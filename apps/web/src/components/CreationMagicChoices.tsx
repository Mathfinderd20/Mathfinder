import { useMemo } from "react";
import { PreparedSpellChoices } from "./PreparedSpellChoices";
import {
  buildCharacter,
  computeSheet,
  type CharacterBuild,
  type DerivedSpellcasting,
} from "@mathfinder/rules-engine";
import {
  RUNTIME_CLASSES,
  RUNTIME_FEATS,
  RUNTIME_CLASS_FEATURES,
  RUNTIME_ARCHETYPES,
  RUNTIME_SPELLS,
  RUNTIME_DOMAINS,
} from "../content";

export type CreationMagicState = Pick<
  CharacterBuild,
  "spellLibrary" | "spellSelections" | "spellDomains" | "spellSpecializations"
>;

export function startingSpellCapacity(
  caster: DerivedSpellcasting,
  level: number,
) {
  if (caster.castingType === "spontaneous")
    return caster.spellsKnown[level] ?? 0;
  if (level === 0)
    return caster.selectionDiagnostics[level]?.availableSpellNames.length ?? 0;
  return caster.className.toLowerCase() === "wizard"
    ? 3 + Math.max(0, Math.floor((caster.castingAbilityScore - 10) / 2))
    : 0;
}

export function creationMagicErrors(
  build: CharacterBuild | undefined,
  casters: DerivedSpellcasting[],
): string[] {
  return casters.flatMap((caster) => {
    const key = caster.className.toLowerCase();
    if (caster.spellAccess === "full-list") {
      return key === "cleric" &&
        !(build?.classArchetypes?.cleric ?? []).includes("battle-chaplain") &&
        new Set((build?.spellDomains?.cleric ?? []).filter(Boolean)).size !== 2
        ? ["Choose two cleric domains."]
        : [];
    }
    if (caster.spellAccess === "spellbook" && key !== "wizard")
      return [
        `Starting spellbook rules for ${caster.className} are not configured.`,
      ];
    return Object.keys(caster.baseSpellsPerDay)
      .map(Number)
      .flatMap((level) => {
        const selected =
          caster.castingType === "spontaneous"
            ? (caster.selectedKnownSpells[level] ?? [])
            : (caster.librarySpells[level] ?? []);
        const capacity = startingSpellCapacity(caster, level);
        return selected.length === capacity
          ? []
          : [
              `Choose ${capacity} level ${level} ${caster.className} spells (${selected.length} selected).`,
            ];
      });
  });
}

