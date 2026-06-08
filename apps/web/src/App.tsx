import { useMemo, useState } from "react";
import {
  activatableResourceMax,
  applyLevelUp,
  buildCharacter,
  CLASS_FEATURES,
  collectActivatableEffects,
  computeSheet,
  FEATS,
  groupActivatables,
  levelDown,
  resolveActivatableSelections,
  validateBuild,
  type AbilityKey,
  type ActivationContext,
  type CharacterBuild,
  type DerivedSpellcasting,
  type LevelUpSelection,
  type Modifier,
  type SpellSlotUsageByLevel,
} from "@path-builder/rules-engine";
import { BUFFS, initialBuild } from "./data";
import { Sheet } from "./components/Sheet";
import { LevelUpModal } from "./components/LevelUpModal";

type SpellCastCounts = Record<string, Record<number, Record<string, number>>>;

export function App() {
  const [build, setBuild] = useState<CharacterBuild>(initialBuild);
  const [activeBuffs, setActiveBuffs] = useState<Record<string, boolean>>({});
  const [leveling, setLeveling] = useState(false);
  const [resourcesUsed, setResourcesUsed] = useState<Record<string, number>>({});
  const [spellSlotUsage, setSpellSlotUsage] = useState<Record<string, SpellSlotUsageByLevel>>({});
  const [spellCastCounts, setSpellCastCounts] = useState<SpellCastCounts>({});
  const [fatigued, setFatigued] = useState(false);

  function confirmLevelUp(selection: LevelUpSelection) {
    setBuild((b) => applyLevelUp(b, selection));
    setLeveling(false);
  }

  // The whole app is a pure render of (build + active buffs). Toggle anything
  // and every derived number recomputes instantly — the engine is fast & local.
  const { sheet, issues, activatableGroups, activatableConflicts, resourceMaxes } = useMemo(() => {
    const input = buildCharacter({
      ...build,
      conditions: fatigued ? ["fatigued"] : [],
      spellSlotUsage,
    });
    const baseSheet = computeSheet(input);
    const activatableFeatures = collectActivatableEffects({
      descriptor: baseSheet.descriptor,
      classFeatureRegistry: CLASS_FEATURES,
      featRegistry: FEATS,
    });
    const abilityModifiers = Object.fromEntries(
      (["str", "dex", "con", "int", "wis", "cha"] as AbilityKey[]).map((k) => [
        k,
        baseSheet.abilities[k].mod,
      ]),
    ) as Record<AbilityKey, number>;
    const context: ActivationContext = {
      baseAttackBonus: baseSheet.baseAttackBonus,
      characterLevel: baseSheet.level,
      abilityModifiers,
    };
    const resourceMaxes: Record<string, number> = {};
    for (const f of activatableFeatures) {
      const max = activatableResourceMax(f, context);
      if (max !== undefined) resourceMaxes[f.id] = max;
    }
    const resolvedActivatables = resolveActivatableSelections({
      available: activatableFeatures,
      selected: activeBuffs,
      context,
    });
    const classAbilityMods: Modifier[] = resolvedActivatables.modifiers;
    const buffMods: Modifier[] = BUFFS.filter((b) => activeBuffs[b.id]).flatMap(
      (b) => b.modifiers,
    );
    const withBuffs = { ...input, modifiers: [...input.modifiers, ...classAbilityMods, ...buffMods] };
    return {
      sheet: computeSheet(withBuffs),
      issues: validateBuild(build),
      activatableFeatures,
      activatableGroups: groupActivatables(activatableFeatures),
      activatableConflicts: resolvedActivatables.conflicts,
      resourceMaxes,
    };
  }, [build, activeBuffs, fatigued, spellSlotUsage]);

  const errors = issues.filter((i) => i.severity === "error");

  function resourceControls(featureId: string) {
    const max = resourceMaxes[featureId];
    if (max === undefined) return null;
    const used = Math.min(resourcesUsed[featureId] ?? 0, max);
    const remaining = Math.max(0, max - used);
    return (
      <div className="resource-row">
        <span className="resource-label">{remaining}/{max} left</span>
        <div className="resource-buttons">
          <button
            className="ghost small"
            onClick={() =>
              setResourcesUsed((prev) => ({ ...prev, [featureId]: Math.max(0, (prev[featureId] ?? 0) - 1) }))
            }
          >
            -
          </button>
          <button
            className="ghost small"
            onClick={() =>
              setResourcesUsed((prev) => ({ ...prev, [featureId]: Math.min(max, (prev[featureId] ?? 0) + 1) }))
            }
          >
            +
          </button>
          <button
            className="ghost small"
            onClick={() => setResourcesUsed((prev) => ({ ...prev, [featureId]: 0 }))}
          >
            Rest
          </button>
        </div>
      </div>
    );
  }

  function adjustSpellSlot(classKey: string, level: number, max: number, delta: number) {
    setSpellSlotUsage((prev) => ({
      ...prev,
      [classKey]: {
        ...(prev[classKey] ?? {}),
        [level]: Math.min(max, Math.max(0, ((prev[classKey] ?? {})[level] ?? 0) + delta)),
      },
    }));
  }

  function castSpell(classKey: string, level: number, max: number, spellName: string, remaining: number) {
    if (remaining <= 0) return;
    adjustSpellSlot(classKey, level, max, 1);
    setSpellCastCounts((prev) => ({
      ...prev,
      [classKey]: {
        ...(prev[classKey] ?? {}),
        [level]: {
          ...((prev[classKey] ?? {})[level] ?? {}),
          [spellName]: (((prev[classKey] ?? {})[level] ?? {})[spellName] ?? 0) + 1,
        },
      },
    }));
  }

  function resetSpellClassRuntime(classKey: string, levels: number[]) {
    setSpellSlotUsage((prev) => ({
      ...prev,
      [classKey]: Object.fromEntries(levels.map((level) => [level, 0])),
    }));
    setSpellCastCounts((prev) => ({
      ...prev,
      [classKey]: {},
    }));
  }

  function spellSlotControls(caster: DerivedSpellcasting) {
    const classKey = caster.className.toLowerCase();
    const levels = Object.keys(caster.spellsPerDay)
      .map(Number)
      .sort((a, b) => a - b);
    return (
      <div className="mode-group" key={classKey}>
        <div className="mode-title">{caster.className} spell slots</div>
        {levels.map((level) => {
          const max = caster.spellsPerDay[level] ?? 0;
          const used = caster.slotsUsed[level] ?? 0;
          const remaining = caster.slotsRemaining[level] ?? max;
          const spells = caster.castingType === "prepared"
            ? (caster.selectedPreparedSpells[level] ?? [])
            : (caster.selectedKnownSpells[level] ?? []);
          return (
            <div className="spell-runtime-block" key={`${classKey}-${level}`}>
              <div className="resource-row">
                <span className="resource-label">L{level}: {remaining}/{max} left</span>
                <div className="resource-buttons">
                  <button
                    className="ghost small"
                    onClick={() => adjustSpellSlot(classKey, level, max, -1)}
                  >
                    -
                  </button>
                  <button
                    className="ghost small"
                    onClick={() => adjustSpellSlot(classKey, level, max, 1)}
                  >
                    +
                  </button>
                  <button
                    className="ghost small"
                    onClick={() =>
                      setSpellSlotUsage((prev) => ({
                        ...prev,
                        [classKey]: {
                          ...(prev[classKey] ?? {}),
                          [level]: 0,
                        },
                      }))
                    }
                  >
                    Rest
                  </button>
                </div>
              </div>
              {spells.length > 0 ? (
                <div className="spell-cast-list">
                  {spells.map((spellName) => {
                    const castCount = spellCastCounts[classKey]?.[level]?.[spellName] ?? 0;
                    return (
                      <div className="spell-cast-row" key={`${classKey}-${level}-${spellName}`}>
                        <span className="resource-label">{spellName} ×{castCount}</span>
                        <div className="resource-buttons">
                          <button
                            className="ghost small"
                            disabled={remaining <= 0}
                            onClick={() => castSpell(classKey, level, max, spellName, remaining)}
                          >
                            Cast
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
        <button className="ghost small" onClick={() => resetSpellClassRuntime(classKey, levels)}>
          Rest All
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-bar">
        <div className="brand">
          Path-Builder <span className="brand-sub">Pathfinder 1e smart sheet</span>
        </div>
        <div className="actions">
          <button onClick={() => setLeveling(true)}>⬆ Level Up</button>
          <button
            className="ghost"
            disabled={build.levels.length <= 1}
            onClick={() => setBuild((b) => levelDown(b))}
          >
            ↩ Undo Level
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="controls">
          <section className="panel">
            <h2>Abilities, Buffs &amp; Auras</h2>
            <p className="hint">
              Toggle a granted class ability, a spell buff, or an aura and watch the
              sheet update live. Same modifier pipeline, less spaghetti.
            </p>
            {activatableGroups.ungrouped.map((feature) => {
              const max = resourceMaxes[feature.id];
              const used = resourcesUsed[feature.id] ?? 0;
              const activationBlocked = max !== undefined && used >= max && !activeBuffs[feature.id];
              return (
                <div className="buff-block" key={feature.id}>
                  <label className="buff">
                    <input
                      type="checkbox"
                      disabled={activationBlocked}
                      checked={!!activeBuffs[feature.id]}
                      onChange={(e) =>
                        setActiveBuffs((prev) => ({ ...prev, [feature.id]: e.target.checked }))
                      }
                    />
                    <span>
                      <strong>{feature.name} (ability)</strong>
                      <span className="buff-desc">{feature.description}</span>
                    </span>
                  </label>
                  {resourceControls(feature.id)}
                </div>
              );
            })}
            {Object.entries(activatableGroups.grouped).map(([group, items]) => (
              <div className="mode-group" key={group}>
                <div className="mode-title">{group.replace(/-/g, " ")}</div>
                {items.map((feature) => (
                  <div className="buff-block" key={feature.id}>
                    <label className="buff">
                      <input
                        type="radio"
                        name={`mode-${group}`}
                        checked={!!activeBuffs[feature.id]}
                        onChange={() =>
                          setActiveBuffs((prev) => {
                            const next = { ...prev };
                            for (const item of items) next[item.id] = false;
                            next[feature.id] = true;
                            return next;
                          })
                        }
                      />
                      <span>
                        <strong>{feature.name} (ability)</strong>
                        <span className="buff-desc">{feature.description}</span>
                      </span>
                    </label>
                    {resourceControls(feature.id)}
                  </div>
                ))}
                <button
                  className="ghost small"
                  onClick={() =>
                    setActiveBuffs((prev) => {
                      const next = { ...prev };
                      for (const item of items) next[item.id] = false;
                      return next;
                    })
                  }
                >
                  Clear mode
                </button>
              </div>
            ))}
            {activatableConflicts.length > 0 ? (
              <p className="hint warn-text">Conflicting modes were selected; only one per group applies.</p>
            ) : null}
            <div className="mode-group">
              <div className="mode-title">conditions</div>
              <label className="buff">
                <input
                  type="checkbox"
                  checked={fatigued}
                  onChange={(e) => setFatigued(e.target.checked)}
                />
                <span>
                  <strong>Fatigued</strong>
                  <span className="buff-desc">Blocks Rage and can suppress other abilities later.</span>
                </span>
              </label>
            </div>
            {BUFFS.map((buff) => (
              <label className="buff" key={buff.id}>
                <input
                  type="checkbox"
                  checked={!!activeBuffs[buff.id]}
                  onChange={(e) =>
                    setActiveBuffs((prev) => ({ ...prev, [buff.id]: e.target.checked }))
                  }
                />
                <span>
                  <strong>{buff.name}</strong>
                  <span className="buff-desc">{buff.description}</span>
                </span>
              </label>
            ))}
          </section>

          {sheet.spellcasting.length > 0 ? (
            <section className="panel">
              <h2>Spell Slots</h2>
              <p className="hint">Burn slots by level during play. Same runtime brain, less paper goblinry.</p>
              {sheet.spellcasting.map((caster) => spellSlotControls(caster))}
            </section>
          ) : null}

          {errors.length > 0 ? (
            <section className="panel errors">
              <h2>Validation</h2>
              <ul>
                {errors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="panel ok">
              <h2>Validation</h2>
              <p>No issues — this build is legal. </p>
            </section>
          )}
        </aside>

        <main className="main">
          <Sheet sheet={sheet} />
        </main>
      </div>

      {leveling ? (
        <LevelUpModal
          build={build}
          onConfirm={confirmLevelUp}
          onClose={() => setLeveling(false)}
        />
      ) : null}
    </div>
  );
}
