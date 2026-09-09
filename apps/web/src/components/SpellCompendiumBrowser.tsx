import { useEffect, useMemo, useState } from "react";
import { displaySpellName } from "../spellLabels";
import {
  collectSpellSchools,
  collectSpellTags,
  filterSpellCompendiumOptions,
  type SpellCompendiumOption,
} from "../spellOptionData";
import {
  defaultSpellSuggestionProfile,
  scoreSpellSuggestion,
  spellSuggestionBadges,
} from "../spellSuggestions";
import { Tooltip } from "./Tooltip";

interface Props {
  className: string;
  classKey: string;
  levels: number[];
  mode: "prepared" | "known";
  spellOptions: SpellCompendiumOption[];
  selectionCounts: Partial<Record<number, number>>;
  selectionCapacities: Partial<Record<number, number>>;
  librarySpells: Partial<Record<number, string[]>>;
  selectedSpells: Partial<Record<number, string[]>>;
  onAppendLibraryEntry: (
    classKey: string,
    level: number,
    spellName: string,
  ) => void;
  onAppendSelection: (
    classKey: string,
    mode: "prepared" | "known",
    level: number,
    spellName: string,
  ) => void;
  onOpenSpell?: (spellName: string) => void;
}

type SpellBrowserSort = "recommended" | "alphabetical" | "level" | "school";

function compareSpellBrowserOptions(
  a: SpellCompendiumOption,
  b: SpellCompendiumOption,
  sort: SpellBrowserSort,
  classKey: string,
  className: string,
) {
  const aLevel =
    a.spell?.classes.find((entry) => entry.className.toLowerCase() === classKey)
      ?.level ?? 99;
  const bLevel =
    b.spell?.classes.find((entry) => entry.className.toLowerCase() === classKey)
      ?.level ?? 99;
  if (sort === "alphabetical") return a.name.localeCompare(b.name);
  if (sort === "level") return aLevel - bLevel || a.name.localeCompare(b.name);
  if (sort === "school")
    return (
      a.schoolTag.localeCompare(b.schoolTag) ||
      aLevel - bLevel ||
      a.name.localeCompare(b.name)
    );
  const aScore = a.spell
    ? scoreSpellSuggestion(
        a.spell,
        defaultSpellSuggestionProfile(className, aLevel),
      )
    : 0;
  const bScore = b.spell
    ? scoreSpellSuggestion(
        b.spell,
        defaultSpellSuggestionProfile(className, bLevel),
      )
    : 0;
  return (
    bScore - aScore ||
    b.tagList.length - a.tagList.length ||
    aLevel - bLevel ||
    a.name.localeCompare(b.name)
  );
}

