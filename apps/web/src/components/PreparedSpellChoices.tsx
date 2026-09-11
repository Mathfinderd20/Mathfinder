import type { DerivedSpellcasting } from "@mathfinder/rules-engine";
export type PreparationChoices = Partial<Record<number, string[]>>;

/** Optional preparations are separate from acquiring spells or spells known. */
export function PreparedSpellChoices({
  caster,
  value,
  onChange,
  additions = false,
}: {
  caster: DerivedSpellcasting;
  value: PreparationChoices;
  onChange: (value: PreparationChoices) => void;
  additions?: boolean;
}) {
  if (caster.castingType !== "prepared") return null;
  return (
    <details className="field guide-archetypes">
      <summary>Daily preparations · optional</summary>
      <p className="hint">
        Choose a starting loadout, or prepare later on the Magic tab. Preparing
        a spell does not learn it.
      </p>
      {Object.keys(caster.baseSpellsPerDay)
        .map(Number)
        .map((level) => {
          const diagnostic = caster.selectionDiagnostics[level];
          if (!diagnostic) return null;
          const prior = additions
            ? (caster.selectedPreparedSpells[level] ?? [])
            : [];
          const capacity = Math.max(0, diagnostic.capacity - prior.length);
          const picks = value[level] ?? [];
          const names = [
            ...new Set([
              ...diagnostic.librarySpellNames,
              ...(caster.grantedSpells[level] ?? []),
              ...prior,
            ]),
          ].sort((a, b) => a.localeCompare(b));
          if (capacity === 0 && !picks.length) return null;
          return (
            <div className="field" key={level}>
              <span>
                Level {level} · {picks.length}/{capacity}{" "}
                {additions ? "additional preparations" : "prepared"}
              </span>
              {Array.from(
                {
                  length: Math.max(
                    picks.length,
                    Math.min(capacity, picks.length + 1),
                  ),
                },
                (_, index) => (
                  <label key={index}>
                    <span>Preparation {index + 1}</span>
                    <select
                      aria-label={`${caster.className} level ${level} preparation ${index + 1}`}
                      value={picks[index] ?? ""}
                      onChange={(event) => {
                        const next = [...picks];
                        if (event.target.value)
                          next[index] = event.target.value;
                        else next.splice(index, 1);
                        onChange({ ...value, [level]: next });
                      }}
                    >
                      <option value="">Choose a spell</option>
                      {names.map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                    </select>
                  </label>
                ),
              )}
              {picks.length > capacity && (
                <p className="form-error">
                  Preparations exceed this level’s available slots.
                </p>
              )}
            </div>
          );
        })}
    </details>
  );
}
