import { displaySpellName } from "../spellLabels";
import { spellTitle } from "../rulesText";
import {
  spellSeedKey,
  type SpellSeedGroup,
  type SpellSeedSelections,
} from "../spellSeedPlans";
import { Tooltip } from "./Tooltip";

interface Props {
  groups: SpellSeedGroup[];
  selections: SpellSeedSelections;
  onChange: (selections: SpellSeedSelections) => void;
  required?: boolean;
}

export function SpellSeedPicker({
  groups,
  selections,
  onChange,
  required = false,
}: Props) {
  function selectedCount(group: SpellSeedGroup) {
    return group.suggestions.filter(
      (entry) =>
        selections[spellSeedKey(group.classKey, group.level, entry.spellName)],
    ).length;
  }

  function toggle(group: SpellSeedGroup, spellName: string) {
    const key = spellSeedKey(group.classKey, group.level, spellName);
    if (selections[key]) {
      const next = { ...selections };
      delete next[key];
      onChange(next);
    } else if (selectedCount(group) < group.capacity) {
      onChange({ ...selections, [key]: true });
    }
  }

  function selectTopPicks(group: SpellSeedGroup) {
    const prefix = `${group.classKey}:${group.level}:`;
    const next = Object.fromEntries(
      Object.entries(selections).filter(([key]) => !key.startsWith(prefix)),
    ) as SpellSeedSelections;
    for (const entry of group.suggestions.slice(0, group.capacity))
      next[spellSeedKey(group.classKey, group.level, entry.spellName)] = true;
    onChange(next);
  }

  function clear(group: SpellSeedGroup) {
    const prefix = `${group.classKey}:${group.level}:`;
    onChange(
      Object.fromEntries(
        Object.entries(selections).filter(([key]) => !key.startsWith(prefix)),
      ) as SpellSeedSelections,
    );
  }

  return (
    <div className="spell-seed-groups">
      {groups.map((group) => {
        const count = selectedCount(group);
        const target = group.capacity;
        return (
          <div
            key={`spell-seed-${group.classKey}-${group.level}`}
            className="modal-spell-seed-card"
          >
            <div className="modal-spell-seed-head">
              <strong>
                {group.className} L{group.level}
              </strong>
              <span className="muted">
                {count}/{required ? target : group.capacity}{" "}
                {required ? "selected" : `queued for ${group.mode}`}
              </span>
            </div>
            <div className="planner-suggestions modal-guidance-chips">
              <button
                type="button"
                className="ghost tiny planner-suggestion-chip"
                onClick={() => selectTopPicks(group)}
              >
                Use Top Picks
              </button>
              <button
                type="button"
                className="ghost tiny planner-suggestion-chip"
                onClick={() => clear(group)}
              >
                Clear
              </button>
            </div>
            <div className="planner-suggestions modal-guidance-chips">
              {group.suggestions
                .filter(
                  (entry) =>
                    selections[
                      spellSeedKey(group.classKey, group.level, entry.spellName)
                    ],
                )
                .map((entry) => {
                  const key = spellSeedKey(
                    group.classKey,
                    group.level,
                    entry.spellName,
                  );
                  const selected = Boolean(selections[key]);
                  return (
                    <Tooltip key={key} content={spellTitle(entry.spellName)}>
                      <button
                        type="button"
                        className={`ghost tiny planner-suggestion-chip spell-suggestion-chip ${selected ? "active" : ""}`}
                        title={entry.reason}
                        disabled={!selected && count >= group.capacity}
                        onClick={() => toggle(group, entry.spellName)}
                      >
                        <span>{displaySpellName(entry.spellName)}</span>
                        {entry.badges?.length ? (
                          <span className="spell-suggestion-badges">
                            {entry.badges.join(" · ")}
                          </span>
                        ) : null}
                      </button>
                    </Tooltip>
                  );
                })}
            </div>
            <select
              aria-label={`Add level ${group.level} ${group.className} known spell`}
              value=""
              disabled={count >= group.capacity}
              onChange={(event) => {
                if (event.target.value) toggle(group, event.target.value);
              }}
            >
              <option value="">Choose a known spell</option>
              {group.suggestions
                .filter(
                  (entry) =>
                    !selections[
                      spellSeedKey(group.classKey, group.level, entry.spellName)
                    ],
                )
                .map((entry) => (
                  <option key={entry.spellName} value={entry.spellName}>
                    {displaySpellName(entry.spellName)}
                  </option>
                ))}
            </select>
            {required && count < target ? (
              <span className="form-error">
                Choose {target - count} more known spell
                {target - count === 1 ? "" : "s"}.
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
