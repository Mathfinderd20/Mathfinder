import type { DerivedSpellcasting } from "@mathfinder/rules-engine";

type SpellCastCounts = Record<string, Record<number, Record<string, number>>>;

type SpellMode = "prepared" | "known";

interface SpellOption {
  id: string;
  name: string;
}

interface Props {
  casters: DerivedSpellcasting[];
  spellOptions: SpellOption[];
  spellCastCounts: SpellCastCounts;
  onAddSelection: (classKey: string, mode: SpellMode, level: number) => void;
  onAppendSelection: (classKey: string, mode: SpellMode, level: number, spellName: string) => void;
  onUpdateSelectionName: (classKey: string, mode: SpellMode, level: number, index: number, value: string) => void;
  onRemoveSelection: (classKey: string, mode: SpellMode, level: number, index: number) => void;
  onResetSelectionsForLevel: (classKey: string, mode: SpellMode, level: number) => void;
  onResetSelectionsForClass: (classKey: string, mode: SpellMode, levels: number[]) => void;
  onAddLibraryEntry: (classKey: string, level: number) => void;
  onAppendLibraryEntry: (classKey: string, level: number, spellName: string) => void;
  onUpdateLibraryName: (classKey: string, level: number, index: number, value: string) => void;
  onRemoveLibraryEntry: (classKey: string, level: number, index: number) => void;
  onResetLibraryLevel: (classKey: string, level: number) => void;
  onResetLibraryForClass: (classKey: string, levels: number[]) => void;
  onFillSelectionsFromLibrary: (classKey: string, mode: SpellMode, level: number, capacity: number) => void;
  onAdjustSpellSlot: (classKey: string, level: number, max: number, delta: number) => void;
  onCastSpell: (classKey: string, level: number, max: number, spellName: string, remaining: number) => void;
  onResetSpellSlotLevel: (classKey: string, level: number) => void;
  onResetSpellRuntimeClass: (classKey: string, levels: number[]) => void;
}

