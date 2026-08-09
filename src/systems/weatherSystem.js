const IN_GAME_DAY_MINUTES = 24 * 60;
const DEFAULT_REAL_DAY_MS = 3 * 60 * 60 * 1000;
const VALID_WEATHER = ['clear', 'cloudy', 'rain', 'storm'];

const WEATHER_PROFILES = {
  clear: {
    overlayColor: [255, 255, 255],
    overlayAlpha: 0,
    accentColor: [255, 255, 255],
    accentAlpha: 0,
    brightnessMultiplier: 1,
    saturationMultiplier: 1,
    fogIntensity: 0,
    cloudCover: 0,
    rainIntensity: 0,
    stormIntensity: 0,
    windIntensity: 0.08,
  },
  cloudy: {
    overlayColor: [84, 101, 112],
    overlayAlpha: 0.08,
    accentColor: [174, 192, 206],
    accentAlpha: 0.035,
    brightnessMultiplier: 0.94,
    saturationMultiplier: 0.9,
    fogIntensity: 0.06,
    cloudCover: 0.62,
    rainIntensity: 0,
    stormIntensity: 0,
    windIntensity: 0.18,
  },
  rain: {
    overlayColor: [58, 78, 96],
    overlayAlpha: 0.13,
    accentColor: [118, 155, 186],
    accentAlpha: 0.05,
    brightnessMultiplier: 0.88,
    saturationMultiplier: 0.84,
    fogIntensity: 0.12,
    cloudCover: 0.82,
    rainIntensity: 0.68,
    stormIntensity: 0,
    windIntensity: 0.38,
  },
  storm: {
    overlayColor: [20, 31, 52],
    overlayAlpha: 0.2,
    accentColor: [78, 102, 152],
    accentAlpha: 0.08,
    brightnessMultiplier: 0.78,
    saturationMultiplier: 0.78,
    fogIntensity: 0.16,
    cloudCover: 0.94,
    rainIntensity: 1,
    stormIntensity: 0.9,
    windIntensity: 0.72,
  },
};

const WEATHER_DURATION_RANGES = {
  clear: [8 * 60, 20 * 60],
  cloudy: [60, 4 * 60],
  rain: [60, 3 * 60],
  storm: [20, 60],
};

const WEATHER_TRANSITIONS = {
  clear: [
    { weather: 'clear', weight: 65 },
    { weather: 'cloudy', weight: 35 },
  ],
  cloudy: [
    { weather: 'clear', weight: 45 },
    { weather: 'rain', weight: 40 },
    { weather: 'storm', weight: 15 },
  ],
  rain: [
    { weather: 'cloudy', weight: 60 },
    { weather: 'storm', weight: 15 },
    { weather: 'rain', weight: 25 },
  ],
  storm: [
    { weather: 'rain', weight: 70 },
    { weather: 'cloudy', weight: 30 },
  ],
};

const WEATHER_TRANSITION_MINUTES = {
  clear: {
    cloudy: 24,
  },
  cloudy: {
    clear: 24,
    rain: 14,
    storm: 10,
  },
  rain: {
    cloudy: 18,
    storm: 8,
  },
  storm: {
    rain: 8,
    cloudy: 16,
  },
};

const state = {
  forcedWeather: null,
  speedMultiplier: 1,
  anchorRealMs: getNowMs(),
  anchorWeatherMinutes: 0,
  currentWeather: 'clear',
  stateStartedAt: 0,
  stateDuration: 10 * 60,
  transitionFrom: null,
  transitionTo: null,
  transitionStartedAt: 0,
  transitionDuration: 0,
  seed: 0x74a3f12,
};

state.stateDuration = rollWeatherDuration(state.currentWeather);

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

function random() {
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
  return state.seed / 0x100000000;
}

function randomRange(min, max) {
  return min + random() * (max - min);
}

