import React from 'react';
import {
  APPEARANCE_CHOICES,
  CLASSES,
  CUSTOMIZATION,
  HUMAN_CUSTOMIZATION,
  FRESH_RACE_CUSTOMIZATION,
  HUMAN_CLASS_APPEARANCE_CHOICES,
  HUMAN_FACE_STYLE_CHOICES,
  FRESH_RACE_FACE_STYLE_CHOICES,
  HUMAN_HAIR_STYLE_CHOICES,
  FRESH_RACE_HAIR_STYLE_CHOICES,
  FRESH_RACE_HERITAGE_STYLE_CHOICES,
  FRESH_RACE_CLASS_APPEARANCE_CHOICES,
  HUMAN_MAGE_APPEARANCE_CHOICES,
  HUMAN_MAGE_CUSTOMIZATION,
  RACES,
} from '../game/gameData';
import { getDefaultAppearance, getMergedDefaultAppearance, isNameTaken } from '../game/worldEntities';
import { CharacterPreview } from '../rendering/canvasRendering';

export { CharacterMenu };

const DEFAULT_RACE_ID = 'human';
const DEFAULT_CLASS_ID = 'mage';
const CREATION_STEPS = [
  { id: 'identity', label: 'Origin', hint: 'Race & class' },
  { id: 'customize', label: 'Appearance', hint: 'Style & colors' },
  { id: 'name', label: 'Identity', hint: 'Choose a name' },
];

const COLOR_CUSTOMIZATION = {
  skin: {
    label: 'Skin tone',
    names: ['Warm', 'Bronze', 'Fair', 'Verdant', 'Ashen'],
  },
  hair: {
    label: 'Hair color',
    names: ['Chestnut', 'Sunlit', 'Raven', 'Arcane', 'Silver'],
  },
  robe: {
    label: 'Outfit color',
    names: ['Royal', 'Forest', 'Sun', 'Crimson', 'Ivory'],
  },
  trim: {
    label: 'Accent color',
    names: ['Frost', 'Silver', 'Gold', 'Steel', 'Arcane'],
  },
};

const HUMAN_MAGE_COLOR_CUSTOMIZATION = {
  skin: {
    label: 'Skin tone',
    names: ['Warm', 'Bronze', 'Fair', 'Sienna', 'Umber', 'Rose', 'Copper', 'Porcelain'],
  },
  eyes: {
    label: 'Eye color',
    names: ['Brown', 'Onyx', 'Sapphire', 'Emerald', 'Amethyst', 'Amber'],
  },
  hair: {
    label: 'Hair color',
    names: ['Chestnut', 'Sunlit', 'Raven', 'Copper', 'Crimson', 'Arcane', 'Slate', 'Silver'],
  },
  hat: {
    label: 'Hat color',
    names: ['Royal', 'Azure', 'Indigo', 'Teal', 'Forest', 'Violet', 'Crimson', 'Charcoal'],
  },
  robe: {
    label: 'Robe color',
    names: ['Royal', 'Azure', 'Indigo', 'Teal', 'Forest', 'Violet', 'Crimson', 'Ochre'],
  },
  trim: {
    label: 'Robe trim',
    names: ['Frost', 'Ivory', 'Gold', 'Sky', 'Mint', 'Arcane', 'Rose', 'Ember'],
  },
  staff: {
    label: 'Staff wood',
    names: ['Oak', 'Walnut', 'Copperwood', 'Ashwood', 'Ironwood', 'Duskwood'],
  },
  crystal: {
    label: 'Crystal',
    names: ['Frost', 'Sapphire', 'Emerald', 'Sunstone', 'Amethyst', 'Rose', 'Ruby', 'Moonlight'],
  },
};