export function SpellCompendiumBrowser({
  className,
  classKey,
  levels,
  mode,
  spellOptions,
  selectionCounts,
  selectionCapacities,
  librarySpells,
  selectedSpells,
  onAppendLibraryEntry,
  onAppendSelection,
  onOpenSpell,
}: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<number | null>(
    levels[0] ?? null,
  );
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [schoolFilter, setSchoolFilter] = useState<string | null>(null);
  const [supportFilter, setSupportFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SpellBrowserSort>("recommended");
  const [visibleCount, setVisibleCount] = useState(24);

  const classSpells = useMemo(
    () =>
      filterSpellCompendiumOptions(spellOptions, {
        classKey,
        level: null,
        query: "",
      }),
    [classKey, spellOptions],
  );
  const filteredForFacets = useMemo(
    () =>
      filterSpellCompendiumOptions(spellOptions, {
        classKey,
        level: levelFilter,
        query: "",
      }),
    [classKey, levelFilter, spellOptions],
  );
  const availableTags = useMemo(
    () => collectSpellTags(filteredForFacets),
    [filteredForFacets],
  );
  const availableSchools = useMemo(
    () => collectSpellSchools(filteredForFacets),
    [filteredForFacets],
  );
  const availableSupportTags = useMemo(
    () =>
      [...new Set(filteredForFacets.map((option) => option.supportTag))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [filteredForFacets],
  );
  const filteredResults = useMemo(
    () =>
      filterSpellCompendiumOptions(spellOptions, {
        classKey,
        level: levelFilter,
        tag: tagFilter,
        school: schoolFilter,
        query: debouncedQuery,
      })
        .filter((option) =>
          supportFilter ? option.supportTag === supportFilter : true,
        )
        .sort((a, b) =>
          compareSpellBrowserOptions(a, b, sortMode, classKey, className),
        ),
    [
      classKey,
      className,
      levelFilter,
      debouncedQuery,
      schoolFilter,
      sortMode,
      spellOptions,
      supportFilter,
      tagFilter,
    ],
  );
  const results = useMemo(
    () => filteredResults.slice(0, visibleCount),
    [filteredResults, visibleCount],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 100);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    setVisibleCount(24);
  }, [
    debouncedQuery,
    levelFilter,
    tagFilter,
    schoolFilter,
    supportFilter,
    sortMode,
    classKey,
  ]);

  return (
    <div className="item-card nested spell-browser-card">
      <div className="editor-section-head tight">
        <h3>Spell Browser</h3>
        <span className="skill-builder-meta">
          {classSpells.length} {className} spells loaded
        </span>
      </div>
      <p className="hint">
        Search the runtime spell catalog without pretending your memory is a
        database index.
      </p>

      <div className="spell-browser-toolbar">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${className} spells`}
        />
        <button
          type="button"
          className="ghost small"
          onClick={() => {
            setQuery("");
            setDebouncedQuery("");
            setLevelFilter(levels[0] ?? null);
            setTagFilter(null);
            setSchoolFilter(null);
            setSupportFilter(null);
            setSortMode("recommended");
          }}
        >
          Reset Filters
        </button>
        <label className="spell-browser-sort">
          <span>Sort</span>
          <select
            value={sortMode}
            onChange={(event) =>
              setSortMode(event.target.value as SpellBrowserSort)
            }
          >
            <option value="recommended">Recommended</option>
            <option value="alphabetical">A–Z</option>
            <option value="level">Level</option>
            <option value="school">School</option>
          </select>
        </label>
        <span className="resource-label">
          {results.length}/{filteredResults.length} shown
        </span>
      </div>

      <div className="spell-filter-strip">
        <button
          type="button"
          className={`ghost tiny ${levelFilter == null ? "active-template-choice" : ""}`}
          onClick={() => setLevelFilter(null)}
        >
          All Levels
        </button>
        {levels.map((level) => (
          <button
            key={`browser-level-${classKey}-${level}`}
            type="button"
            className={`ghost tiny ${levelFilter === level ? "active-template-choice" : ""}`}
            onClick={() => setLevelFilter(level)}
          >
            L{level}
          </button>
        ))}
      </div>

      <div className="spell-filter-strip">
        <button
          type="button"
          className={`ghost tiny ${tagFilter == null ? "active-template-choice" : ""}`}
          onClick={() => setTagFilter(null)}
        >
          All Tags
        </button>
        {availableTags.map((tag) => (
          <button
            key={`browser-tag-${classKey}-${tag}`}
            type="button"
            className={`ghost tiny ${tagFilter === tag ? "active-template-choice" : ""}`}
            onClick={() => setTagFilter(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="spell-filter-strip">
        <button
          type="button"
          className={`ghost tiny ${schoolFilter == null ? "active-template-choice" : ""}`}
          onClick={() => setSchoolFilter(null)}
        >
          All Schools
        </button>
        {availableSchools.map((school) => (
          <button
            key={`browser-school-${classKey}-${school}`}
            type="button"
            className={`ghost tiny ${schoolFilter === school ? "active-template-choice" : ""}`}
            onClick={() => setSchoolFilter(school)}
          >
            {school}
          </button>
        ))}
      </div>

      <div className="spell-filter-strip">
        <button
          type="button"
          className={`ghost tiny ${supportFilter == null ? "active-template-choice" : ""}`}
          onClick={() => setSupportFilter(null)}
        >
          All Support
        </button>
        {availableSupportTags.map((supportTag) => (
          <button
            key={`browser-support-${classKey}-${supportTag}`}
            type="button"
            className={`ghost tiny ${supportFilter === supportTag ? "active-template-choice" : ""}`}
            onClick={() => setSupportFilter(supportTag)}
          >
            {supportTag}
          </button>
        ))}
      </div>

      <div className="spell-browser-results">
        {results.map((option) => {
          const targetLevel =
            levelFilter ??
            option.spell?.classes.find(
              (entry) => entry.className.toLowerCase() === classKey,
            )?.level;
          const inLibrary =
            targetLevel == null
              ? false
              : (librarySpells[targetLevel] ?? []).includes(option.name);
          const inSelection =
            targetLevel == null
              ? false
              : (selectedSpells[targetLevel] ?? []).includes(option.name);
          const selectionCount =
            targetLevel == null ? 0 : (selectionCounts[targetLevel] ?? 0);
          const selectionCapacity =
            targetLevel == null ? 0 : (selectionCapacities[targetLevel] ?? 0);
          const canAddSelection =
            targetLevel != null && selectionCount < selectionCapacity;
          const browseBadges = option.spell
            ? spellSuggestionBadges(
                option.spell,
                defaultSpellSuggestionProfile(className, targetLevel ?? 1),
              )
            : option.tagList;
          return (
            <div
              key={`browser-spell-${classKey}-${option.id}`}
              className="spell-browser-result"
            >
              <div className="spell-browser-result-head">
                <button
                  type="button"
                  className="spell-browser-name"
                  onClick={() => onOpenSpell?.(option.name)}
                >
                  {displaySpellName(option.name)}
                </button>
                {targetLevel != null ? (
                  <span className="resource-label">L{targetLevel}</span>
                ) : null}
              </div>
              {option.metaTag ? (
                <div className="searchable-picker-option-meta">
                  {option.metaTag}
                </div>
              ) : null}
              {browseBadges.length > 0 ||
              option.sourceTag ||
              option.supportSummary ? (
                <div className="spell-chip-list readonly">
                  {browseBadges.map((tag) => (
                    <span key={`${option.id}-${tag}`} className="chip">
                      {tag}
                    </span>
                  ))}
                  <span className="chip">{option.supportTag}</span>
                  {option.sourceTag ? (
                    <span className="chip">{option.sourceTag}</span>
                  ) : null}
                </div>
              ) : null}
              {option.supportSummary ? (
                <p className="hint spell-browser-desc">
                  {option.supportSummary}
                </p>
              ) : null}
              {option.spell?.description ? (
                <p className="hint spell-browser-desc">
                  {option.spell.description.slice(0, 220)}
                  {option.spell.description.length > 220 ? "…" : ""}
                </p>
              ) : null}
              <div className="resource-buttons wrap">
                {option.sourceUrl ? (
                  <a
                    className="ghost small spell-source-link"
                    href={option.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source
                  </a>
                ) : null}
                <Tooltip content={option.tooltip}>
                  <button
                    type="button"
                    className="ghost small"
                    disabled={targetLevel == null || inLibrary}
                    onClick={() =>
                      targetLevel != null &&
                      onAppendLibraryEntry(classKey, targetLevel, option.name)
                    }
                  >
                    {inLibrary ? "In Library" : "Add to Library"}
                  </button>
                </Tooltip>
                <Tooltip content={option.tooltip}>
                  <button
                    type="button"
                    className="ghost small"
                    disabled={
                      targetLevel == null ||
                      (mode === "known" && inSelection) ||
                      !canAddSelection
                    }
                    onClick={() => {
                      if (targetLevel == null) return;
                      if (!inLibrary)
                        onAppendLibraryEntry(
                          classKey,
                          targetLevel,
                          option.name,
                        );
                      onAppendSelection(
                        classKey,
                        mode,
                        targetLevel,
                        option.name,
                      );
                    }}
                  >
                    {mode === "prepared"
                      ? `Prepare${inSelection ? " another" : ""}`
                      : inSelection
                        ? "Known"
                        : "Add to Known"}
                  </button>
                </Tooltip>
              </div>
            </div>
          );
        })}
        {results.length === 0 ? (
          <p className="hint">
            No spell results. Your filters got a little too spicy.
          </p>
        ) : null}
      </div>
      {filteredResults.length > results.length ? (
        <div className="resource-buttons wrap">
          <button
            type="button"
            className="ghost small"
            onClick={() => setVisibleCount((count) => count + 24)}
          >
            Show More
          </button>
        </div>
      ) : null}
    </div>
  );
}
