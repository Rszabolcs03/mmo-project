const IN_GAME_DAY_MINUTES = 24 * 60;
const DEFAULT_REAL_DAY_MS = 3 * 60 * 60 * 1000;
const DEFAULT_START_MINUTE = 8 * 60;
const VALID_PHASES = ['dawn', 'day', 'evening', 'night'];

const PHASE_RANGES = {
  dawn: { start: 6 * 60, end: 8 * 60 },
  day: { start: 8 * 60, end: 18 * 60 },
  evening: { start: 18 * 60, end: 21 * 60 },
  night: { start: 21 * 60, end: 6 * 60 },
};

const PHASE_DISPLAY_MINUTES = {
  dawn: 6 * 60,
  day: 12 * 60,
  evening: 18 * 60 + 30,
  night: 22 * 60,
};

const LIGHTING_PROFILES = {
  day: {
    overlayColor: [255, 246, 214],
    overlayAlpha: 0.015,
    accentColor: [255, 255, 255],
    accentAlpha: 0,
    brightnessMultiplier: 1,
    saturationMultiplier: 1,
    fogIntensity: 0,
  },
  dawn: {
    overlayColor: [122, 162, 212],
    overlayAlpha: 0.13,
    accentColor: [232, 218, 192],
    accentAlpha: 0.035,
    brightnessMultiplier: 0.99,
    saturationMultiplier: 0.9,
    fogIntensity: 0.16,
  },
  evening: {
    overlayColor: [255, 139, 62],
    overlayAlpha: 0.13,
    accentColor: [126, 72, 154],
    accentAlpha: 0.06,
    brightnessMultiplier: 0.93,
    saturationMultiplier: 1.06,
    fogIntensity: 0.025,
  },
  night: {
    overlayColor: [4, 12, 40],
    overlayAlpha: 0.38,
    accentColor: [42, 72, 140],
    accentAlpha: 0.05,
    brightnessMultiplier: 1,
    saturationMultiplier: 1,
    fogIntensity: 0,
  },
};

const LIGHTING_KEYFRAMES = [
  { minute: 0, phase: 'night' },
  { minute: 5 * 60 + 30, phase: 'night' },
  { minute: 6 * 60, phase: 'dawn' },
  { minute: 7 * 60 + 15, phase: 'dawn' },
  { minute: 8 * 60, phase: 'day' },
  { minute: 17 * 60, phase: 'day' },
  { minute: 18 * 60, phase: 'evening' },
  { minute: 19 * 60 + 30, phase: 'evening' },
  { minute: 21 * 60, phase: 'night' },
  { minute: IN_GAME_DAY_MINUTES, phase: 'night' },
];

const state = {
  forcedPhase: null,
  speedMultiplier: 1,
  anchorRealMs: getNowMs(),
  anchorGameMinutes: DEFAULT_START_MINUTE,
};

function getNowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return 0;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function smoothStep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function normalizeMinute(value) {
  const minute = Number(value);
  if (!Number.isFinite(minute)) return 0;
  return ((minute % IN_GAME_DAY_MINUTES) + IN_GAME_DAY_MINUTES) % IN_GAME_DAY_MINUTES;
}

function isValidPhase(phase) {
  return VALID_PHASES.includes(String(phase ?? '').toLowerCase());
}

function normalizePhase(phase) {
  const normalized = String(phase ?? '').toLowerCase();
  return isValidPhase(normalized) ? normalized : null;
}

function phaseForMinute(minuteInput) {
  const minute = normalizeMinute(minuteInput);
  if (minute >= PHASE_RANGES.dawn.start && minute < PHASE_RANGES.dawn.end) return 'dawn';
  if (minute >= PHASE_RANGES.day.start && minute < PHASE_RANGES.day.end) return 'day';
  if (minute >= PHASE_RANGES.evening.start && minute < PHASE_RANGES.evening.end) return 'evening';
  return 'night';
}