const HUMAN_COLOR_CUSTOMIZATION = {
  ...COLOR_CUSTOMIZATION,
  skin: {
    label: 'Skin tone',
    names: ['Warm', 'Bronze', 'Fair', 'Sienna', 'Umber', 'Rose', 'Copper', 'Porcelain'],
  },
  eyes: {
    label: 'Eye color',
    names: ['Brown', 'Onyx', 'Sapphire', 'Emerald', 'Amethyst', 'Amber'],
  },
  hair: {
    label: 'Hair color',
    names: ['Chestnut', 'Sunlit', 'Raven', 'Copper', 'Crimson', 'Arcane', 'Slate', 'Silver'],
  },
  robe: {
    label: 'Outfit color',
    names: ['Royal', 'Forest', 'Sun', 'Crimson', 'Ivory', 'Midnight'],
  },
  weaponColor: {
    label: 'Weapon finish',
    names: ['Steel', 'Gilded', 'Frost', 'Crimson', 'Arcane', 'Blackiron'],
  },
};

const RACE_COLOR_CUSTOMIZATION = {
  elf: {
    skin: { label: 'Elven complexion', names: ['Moonwarm', 'Sunlit', 'Gilded', 'Dawn Pale', 'Woodland', 'Starlight'] },
    eyes: { label: 'Elven eyes', names: ['Sapphire', 'Emerald', 'Amethyst', 'Teal', 'Amber', 'Silver'] },
    hair: { label: 'Elven hair', names: ['Sun Gold', 'Pale Gold', 'Chestnut', 'Copper', 'Raven', 'Silver', 'Arcane', 'Moss'] },
    robe: { label: 'Elven weave', names: ['Verdant', 'Tideglass', 'Moonviolet', 'Bronzeleaf', 'Moonwhite', 'Gloam'] },
    trim: { label: 'Elven accent', names: ['Moonmint', 'Silver', 'Sun Gold', 'Sky', 'Amethyst', 'Slate'] },
    weaponColor: { label: 'Elven weapon finish', names: ['Moonsteel', 'Sun Gold', 'Verdant Glass', 'Starsteel', 'Silver', 'Gloamsteel'] },
  },
  dwarf: {
    skin: { label: 'Dwarven complexion', names: ['Forge Warm', 'Copper', 'Stone Fair', 'Deep Bronze', 'Ember Pale', 'Earth'] },
    eyes: { label: 'Dwarven eyes', names: ['Brown', 'Emerald', 'Sapphire', 'Amber', 'Slate', 'Coal'] },
    hair: { label: 'Dwarven hair', names: ['Auburn', 'Copper', 'Dark Red', 'Coal', 'Gold', 'Iron', 'Silver', 'Ember'] },
    robe: { label: 'Clan colors', names: ['Ember', 'Bronze', 'Steel', 'Blackiron', 'Deep Green', 'Royal'] },
    trim: { label: 'Forge accent', names: ['Brass', 'Silver', 'Ember', 'Steel', 'Gold', 'Old Gold'] },
    weaponColor: { label: 'Forged finish', names: ['Iron', 'Brass', 'Copper', 'Steel', 'Silver', 'Blackiron'] },
  },
  orc: {
    skin: { label: 'Orc skin', names: ['Moss', 'Forest', 'Fern', 'Deep Green', 'Olive', 'Ash Green'] },
    eyes: { label: 'Orc eyes', names: ['Amber', 'Gold', 'Blood', 'Coal', 'Frost', 'Spirit'] },
    hair: { label: 'Orc mane', names: ['Black', 'Iron', 'Brown', 'Auburn', 'Ash', 'White'] },
    robe: { label: 'Clan hide', names: ['Moss', 'Blood', 'Leather', 'Iron', 'Lichen', 'Dark Hide'] },
    trim: { label: 'War accent', names: ['Brass', 'Bone', 'Ember', 'Venom', 'Blood', 'Stone'] },
    weaponColor: { label: 'Orc weapon finish', names: ['Iron', 'Copper', 'Bone', 'Bloodiron', 'Bog Iron', 'Blackiron'] },
  },
  undead: {
    skin: { label: 'Undead complexion', names: ['Pallid', 'Grave', 'Bone Pale', 'Moldered', 'Worn', 'Crypt'] },
    eyes: { label: 'Undying glow', names: ['Frost', 'Void', 'Plague', 'Soulfire', 'Blood', 'Pale'] },
    hair: { label: 'Faded hair', names: ['White', 'Ash', 'Slate', 'Black', 'Mauve', 'Bone'] },
    robe: { label: 'Gravecloth', names: ['Charcoal', 'Void', 'Slate', 'Plague', 'Mauve', 'Night'] },
    trim: { label: 'Crypt accent', names: ['Spirit', 'Amethyst', 'Steel', 'Bone', 'Frost', 'Plague'] },
    weaponColor: { label: 'Relic finish', names: ['Grave Iron', 'Rust', 'Voidglass', 'Steel', 'Plague', 'Blackbone'] },
  },
};