function pseudoRandom(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function normalizeWeather(weather) {
  const normalized = String(weather ?? '').toLowerCase();
  return VALID_WEATHER.includes(normalized) ? normalized : null;
}

function getAutoWeatherMinutes() {
  const elapsedMs = Math.max(0, getNowMs() - state.anchorRealMs);
  return state.anchorWeatherMinutes + (elapsedMs / DEFAULT_REAL_DAY_MS) * IN_GAME_DAY_MINUTES * state.speedMultiplier;
}

function rollWeatherDuration(weather) {
  const [minMinutes, maxMinutes] = WEATHER_DURATION_RANGES[weather] ?? WEATHER_DURATION_RANGES.clear;
  return randomRange(minMinutes, maxMinutes);
}

function pickWeightedWeather(options) {
  const totalWeight = options.reduce((total, option) => total + Math.max(0, Number(option.weight) || 0), 0);
  let roll = random() * Math.max(1, totalWeight);
  for (const option of options) {
    roll -= Math.max(0, Number(option.weight) || 0);
    if (roll <= 0) return normalizeWeather(option.weather) ?? 'clear';
  }
  return normalizeWeather(options[options.length - 1]?.weather) ?? 'clear';
}

function chooseNextWeather(weather) {
  return pickWeightedWeather(WEATHER_TRANSITIONS[weather] ?? WEATHER_TRANSITIONS.clear);
}

function getTransitionDuration(from, to) {
  if (from === to) return 0;
  return WEATHER_TRANSITION_MINUTES[from]?.[to] ?? 16;
}

function finishTransition() {
  state.currentWeather = state.transitionTo ?? state.currentWeather;
  state.stateStartedAt = state.transitionStartedAt + state.transitionDuration;
  state.stateDuration = rollWeatherDuration(state.currentWeather);
  state.transitionFrom = null;
  state.transitionTo = null;
  state.transitionStartedAt = 0;
  state.transitionDuration = 0;
}

function advanceAutoWeather() {
  const nowMinutes = getAutoWeatherMinutes();
  let guard = 0;
  while (guard < 32) {
    guard += 1;

    if (state.transitionTo) {
      if (nowMinutes >= state.transitionStartedAt + state.transitionDuration) {
        finishTransition();
        continue;
      }
      break;
    }

    if (nowMinutes < state.stateStartedAt + state.stateDuration) break;

    const nextWeather = chooseNextWeather(state.currentWeather);
    if (nextWeather === state.currentWeather) {
      state.stateStartedAt += state.stateDuration;
      state.stateDuration = rollWeatherDuration(state.currentWeather);
      continue;
    }

    state.transitionFrom = state.currentWeather;
    state.transitionTo = nextWeather;
    state.transitionStartedAt = state.stateStartedAt + state.stateDuration;
    state.transitionDuration = getTransitionDuration(state.currentWeather, nextWeather);
  }
}

function mixNumber(a, b, amount) {
  return a + (b - a) * amount;
}

function mixChannels(a, b, amount) {
  return a.map((value, index) => mixNumber(value, b[index] ?? value, amount));
}

function mixWeatherProfiles(from, to, amount) {
  return {
    overlayColor: mixChannels(from.overlayColor, to.overlayColor, amount),
    overlayAlpha: mixNumber(from.overlayAlpha, to.overlayAlpha, amount),
    accentColor: mixChannels(from.accentColor, to.accentColor, amount),
    accentAlpha: mixNumber(from.accentAlpha, to.accentAlpha, amount),
    brightnessMultiplier: mixNumber(from.brightnessMultiplier, to.brightnessMultiplier, amount),
    saturationMultiplier: mixNumber(from.saturationMultiplier, to.saturationMultiplier, amount),
    fogIntensity: mixNumber(from.fogIntensity, to.fogIntensity, amount),
    cloudCover: mixNumber(from.cloudCover, to.cloudCover, amount),
    rainIntensity: mixNumber(from.rainIntensity, to.rainIntensity, amount),
    stormIntensity: mixNumber(from.stormIntensity, to.stormIntensity, amount),
    windIntensity: mixNumber(from.windIntensity, to.windIntensity, amount),
  };
}

function profileForWeather(weather) {
  return WEATHER_PROFILES[normalizeWeather(weather) ?? 'clear'];
}

function getWeatherState() {
  advanceAutoWeather();
  const forcedWeather = normalizeWeather(state.forcedWeather);
  const nowMinutes = getAutoWeatherMinutes();

  if (forcedWeather) {
    return {
      mode: 'forced',
      forcedWeather,
      phase: forcedWeather,
      currentWeather: forcedWeather,
      targetWeather: forcedWeather,
      speedMultiplier: state.speedMultiplier,
      elapsedMinutes: 0,
      remainingMinutes: 0,
      transition: {
        from: forcedWeather,
        to: forcedWeather,
        amount: 0,
        durationMinutes: 0,
        elapsedMinutes: 0,
      },
    };
  }

  const inTransition = Boolean(state.transitionTo);
  const transitionElapsed = inTransition ? Math.max(0, nowMinutes - state.transitionStartedAt) : 0;
  const transitionAmount = inTransition
    ? smoothStep(transitionElapsed / Math.max(1, state.transitionDuration))
    : 0;
  const elapsedMinutes = inTransition
    ? transitionElapsed
    : Math.max(0, nowMinutes - state.stateStartedAt);
  const remainingMinutes = inTransition
    ? Math.max(0, state.transitionStartedAt + state.transitionDuration - nowMinutes)
    : Math.max(0, state.stateStartedAt + state.stateDuration - nowMinutes);

  return {
    mode: 'auto',
    forcedWeather: null,
    phase: inTransition && transitionAmount > 0.5 ? state.transitionTo : state.currentWeather,
    currentWeather: state.currentWeather,
    targetWeather: state.transitionTo ?? state.currentWeather,
    speedMultiplier: state.speedMultiplier,
    elapsedMinutes,
    remainingMinutes,
    transition: {
      from: state.transitionFrom ?? state.currentWeather,
      to: state.transitionTo ?? state.currentWeather,
      amount: transitionAmount,
      durationMinutes: state.transitionDuration,
      elapsedMinutes: transitionElapsed,
    },
  };
}

function getWeatherPhase() {
  return getWeatherState().phase;
}

function getWeatherLightingModifier(weatherState = getWeatherState()) {
  const fromWeather = weatherState.transition?.from ?? weatherState.currentWeather;
  const toWeather = weatherState.transition?.to ?? weatherState.targetWeather;
  const amount = weatherState.mode === 'forced' ? 0 : weatherState.transition?.amount ?? 0;
  const profile = mixWeatherProfiles(profileForWeather(fromWeather), profileForWeather(toWeather), amount);

  return {
    phase: weatherState.phase,
    currentWeather: weatherState.currentWeather,
    targetWeather: weatherState.targetWeather,
    mode: weatherState.mode,
    overlayColor: [...profile.overlayColor],
    overlayAlpha: profile.overlayAlpha,
    accentColor: [...profile.accentColor],
    accentAlpha: profile.accentAlpha,
    overlay: [...profile.overlayColor, profile.overlayAlpha],
    accent: [...profile.accentColor, profile.accentAlpha],
    brightnessMultiplier: profile.brightnessMultiplier,
    saturationMultiplier: profile.saturationMultiplier,
    fogIntensity: profile.fogIntensity,
    cloudCover: profile.cloudCover,
    rainIntensity: profile.rainIntensity,
    stormIntensity: profile.stormIntensity,
    windIntensity: profile.windIntensity,
    transition: weatherState.transition,
  };
}

function getPrecipitationState(weatherState = getWeatherState()) {
  const modifier = getWeatherLightingModifier(weatherState);
  const nowMs = getNowMs();
  const stormIntensity = clamp01(modifier.stormIntensity);
  const lightningSlot = Math.floor(nowMs / 4800);
  const lightningChance = pseudoRandom(lightningSlot + 91);
  const lightningOffset = pseudoRandom(lightningSlot + 193) * 3200;
  const lightningElapsed = (nowMs + lightningOffset) % 4800;
  const lightningFlash = stormIntensity > 0.05 && lightningChance > 0.42 && lightningElapsed < 150
    ? (1 - lightningElapsed / 150) * stormIntensity
    : 0;

  return {
    active: modifier.rainIntensity > 0.04 || modifier.cloudCover > 0.04 || lightningFlash > 0,
    phase: modifier.phase,
    cloudCover: clamp01(modifier.cloudCover),
    rainIntensity: clamp01(modifier.rainIntensity),
    stormIntensity,
    windIntensity: clamp01(modifier.windIntensity),
    lightningFlash: clamp01(lightningFlash),
  };
}

function setForcedWeather(weather) {
  const normalized = normalizeWeather(weather);
  if (!normalized) {
    throw new Error(`Invalid weather: ${weather}`);
  }
  advanceAutoWeather();
  state.forcedWeather = normalized;
  return getWeatherDebugState();
}

function clearForcedWeather() {
  state.forcedWeather = null;
  advanceAutoWeather();
  return getWeatherDebugState();
}

function setWeatherSpeed(multiplier) {
  const nextMultiplier = Math.max(0, Number(multiplier));
  if (!Number.isFinite(nextMultiplier)) {
    throw new Error(`Invalid weather speed: ${multiplier}`);
  }

  state.anchorWeatherMinutes = getAutoWeatherMinutes();
  state.anchorRealMs = getNowMs();
  state.speedMultiplier = nextMultiplier;
  return getWeatherDebugState();
}

function formatMinutes(minutes) {
  const rounded = Math.max(0, Math.round(Number(minutes) || 0));
  if (rounded >= 60) {
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${rounded}m`;
}

function getWeatherDebugState() {
  const weather = getWeatherState();
  const lighting = getWeatherLightingModifier(weather);
  const precipitation = getPrecipitationState(weather);
  return {
    ...weather,
    transitionLabel: weather.transition?.from === weather.transition?.to
      ? weather.phase
      : `${weather.transition.from} -> ${weather.transition.to}`,
    remainingLabel: formatMinutes(weather.remainingMinutes),
    lighting: {
      overlay: [...lighting.overlay],
      accent: [...lighting.accent],
      brightnessMultiplier: lighting.brightnessMultiplier,
      saturationMultiplier: lighting.saturationMultiplier,
      fogIntensity: lighting.fogIntensity,
      cloudCover: lighting.cloudCover,
      rainIntensity: lighting.rainIntensity,
      stormIntensity: lighting.stormIntensity,
      windIntensity: lighting.windIntensity,
    },
    precipitation,
  };
}

export {
  getWeatherState,
  getWeatherPhase,
  getWeatherLightingModifier,
  getPrecipitationState,
  setForcedWeather,
  clearForcedWeather,
  setWeatherSpeed,
  getWeatherDebugState,
};
