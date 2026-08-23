import { useMemo, useState } from "react";
import type { ArchetypeDefinitionLike } from "@mathfinder/rules-engine";

interface ArchetypePickerProps {
  className: string;
  archetypes: ArchetypeDefinitionLike[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

function archetypeSearchText(archetype: ArchetypeDefinitionLike) {
  return [
    archetype.name,
    archetype.description,
    ...(archetype.replaces ?? []),
    ...(archetype.alters ?? []),
    ...(archetype.modifies ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

export function filterArchetypes(
  archetypes: ArchetypeDefinitionLike[],
  query: string,
) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return archetypes
    .filter((archetype) => {
      const searchText = archetypeSearchText(archetype);
      return terms.every((term) => searchText.includes(term));
    })
    .sort((a, b) => {
      const queryText = terms.join(" ");
      const aStarts = a.name.toLowerCase().startsWith(queryText) ? 1 : 0;
      const bStarts = b.name.toLowerCase().startsWith(queryText) ? 1 : 0;
      return bStarts - aStarts || a.name.localeCompare(b.name);
    });
}

function ArchetypeCard(props: {
  archetype: ArchetypeDefinitionLike;
  applied: boolean;
  defaultOpen?: boolean;
  onApply: (applied: boolean) => void;
}) {
  const { archetype, applied, defaultOpen = false, onApply } = props;
  return (
    <details
      className={`archetype-result-card ${applied ? "applied" : ""}`}
      open={defaultOpen || undefined}
    >
      <summary>
        <strong>{archetype.name}</strong>
        <span className="skill-builder-meta">
          {applied ? "Applied" : "Click to inspect"}
        </span>
      </summary>
      <div className="archetype-result-body">
        <p>{archetype.description}</p>
        {archetype.replaces?.length ? (
          <p className="hint">
            <strong>Replaces:</strong> {archetype.replaces.join(", ")}
          </p>
        ) : null}
        {archetype.alters?.length ? (
          <p className="hint">
            <strong>Alters:</strong> {archetype.alters.join(", ")}
          </p>
        ) : null}
        {archetype.modifies?.length ? (
          <p className="hint">
            <strong>Modifies:</strong> {archetype.modifies.join(", ")}
          </p>
        ) : null}
        <label className={`pick archetype-apply-pick ${applied ? "on" : ""}`}>
          <input
            type="checkbox"
            checked={applied}
            onChange={(event) => onApply(event.target.checked)}
          />
          <span>
            <strong>Apply {archetype.name}</strong>
          </span>
        </label>
      </div>
    </details>
  );
}

export function ArchetypePicker({
  className,
  archetypes,
  selectedIds,
  onSelectionChange,
}: ArchetypePickerProps) {
  const [query, setQuery] = useState("");
  const normalizedSelectedIds = selectedIds.map((id) => id.toLowerCase());
  const selected = archetypes.filter((archetype) =>
    normalizedSelectedIds.includes(archetype.id.toLowerCase()),
  );
  const matches = useMemo(
    () => filterArchetypes(archetypes, query).slice(0, 20),
    [archetypes, query],
  );

  function setApplied(archetype: ArchetypeDefinitionLike, applied: boolean) {
    const id = archetype.id.toLowerCase();
    onSelectionChange(
      applied
        ? [...new Set([...normalizedSelectedIds, archetype.id])]
        : normalizedSelectedIds.filter((selectedId) => selectedId !== id),
    );
  }

  return (
    <div className="archetype-picker-card">
      <div className="editor-section-head tight">
        <h3>{className}</h3>
        <span className="skill-builder-meta">
          {selected.length} applied · {archetypes.length} available
        </span>
      </div>

      {selected.length > 0 ? (
        <div className="archetype-result-list selected-archetypes">
          {selected.map((archetype) => (
            <ArchetypeCard
              key={`selected-${archetype.id}`}
              archetype={archetype}
              applied
              defaultOpen
              onApply={(applied) => setApplied(archetype, applied)}
            />
          ))}
        </div>
      ) : (
        <p className="hint">No archetype applied.</p>
      )}

      <input
        className="searchable-name-input archetype-search-input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${className} archetypes`}
        autoComplete="off"
      />

      {query.trim() ? (
        matches.length > 0 ? (
          <div className="archetype-result-list search-results">
            {matches.map((archetype) => (
              <ArchetypeCard
                key={`result-${archetype.id}`}
                archetype={archetype}
                applied={normalizedSelectedIds.includes(
                  archetype.id.toLowerCase(),
                )}
                onApply={(applied) => setApplied(archetype, applied)}
              />
            ))}
          </div>
        ) : (
          <p className="hint">No matching archetypes.</p>
        )
      ) : (
        <p className="hint">
          Search by name, description, or replaced feature. Results stay hidden
          until you search.
        </p>
      )}
    </div>
  );
}