function getFreshClassChoices(raceId, classId) {
  return FRESH_RACE_CLASS_APPEARANCE_CHOICES[raceId]?.[classId]
    ?? FRESH_RACE_CLASS_APPEARANCE_CHOICES.human?.[classId]
    ?? (classId === 'mage' ? HUMAN_MAGE_APPEARANCE_CHOICES : HUMAN_CLASS_APPEARANCE_CHOICES[classId]);
}

const APPEARANCE_LABELS = {
  gender: 'Body type',
  faceVariant: 'Face',
  heritageStyle: 'Heritage detail',
  hairStyle: 'Hair design',
  hatVariant: 'Hat design',
  beard: 'Facial hair',
  outfitVariant: 'Outfit design',
  weaponVariant: 'Weapon design',
  capeStyle: 'Cape',
};

function getAppearanceLabel(key, classId) {
  if (key === 'outfitVariant' && classId === 'mage') return 'Robe design';
  if (key !== 'weaponVariant') return APPEARANCE_LABELS[key] ?? key;
  if (classId === 'mage' || classId === 'priest') return 'Staff design';
  if (classId === 'hunter') return 'Bow design';
  if (classId === 'rogue') return 'Blade design';
  if (classId === 'warrior' || classId === 'paladin') return 'Arms design';
  return APPEARANCE_LABELS[key];
}

function getAppearanceChoiceEntries(raceId, classId, appearance) {
  if (RACES[raceId]?.allowedClasses?.includes(classId) && (classId === 'mage' || HUMAN_CLASS_APPEARANCE_CHOICES[classId])) {
    const classChoices = getFreshClassChoices(raceId, classId);
    const faceChoices = FRESH_RACE_FACE_STYLE_CHOICES[raceId] ?? HUMAN_FACE_STYLE_CHOICES;
    const hairChoices = FRESH_RACE_HAIR_STYLE_CHOICES[raceId] ?? HUMAN_HAIR_STYLE_CHOICES;
    const heritageChoices = FRESH_RACE_HERITAGE_STYLE_CHOICES[raceId] ?? [];
    return [
      ['gender', APPEARANCE_CHOICES.gender],
      [
        'faceVariant',
        faceChoices.filter((option) => option.gender === appearance.gender),
      ],
      ['heritageStyle', heritageChoices],
      [
        'hairStyle',
        hairChoices.filter((option) => option.gender === appearance.gender),
      ],
      ['beard', APPEARANCE_CHOICES.beard],
      ['outfitVariant', classChoices.outfitVariant],
      ['weaponVariant', classChoices.weaponVariant],
      ['capeStyle', APPEARANCE_CHOICES.capeStyle],
    ]
      .filter(Boolean)
      .filter(([key]) => !(key === 'beard' && appearance.gender === 'female'));
  }
  return Object.entries(APPEARANCE_CHOICES)
    .filter(([key]) => !(key === 'beard' && appearance.gender === 'female'));
}

