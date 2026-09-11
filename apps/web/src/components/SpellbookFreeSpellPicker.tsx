import { displaySpellName } from "../spellLabels";
import {
  selectedSpellCount,
  spellSeedKey,
  type SpellSeedGroup,
  type SpellSeedSelections,
} from "../spellSeedPlans";

interface Props {
  groups: SpellSeedGroup[];
  selections: SpellSeedSelections;
  onChange: (selections: SpellSeedSelections) => void;
  requiredCount?: number;
}

export function SpellbookFreeSpellPicker({
  groups,
  selections,
  onChange,
  requiredCount = 2,
}: Props) {
  const candidates = groups.flatMap((group) =>
    group.suggestions.map((suggestion) => ({ group, suggestion })),
  );
  const selectedKeys = candidates
    .map(({ group, suggestion }) =>
      spellSeedKey(group.classKey, group.level, suggestion.spellName),
    )
    .filter((key) => selections[key]);
  const count = selectedSpellCount(groups, selections);

  function selectSlot(slotIndex: number, nextKey: string) {
    const next = { ...selections };
    const previousKey = selectedKeys[slotIndex];
    if (previousKey) delete next[previousKey];
    if (nextKey) next[nextKey] = true;
    onChange(next);
  }

  function selectTopPicks() {
    const next: SpellSeedSelections = {};
    for (const { group, suggestion } of candidates.slice(0, requiredCount))
      next[spellSeedKey(group.classKey, group.level, suggestion.spellName)] =
        true;
    onChange(next);
  }

  return (
    <div className="spell-seed-groups">
      <div className="modal-spell-seed-head">
        <strong>Free spellbook spells</strong>
        <span className="muted">
          {count}/{requiredCount} selected
        </span>
      </div>
      <div className="planner-suggestions modal-guidance-chips">
        <button
          type="button"
          className="ghost tiny planner-suggestion-chip"
          disabled={candidates.length < requiredCount}
          onClick={selectTopPicks}
        >
          Use Top Picks
        </button>
        <button
          type="button"
          className="ghost tiny planner-suggestion-chip"
          onClick={() => onChange({})}
        >
          Clear
        </button>
      </div>
      {Array.from({ length: requiredCount }, (_, slotIndex) => (
        <label className="field compact" key={`spellbook-slot-${slotIndex}`}>
          <span>Free spell {slotIndex + 1}</span>
          <select
            aria-label={`Free spellbook spell ${slotIndex + 1}`}
            required
            value={selectedKeys[slotIndex] ?? ""}
            onChange={(event) => selectSlot(slotIndex, event.target.value)}
          >
            <option value="">Choose a spell</option>
            {groups.map((group) => (
              <optgroup
                key={`spellbook-level-${group.level}`}
                label={`Spell level ${group.level}`}
              >
                {group.suggestions.map((suggestion) => {
                  const key = spellSeedKey(
                    group.classKey,
                    group.level,
                    suggestion.spellName,
                  );
                  return (
                    <option
                      key={key}
                      value={key}
                      disabled={
                        selections[key] && selectedKeys[slotIndex] !== key
                      }
                    >
                      {displaySpellName(suggestion.spellName)}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
        </label>
      ))}
      {count < requiredCount ? (
        <span className="form-error">
          Choose {requiredCount - count} more free spellbook spell
          {requiredCount - count === 1 ? "" : "s"}.
        </span>
      ) : null}
    </div>
  );
}