function getAutoGameMinutes() {
  const elapsedMs = Math.max(0, getNowMs() - state.anchorRealMs);
  return state.anchorGameMinutes + (elapsedMs / DEFAULT_REAL_DAY_MS) * IN_GAME_DAY_MINUTES * state.speedMultiplier;
}

function formatWorldClock(minuteInput) {
  const minuteOfDay = normalizeMinute(minuteInput);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = Math.floor(minuteOfDay % 60);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getWorldTime() {
  const autoTotalMinutes = getAutoGameMinutes();
  const forcedPhase = normalizePhase(state.forcedPhase);
  const totalMinutes = forcedPhase ? PHASE_DISPLAY_MINUTES[forcedPhase] : autoTotalMinutes;
  const minuteOfDay = normalizeMinute(totalMinutes);
  const autoMinuteOfDay = normalizeMinute(autoTotalMinutes);

  return {
    totalMinutes,
    minuteOfDay,
    hour: Math.floor(minuteOfDay / 60),
    minute: Math.floor(minuteOfDay % 60),
    formatted: formatWorldClock(minuteOfDay),
    day: Math.floor(autoTotalMinutes / IN_GAME_DAY_MINUTES) + 1,
    progress: minuteOfDay / IN_GAME_DAY_MINUTES,
    auto: !forcedPhase,
    forcedPhase,
    autoMinuteOfDay,
    autoFormatted: formatWorldClock(autoMinuteOfDay),
    autoPhase: phaseForMinute(autoMinuteOfDay),
  };
}

function getTimePhase(time = getWorldTime()) {
  const forcedPhase = normalizePhase(state.forcedPhase);
  if (forcedPhase) return forcedPhase;
  if (typeof time === 'number') return phaseForMinute(time);
  return phaseForMinute(time?.minuteOfDay ?? 0);
}

function mixNumber(a, b, amount) {
  return a + (b - a) * amount;
}

function mixChannels(a, b, amount) {
  return a.map((value, index) => mixNumber(value, b[index] ?? value, amount));
}

function lightingStateFromProfile(phase, profile, isForced, transition) {
  const overlayColor = [...profile.overlayColor];
  const overlayAlpha = profile.overlayAlpha;
  const accentColor = [...profile.accentColor];
  const accentAlpha = profile.accentAlpha;
  const brightnessMultiplier = profile.brightnessMultiplier;
  const saturationMultiplier = profile.saturationMultiplier;

  return {
    phase,
    overlayColor,
    overlayAlpha,
    accentColor,
    accentAlpha,
    overlay: [...overlayColor, overlayAlpha],
    accent: [...accentColor, accentAlpha],
    brightness: brightnessMultiplier,
    brightnessMultiplier,
    saturation: saturationMultiplier,
    saturationMultiplier,
    fogIntensity: profile.fogIntensity,
    isForced,
    transition,
  };
}

function mixLightingProfiles(from, to, amount) {
  return {
    overlayColor: mixChannels(from.overlayColor, to.overlayColor, amount),
    overlayAlpha: mixNumber(from.overlayAlpha, to.overlayAlpha, amount),
    accentColor: mixChannels(from.accentColor, to.accentColor, amount),
    accentAlpha: mixNumber(from.accentAlpha, to.accentAlpha, amount),
    brightnessMultiplier: mixNumber(from.brightnessMultiplier, to.brightnessMultiplier, amount),
    saturationMultiplier: mixNumber(from.saturationMultiplier, to.saturationMultiplier, amount),
    fogIntensity: mixNumber(from.fogIntensity, to.fogIntensity, amount),
  };
}

function lightingForProfile(phase) {
  const normalized = normalizePhase(phase) ?? 'day';
  const profile = LIGHTING_PROFILES[normalized];
  return lightingStateFromProfile(
    normalized,
    profile,
    Boolean(state.forcedPhase),
    {
      from: normalized,
      to: normalized,
      amount: 0,
    },
  );
}

function getSmoothedLighting(minuteOfDay) {
  const minute = normalizeMinute(minuteOfDay);
  let previous = LIGHTING_KEYFRAMES[0];
  let next = LIGHTING_KEYFRAMES[LIGHTING_KEYFRAMES.length - 1];

  for (let index = 0; index < LIGHTING_KEYFRAMES.length - 1; index += 1) {
    const candidate = LIGHTING_KEYFRAMES[index];
    const following = LIGHTING_KEYFRAMES[index + 1];
    if (minute >= candidate.minute && minute <= following.minute) {
      previous = candidate;
      next = following;
      break;
    }
  }

  const span = Math.max(1, next.minute - previous.minute);
  const amount = smoothStep((minute - previous.minute) / span);
  const profile = mixLightingProfiles(
    LIGHTING_PROFILES[previous.phase],
    LIGHTING_PROFILES[next.phase],
    amount,
  );

  return lightingStateFromProfile(
    phaseForMinute(minute),
    profile,
    false,
    {
      from: previous.phase,
      to: next.phase,
      amount,
    },
  );
}

function getLightingForPhase(phase = null) {
  const explicitPhase = normalizePhase(phase);
  if (explicitPhase) return lightingForProfile(explicitPhase);

  const worldTime = getWorldTime();
  const forcedPhase = normalizePhase(state.forcedPhase);
  const lighting = forcedPhase
    ? lightingForProfile(forcedPhase)
    : getSmoothedLighting(worldTime.minuteOfDay);

  return {
    ...lighting,
    time: worldTime,
  };
}

function isNightTime() {
  return getTimePhase() === 'night';
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(normalized);
}

function getLightProps(light) {
  if (!light) return {};
  if (light.props && typeof light.props === 'object') return light.props;
  if (Array.isArray(light.properties)) {
    return Object.fromEntries(light.properties.map((property) => [property.name, property.value]));
  }
  return light;
}

function parsePhaseOrTime(value, fallbackMinute = null, phaseBoundary = 'start') {
  const normalizedPhase = normalizePhase(value);
  if (normalizedPhase) {
    return phaseBoundary === 'end'
      ? PHASE_RANGES[normalizedPhase].end
      : PHASE_RANGES[normalizedPhase].start;
  }

  const match = String(value ?? '').trim().match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return fallbackMinute;

  const hour = Math.max(0, Math.min(23, Number.parseInt(match[1], 10)));
  const minute = Math.max(0, Math.min(59, Number.parseInt(match[2] ?? '0', 10)));
  return hour * 60 + minute;
}

function isMinuteInRange(minuteInput, startInput, endInput) {
  const minute = normalizeMinute(minuteInput);
  const start = normalizeMinute(startInput);
  const end = normalizeMinute(endInput);
  if (start === end) return true;
  if (start < end) return minute >= start && minute < end;
  return minute >= start || minute < end;
}

function getPhaseProgress(phaseInput, minuteInput) {
  const phase = normalizePhase(phaseInput);
  if (!phase) return 0;
  const range = PHASE_RANGES[phase];
  const start = normalizeMinute(range.start);
  const end = normalizeMinute(range.end);
  const minute = normalizeMinute(minuteInput);
  const duration = start < end ? end - start : IN_GAME_DAY_MINUTES - start + end;
  const elapsed = minute >= start ? minute - start : IN_GAME_DAY_MINUTES - start + minute;
  return clamp01(elapsed / Math.max(1, duration));
}

function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function isStreetLampLight(light, props) {
  const label = `${props.type ?? ''} ${light?.type ?? ''} ${light?.name ?? ''}`.toLowerCase();
  return label.includes('street_lamp') || label.includes('street-lamp') || label.includes('street lamp');
}

function getLampLightState(light = null) {
  const props = getLightProps(light);
  const worldTime = getWorldTime();
  const phase = getTimePhase(worldTime);
  const alwaysOn = parseBoolean(props.alwaysOn);
  const activeFrom = props.activeFrom ?? props.active_from ?? null;
  const activeTo = props.activeTo ?? props.active_to ?? null;
  const hasSchedule = activeFrom != null || activeTo != null;
  const isStreetLamp = isStreetLampLight(light, props);

  let scheduleActive = alwaysOn;
  if (!alwaysOn && hasSchedule) {
    const start = parsePhaseOrTime(activeFrom, PHASE_RANGES.evening.start);
    const end = parsePhaseOrTime(activeTo, PHASE_RANGES.dawn.end, 'end');
    scheduleActive = isMinuteInRange(worldTime.minuteOfDay, start, end);
  } else if (!alwaysOn) {
    scheduleActive = phase === 'night' || phase === 'evening' || (isStreetLamp && phase === 'dawn');
  }

  let phaseFactor = scheduleActive ? 1 : 0;
  if (scheduleActive && isStreetLamp) {
    if (phase === 'evening') {
      phaseFactor = 0.35 + getPhaseProgress('evening', worldTime.minuteOfDay) * 0.65;
    } else if (phase === 'dawn') {
      phaseFactor = Math.max(0.22, 1 - getPhaseProgress('dawn', worldTime.minuteOfDay) * 0.78);
    } else if (phase === 'day' && !alwaysOn) {
      phaseFactor = 0;
    }
  }

  const baseIntensity = clamp01(numberOr(props.intensity, isStreetLamp ? 0.82 : 1));
  const intensity = clamp01(baseIntensity * phaseFactor);

  return {
    active: intensity > 0.04,
    intensity,
    phase,
    time: worldTime.formatted,
    color: props.color ?? (isStreetLamp ? '#ffd37a' : '#ffffff'),
    radius: numberOr(props.radius, isStreetLamp ? 128 : 96),
    mode: state.forcedPhase ? 'forced' : 'auto',
    isStreetLamp,
    scheduleActive,
  };
}

function isLampActive(light = null) {
  return getLampLightState(light).active;
}

function setForcedPhase(phase) {
  const normalized = normalizePhase(phase);
  if (!normalized) {
    throw new Error(`Invalid day/night phase: ${phase}`);
  }
  state.forcedPhase = normalized;
  return getDayNightDebugState();
}

function clearForcedPhase() {
  state.forcedPhase = null;
  return getDayNightDebugState();
}

function setTimeSpeed(multiplier) {
  const nextMultiplier = Math.max(0, Number(multiplier));
  if (!Number.isFinite(nextMultiplier)) {
    throw new Error(`Invalid day/night speed: ${multiplier}`);
  }

  state.anchorGameMinutes = getAutoGameMinutes();
  state.anchorRealMs = getNowMs();
  state.speedMultiplier = nextMultiplier;
  return getDayNightDebugState();
}

function getDayNightDebugState() {
  const worldTime = getWorldTime();
  const phase = getTimePhase(worldTime);
  const lighting = getLightingForPhase();

  return {
    mode: state.forcedPhase ? 'forced' : 'auto',
    forcedPhase: state.forcedPhase,
    phase,
    time: worldTime.formatted,
    hour: worldTime.hour,
    minute: worldTime.minute,
    day: worldTime.day,
    speedMultiplier: state.speedMultiplier,
    cycleRealHours: DEFAULT_REAL_DAY_MS / (60 * 60 * 1000),
    autoTime: worldTime.autoFormatted,
    autoPhase: worldTime.autoPhase,
    isNight: phase === 'night',
    lampDefaultActive: isLampActive(),
    lampDefaultIntensity: getLampLightState().intensity,
    lighting: {
      overlay: [...lighting.overlay],
      accent: [...lighting.accent],
      brightness: lighting.brightness,
      brightnessMultiplier: lighting.brightnessMultiplier,
      saturationMultiplier: lighting.saturationMultiplier,
      fogIntensity: lighting.fogIntensity,
      overlayColor: [...lighting.overlayColor],
      overlayAlpha: lighting.overlayAlpha,
      accentColor: [...lighting.accentColor],
      accentAlpha: lighting.accentAlpha,
      transition: lighting.transition,
    },
  };
}

export {
  getWorldTime,
  getTimePhase,
  getLightingForPhase,
  isNightTime,
  isLampActive,
  getLampLightState,
  setForcedPhase,
  clearForcedPhase,
  setTimeSpeed,
  getDayNightDebugState,
};
