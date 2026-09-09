import { useMemo, useState } from "react";
import {
  analyzeRuntimeBuff,
  tacticalCategoryLabel,
  type RuntimeBuffView,
  type RuntimeProfile,
  type RuntimeTacticalCategory,
} from "../runtimeInsights";
import { FATIGUED_EFFECT_ID } from "../effectSelection";
import { CharacterDialog } from "./CharacterDialog";

export interface EffectLibraryFilters {
  search: string;
  category: string;
  target: string;
  bonus: string;
  tracking: string;
  ownership: string;
  letter: string;
}
export function filterEffectLibrary(
  buffs: RuntimeBuffView[],
  profile: RuntimeProfile,
  owned: string[],
  added: string[],
  filters: EffectLibraryFilters,
) {
  const terms = filters.search
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return buffs
    .filter((buff) => {
      const insight = analyzeRuntimeBuff(buff, profile);
      return (
        terms.every((term) => insight.searchText.includes(term)) &&
        (!filters.category ||
          insight.categories.includes(
            filters.category as RuntimeTacticalCategory,
          )) &&
        (!filters.target ||
          buff.modifiers.some((mod) => mod.target === filters.target)) &&
        (!filters.bonus ||
          buff.modifiers.some(
            (mod) => (mod.type ?? "untyped") === filters.bonus,
          )) &&
        (!filters.tracking ||
          (filters.tracking === "tracked"
            ? buff.trackerMax !== undefined
            : !!buff.limitations?.length)) &&
        (!filters.ownership ||
          (filters.ownership === "known"
            ? owned.some(
                (name) => name.toLowerCase() === buff.name.toLowerCase(),
              )
            : filters.ownership === "added"
              ? added.includes(buff.id)
              : !added.includes(buff.id))) &&
        (!filters.letter || buff.name.toUpperCase().startsWith(filters.letter))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
const emptyFilters: EffectLibraryFilters = {
  search: "",
  category: "",
  target: "",
  bonus: "",
  tracking: "",
  ownership: "available",
  letter: "",
};
export function EffectLibraryModal({
  buffs,
  profile,
  ownedSpellNames,
  addedIds,
  onApply,
  onClose,
}: {
  buffs: RuntimeBuffView[];
  profile: RuntimeProfile;
  ownedSpellNames: string[];
  addedIds: string[];
  onApply: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [filters, setFilters] = useState(emptyFilters);
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const catalog = useMemo(
    () => [
      ...buffs,
      {
        id: FATIGUED_EFFECT_ID,
        name: "Fatigued",
        description:
          "−2 Strength and Dexterity; cannot run or charge. Blocks Rage.",
        modifiers: [
          { target: "str", value: -2, source: "Fatigued" },
          { target: "dex", value: -2, source: "Fatigued" },
        ],
      },
    ],
    [buffs],
  );
  const matches = filterEffectLibrary(
    catalog,
    profile,
    ownedSpellNames,
    addedIds,
    filters,
  );
  const targets = [
    ...new Set(
      catalog.flatMap((buff) => buff.modifiers.map((mod) => mod.target)),
    ),
  ].sort();
  const bonuses = [
    ...new Set(
      catalog.flatMap((buff) =>
        buff.modifiers.map((mod) => mod.type ?? "untyped"),
      ),
    ),
  ].sort();
  const pages = Math.max(1, Math.ceil(matches.length / 40));
  const currentPage = Math.min(page, pages - 1);
  const update = (key: keyof EffectLibraryFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(0);
  };
  return (
    <CharacterDialog label="Effects & Conditions" onClose={onClose}>
      <section
        className="modal effect-library-dialog"
        aria-labelledby="effect-library-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="character-eyebrow">Character effects library</span>
            <h2 id="effect-library-title">Effects &amp; Conditions</h2>
          </div>
          <span className="effect-library-count">
            {selected.length} selected
          </span>
        </div>
        <label className="field">
          <span>Search effects and conditions</span>
          <input
            autoFocus
            type="search"
            placeholder="Name, rules text, modifier, or category…"
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
          />
        </label>
        <div className="effect-library-filters">
          <label>
            Category
            <select
              value={filters.category}
              onChange={(event) => update("category", event.target.value)}
            >
              <option value="">All categories</option>
              {(
                [
                  "offense",
                  "defense",
                  "mobility",
                  "casting",
                  "utility",
                ] as const
              ).map((category) => (
                <option key={category} value={category}>
                  {tacticalCategoryLabel(category)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Modified stat
            <select
              value={filters.target}
              onChange={(event) => update("target", event.target.value)}
            >
              <option value="">All stats</option>
              {targets.map((target) => (
                <option key={target}>{target}</option>
              ))}
            </select>
          </label>
          <label>
            Bonus type
            <select
              value={filters.bonus}
              onChange={(event) => update("bonus", event.target.value)}
            >
              <option value="">All types</option>
              {bonuses.map((bonus) => (
                <option key={bonus}>{bonus}</option>
              ))}
            </select>
          </label>
          <label>
            Rules
            <select
              value={filters.tracking}
              onChange={(event) => update("tracking", event.target.value)}
            >
              <option value="">All effects</option>
              <option value="tracked">Has resource tracker</option>
              <option value="manual">Has manual rules</option>
            </select>
          </label>
          <label>
            Availability
            <select
              value={filters.ownership}
              onChange={(event) => update("ownership", event.target.value)}
            >
              <option value="available">Not yet added</option>
              <option value="">All</option>
              <option value="added">Already added</option>
              <option value="known">Known spell effects</option>
            </select>
          </label>
        </div>
        <div className="effect-library-alphabet">
          <label>
            Jump to letter <strong>{filters.letter || "All"}</strong>
            <input
              type="range"
              aria-label="Jump to letter"
              min={0}
              max={26}
              value={filters.letter ? filters.letter.charCodeAt(0) - 64 : 0}
              onChange={(event) =>
                update(
                  "letter",
                  Number(event.target.value)
                    ? String.fromCharCode(64 + Number(event.target.value))
                    : "",
                )
              }
            />
          </label>
          <div>
            {["", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((letter) => (
              <button
                type="button"
                className="ghost small"
                aria-pressed={filters.letter === letter}
                key={letter}
                onClick={() => update("letter", letter)}
              >
                {letter || "All"}
              </button>
            ))}
          </div>
        </div>
        <div className="effect-library-result-head">
          <span>{matches.length} matches</span>
          <button
            type="button"
            className="ghost small"
            onClick={() => {
              setFilters(emptyFilters);
              setPage(0);
            }}
          >
            Reset filters
          </button>
        </div>
        <div className="effect-library-results">
          {matches
            .slice(currentPage * 40, (currentPage + 1) * 40)
            .map((buff) => (
              <label className="effect-library-option" key={buff.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(buff.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, buff.id]
                        : current.filter((id) => id !== buff.id),
                    )
                  }
                />
                <span>
                  <strong>{buff.name}</strong>
                  <small>
                    {addedIds.includes(buff.id)
                      ? "Already in Active Now · "
                      : ""}
                    {buff.modifiers.map((mod) => mod.target).join(" · ")}
                  </small>
                  <span>{buff.description}</span>
                  {buff.limitations?.length ? (
                    <small>Manual: {buff.limitations.join(" ")}</small>
                  ) : null}
                </span>
              </label>
            ))}
          {!matches.length ? (
            <p className="hint">
              No matches. Try another letter or broaden the filters.
            </p>
          ) : null}
        </div>
        <div className="effect-library-pagination">
          <button
            type="button"
            className="ghost small"
            disabled={!currentPage}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </button>
          <span>
            Page {currentPage + 1} of {pages}
          </span>
          <button
            type="button"
            className="ghost small"
            disabled={currentPage >= pages - 1}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
        <div className="modal-actions">
          <span>Apply adds and enables the selected effects.</span>
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected.length}
            onClick={() => onApply(selected)}
          >
            Apply ({selected.length})
          </button>
        </div>
      </section>
    </CharacterDialog>
  );
}
