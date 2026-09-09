import { useState } from "react";
import {
  buildCharacter,
  computeSheet,
  type CharacterBuild,
  type Modifier,
} from "@mathfinder/rules-engine";
import {
  RUNTIME_ARCHETYPES,
  RUNTIME_CLASSES,
  RUNTIME_CLASS_FEATURES,
  RUNTIME_FEATS,
  RUNTIME_SPELLS,
} from "../../../content";
import type { Actor } from "./mockData";

type ActorTab = "notes" | "character" | "inventory" | "magic" | "build";

const TABS: Array<[ActorTab, string]> = [
  ["notes", "Notes"],
  ["character", "Character"],
  ["inventory", "Inventory"],
  ["magic", "Magic"],
  ["build", "Build"],
];

function spellNames(build: CharacterBuild) {
  const names = new Set<string>();
  for (const source of Object.values(build.spellSelections ?? {})) {
    for (const mode of [source?.prepared, source?.known]) {
      for (const level of Object.values(mode ?? {})) {
        for (const name of level ?? []) if (name.trim()) names.add(name);
      }
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function ActorSheet({
  actor,
  live = false,
  update,
  tabletop,
  remove,
  previewOnly = false,
}: {
  live?: boolean;
  actor: Actor;
  update: (patch: Partial<Actor>) => void;
  tabletop: boolean;
  remove: () => void;
  previewOnly?: boolean;
}) {
  const [tab, setTab] = useState<ActorTab>("character");
  const [modifierTarget, setModifierTarget] = useState("ac");
  const [modifierValue, setModifierValue] = useState(1);
  const [modifierSource, setModifierSource] = useState("GM adjustment");
  const equipment = actor.build?.equipment ?? [];
  const weapons = actor.build?.weapons ?? [];
  const spells = actor.build ? spellNames(actor.build) : [];

  function applyBuild(build: CharacterBuild) {
    const sheet = computeSheet(
      buildCharacter(
        build,
        RUNTIME_CLASSES,
        RUNTIME_FEATS,
        RUNTIME_CLASS_FEATURES,
        RUNTIME_ARCHETYPES,
      ),
      { spellRegistry: RUNTIME_SPELLS },
    );
    update({
      build,
      ancestry: build.race.name,
      role: sheet.descriptor.classes.map((entry) => entry.name).join(" / "),
      level: `Level ${sheet.level}`,
      maxHp: sheet.hitPoints.total,
      hp: Math.min(actor.hp, sheet.hitPoints.total),
      ac: sheet.ac.normal.total,
      initiativeBonus: sheet.initiative.total,
    });
  }

  function updateBuildLevel(
    index: number,
    patch: Partial<CharacterBuild["levels"][number]>,
  ) {
    if (!actor.build) return;
    applyBuild({
      ...actor.build,
      levels: actor.build.levels.map((level, levelIndex) =>
        levelIndex === index ? { ...level, ...patch } : level,
      ),
    });
  }

  function flatModifierPatch(
    modifier: Modifier,
    direction: 1 | -1,
  ): Partial<Actor> {
    const value = modifier.value * direction;
    if (modifier.target === "ac") return { ac: actor.ac + value };
    if (modifier.target === "init")
      return { initiativeBonus: (actor.initiativeBonus ?? 0) + value };
    if (modifier.target === "hp")
      return { maxHp: Math.max(1, actor.maxHp + value) };
    return {};
  }

  function addManualModifier() {
    const modifier: Modifier = {
      target: modifierTarget,
      type: "untyped",
      value: modifierValue,
      source: modifierSource.trim() || "GM adjustment",
    };
    if (actor.build) {
      applyBuild({
        ...actor.build,
        otherModifiers: [...(actor.build.otherModifiers ?? []), modifier],
      });
    } else {
      update({
        ...flatModifierPatch(modifier, 1),
        manualModifiers: [...(actor.manualModifiers ?? []), modifier],
      });
    }
  }

  function removeManualModifier(index: number) {
    const modifiers =
      actor.build?.otherModifiers ?? actor.manualModifiers ?? [];
    const modifier = modifiers[index];
    if (!modifier) return;
    if (actor.build) {
      applyBuild({
        ...actor.build,
        otherModifiers: actor.build.otherModifiers?.filter(
          (_, modifierIndex) => modifierIndex !== index,
        ),
      });
    } else {
      update({
        ...flatModifierPatch(modifier, -1),
        manualModifiers: actor.manualModifiers?.filter(
          (_, modifierIndex) => modifierIndex !== index,
        ),
      });
    }
  }

  return (
    <article className="gm-unified-character">
      <div className="gm-sheet-top gm-unified-status">
        <span className="gm-kicker">
          {actor.kind} / {live ? "Campaign copy" : "Preview"}
        </span>
        <span className="gm-save">
          {live ? "● Campaign autosave" : "● In-memory draft"}
        </span>
      </div>

      <header className="gm-character-identity">
        <div
          className={`gm-portrait tone-${actor.kind.toLowerCase()}`}
          aria-hidden="true"
        >
          {actor.name
            .split(" ")
            .map((name) => name[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div className="gm-character-identity-main">
          <span className="gm-kicker">
            {actor.kind} · {actor.level}
          </span>
          <h2>{actor.name}</h2>
          <p>
            {actor.ancestry} · {actor.role}
          </p>
        </div>
        <div className="gm-character-vitals">
          <span>Hit points</span>
          <strong>
            {actor.hp}
            <small> / {actor.maxHp}</small>
          </strong>
          <progress
            value={Math.max(0, actor.hp)}
            max={actor.maxHp}
            aria-label="Hit points"
          />
        </div>
      </header>

      <nav className="gm-character-tabs" aria-label={`${actor.name} workspace`}>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "notes" ? (
        <div className="gm-character-notes">
          <aside>
            <span className="gm-kicker">GM-only character note</span>
            <button type="button" className="gm-list-entry is-selected">
              <strong>{actor.name}</strong>
              <small>
                {actor.notes.slice(0, 65) || "No private notes yet"}
              </small>
            </button>
          </aside>
          <section className="gm-sheet">
            <div className="gm-section-title">
              <h3>Behind the screen</h3>
              <span>◈ This campaign only</span>
            </div>
            <textarea
              className="gm-note-body"
              aria-label={`Private GM notes for ${actor.name}`}
              value={actor.notes}
              onChange={(event) => update({ notes: event.target.value })}
              placeholder="Notes here are visible only to the GM and belong to this campaign copy."
            />
          </section>
        </div>
      ) : null}

      {tab === "character" ? (
        <div className="gm-character-frame">
          <main className="gm-character-main">
            {!previewOnly ? (
              <div className="gm-actions">
                <button
                  className={actor.onTable ? "gm-secondary" : "gm-primary"}
                  onClick={() => update({ onTable: !actor.onTable })}
                >
                  {actor.onTable
                    ? "↗ Remove from Tabletop"
                    : "+ Add to Tabletop"}
                </button>
                {!actor.saved ? (
                  <button onClick={() => update({ saved: true })}>
                    Save to Roster
                  </button>
                ) : null}
                <span className="gm-tag">
                  {actor.onTable ? "● On the tabletop" : "Off the tabletop"}
                </span>
              </div>
            ) : null}
            <div className="gm-stats">
              <div>
                <span>Hit points</span>
                <strong>
                  {actor.hp}
                  <small> / {actor.maxHp}</small>
                </strong>
                <progress value={Math.max(0, actor.hp)} max={actor.maxHp} />
              </div>
              <div>
                <span>Armor class</span>
                <strong>{actor.ac}</strong>
                <small>Current defense</small>
              </div>
              <div>
                <span>Initiative</span>
                <strong>
                  {actor.initiative >= 0 ? "+" : ""}
                  {actor.initiative}
                </strong>
                <small>Encounter result</small>
              </div>
              <div>
                <span>Turn economy</span>
                <strong>{actor.dual ? "2" : "1"}</strong>
                <small>
                  {actor.dual ? "Dual initiative" : "Turn per round"}
                </small>
              </div>
            </div>
            <div className="gm-section-title">
              <h3>Character overview</h3>
              <span>Campaign-scoped actor</span>
            </div>
            {!previewOnly ? (
              <div className="gm-field-grid">
                <label>
                  Display name
                  <input
                    value={actor.name}
                    onChange={(event) => update({ name: event.target.value })}
                  />
                </label>
                {(["ancestry", "role", "level"] as const).map((key) => (
                  <label key={key}>
                    {key}
                    <input
                      value={actor[key]}
                      onChange={(event) =>
                        update({ [key]: event.target.value })
                      }
                    />
                  </label>
                ))}
                <label>
                  Maximum hit points
                  <input
                    type="number"
                    min={1}
                    value={actor.maxHp}
                    onChange={(event) => {
                      const maxHp = Math.max(1, Number(event.target.value));
                      update({ maxHp, hp: Math.min(actor.hp, maxHp) });
                    }}
                  />
                </label>
                <label>
                  Armor class
                  <input
                    type="number"
                    value={actor.ac}
                    onChange={(event) =>
                      update({ ac: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Initiative modifier
                  <input
                    type="number"
                    value={actor.initiativeBonus ?? 0}
                    onChange={(event) =>
                      update({ initiativeBonus: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Character type
                  <select
                    value={actor.kind}
                    onChange={(event) =>
                      update({ kind: event.target.value as Actor["kind"] })
                    }
                  >
                    {["Player", "Ally", "NPC", "Monster", "Villain"].map(
                      (kind) => (
                        <option key={kind}>{kind}</option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            ) : (
              <p className="gm-prose">
                Codex references remain unchanged. Add a copy to the campaign
                before modifying its identity, hit points, build, or effects.
              </p>
            )}
            {actor.build ? (
              <div className="gm-build-snapshot">
                <span className="gm-kicker">Connected build snapshot</span>
                <p>
                  {actor.build.race.name} · {actor.build.levels.length} levels ·{" "}
                  {equipment.length} inventory entries · {spells.length} spells
                </p>
              </div>
            ) : null}
            {!previewOnly && (actor.saved || live) ? (
              <button className="gm-danger" onClick={remove}>
                Remove from Roster and Tabletop
              </button>
            ) : null}
          </main>
          <aside className="gm-character-rail">
            <div className="gm-rail-head">
              <span className="gm-kicker">Abilities &amp; Effects</span>
              <h3>Active Now</h3>
            </div>
            {!previewOnly ? (
              <>
                <label>
                  Current HP
                  <input
                    type="number"
                    value={actor.hp}
                    onChange={(event) =>
                      update({
                        hp: Math.min(actor.maxHp, Number(event.target.value)),
                      })
                    }
                  />
                </label>
                <label>
                  Initiative result
                  <input
                    type="number"
                    value={actor.initiative}
                    onChange={(event) =>
                      update({ initiative: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Effects &amp; conditions
                  <input
                    value={actor.conditions}
                    onChange={(event) =>
                      update({ conditions: event.target.value })
                    }
                    placeholder="Bless, frightened…"
                  />
                </label>
                {actor.conditions.trim() ? (
                  <div className="gm-condition-chips">
                    {actor.conditions
                      .split(",")
                      .map((condition) => condition.trim())
                      .filter(Boolean)
                      .map((condition) => (
                        <button
                          type="button"
                          key={condition}
                          title="Attempt a subsequent save or remove this condition"
                          onClick={() => {
                            if (
                              window.confirm(
                                `${condition}: remove this condition after a successful save or GM ruling?`,
                              )
                            ) {
                              update({
                                conditions: actor.conditions
                                  .split(",")
                                  .map((entry) => entry.trim())
                                  .filter(
                                    (entry) =>
                                      entry &&
                                      entry.toLowerCase() !==
                                        condition.toLowerCase(),
                                  )
                                  .join(", "),
                              });
                            }
                          }}
                        >
                          {condition} · Save / remove
                        </button>
                      ))}
                  </div>
                ) : null}
                <details className="gm-manual-modifiers" open>
                  <summary>
                    Manual modifiers
                    <span>
                      {
                        (
                          actor.build?.otherModifiers ??
                          actor.manualModifiers ??
                          []
                        ).length
                      }
                    </span>
                  </summary>
                  <div className="gm-manual-modifier-list">
                    {(
                      actor.build?.otherModifiers ??
                      actor.manualModifiers ??
                      []
                    ).map((modifier, index) => (
                      <div
                        className="gm-manual-modifier"
                        key={`${modifier.source}-${modifier.target}-${index}`}
                      >
                        <span>
                          <strong>{modifier.source}</strong>
                          {modifier.target} · {modifier.value >= 0 ? "+" : ""}
                          {modifier.value}
                        </span>
                        <button
                          type="button"
                          className="gm-danger"
                          onClick={() => removeManualModifier(index)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <label>
                    Target
                    <input
                      list={`modifier-targets-${actor.id}`}
                      value={modifierTarget}
                      onChange={(event) =>
                        setModifierTarget(event.target.value)
                      }
                    />
                    <datalist id={`modifier-targets-${actor.id}`}>
                      {[
                        "ac",
                        "hp",
                        "init",
                        "save.all",
                        "save.fort",
                        "save.ref",
                        "save.will",
                        "attack",
                        "attack.melee",
                        "attack.ranged",
                        "damage",
                        "cmb",
                        "cmd",
                        "speed",
                        "str",
                        "dex",
                        "con",
                        "int",
                        "wis",
                        "cha",
                      ].map((target) => (
                        <option key={target} value={target} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Value
                    <input
                      type="number"
                      value={modifierValue}
                      onChange={(event) =>
                        setModifierValue(Number(event.target.value))
                      }
                    />
                  </label>
                  <label>
                    Source / reason
                    <input
                      value={modifierSource}
                      onChange={(event) =>
                        setModifierSource(event.target.value)
                      }
                    />
                  </label>
                  <button type="button" onClick={addManualModifier}>
                    + Apply modifier
                  </button>
                </details>
                {tabletop ? (
                  <>
                    <div className="gm-section-title">
                      <h3>Encounter</h3>
                      <span>GM authority</span>
                    </div>
                    <label>
                      Initiative group
                      <input
                        value={actor.group}
                        onChange={(event) =>
                          update({ group: event.target.value })
                        }
                        placeholder="Independent"
                      />
                    </label>
                    <label>
                      Turn state
                      <select
                        value={actor.stance}
                        onChange={(event) =>
                          update({
                            stance: event.target.value as Actor["stance"],
                          })
                        }
                      >
                        <option>Normal</option>
                        <option>Delayed</option>
                        <option>Readied</option>
                      </select>
                    </label>
                    <label className="gm-check">
                      <input
                        type="checkbox"
                        checked={actor.dual}
                        onChange={(event) =>
                          update({ dual: event.target.checked })
                        }
                      />{" "}
                      Dual initiative
                    </label>
                    <label className="gm-check">
                      <input
                        type="checkbox"
                        checked={actor.aware}
                        onChange={(event) =>
                          update({ aware: event.target.checked })
                        }
                      />{" "}
                      Acts in surprise round
                    </label>
                  </>
                ) : null}
              </>
            ) : (
              <p className="gm-muted">
                Add this reference to the Roster or Tabletop to apply
                campaign-scoped effects and conditions.
              </p>
            )}
          </aside>
        </div>
      ) : null}

      {tab === "inventory" ? (
        <section className="gm-sheet gm-character-tab-page">
          <div className="gm-section-title">
            <h3>Inventory</h3>
            <span>{equipment.length + weapons.length} entries</span>
          </div>
          {actor.build ? (
            <div className="gm-inventory-columns">
              <div>
                <span className="gm-kicker">Carried</span>
                {[
                  ...weapons.map((weapon) => ({
                    name: weapon.name,
                    detail: weapon.loadedAmmoType
                      ? `Ammo: ${weapon.loadedAmmoType}`
                      : weapon.category,
                  })),
                  ...equipment
                    .filter(
                      (item) => (item.carryState ?? "carried") !== "cached",
                    )
                    .map((item) => ({
                      name: item.name,
                      detail: `${item.quantity ?? 1} × · ${item.slot}`,
                    })),
                ].map((item, index) => (
                  <div className="gm-inventory-row" key={`carried-${index}`}>
                    <strong>{item.name}</strong>
                    <span>{item.detail}</span>
                  </div>
                ))}
              </div>
              <div>
                <span className="gm-kicker">Stored</span>
                {equipment
                  .filter((item) => item.carryState === "cached")
                  .map((item, index) => (
                    <div className="gm-inventory-row" key={`stored-${index}`}>
                      <strong>{item.name}</strong>
                      <span>
                        {item.quantity ?? 1} × · {item.slot}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="gm-empty">
              <h2>No inventory snapshot</h2>
              <p>This Codex actor has no itemized build data yet.</p>
            </div>
          )}
        </section>
      ) : null}

      {tab === "magic" ? (
        <section className="gm-sheet gm-character-tab-page">
          <div className="gm-section-title">
            <h3>Magic</h3>
            <span>{spells.length} spells</span>
          </div>
          {spells.length ? (
            <div className="gm-spell-list">
              {spells.map((spell) => (
                <button type="button" key={spell}>
                  {spell}
                </button>
              ))}
            </div>
          ) : (
            <div className="gm-empty">
              <h2>No magic source yet</h2>
              <p>
                The tab remains available for an SLA, template, item, or future
                class level.
              </p>
            </div>
          )}
        </section>
      ) : null}

      {tab === "build" ? (
        <section className="gm-sheet gm-character-tab-page">
          <div className="gm-section-title">
            <h3>Level Progression</h3>
            <span>{actor.build?.levels.length ?? 0} lines</span>
          </div>
          {actor.build ? (
            <>
              {actor.kind !== "Monster" ? (
                <div className="gm-build-foundation">
                  <div className="gm-build-origin">
                    <span>Race</span>
                    <strong>{actor.build.race.name}</strong>
                    <small>
                      Racial choices remain attached to this campaign snapshot.
                    </small>
                  </div>
                  <div className="gm-build-origin">
                    <span>Campaign Traits</span>
                    <strong>
                      {actor.campaignTraits?.join(", ") || "None selected"}
                    </strong>
                    <small>Subject to this campaign’s creation rules.</small>
                  </div>
                </div>
              ) : null}
              <div className="gm-level-progression">
                {actor.build.levels.map((level, index) => (
                  <details
                    key={`gm-level-${index}`}
                    open={index === actor.build!.levels.length - 1}
                  >
                    <summary>
                      <span>Level {index + 1}</span>
                      <strong>{level.className}</strong>
                      <small>
                        {level.feats?.filter(Boolean).join(", ") ||
                          "No feat at this level"}
                      </small>
                      <b>Edit level</b>
                    </summary>
                    <div className="gm-field-grid">
                      <label>
                        Class
                        <input
                          value={level.className}
                          onChange={(event) =>
                            updateBuildLevel(index, {
                              className: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Hit point roll
                        <input
                          type="number"
                          min={1}
                          value={level.hitPointRoll}
                          onChange={(event) =>
                            updateBuildLevel(index, {
                              hitPointRoll: Math.max(
                                1,
                                Number(event.target.value),
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Feat(s)
                        <input
                          value={level.feats?.join(", ") ?? ""}
                          onChange={(event) =>
                            updateBuildLevel(index, {
                              feats: event.target.value
                                .split(",")
                                .map((feat) => feat.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      </label>
                    </div>
                  </details>
                ))}
              </div>
            </>
          ) : (
            <div className="gm-empty">
              <h2>Codex baseline</h2>
              <p>
                Add this actor to a campaign to extend racial HD, apply
                templates, or add class levels.
              </p>
            </div>
          )}
        </section>
      ) : null}
    </article>
  );
}