export function CreationMagicChoices({
  build,
  value,
  onChange,
  classKey,
}: {
  build?: CharacterBuild;
  value: CreationMagicState;
  onChange: (value: CreationMagicState) => void;
  classKey?: string;
}) {
  const casters = useMemo(
    () =>
      build
        ? computeSheet(
            buildCharacter(
              build,
              RUNTIME_CLASSES,
              RUNTIME_FEATS,
              RUNTIME_CLASS_FEATURES,
              RUNTIME_ARCHETYPES,
            ),
            { spellRegistry: RUNTIME_SPELLS },
          ).spellcasting
        : [],
    [build],
  );
  if (!casters.length)
    return (
      <p className="guide-policy">
        This class has no spell choices at level 1.
      </p>
    );
  return (
    <section className="creation-magic">
      <h4>Starting magic</h4>
      {casters
        .filter(
          (caster) =>
            !classKey ||
            caster.className.toLowerCase() === classKey.toLowerCase(),
        )
        .map((caster) => {
          const key = caster.className.toLowerCase();
          const fullList = caster.spellAccess === "full-list";
          const spontaneous = caster.castingType === "spontaneous";
          const domainsEnabled =
            key === "cleric" &&
            !(build?.classArchetypes?.cleric ?? []).includes("battle-chaplain");
          return (
            <div key={key}>
              <p className="guide-policy">
                {fullList
                  ? "Your class spell library is available automatically. You can choose daily preparations below or later on the Magic tab."
                  : spontaneous
                    ? "Choose your starting spells known. These become available on the Magic tab."
                    : "Record your starting spellbook. You can add spells acquired from scrolls or other sources on the Magic tab."}
              </p>
              {domainsEnabled && (
                <div className="ability-picker">
                  {[0, 1].map((index) => (
                    <label className="field" key={index}>
                      <span>Domain {index + 1}</span>
                      <select
                        value={value.spellDomains?.[key]?.[index] ?? ""}
                        onChange={(event) => {
                          const domains = [
                            ...(value.spellDomains?.[key] ?? []),
                          ];
                          domains[index] = event.target.value;
                          onChange({
                            ...value,
                            spellDomains: {
                              ...value.spellDomains,
                              [key]: domains,
                            },
                          });
                        }}
                      >
                        <option value="">Choose domain</option>
                        {RUNTIME_DOMAINS.map((domain) => (
                          <option
                            key={domain.id}
                            value={domain.id}
                            disabled={(value.spellDomains?.[key] ?? []).some(
                              (selected, otherIndex) =>
                                otherIndex !== index && selected === domain.id,
                            )}
                          >
                            {domain.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}
              {!fullList &&
                Object.entries(caster.baseSpellsPerDay).map(([levelText]) => {
                  const level = Number(levelText);
                  const picks = spontaneous
                    ? (value.spellSelections?.[key]?.known?.[level] ?? [])
                    : (value.spellLibrary?.[key]?.[level] ?? []);
                  const names =
                    caster.selectionDiagnostics[level]?.availableSpellNames ??
                    [];
                  const capacity = startingSpellCapacity(caster, level);
                  function update(next: string[]) {
                    onChange({
                      ...value,
                      spellLibrary: {
                        ...value.spellLibrary,
                        [key]: { ...value.spellLibrary?.[key], [level]: next },
                      },
                      ...(spontaneous
                        ? {
                            spellSelections: {
                              ...value.spellSelections,
                              [key]: {
                                ...value.spellSelections?.[key],
                                known: {
                                  ...value.spellSelections?.[key]?.known,
                                  [level]: next,
                                },
                              },
                            },
                          }
                        : {}),
                    });
                  }
                  return (
                    <div className="field" key={level}>
                      <span>
                        Level {level} · {picks.length}/{capacity}{" "}
                        {spontaneous ? "known" : "in spellbook"}
                      </span>
                      {!spontaneous && level === 0 && (
                        <button
                          type="button"
                          className="ghost small"
                          onClick={() => update(names)}
                        >
                          Add starting cantrips
                        </button>
                      )}
                      <div className="guide-choice-list">
                        {picks.map((name) => (
                          <article key={name}>
                            <strong>{name}</strong>
                            <button
                              type="button"
                              className="ghost small"
                              onClick={() =>
                                update(picks.filter((pick) => pick !== name))
                              }
                            >
                              Remove {name}
                            </button>
                          </article>
                        ))}
                      </div>
                      <select
                        aria-label={`Add level ${level} ${caster.className} spell`}
                        value=""
                        disabled={picks.length >= capacity}
                        onChange={(event) => {
                          if (event.target.value && picks.length < capacity)
                            update([...picks, event.target.value]);
                        }}
                      >
                        <option value="">Choose spell</option>
                        {names
                          .filter((name) => !picks.includes(name))
                          .map((name) => (
                            <option key={name}>{name}</option>
                          ))}
                      </select>
                    </div>
                  );
                })}
              <PreparedSpellChoices
                caster={caster}
                value={value.spellSelections?.[key]?.prepared ?? {}}
                onChange={(prepared) =>
                  onChange({
                    ...value,
                    spellSelections: {
                      ...value.spellSelections,
                      [key]: { ...value.spellSelections?.[key], prepared },
                    },
                  })
                }
              />
            </div>
          );
        })}
    </section>
  );
}
