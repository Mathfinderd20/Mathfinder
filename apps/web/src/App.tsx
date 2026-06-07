import { useMemo, useState } from "react";
import {
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
  type CharacterBuild,
  type LevelUpSelection,
  type Modifier,
} from "@path-builder/rules-engine";
import { BUFFS, initialBuild } from "./data";
import { Sheet } from "./components/Sheet";
import { LevelUpModal } from "./components/LevelUpModal";

export function App() {
  const [build, setBuild] = useState<CharacterBuild>(initialBuild);
  const [activeBuffs, setActiveBuffs] = useState<Record<string, boolean>>({});
  const [leveling, setLeveling] = useState(false);

  function confirmLevelUp(selection: LevelUpSelection) {
    setBuild((b) => applyLevelUp(b, selection));
    setLeveling(false);
  }

  // The whole app is a pure render of (build + active buffs). Toggle anything
  // and every derived number recomputes instantly — the engine is fast & local.
  const { sheet, issues, activatableFeatures, activatableGroups, activatableConflicts } = useMemo(() => {
    const input = buildCharacter(build);
    const baseSheet = computeSheet(input);
    const activatableFeatures = collectActivatableEffects({
      descriptor: baseSheet.descriptor,
      classFeatureRegistry: CLASS_FEATURES,
      featRegistry: FEATS,
    });
    const resolvedActivatables = resolveActivatableSelections({
      available: activatableFeatures,
      selected: activeBuffs,
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
    };
  }, [build, activeBuffs]);

  const errors = issues.filter((i) => i.severity === "error");

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
            {activatableGroups.ungrouped.map((feature) => (
              <label className="buff" key={feature.id}>
                <input
                  type="checkbox"
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
            ))}
            {Object.entries(activatableGroups.grouped).map(([group, items]) => (
              <div className="mode-group" key={group}>
                <div className="mode-title">{group.replace(/-/g, " ")}</div>
                {items.map((feature) => (
                  <label className="buff" key={feature.id}>
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