function getColorCustomizationEntries(raceId, classId) {
  const raceValues = FRESH_RACE_CUSTOMIZATION[raceId] ?? HUMAN_CUSTOMIZATION ?? CUSTOMIZATION;
  const values = classId === 'mage'
    ? {
      ...raceValues,
      staff: HUMAN_MAGE_CUSTOMIZATION.staff,
      crystal: HUMAN_MAGE_CUSTOMIZATION.crystal,
    }
    : raceValues;
  const configs = {
    ...(classId === 'mage' ? HUMAN_MAGE_COLOR_CUSTOMIZATION : HUMAN_COLOR_CUSTOMIZATION),
    ...(RACE_COLOR_CUSTOMIZATION[raceId] ?? {}),
  };
  return Object.entries(values)
    .filter(([key]) => key !== 'hat' && !(classId === 'mage' && key === 'weaponColor'))
    .map(([key, colors]) => [key, colors, configs[key] ?? COLOR_CUSTOMIZATION[key] ?? {
      label: key === 'eyes' ? 'Eye color' : key,
      names: colors.map((_, index) => `Option ${index + 1}`),
    }]);
}

function AppearanceCycler({
  pickerId,
  label,
  options,
  value,
  expanded,
  color = false,
  onChange,
  onToggle,
}) {
  const selectedIndex = Math.max(0, options.findIndex((option) => option.id === value));
  const selected = options[selectedIndex] ?? options[0];
  const cycle = (offset) => {
    const nextIndex = (selectedIndex + offset + options.length) % options.length;
    onChange(options[nextIndex].id);
  };

  return (
    <div className={`appearance-cycler ${expanded ? 'expanded' : ''}`}>
      <button
        aria-label={`Previous ${label}`}
        className="appearance-cycle-arrow"
        type="button"
        onClick={() => cycle(-1)}
      >
        <span aria-hidden="true">&lsaquo;</span>
      </button>
      <button
        aria-controls={`${pickerId}-options`}
        aria-expanded={expanded}
        aria-haspopup="listbox"
        className="appearance-cycle-current"
        type="button"
        onClick={onToggle}
      >
        {color && <span className="appearance-current-swatch" style={{ backgroundColor: selected.id }} />}
        <span>
          <strong>{selected.label}</strong>
          <small>{expanded ? 'Hide options' : 'View all options'}</small>
        </span>
      </button>
      <button
        aria-label={`Next ${label}`}
        className="appearance-cycle-arrow"
        type="button"
        onClick={() => cycle(1)}
      >
        <span aria-hidden="true">&rsaquo;</span>
      </button>
      {expanded && (
        <div
          className={`appearance-cycler-options ${color ? 'color-options' : ''}`}
          id={`${pickerId}-options`}
          role="listbox"
          aria-label={`${label} options`}
        >
          {options.map((option) => (
            <button
              aria-selected={option.id === selected.id}
              className={option.id === selected.id ? 'selected' : ''}
              key={option.id}
              role="option"
              type="button"
              onClick={() => {
                onChange(option.id);
                onToggle(false);
              }}
            >
              {color && <span className="appearance-option-swatch" style={{ backgroundColor: option.id }} />}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getAppearanceForOrigin(raceId, classId, current = {}) {
  const defaults = getDefaultAppearance(raceId, classId);
  const next = {
    ...defaults,
    gender: current.gender ?? defaults.gender,
    hairStyle: current.hairStyle ?? defaults.hairStyle,
    faceVariant: current.faceVariant ?? defaults.faceVariant,
    heritageStyle: current.heritageStyle ?? defaults.heritageStyle,
    hatVariant: current.hatVariant ?? defaults.hatVariant,
    beard: current.beard ?? defaults.beard,
    outfitVariant: current.outfitVariant ?? defaults.outfitVariant,
    weaponVariant: current.weaponVariant ?? defaults.weaponVariant,
    capeStyle: current.capeStyle ?? defaults.capeStyle,
    cape: current.capeStyle ?? defaults.capeStyle,
    eyes: current.eyes ?? defaults.eyes,
    hat: current.hat ?? defaults.hat,
    staff: current.staff ?? defaults.staff,
    crystal: current.crystal ?? defaults.crystal,
    weaponColor: current.weaponColor ?? defaults.weaponColor,
  };
  if (RACES[raceId]?.allowedClasses?.includes(classId) && (classId === 'mage' || HUMAN_CLASS_APPEARANCE_CHOICES[classId])) {
    const gender = next.gender === 'female' ? 'female' : 'male';
    const hairOptions = (FRESH_RACE_HAIR_STYLE_CHOICES[raceId] ?? HUMAN_HAIR_STYLE_CHOICES)
      .filter((option) => option.gender === gender);
    const faceOptions = (FRESH_RACE_FACE_STYLE_CHOICES[raceId] ?? HUMAN_FACE_STYLE_CHOICES)
      .filter((option) => option.gender === gender);
    const classChoices = getFreshClassChoices(raceId, classId);
    const heritageOptions = FRESH_RACE_HERITAGE_STYLE_CHOICES[raceId] ?? [];
    if (!faceOptions.some((option) => option.id === next.faceVariant)) {
      next.faceVariant = faceOptions[0].id;
    }
    if (!hairOptions.some((option) => option.id === next.hairStyle)) {
      next.hairStyle = hairOptions[0].id;
    }
    if (!heritageOptions.some((option) => option.id === next.heritageStyle)) {
      next.heritageStyle = defaults.heritageStyle ?? heritageOptions[0]?.id ?? 'none';
    }
    next.hatVariant = 'none';
    if (!classChoices.outfitVariant
      .some((option) => option.id === next.outfitVariant)) {
      next.outfitVariant = classChoices.outfitVariant[0].id;
    }
    if (!classChoices.weaponVariant.some((option) => option.id === next.weaponVariant)) {
      next.weaponVariant = classChoices.weaponVariant[0].id;
    }
    if (gender === 'female') {
      next.beard = 'none';
    }
  }
  return next;
}

function CharacterMenu({
  characters,
  onCreate,
  onDelete,
  onEnter,
  onExitGame,
  onLogout,
  spriteLoadVersion = 0,
}) {
  const [mode, setMode] = React.useState(characters.length > 0 ? 'list' : 'create');
  const [creationStep, setCreationStep] = React.useState('identity');
  const [selectedCharacterId, setSelectedCharacterId] = React.useState(characters[0]?.id ?? null);
  const [name, setName] = React.useState('');
  const [raceId, setRaceId] = React.useState(DEFAULT_RACE_ID);
  const [classId, setClassId] = React.useState(DEFAULT_CLASS_ID);
  const [appearance, setAppearance] = React.useState(() => getDefaultAppearance(DEFAULT_RACE_ID, DEFAULT_CLASS_ID));
  const [openAppearancePicker, setOpenAppearancePicker] = React.useState(null);
  const selectedRace = RACES[raceId];
  const selectedCharacter = characters.find((savedCharacter) => savedCharacter.id === selectedCharacterId) ?? characters[0] ?? null;
  const trimmedName = name.trim();
  const nameTaken = isNameTaken(trimmedName, characters);
  const canCreate = trimmedName.length >= 2 && !nameTaken && selectedRace.allowedClasses.includes(classId);
  const activeStepIndex = CREATION_STEPS.findIndex((step) => step.id === creationStep);
  const draftCharacter = {
    name: trimmedName || 'Unnamed',
    raceId,
    classId,
    appearance,
    level: 1,
  };

  React.useEffect(() => {
    if (!selectedRace.allowedClasses.includes(classId)) {
      const nextClassId = selectedRace.allowedClasses[0];
      setClassId(nextClassId);
      setAppearance((current) => getAppearanceForOrigin(raceId, nextClassId, current));
    }
  }, [classId, raceId, selectedRace]);

  React.useEffect(() => {
    if (selectedCharacterId && characters.some((savedCharacter) => savedCharacter.id === selectedCharacterId)) return;
    setSelectedCharacterId(characters[0]?.id ?? null);
  }, [characters, selectedCharacterId]);

  const selectRace = (id) => {
    const race = RACES[id];
    const nextClassId = race.allowedClasses.includes(classId) ? classId : race.allowedClasses[0];
    setRaceId(id);
    setClassId(nextClassId);
    setOpenAppearancePicker(null);
    setAppearance((current) => getAppearanceForOrigin(id, nextClassId, current));
  };

  const selectClass = (id) => {
    setClassId(id);
    setOpenAppearancePicker(null);
    setAppearance((current) => getAppearanceForOrigin(raceId, id, current));
  };

  const updateAppearance = (key, value) => {
    const genderFace = key === 'gender'
      ? (FRESH_RACE_FACE_STYLE_CHOICES[raceId] ?? HUMAN_FACE_STYLE_CHOICES)
        .find((option) => option.gender === value)?.id
      : null;
    const genderHair = key === 'gender'
      ? (FRESH_RACE_HAIR_STYLE_CHOICES[raceId] ?? HUMAN_HAIR_STYLE_CHOICES)
        .find((option) => option.gender === value)?.id
      : null;
    setAppearance((current) => ({
      ...current,
      [key]: value,
      ...(key === 'gender' ? {
        faceVariant: genderFace,
        hairStyle: genderHair,
        ...(value === 'female' ? { beard: 'none' } : {}),
      } : {}),
      ...(raceId === 'human' ? { hatVariant: 'none' } : {}),
      ...(key === 'capeStyle' ? { cape: value } : {}),
    }));
  };

  const startCreate = () => {
    setMode('create');
    setCreationStep('identity');
    setName('');
    setRaceId(DEFAULT_RACE_ID);
    setClassId(DEFAULT_CLASS_ID);
    setOpenAppearancePicker(null);
    setAppearance(getDefaultAppearance(DEFAULT_RACE_ID, DEFAULT_CLASS_ID));
  };

  const leaveCreation = () => {
    setMode('list');
    setCreationStep('identity');
    setSelectedCharacterId((current) => current ?? characters[0]?.id ?? null);
  };

  const createAndReturn = () => {
    if (!canCreate) return;
    onCreate({
      name: trimmedName,
      raceId,
      classId,
      appearance: getMergedDefaultAppearance(raceId, classId, appearance),
    });
  };

  return (
    <div className={`selection-screen ${mode === 'create' ? 'creating-character' : ''}`}>
      <div className={`selection-panel ${mode === 'create' ? 'creation-mode' : ''}`}>
        <header className="character-menu-header">
          <div className="character-menu-title">
            {mode === 'create' && (
              <button className="creation-exit-button" type="button" onClick={leaveCreation}>
                <span aria-hidden="true">←</span>
                Back to characters
              </button>
            )}
            <p className="eyebrow">{mode === 'create' ? 'New adventurer' : 'Character menu'}</p>
            <h1>{mode === 'create' ? 'Create Your Hero' : 'Choose Your Hero'}</h1>
            <p className="character-menu-lead">
              {mode === 'create'
                ? 'Shape a hero, preview every choice, then begin your journey.'
                : 'Select a saved character or start a new adventure.'}
            </p>
          </div>
          <div className="character-menu-actions">
            <button className="auth-button secondary" type="button" onClick={onLogout}>Logout</button>
            <button className="auth-button secondary" type="button" onClick={onExitGame}>Exit Game</button>
          </div>
        </header>

        {mode === 'list' ? (
          <div className="character-menu-layout character-selection-layout">
            <aside className="character-list">
              <div className="section-heading-row">
                <p className="section-label">Saved characters</p>
                <span>{characters.length}</span>
              </div>
              <div className="saved-list">
                {characters.length === 0 && (
                  <div className="empty-slot">
                    <strong>No heroes yet</strong>
                    <span>Create your first character to enter the world.</span>
                  </div>
                )}
                {characters.map((savedCharacter) => {
                  const race = RACES[savedCharacter.raceId] ?? RACES.human;
                  const classConfig = CLASSES[savedCharacter.classId] ?? CLASSES.warrior;
                  const Icon = classConfig.icon;
                  return (
                    <div
                      className={`saved-card ${selectedCharacter?.id === savedCharacter.id ? 'selected' : ''}`}
                      key={savedCharacter.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedCharacterId(savedCharacter.id)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        setSelectedCharacterId(savedCharacter.id);
                      }}
                    >
                      <span className={`class-portrait ${savedCharacter.classId}`}><Icon size={26} /></span>
                      <span>
                        <strong>{savedCharacter.name}</strong>
                        <small>Level {savedCharacter.level ?? 1} · {race.name} {classConfig.name}</small>
                      </span>
                      <button
                        className="delete-character"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(savedCharacter.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
              <button className="create-new-character" type="button" onClick={startCreate}>
                <span aria-hidden="true">+</span>
                Create New Character
              </button>
            </aside>

            <section className="character-preview-panel">
              <CharacterPreview character={selectedCharacter} spriteLoadVersion={spriteLoadVersion} />
              <div className="preview-actions">
                <button
                  className="create-button"
                  disabled={!selectedCharacter}
                  type="button"
                  onClick={() => selectedCharacter && onEnter(selectedCharacter)}
                >
                  Enter World
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="character-creation-space">
            <section className="character-builder">
              <div className="builder-preview">
                <CharacterPreview
                  character={draftCharacter}
                  showDirectionControls
                  spriteLoadVersion={spriteLoadVersion}
                />
                <div className="creation-summary">
                  <div>
                    <span>Origin</span>
                    <strong>{selectedRace.name}</strong>
                  </div>
                  <div>
                    <span>Path</span>
                    <strong>{CLASSES[classId]?.name}</strong>
                  </div>
                  <small>{CLASSES[classId]?.abilities.slice(0, 3).map((ability) => ability.name).join(' · ')}</small>
                </div>
              </div>

              <div className="builder-fields">
                <nav className="creation-stepper" aria-label="Character creation steps">
                  {CREATION_STEPS.map((step, index) => (
                    <button
                      className={`${creationStep === step.id ? 'active' : ''} ${index < activeStepIndex ? 'done' : ''}`}
                      key={step.id}
                      type="button"
                      onClick={() => setCreationStep(step.id)}
                    >
                      <span>{index < activeStepIndex ? '✓' : index + 1}</span>
                      <span className="step-copy">
                        <strong>{step.label}</strong>
                        <small>{step.hint}</small>
                      </span>
                    </button>
                  ))}
                </nav>

                <div className="builder-step-content">
                  {creationStep === 'identity' && (
                    <>
                      <div className="builder-section-heading">
                        <div>
                          <p className="section-label">Choose your origin</p>
                          <h2>Race and class</h2>
                        </div>
                        <p>Your race determines where your journey begins. Your class defines how you fight.</p>
                      </div>

                      <div className="race-grid">
                        {Object.entries(RACES).map(([id, race]) => {
                          const Icon = race.icon;
                          return (
                            <button
                              aria-pressed={raceId === id}
                              className={`race-card ${raceId === id ? 'selected' : ''}`}
                              key={id}
                              type="button"
                              onClick={() => selectRace(id)}
                            >
                              <span className="race-icon" style={{ backgroundColor: race.skin }}><Icon size={24} /></span>
                              <span>
                                <strong>{race.name}</strong>
                                <small>{race.allowedClasses.length} available classes</small>
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <p className="section-label class-section-label">Choose your class</p>
                      <div className="class-grid">
                        {Object.entries(CLASSES).map(([id, classConfig]) => {
                          const Icon = classConfig.icon;
                          const isAllowed = selectedRace.allowedClasses.includes(id);
                          return (
                            <button
                              aria-pressed={classId === id}
                              className={`class-card ${classId === id ? 'selected' : ''}`}
                              disabled={!isAllowed}
                              key={id}
                              type="button"
                              onClick={() => selectClass(id)}
                            >
                              <span className={`class-portrait ${id}`}><Icon size={30} /></span>
                              <span className="class-card-copy">
                                <strong>{classConfig.name}</strong>
                                <small>
                                  {isAllowed
                                    ? classConfig.abilities.slice(0, 3).map((ability) => ability.name).join(' · ')
                                    : `Unavailable to ${selectedRace.name}`}
                                </small>
                              </span>
                              {classId === id && <span className="selected-mark" aria-hidden="true">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {creationStep === 'customize' && (
                    <>
                      <div className="builder-section-heading">
                        <div>
                          <p className="section-label">Make it yours</p>
                          <h2>Appearance</h2>
                        </div>
                        <p>Every option below updates the preview immediately.</p>
                      </div>

                      <div className="appearance-layout">
                        <section className="appearance-panel">
                          <h3>Style</h3>
                          <div className="appearance-choice-list">
                            {getAppearanceChoiceEntries(raceId, classId, appearance).map(([key, choices]) => {
                              const pickerId = `style-${key}`;
                              const appearanceLabel = getAppearanceLabel(key, classId);
                              return (
                                <div className="appearance-choice-row" data-appearance-key={key} key={key}>
                                  <div className="appearance-field-label">
                                    <strong>{appearanceLabel}</strong>
                                    <small>{choices.length} choices</small>
                                  </div>
                                  <AppearanceCycler
                                    expanded={openAppearancePicker === pickerId}
                                    label={appearanceLabel}
                                    onChange={(value) => updateAppearance(key, value)}
                                    onToggle={(force) => setOpenAppearancePicker((current) => (
                                      force === false ? null : current === pickerId ? null : pickerId
                                    ))}
                                    options={choices}
                                    pickerId={pickerId}
                                    value={appearance[key]}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </section>

                        <section className="appearance-panel color-panel">
                          <h3>Colors</h3>
                          <div className="color-customization-list">
                            {getColorCustomizationEntries(raceId, classId).map(([key, values, entryConfig]) => {
                              const config = entryConfig ?? { label: key, names: values };
                              const pickerId = `color-${key}`;
                              const options = values.map((value, index) => ({ id: value, label: config.names[index] }));
                              return (
                                <div className="color-customization-row" key={key}>
                                  <div className="appearance-field-label">
                                    <strong>{config.label}</strong>
                                    <small>{values.length} colors</small>
                                  </div>
                                  <AppearanceCycler
                                    color
                                    expanded={openAppearancePicker === pickerId}
                                    label={config.label}
                                    onChange={(value) => updateAppearance(key, value)}
                                    onToggle={(force) => setOpenAppearancePicker((current) => (
                                      force === false ? null : current === pickerId ? null : pickerId
                                    ))}
                                    options={options}
                                    pickerId={pickerId}
                                    value={appearance[key]}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      </div>
                    </>
                  )}

                  {creationStep === 'name' && (
                    <div className="name-step">
                      <div className="builder-section-heading">
                        <div>
                          <p className="section-label">Final step</p>
                          <h2>Name your hero</h2>
                        </div>
                        <p>Choose a unique name between 2 and 18 characters.</p>
                      </div>
                      <label className="name-field name-field-large">
                        <span>Character name</span>
                        <input
                          autoFocus
                          maxLength={18}
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && canCreate) createAndReturn();
                          }}
                          placeholder="Enter a name"
                        />
                        {nameTaken
                          ? <em>This name is already taken.</em>
                          : <small>{trimmedName.length}/18 characters</small>}
                      </label>
                      <div className="final-character-summary">
                        <span>{selectedRace.name}</span>
                        <span>{CLASSES[classId]?.name}</span>
                        <span>{appearance.outfitVariant} outfit</span>
                        <span>{appearance.weaponVariant} weapon</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="builder-actions">
                  <button
                    className="auth-button secondary"
                    type="button"
                    onClick={() => {
                      if (creationStep === 'identity') leaveCreation();
                      else setCreationStep(creationStep === 'name' ? 'customize' : 'identity');
                    }}
                  >
                    Back
                  </button>
                  {creationStep !== 'name' ? (
                    <button
                      className="create-button"
                      type="button"
                      onClick={() => setCreationStep(creationStep === 'identity' ? 'customize' : 'name')}
                    >
                      Continue
                    </button>
                  ) : (
                    <button className="create-button" disabled={!canCreate} type="button" onClick={createAndReturn}>
                      Create Character
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
