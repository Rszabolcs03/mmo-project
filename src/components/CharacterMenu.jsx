import React from 'react';
import {
  APPEARANCE_CHOICES,
  CLASSES,
  CUSTOMIZATION,
  RACES,
} from '../game/gameData';
import { getDefaultAppearance, getMergedDefaultAppearance, isNameTaken } from '../game/worldEntities';
import { CharacterPreview } from '../rendering/canvasRendering';

export { CharacterMenu };

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
  const [raceId, setRaceId] = React.useState('human');
  const [classId, setClassId] = React.useState('warrior');
  const [appearance, setAppearance] = React.useState(() => getDefaultAppearance('human', 'warrior'));
  const selectedRace = RACES[raceId];
  const selectedCharacter = characters.find((savedCharacter) => savedCharacter.id === selectedCharacterId) ?? characters[0] ?? null;
  const trimmedName = name.trim();
  const nameTaken = isNameTaken(trimmedName, characters);
  const canCreate = trimmedName.length >= 2 && !nameTaken && selectedRace.allowedClasses.includes(classId);
  const creationSteps = [
    { id: 'identity', label: 'Origin' },
    { id: 'customize', label: 'Look' },
    { id: 'name', label: 'Name' },
  ];
  const activeStepIndex = creationSteps.findIndex((step) => step.id === creationStep);
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
      setAppearance((current) => getMergedDefaultAppearance(raceId, nextClassId, current));
    }
  }, [classId, raceId, selectedRace]);

  React.useEffect(() => {
    if (selectedCharacterId && characters.some((savedCharacter) => savedCharacter.id === selectedCharacterId)) return;
    setSelectedCharacterId(characters[0]?.id ?? null);
    if (characters.length === 0) setMode('create');
  }, [characters, selectedCharacterId]);

  const selectRace = (id) => {
    const race = RACES[id];
    const nextClassId = race.allowedClasses.includes(classId) ? classId : race.allowedClasses[0];
    setRaceId(id);
    setClassId(nextClassId);
    setAppearance((current) => getMergedDefaultAppearance(id, nextClassId, current));
  };

  const selectClass = (id) => {
    setClassId(id);
    setAppearance((current) => getMergedDefaultAppearance(raceId, id, current));
  };

  const updateAppearance = (key, value) => {
    setAppearance((current) => ({ ...current, [key]: value }));
  };

  const cycleAppearanceValue = (key, values, direction) => {
    const currentIndex = values.indexOf(appearance[key]);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + values.length) % values.length;
    updateAppearance(key, values[nextIndex]);
  };

  const cycleAppearanceChoice = (key, choices, direction) => {
    const values = choices.map((choice) => choice.id);
    cycleAppearanceValue(key, values, direction);
  };

  const startCreate = () => {
    setMode('create');
    setCreationStep('identity');
    setName('');
    setRaceId('human');
    setClassId('warrior');
    setAppearance(getDefaultAppearance('human', 'warrior'));
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
    <div className="selection-screen">
      <div className="selection-panel">
        <header className="character-menu-header">
          <div>
            <p className="eyebrow">Character menu</p>
            <h1>{mode === 'create' ? 'Create Your Hero' : 'Choose Your Hero'}</h1>
          </div>
          <div className="character-menu-actions">
            <button className="auth-button secondary" type="button" onClick={onLogout}>
              Logout
            </button>
            <button className="auth-button secondary" type="button" onClick={onExitGame}>
              Exit Game
            </button>
          </div>
        </header>

        <div className="character-menu-layout">
          <aside className="character-list">
            <p className="section-label">Saved characters</p>
            <div className="saved-list">
              {characters.length === 0 && (
                <div className="empty-slot">No characters yet</div>
              )}
              {characters.map((savedCharacter) => {
                const race = RACES[savedCharacter.raceId] ?? RACES.human;
                const classConfig = CLASSES[savedCharacter.classId] ?? CLASSES.warrior;
                const Icon = classConfig.icon;
                return (
                  <div
                    className={`saved-card ${selectedCharacter?.id === savedCharacter.id && mode === 'list' ? 'selected' : ''}`}
                    key={savedCharacter.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setMode('list');
                      setSelectedCharacterId(savedCharacter.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setMode('list');
                      setSelectedCharacterId(savedCharacter.id);
                    }}
                  >
                    <span className={`class-portrait ${savedCharacter.classId}`}>
                      <Icon size={26} />
                    </span>
                    <span>
                      <strong>{savedCharacter.name}</strong>
                      <small>
                        Level {savedCharacter.level ?? 1} {race.name} {classConfig.name}
                      </small>
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
              Create New Character
            </button>
          </aside>

          {mode === 'list' && (
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
          )}

          {mode === 'create' && (
            <section className="character-builder">
              <div className="builder-preview">
                <CharacterPreview character={draftCharacter} spriteLoadVersion={spriteLoadVersion} />
                <div className="creation-summary">
                  <span>{selectedRace.name}</span>
                  <strong>{CLASSES[classId]?.name}</strong>
                  <small>{CLASSES[classId]?.abilities.slice(0, 3).map((ability) => ability.name).join(' / ')}</small>
                </div>
              </div>

              <div className="builder-fields">
                <div className="creation-stepper">
                  {creationSteps.map((step, index) => (
                    <button
                      className={`${creationStep === step.id ? 'active' : ''} ${index < activeStepIndex ? 'done' : ''}`}
                      key={step.id}
                      type="button"
                      onClick={() => setCreationStep(step.id)}
                    >
                      <span>{index + 1}</span>
                      <strong>{step.label}</strong>
                    </button>
                  ))}
                </div>
                {creationStep === 'identity' && (
                  <>
                    <p className="section-label">Race</p>
                    <div className="race-grid">
                      {Object.entries(RACES).map(([id, race]) => {
                        const Icon = race.icon;
                        return (
                          <button
                            className={`race-card ${raceId === id ? 'selected' : ''}`}
                            key={id}
                            type="button"
                            onClick={() => selectRace(id)}
                          >
                            <span className="race-icon" style={{ backgroundColor: race.skin }}>
                              <Icon size={24} />
                            </span>
                            <strong>{race.name}</strong>
                          </button>
                        );
                      })}
                    </div>

                    <p className="section-label">Class</p>
                    <div className="class-grid">
                      {Object.entries(CLASSES).map(([id, classConfig]) => {
                        const Icon = classConfig.icon;
                        const isAllowed = selectedRace.allowedClasses.includes(id);
                        return (
                          <button
                            className={`class-card ${classId === id ? 'selected' : ''}`}
                            disabled={!isAllowed}
                            key={id}
                            type="button"
                            onClick={() => selectClass(id)}
                          >
                            <span className={`class-portrait ${id}`}>
                              <Icon size={32} />
                            </span>
                            <strong>{classConfig.name}</strong>
                            <span>
                              {isAllowed
                                ? classConfig.abilities.map((ability) => ability.name).join(' / ')
                                : `${selectedRace.name} cannot be ${classConfig.name}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {creationStep === 'customize' && (
                  <>
                    <p className="section-label">Customize</p>
                    <div className="customization-grid">
                      {Object.entries(APPEARANCE_CHOICES).map(([key, choices]) => (
                        <div className="customization-row" key={key}>
                          <strong>{key}</strong>
                          {key === 'gender' ? (
                            <div className="choice-buttons">
                              {choices.map((choice) => (
                                <button
                                  className={appearance[key] === choice.id ? 'selected text-choice' : 'text-choice'}
                                  key={choice.id}
                                  type="button"
                                  onClick={() => updateAppearance(key, choice.id)}
                                >
                                  {choice.label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="cycle-control">
                              <button
                                aria-label={`Previous ${key}`}
                                className="cycle-arrow"
                                type="button"
                                onClick={() => cycleAppearanceChoice(key, choices, -1)}
                              >
                                {'<'}
                              </button>
                              <button
                                className="cycle-value"
                                type="button"
                                onClick={() => cycleAppearanceChoice(key, choices, 1)}
                              >
                                {choices.find((choice) => choice.id === appearance[key])?.label ?? choices[0]?.label}
                              </button>
                              <button
                                aria-label={`Next ${key}`}
                                className="cycle-arrow"
                                type="button"
                                onClick={() => cycleAppearanceChoice(key, choices, 1)}
                              >
                                {'>'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {Object.entries(CUSTOMIZATION).map(([key, values]) => (
                        <div className="customization-row" key={key}>
                          <strong>{key}</strong>
                          <div className="cycle-control">
                            <button
                              aria-label={`Previous ${key}`}
                              className="cycle-arrow"
                              type="button"
                              onClick={() => cycleAppearanceValue(key, values, -1)}
                            >
                              {'<'}
                            </button>
                            <button
                              className="cycle-value color-value"
                              type="button"
                              onClick={() => cycleAppearanceValue(key, values, 1)}
                              title={appearance[key]}
                            >
                              <span className="cycle-swatch" style={{ backgroundColor: appearance[key] }} />
                              <span>{appearance[key]}</span>
                            </button>
                            <button
                              aria-label={`Next ${key}`}
                              className="cycle-arrow"
                              type="button"
                              onClick={() => cycleAppearanceValue(key, values, 1)}
                            >
                              {'>'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {creationStep === 'name' && (
                  <>
                    <p className="section-label">Name</p>
                    <label className="name-field">
                      <span>Character name</span>
                      <input
                        maxLength={18}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Name"
                      />
                      {nameTaken && <em>Name taken</em>}
                    </label>
                  </>
                )}

                <div className="builder-actions">
                  <button
                    className="auth-button secondary"
                    type="button"
                    onClick={() => {
                      if (creationStep === 'identity') {
                        setMode(characters.length > 0 ? 'list' : 'create');
                        return;
                      }
                      setCreationStep(creationStep === 'name' ? 'customize' : 'identity');
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
                    Next
                  </button>
                ) : (
                  <button
                    className="create-button"
                    disabled={!canCreate}
                    type="button"
                    onClick={createAndReturn}
                  >
                    Create
                  </button>
                )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