export function SpellcastingManager({
  casters,
  spellOptions,
  spellCastCounts,
  onAddSelection,
  onAppendSelection,
  onUpdateSelectionName,
  onRemoveSelection,
  onResetSelectionsForLevel,
  onResetSelectionsForClass,
  onAddLibraryEntry,
  onAppendLibraryEntry,
  onUpdateLibraryName,
  onRemoveLibraryEntry,
  onResetLibraryLevel,
  onResetLibraryForClass,
  onFillSelectionsFromLibrary,
  onAdjustSpellSlot,
  onCastSpell,
  onResetSpellSlotLevel,
  onResetSpellRuntimeClass,
}: Props) {
  if (casters.length === 0) return null;

  return (
    <>
      <div className="editor-section-head">
        <h3>Spellcasting Build Setup</h3>
      </div>
      <p className="hint">
        Manage library/learnable spells, prepared or known picks, and runtime usage in one caster block.
        Less note-card necromancy, more actual sheet behavior.
      </p>
      <datalist id="spell-options">
        {spellOptions.map((spell) => <option key={spell.id} value={spell.name} />)}
      </datalist>
      <div className="item-list">
        {casters.map((caster) => {
          const classKey = caster.className.toLowerCase();
          const mode: SpellMode = caster.castingType === "prepared" ? "prepared" : "known";
          const selections = mode === "prepared" ? caster.selectedPreparedSpells : caster.selectedKnownSpells;
          const levels = Object.keys(caster.selectionDiagnostics).map(Number).sort((a, b) => a - b);
          const invalidLevels = levels.filter((level) => {
            const diag = caster.selectionDiagnostics[level];
            return !!diag && (
              diag.overCapacity ||
              diag.unknownSpells.length > 0 ||
              diag.offListSpells.length > 0 ||
              diag.wrongLevelSpells.length > 0 ||
              diag.missingFromLibrary.length > 0
            );
          });
          return (
            <div className="item-card" key={`spellcasting-${classKey}`}>
              <div className="editor-section-head tight">
                <h3>{caster.className} Spellcasting</h3>
                <div className="resource-buttons">
                  <button className="ghost small" onClick={() => onResetLibraryForClass(classKey, levels)}>
                    Clear Library
                  </button>
                  <button className="ghost small" onClick={() => onResetSelectionsForClass(classKey, mode, levels)}>
                    Clear Selections
                  </button>
                  <button className="ghost small" onClick={() => onResetSpellRuntimeClass(classKey, levels)}>
                    Rest Runtime
                  </button>
                </div>
              </div>
              <div className="spell-class-summary">
                <span className="resource-label">Caster level {caster.casterLevel}</span>
                <span className="resource-label">Concentration +{caster.concentration.total}</span>
                {invalidLevels.length > 0 ? (
                  <span className="warn-pill">Needs fixes on L{invalidLevels.join(", L")}</span>
                ) : (
                  <span className="ok-pill">Selections look legal</span>
                )}
              </div>

              {levels.map((level) => {
                const diag = caster.selectionDiagnostics[level];
                if (!diag) return null;
                const current = selections[level] ?? [];
                const library = caster.librarySpells[level] ?? [];
                const quickLibraryPicks = diag.availableSpellNames.filter((name) => !library.includes(name)).slice(0, 6);
                const quickSelectionPicks = diag.librarySpellNames.filter((name) => !current.includes(name)).slice(0, 6);
                const canAddSelection = current.length < diag.capacity;
                const runtimeMax = caster.spellsPerDay[level] ?? 0;
                const runtimeRemaining = caster.slotsRemaining[level] ?? runtimeMax;
                const castables = current.length > 0 ? current : library;
                return (
                  <div className="spell-level-block" key={`spell-level-${classKey}-${level}`}>
                    <div className="editor-section-head tight">
                      <div className="subsection-title level-title">
                        Level {level} <span className="muted">{current.length}/{diag.capacity} selected</span>
                      </div>
                      <div className="resource-buttons">
                        <button className="ghost small" onClick={() => onFillSelectionsFromLibrary(classKey, mode, level, diag.capacity)}>
                          Fill From Library
                        </button>
                        <button className="ghost small" onClick={() => onResetLibraryLevel(classKey, level)} disabled={library.length === 0}>
                          Clear Library
                        </button>
                        <button className="ghost small" onClick={() => onResetSelectionsForLevel(classKey, mode, level)} disabled={current.length === 0}>
                          Clear Picks
                        </button>
                      </div>
                    </div>

                    <div className="subsection-title">Library / Learnable Pool</div>
                    <div className="item-list compact-list">
                      {library.map((spellName, index) => (
                        <div className="inline-row" key={`library-${classKey}-${level}-${index}`}>
                          <input
                            className="inline-input"
                            type="text"
                            list="spell-options"
                            value={spellName}
                            onChange={(e) => onUpdateLibraryName(classKey, level, index, e.target.value)}
                          />
                          <button className="ghost small" onClick={() => onRemoveLibraryEntry(classKey, level, index)}>
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="resource-buttons wrap">
                        <button className="ghost small" onClick={() => onAddLibraryEntry(classKey, level)}>
                          Add Library Spell
                        </button>
                        {quickLibraryPicks.map((spellName) => (
                          <button
                            key={`lib-pick-${classKey}-${level}-${spellName}`}
                            className="ghost small"
                            onClick={() => onAppendLibraryEntry(classKey, level, spellName)}
                          >
                            + {spellName}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="subsection-title">{mode === "prepared" ? "Prepared Today" : "Known Spells"}</div>
                    {diag.overCapacity ? <p className="hint warn-text">Over capacity: {current.length}/{diag.capacity} selected.</p> : null}
                    {diag.unknownSpells.length > 0 ? <p className="hint warn-text">Unknown: {diag.unknownSpells.join(", ")}</p> : null}
                    {diag.offListSpells.length > 0 ? <p className="hint warn-text">Not on {caster.className} list: {diag.offListSpells.join(", ")}</p> : null}
                    {diag.missingFromLibrary.length > 0 ? <p className="hint warn-text">Missing from library/pool: {diag.missingFromLibrary.join(", ")}</p> : null}
                    {diag.wrongLevelSpells.length > 0 ? (
                      <p className="hint warn-text">
                        Wrong level: {diag.wrongLevelSpells.map((s) => `${s.name} (actual ${s.actualLevel})`).join(", ")}
                      </p>
                    ) : null}
                    <div className="item-list compact-list">
                      {current.map((spellName, index) => (
                        <div className="inline-row" key={`selection-${classKey}-${level}-${index}`}>
                          <input
                            className="inline-input"
                            type="text"
                            list="spell-options"
                            value={spellName}
                            onChange={(e) => onUpdateSelectionName(classKey, mode, level, index, e.target.value)}
                          />
                          <button className="ghost small" onClick={() => onRemoveSelection(classKey, mode, level, index)}>
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="resource-buttons wrap">
                        <button className="ghost small" disabled={!canAddSelection} onClick={() => onAddSelection(classKey, mode, level)}>
                          Add Blank
                        </button>
                        {quickSelectionPicks.map((spellName) => (
                          <button
                            key={`sel-pick-${classKey}-${level}-${spellName}`}
                            className="ghost small"
                            disabled={!canAddSelection}
                            onClick={() => onAppendSelection(classKey, mode, level, spellName)}
                          >
                            + {spellName}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="subsection-title">Runtime</div>
                    <div className="resource-row runtime-row">
                      <span className="resource-label">Slots: {runtimeRemaining}/{runtimeMax} left</span>
                      <div className="resource-buttons">
                        <button className="ghost small" onClick={() => onAdjustSpellSlot(classKey, level, runtimeMax, -1)}>-</button>
                        <button className="ghost small" onClick={() => onAdjustSpellSlot(classKey, level, runtimeMax, 1)}>+</button>
                        <button className="ghost small" onClick={() => onResetSpellSlotLevel(classKey, level)}>Rest</button>
                      </div>
                    </div>
                    {castables.length > 0 ? (
                      <div className="spell-cast-list">
                        {castables.map((spellName) => {
                          const castCount = spellCastCounts[classKey]?.[level]?.[spellName] ?? 0;
                          return (
                            <div className="spell-cast-row" key={`cast-${classKey}-${level}-${spellName}`}>
                              <span className="resource-label">{spellName} ×{castCount}</span>
                              <div className="resource-buttons">
                                <button
                                  className="ghost small"
                                  disabled={runtimeRemaining <= 0}
                                  onClick={() => onCastSpell(classKey, level, runtimeMax, spellName, runtimeRemaining)}
                                >
                                  Cast
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="hint">No selected/library spells here yet. Even magic needs a to-do list.</p>
                    )}
                    {diag.availableSpellNames.length > 0 ? (
                      <div className="hint">Registry options: {diag.availableSpellNames.join(", ")}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
