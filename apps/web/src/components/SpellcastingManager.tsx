import {
  getSpellEffectByName,
  type DerivedSpellcasting,
} from "@mathfinder/rules-engine";
import { useMemo, useState } from "react";
import type { SpellSuggestionChoice } from "../buildSuggestions";
import type { SpellCompendiumOption } from "../spellOptionData";
import { buildSpellCompendiumOptions } from "../spellOptionData";
import type { SpellCastCounts } from "../runtimeState";
import {
  displayDomainNames,
  displaySchoolName,
  displaySpellName,
  displaySpellNames,
} from "../spellLabels";
import { spellTitle } from "../rulesText";
import { CompendiumPicker, type CompendiumOption } from "./CompendiumPicker";
import { SpellCompendiumBrowser } from "./SpellCompendiumBrowser";
import { Tooltip } from "./Tooltip";

type SpellMode = "prepared" | "known";
type SpellLevelTab = "library" | "active" | "runtime";

interface SpellIssue {
  label: string;
  detail: string;
}

function uniqueSpellNames(spellNames: string[]) {
  return [...new Set(spellNames.map((name) => name.trim()).filter(Boolean))];
}

function spellHasTag(
  option: SpellCompendiumOption | undefined,
  tag: string | null,
) {
  return !tag || !!option?.tagList.includes(tag);
}

function findSpellOption(options: SpellCompendiumOption[], spellName: string) {
  return options.find(
    (option) => option.name.toLowerCase() === spellName.trim().toLowerCase(),
  );
}

function spellMetaSummary(option: SpellCompendiumOption | undefined) {
  return option?.metaTag || option?.schoolTag || "";
}

function spellBadgesSummary(option: SpellCompendiumOption | undefined) {
  return option?.tagList?.slice(0, 4) ?? [];
}

interface SpellOption {
  id: string;
  name: string;
}

interface Props {
  casters: DerivedSpellcasting[];
  classArchetypes?: Partial<Record<string, string[]>>;
  spellOptions: SpellOption[];
  domainOptions: Array<{ id: string; name: string }>;
  schoolOptions: Array<{ id: string; name: string }>;
  spellCastCounts: SpellCastCounts;
  spellSuggestions: Record<
    string,
    Partial<Record<number, SpellSuggestionChoice[]>>
  >;
  onAddSelection: (classKey: string, mode: SpellMode, level: number) => void;
  onAppendSelection: (
    classKey: string,
    mode: SpellMode,
    level: number,
    spellName: string,
  ) => void;
  onUpdateSelectionName: (
    classKey: string,
    mode: SpellMode,
    level: number,
    index: number,
    value: string,
  ) => void;
  onRemoveSelection: (
    classKey: string,
    mode: SpellMode,
    level: number,
    index: number,
  ) => void;
  onResetSelectionsForLevel: (
    classKey: string,
    mode: SpellMode,
    level: number,
  ) => void;
  onResetSelectionsForClass: (
    classKey: string,
    mode: SpellMode,
    levels: number[],
  ) => void;
  onAddLibraryEntry: (classKey: string, level: number) => void;
  onAppendLibraryEntry: (
    classKey: string,
    level: number,
    spellName: string,
  ) => void;
  onUpdateLibraryName: (
    classKey: string,
    level: number,
    index: number,
    value: string,
  ) => void;
  onRemoveLibraryEntry: (
    classKey: string,
    level: number,
    index: number,
  ) => void;
  onResetLibraryLevel: (classKey: string, level: number) => void;
  onResetLibraryForClass: (classKey: string, levels: number[]) => void;
  onFillSelectionsFromLibrary: (
    classKey: string,
    mode: SpellMode,
    level: number,
    capacity: number,
  ) => void;
  onUpdateDomains: (classKey: string, index: number, value: string) => void;
  onUpdateSpecialization: (classKey: string, value: string) => void;
  onAdjustExtraSpellSlots: (
    classKey: string,
    level: number,
    delta: number,
  ) => void;
  onAdjustSpellSlot: (
    classKey: string,
    level: number,
    max: number,
    delta: number,
  ) => void;
  onCastSpell: (
    classKey: string,
    level: number,
    max: number,
    spellName: string,
    remaining: number,
  ) => void;
  onResetSpellSlotLevel: (classKey: string, level: number) => void;
  onResetSpellRuntimeClass: (classKey: string, levels: number[]) => void;
}

export function SpellcastingManager({
  casters,
  classArchetypes,
  spellOptions,
  domainOptions,
  schoolOptions,
  spellCastCounts,
  spellSuggestions,
  onAddSelection,
  onAppendSelection,
  onUpdateSelectionName,
  onRemoveSelection,
  onResetSelectionsForLevel,
  onResetSelectionsForClass,
  onAddLibraryEntry,
  onAppendLibraryEntry,
  onUpdateLibraryName,
  onRemoveLibraryEntry,
  onResetLibraryLevel,
  onResetLibraryForClass,
  onFillSelectionsFromLibrary,
  onUpdateDomains,
  onUpdateSpecialization,
  onAdjustExtraSpellSlots,
  onAdjustSpellSlot,
  onCastSpell,
  onResetSpellSlotLevel,
  onResetSpellRuntimeClass,
}: Props) {
  const [spellLevelTabs, setSpellLevelTabs] = useState<
    Record<string, SpellLevelTab>
  >({});
  const [spellTagFilters, setSpellTagFilters] = useState<
    Record<string, string | null>
  >({});
  const [spellSchoolFilters, setSpellSchoolFilters] = useState<
    Record<string, string | null>
  >({});
  const spellCompendiumOptions = useMemo(
    () => buildSpellCompendiumOptions(spellOptions),
    [spellOptions],
  );

  if (casters.length === 0) return null;

  return (
    <>
      <div className="editor-section-head">
        <h3>Spellcasting Build Setup</h3>
      </div>
      <p className="hint">
        Manage library/learnable spells, prepared or known picks, and runtime
        usage in one caster block. Less note-card necromancy, more actual sheet
        behavior.
      </p>
      <div className="item-list">
        {casters.map((caster) => {
          const classKey = caster.className.toLowerCase();
          const mode: SpellMode =
            caster.castingType === "prepared" ? "prepared" : "known";
          const selections =
            mode === "prepared"
              ? caster.selectedPreparedSpells
              : caster.selectedKnownSpells;
          const levels = Object.keys(caster.selectionDiagnostics)
            .map(Number)
            .sort((a, b) => a - b);
          const domainNames = displayDomainNames(caster.domains);
          const schoolName = displaySchoolName(caster.specialistSchool);
          const selectedArchetypes = classArchetypes?.[classKey] ?? [];
          const domainsEnabled =
            caster.className.toLowerCase() !== "cleric" ||
            !selectedArchetypes.some(
              (id) => id.toLowerCase() === "battle-chaplain",
            );
          const invalidLevels = levels.filter((level) => {
            const diag = caster.selectionDiagnostics[level];
            return (
              !!diag &&
              (!diag.canCastLevel ||
                diag.overCapacity ||
                diag.unknownSpells.length > 0 ||
                diag.offListSpells.length > 0 ||
                diag.wrongLevelSpells.length > 0 ||
                diag.missingFromLibrary.length > 0)
            );
          });
          return (
            <div className="item-card" key={`spellcasting-${classKey}`}>
              <div className="editor-section-head tight">
                <h3>{caster.className} Spellcasting</h3>
                <div className="resource-buttons">
                  <button
                    className="ghost small"
                    onClick={() => onResetLibraryForClass(classKey, levels)}
                  >
                    Clear Library
                  </button>
                  <button
                    className="ghost small"
                    onClick={() =>
                      onResetSelectionsForClass(classKey, mode, levels)
                    }
                  >
                    Clear Selections
                  </button>
                  <button
                    className="ghost small"
                    onClick={() => onResetSpellRuntimeClass(classKey, levels)}
                  >
                    Rest Runtime
                  </button>
                </div>
              </div>
              <div className="spell-class-summary">
                <span className="resource-label">
                  Caster level {caster.casterLevel}
                </span>
                <span className="resource-label">
                  {caster.castingAbility.toUpperCase()}{" "}
                  {caster.castingAbilityScore}
                </span>
                <span className="resource-label">
                  Concentration +{caster.concentration.total}
                </span>
                {domainNames.length > 0 ? (
                  <span className="resource-label">
                    Domains: {domainNames.join(", ")}
                  </span>
                ) : null}
                {schoolName ? (
                  <span className="resource-label">School: {schoolName}</span>
                ) : null}
                {invalidLevels.length > 0 ? (
                  <span className="warn-pill">
                    Needs fixes on L{invalidLevels.join(", L")}
                  </span>
                ) : (
                  <span className="ok-pill">Selections look legal</span>
                )}
              </div>

              {caster.className.toLowerCase() === "cleric" && domainsEnabled ? (
                <div className="item-card">
                  <div className="subsection-title">Domains</div>
                  <div className="editor-grid">
                    {[0, 1].map((index) => (
                      <label
                        className="field compact"
                        key={`domain-${classKey}-${index}`}
                      >
                        <span>Domain {index + 1}</span>
                        <select
                          value={caster.domains[index] ?? ""}
                          onChange={(e) =>
                            onUpdateDomains(classKey, index, e.target.value)
                          }
                        >
                          <option value="">None</option>
                          {domainOptions.map((domain) => (
                            <option key={domain.id} value={domain.id}>
                              {domain.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              {caster.className.toLowerCase() === "wizard" ? (
                <div className="item-card">
                  <div className="subsection-title">Specialist School</div>
                  <label className="field compact">
                    <span>School</span>
                    <select
                      value={caster.specialistSchool ?? ""}
                      onChange={(e) =>
                        onUpdateSpecialization(classKey, e.target.value)
                      }
                    >
                      <option value="">Universalist</option>
                      {schoolOptions.map((school) => (
                        <option key={school.id} value={school.id}>
                          {school.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              <SpellCompendiumBrowser
                className={caster.className}
                classKey={classKey}
                levels={levels}
                mode={mode}
                spellOptions={spellCompendiumOptions}
                selectionCounts={Object.fromEntries(
                  levels.map((level) => [
                    level,
                    (selections[level] ?? []).length,
                  ]),
                )}
                selectionCapacities={Object.fromEntries(
                  levels.map((level) => [
                    level,
                    caster.selectionDiagnostics[level]?.capacity ?? 0,
                  ]),
                )}
                librarySpells={caster.librarySpells}
                selectedSpells={selections}
                onAppendLibraryEntry={onAppendLibraryEntry}
                onAppendSelection={onAppendSelection}
              />

              {levels.map((level) => {
                const diag = caster.selectionDiagnostics[level];
                if (!diag) return null;
                const current = selections[level] ?? [];
                const library = caster.librarySpells[level] ?? [];
                const tabKey = `${classKey}:${level}`;
                const activeTab = spellLevelTabs[tabKey] ?? "active";
                const activeTagFilter = spellTagFilters[tabKey] ?? null;
                const activeSchoolFilter = spellSchoolFilters[tabKey] ?? null;
                const levelSpellOptions = spellCompendiumOptions.filter(
                  (option) =>
                    option.spell?.classes.some(
                      (entry) =>
                        entry.className.toLowerCase() === classKey &&
                        entry.level === level,
                    ),
                );
                const levelPickerOptions =
                  levelSpellOptions as CompendiumOption[];
                const levelSpellMap = new Map(
                  levelSpellOptions.map(
                    (option) => [option.name.toLowerCase(), option] as const,
                  ),
                );
                const levelTags = [
                  ...new Set(
                    levelSpellOptions.flatMap((option) => option.tagList),
                  ),
                ].sort((a, b) => a.localeCompare(b));
                const levelSchools = [
                  ...new Set(
                    levelSpellOptions
                      .map((option) => option.schoolTag)
                      .filter(Boolean),
                  ),
                ].sort((a, b) => a.localeCompare(b));
                const matchesFilters = (
                  option: SpellCompendiumOption | undefined,
                ) =>
                  spellHasTag(option, activeTagFilter) &&
                  (!activeSchoolFilter ||
                    option?.schoolTag === activeSchoolFilter);
                const quickLibraryPicks = levelSpellOptions
                  .filter(
                    (option) =>
                      !library.includes(option.name) && matchesFilters(option),
                  )
                  .slice(0, 8)
                  .map((option) => option.name);
                const quickSelectionPicks = levelSpellOptions
                  .filter(
                    (option) =>
                      !current.includes(option.name) && matchesFilters(option),
                  )
                  .slice(0, 8)
                  .map((option) => option.name);
                const suggestedSpells =
                  spellSuggestions[classKey]?.[level] ?? [];
                const suggestedLibraryPicks = suggestedSpells.filter(
                  (entry) =>
                    !library.includes(entry.spellName) &&
                    matchesFilters(
                      levelSpellMap.get(entry.spellName.toLowerCase()),
                    ),
                );
                const suggestedSelectionPicks = suggestedSpells.filter(
                  (entry) =>
                    !current.includes(entry.spellName) &&
                    matchesFilters(
                      levelSpellMap.get(entry.spellName.toLowerCase()),
                    ),
                );
                const canAddSelection = current.length < diag.capacity;
                const extraSlots = caster.extraSlotsPerDay[level] ?? 0;
                const runtimeMax = caster.spellsPerDay[level] ?? 0;
                const runtimeRemaining =
                  caster.slotsRemaining[level] ?? runtimeMax;
                const isAtWill = diag.isAtWill;
                const castables = uniqueSpellNames(
                  current.length > 0
                    ? current
                    : [...(caster.grantedSpells[level] ?? []), ...library],
                );
                const issues: SpellIssue[] = [
                  !diag.canCastLevel
                    ? {
                        label: "Ability",
                        detail: `Needs ${caster.castingAbility.toUpperCase()} ${diag.requiredAbilityScore} to cast level ${level}.`,
                      }
                    : null,
                  diag.overCapacity
                    ? {
                        label: "Capacity",
                        detail: `Over capacity at ${current.length}/${diag.capacity}.`,
                      }
                    : null,
                  diag.restrictedSlotShortfall > 0
                    ? {
                        label: "Restricted",
                        detail: `Need ${diag.restrictedSlotCapacity} granted spell pick(s); only ${diag.restrictedSlotEligibleSelectedCount} qualify.`,
                      }
                    : null,
                  diag.unknownSpells.length > 0
                    ? {
                        label: "Unknown",
                        detail: diag.unknownSpells.join(", "),
                      }
                    : null,
                  diag.offListSpells.length > 0
                    ? {
                        label: "Off-list",
                        detail: diag.offListSpells.join(", "),
                      }
                    : null,
                  diag.missingFromLibrary.length > 0
                    ? {
                        label: "Missing",
                        detail: diag.missingFromLibrary.join(", "),
                      }
                    : null,
                  diag.wrongLevelSpells.length > 0
                    ? {
                        label: "Wrong level",
                        detail: diag.wrongLevelSpells
                          .map((s) => `${s.name} (actual ${s.actualLevel})`)
                          .join(", "),
                      }
                    : null,
                ].filter((issue): issue is SpellIssue => !!issue);
                const issueCount = issues.length;
                return (
                  <details
                    className="spell-level-block spell-level-details"
                    key={`spell-level-${classKey}-${level}`}
                    open
                  >
                    <summary className="spell-level-summary-head">
                      <div className="spell-level-title-group">
                        <div className="subsection-title level-title">
                          Level {level}
                        </div>
                        <div className="spell-level-head-meta">
                          <span>
                            {mode === "prepared"
                              ? `${current.length}/${diag.capacity} prepared`
                              : `${current.length}/${diag.capacity} known`}
                          </span>
                          <span>
                            {isAtWill
                              ? "At will"
                              : `${runtimeRemaining}/${runtimeMax} slots`}
                          </span>
                          <span>{library.length} in library</span>
                        </div>
                      </div>
                      <div
                        className={`spell-level-head-status ${issueCount > 0 ? "warn" : "ok"}`}
                      >
                        {issueCount > 0
                          ? `${issueCount} issue${issueCount === 1 ? "" : "s"}`
                          : "Legal"}
                      </div>
                    </summary>

                    <div className="spell-level-summary-grid">
                      <div className="spell-summary-card">
                        <span className="spell-summary-label">Ready</span>
                        <strong>
                          {current.length}/{diag.capacity}
                        </strong>
                        <span className="muted">
                          {mode === "prepared" ? "prepared" : "known"}
                        </span>
                      </div>
                      <div className="spell-summary-card">
                        <span className="spell-summary-label">Library</span>
                        <strong>{library.length}</strong>
                        <span className="muted">saved spell names</span>
                      </div>
                      <div className="spell-summary-card">
                        <span className="spell-summary-label">Runtime</span>
                        <strong>
                          {isAtWill
                            ? "At will"
                            : `${runtimeRemaining}/${runtimeMax}`}
                        </strong>
                        <span className="muted">slots remaining</span>
                      </div>
                      <div
                        className={`spell-summary-card ${issueCount > 0 ? "warn" : "ok"}`}
                      >
                        <span className="spell-summary-label">Status</span>
                        <strong>
                          {issueCount > 0
                            ? `${issueCount} issue${issueCount === 1 ? "" : "s"}`
                            : "Legal"}
                        </strong>
                        <span className="muted">selection check</span>
                      </div>
                    </div>

                    <div className="resource-row runtime-row spell-runtime-toolbar">
                      <span className="resource-label">
                        Extra slots: +{extraSlots}
                      </span>
                      {(caster.restrictedExtraSlotsPerDay[level] ?? 0) > 0 ? (
                        <span className="resource-label">
                          Restricted: {caster.restrictedExtraSlotsPerDay[level]}
                        </span>
                      ) : null}
                      {(caster.grantedSpells[level]?.length ?? 0) > 0 ? (
                        <Tooltip
                          content={caster.grantedSpells[level]!.map(
                            (spellName) => spellTitle(spellName),
                          ).join("\n\n")}
                        >
                          <span className="resource-label">
                            Granted:{" "}
                            {displaySpellNames(
                              caster.grantedSpells[level]!,
                            ).join(", ")}
                          </span>
                        </Tooltip>
                      ) : null}
                      <div className="resource-buttons">
                        <button
                          className="ghost small"
                          disabled={diag.capacity <= 0}
                          onClick={() =>
                            onFillSelectionsFromLibrary(
                              classKey,
                              mode,
                              level,
                              diag.capacity,
                            )
                          }
                        >
                          Auto Fill
                        </button>
                        <button
                          className="ghost small"
                          onClick={() => onResetLibraryLevel(classKey, level)}
                          disabled={library.length === 0}
                        >
                          Clear Library
                        </button>
                        <button
                          className="ghost small"
                          onClick={() =>
                            onResetSelectionsForLevel(classKey, mode, level)
                          }
                          disabled={current.length === 0}
                        >
                          Clear Picks
                        </button>
                        <button
                          className="ghost small"
                          onClick={() =>
                            onAdjustExtraSpellSlots(classKey, level, -1)
                          }
                        >
                          -
                        </button>
                        <button
                          className="ghost small"
                          onClick={() =>
                            onAdjustExtraSpellSlots(classKey, level, 1)
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="tab-bar spell-tab-bar">
                      <button
                        type="button"
                        className={`tab-button ${activeTab === "library" ? "active" : ""}`}
                        onClick={() =>
                          setSpellLevelTabs((prev) => ({
                            ...prev,
                            [tabKey]: "library",
                          }))
                        }
                      >
                        Library
                      </button>
                      <button
                        type="button"
                        className={`tab-button ${activeTab === "active" ? "active" : ""}`}
                        onClick={() =>
                          setSpellLevelTabs((prev) => ({
                            ...prev,
                            [tabKey]: "active",
                          }))
                        }
                      >
                        {mode === "prepared" ? "Prepared" : "Known"}
                      </button>
                      <button
                        type="button"
                        className={`tab-button ${activeTab === "runtime" ? "active" : ""}`}
                        onClick={() =>
                          setSpellLevelTabs((prev) => ({
                            ...prev,
                            [tabKey]: "runtime",
                          }))
                        }
                      >
                        Runtime
                      </button>
                    </div>

                    <div className="spell-filter-strip">
                      <button
                        type="button"
                        className={`ghost tiny ${activeTagFilter == null ? "active-template-choice" : ""}`}
                        onClick={() =>
                          setSpellTagFilters((prev) => ({
                            ...prev,
                            [tabKey]: null,
                          }))
                        }
                      >
                        All Tags
                      </button>
                      {levelTags.map((tag) => (
                        <button
                          key={`filter-${tabKey}-${tag}`}
                          type="button"
                          className={`ghost tiny ${activeTagFilter === tag ? "active-template-choice" : ""}`}
                          onClick={() =>
                            setSpellTagFilters((prev) => ({
                              ...prev,
                              [tabKey]: prev[tabKey] === tag ? null : tag,
                            }))
                          }
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                    <div className="spell-filter-strip">
                      <button
                        type="button"
                        className={`ghost tiny ${activeSchoolFilter == null ? "active-template-choice" : ""}`}
                        onClick={() =>
                          setSpellSchoolFilters((prev) => ({
                            ...prev,
                            [tabKey]: null,
                          }))
                        }
                      >
                        All Schools
                      </button>
                      {levelSchools.map((school) => (
                        <button
                          key={`school-filter-${tabKey}-${school}`}
                          type="button"
                          className={`ghost tiny ${activeSchoolFilter === school ? "active-template-choice" : ""}`}
                          onClick={() =>
                            setSpellSchoolFilters((prev) => ({
                              ...prev,
                              [tabKey]: prev[tabKey] === school ? null : school,
                            }))
                          }
                        >
                          {school}
                        </button>
                      ))}
                    </div>

                    {activeTab === "library" ? (
                      <div className="spell-level-column spell-level-tab-panel">
                        <div className="subsection-title">
                          Library / Learnable Pool
                        </div>
                        <p className="hint">
                          Store spells you might use at this level. Think
                          reference shelf, not today’s loadout.
                        </p>
                        <div className="item-list compact-list">
                          {library.map((spellName, index) => {
                            const option = findSpellOption(
                              levelSpellOptions,
                              spellName,
                            );
                            const meta = spellMetaSummary(option);
                            const badges = spellBadgesSummary(option);
                            return (
                              <div
                                className="spell-entry-card"
                                key={`library-${classKey}-${level}-${index}`}
                              >
                                <div className="inline-row">
                                  <div className="inline-grow">
                                    <CompendiumPicker
                                      value={spellName}
                                      onChange={(value) =>
                                        onUpdateLibraryName(
                                          classKey,
                                          level,
                                          index,
                                          value,
                                        )
                                      }
                                      options={levelPickerOptions}
                                      placeholder="Search spell"
                                    />
                                  </div>
                                  <button
                                    className="ghost small"
                                    onClick={() =>
                                      onRemoveLibraryEntry(
                                        classKey,
                                        level,
                                        index,
                                      )
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                                {meta || badges.length > 0 ? (
                                  <div className="spell-inline-meta">
                                    {meta ? (
                                      <span className="searchable-picker-option-meta">
                                        {meta}
                                      </span>
                                    ) : null}
                                    {badges.length > 0 ? (
                                      <span className="spell-suggestion-badges">
                                        {badges.join(" · ")}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                          <div className="resource-buttons wrap">
                            <button
                              className="ghost small"
                              onClick={() => onAddLibraryEntry(classKey, level)}
                            >
                              Add Library Spell
                            </button>
                            {suggestedLibraryPicks.map((entry) => (
                              <Tooltip
                                key={`lib-suggest-${classKey}-${level}-${entry.spellName}`}
                                content={spellTitle(entry.spellName)}
                              >
                                <button
                                  className="ghost small planner-suggestion-chip spell-suggestion-chip"
                                  title={entry.reason}
                                  onClick={() =>
                                    onAppendLibraryEntry(
                                      classKey,
                                      level,
                                      entry.spellName,
                                    )
                                  }
                                >
                                  <span>
                                    {displaySpellName(entry.spellName)}
                                  </span>
                                  {entry.badges?.length ? (
                                    <span className="spell-suggestion-badges">
                                      {entry.badges.join(" · ")}
                                    </span>
                                  ) : null}
                                </button>
                              </Tooltip>
                            ))}
                            {quickLibraryPicks.map((spellName) => (
                              <Tooltip
                                key={`lib-pick-${classKey}-${level}-${spellName}`}
                                content={spellTitle(spellName)}
                              >
                                <button
                                  className="ghost small"
                                  onClick={() =>
                                    onAppendLibraryEntry(
                                      classKey,
                                      level,
                                      spellName,
                                    )
                                  }
                                >
                                  + {displaySpellName(spellName)}
                                </button>
                              </Tooltip>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {activeTab === "active" ? (
                      <div className="spell-level-column spell-level-tab-panel">
                        <div className="subsection-title">
                          {mode === "prepared"
                            ? "Prepared Today"
                            : "Known Spells"}
                        </div>
                        <p className="hint">
                          These are your active picks for actual play and
                          casting.
                        </p>
                        {issues.length > 0 ? (
                          <div className="spell-issue-list">
                            {issues.map((issue) => (
                              <Tooltip
                                key={`${tabKey}-${issue.label}-${issue.detail}`}
                                content={issue.detail}
                              >
                                <span className="spell-issue-badge">
                                  {issue.label}
                                </span>
                              </Tooltip>
                            ))}
                          </div>
                        ) : (
                          <div className="ok-pill">No validation issues</div>
                        )}
                        {diag.restrictedSlotCapacity > 0 &&
                        diag.restrictedSlotEligibleSpellNames.length > 0 ? (
                          <Tooltip
                            content={diag.restrictedSlotEligibleSpellNames
                              .map((spellName) => spellTitle(spellName))
                              .join("\n\n")}
                            className="mf-tooltip-anchor-block"
                          >
                            <p className="hint">
                              Restricted slot pool:{" "}
                              {displaySpellNames(
                                diag.restrictedSlotEligibleSpellNames,
                              ).join(", ")}
                            </p>
                          </Tooltip>
                        ) : null}
                        <div className="item-list compact-list">
                          {current.map((spellName, index) => {
                            const option = findSpellOption(
                              levelSpellOptions,
                              spellName,
                            );
                            const meta = spellMetaSummary(option);
                            const badges = spellBadgesSummary(option);
                            return (
                              <div
                                className="spell-entry-card"
                                key={`selection-${classKey}-${level}-${index}`}
                              >
                                <div className="inline-row">
                                  <div className="inline-grow">
                                    <CompendiumPicker
                                      value={spellName}
                                      onChange={(value) =>
                                        onUpdateSelectionName(
                                          classKey,
                                          mode,
                                          level,
                                          index,
                                          value,
                                        )
                                      }
                                      options={levelPickerOptions}
                                      placeholder="Search spell"
                                    />
                                  </div>
                                  <button
                                    className="ghost small"
                                    onClick={() =>
                                      onRemoveSelection(
                                        classKey,
                                        mode,
                                        level,
                                        index,
                                      )
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                                {meta || badges.length > 0 ? (
                                  <div className="spell-inline-meta">
                                    {meta ? (
                                      <span className="searchable-picker-option-meta">
                                        {meta}
                                      </span>
                                    ) : null}
                                    {badges.length > 0 ? (
                                      <span className="spell-suggestion-badges">
                                        {badges.join(" · ")}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                          <div className="resource-buttons wrap">
                            <button
                              className="ghost small"
                              disabled={!canAddSelection || diag.capacity <= 0}
                              onClick={() =>
                                onAddSelection(classKey, mode, level)
                              }
                            >
                              Add Blank
                            </button>
                            {suggestedSelectionPicks.map((entry) => (
                              <Tooltip
                                key={`sel-suggest-${classKey}-${level}-${entry.spellName}`}
                                content={spellTitle(entry.spellName)}
                              >
                                <button
                                  className="ghost small planner-suggestion-chip spell-suggestion-chip"
                                  title={entry.reason}
                                  disabled={
                                    !canAddSelection || diag.capacity <= 0
                                  }
                                  onClick={() => {
                                    if (!library.includes(entry.spellName))
                                      onAppendLibraryEntry(
                                        classKey,
                                        level,
                                        entry.spellName,
                                      );
                                    onAppendSelection(
                                      classKey,
                                      mode,
                                      level,
                                      entry.spellName,
                                    );
                                  }}
                                >
                                  <span>
                                    {displaySpellName(entry.spellName)}
                                  </span>
                                  {entry.badges?.length ? (
                                    <span className="spell-suggestion-badges">
                                      {entry.badges.join(" · ")}
                                    </span>
                                  ) : null}
                                </button>
                              </Tooltip>
                            ))}
                            {quickSelectionPicks.map((spellName) => (
                              <Tooltip
                                key={`sel-pick-${classKey}-${level}-${spellName}`}
                                content={spellTitle(spellName)}
                              >
                                <button
                                  className="ghost small"
                                  disabled={
                                    !canAddSelection || diag.capacity <= 0
                                  }
                                  onClick={() => {
                                    if (!library.includes(spellName))
                                      onAppendLibraryEntry(
                                        classKey,
                                        level,
                                        spellName,
                                      );
                                    onAppendSelection(
                                      classKey,
                                      mode,
                                      level,
                                      spellName,
                                    );
                                  }}
                                >
                                  + {displaySpellName(spellName)}
                                </button>
                              </Tooltip>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {activeTab === "runtime" ? (
                      <div className="spell-level-column spell-level-tab-panel">
                        <div className="subsection-title">Cast / Runtime</div>
                        <div className="resource-row runtime-row spell-runtime-toolbar">
                          <span className="resource-label">
                            {isAtWill
                              ? "At will"
                              : `Slots: ${runtimeRemaining}/${runtimeMax} left`}
                          </span>
                          <div className="resource-buttons">
                            {!isAtWill ? (
                              <>
                                <button
                                  className="ghost small"
                                  onClick={() =>
                                    onAdjustSpellSlot(
                                      classKey,
                                      level,
                                      runtimeMax,
                                      -1,
                                    )
                                  }
                                >
                                  -
                                </button>
                                <button
                                  className="ghost small"
                                  onClick={() =>
                                    onAdjustSpellSlot(
                                      classKey,
                                      level,
                                      runtimeMax,
                                      1,
                                    )
                                  }
                                >
                                  +
                                </button>
                                <button
                                  className="ghost small"
                                  onClick={() =>
                                    onResetSpellSlotLevel(classKey, level)
                                  }
                                >
                                  Rest
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                        {castables.length > 0 ? (
                          <div className="spell-cast-list spell-cast-list-roomy">
                            {castables.map((spellName) => {
                              const castCount =
                                spellCastCounts[classKey]?.[level]?.[
                                  spellName
                                ] ?? 0;
                              const spellEffect =
                                getSpellEffectByName(spellName);
                              const option = findSpellOption(
                                levelSpellOptions,
                                spellName,
                              );
                              const meta = spellMetaSummary(option);
                              const badges = spellBadgesSummary(option);
                              const supportSummary =
                                option?.supportSummary ?? "";
                              const sourceTag = option?.sourceTag ?? "";
                              return (
                                <div
                                  className="spell-cast-row spell-cast-row-rich"
                                  key={`cast-${classKey}-${level}-${spellName}`}
                                >
                                  <div className="spell-cast-copy">
                                    <Tooltip content={spellTitle(spellName)}>
                                      <span className="resource-label">
                                        {displaySpellName(spellName)} ×
                                        {castCount}
                                        {spellEffect
                                          ? " · activates effect"
                                          : ""}
                                      </span>
                                    </Tooltip>
                                    {meta || badges.length > 0 || sourceTag ? (
                                      <div className="spell-inline-meta">
                                        {meta ? (
                                          <span className="searchable-picker-option-meta">
                                            {meta}
                                          </span>
                                        ) : null}
                                        {badges.length > 0 ? (
                                          <span className="spell-suggestion-badges">
                                            {badges.join(" · ")}
                                          </span>
                                        ) : null}
                                        {sourceTag ? (
                                          <span className="searchable-picker-option-meta">
                                            {sourceTag}
                                          </span>
                                        ) : null}
                                      </div>
                                    ) : null}
                                    {supportSummary ? (
                                      <div className="hint">
                                        {supportSummary}
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="resource-buttons">
                                    <button
                                      className="ghost small spell-cast-action"
                                      title={
                                        spellEffect
                                          ? `Casts ${spellName} and enables its tracked sheet effect.`
                                          : supportSummary ||
                                            `Casts ${spellName}.`
                                      }
                                      disabled={
                                        !isAtWill && runtimeRemaining <= 0
                                      }
                                      onClick={() =>
                                        onCastSpell(
                                          classKey,
                                          level,
                                          runtimeMax,
                                          spellName,
                                          runtimeRemaining,
                                        )
                                      }
                                    >
                                      {spellEffect ? "Cast + Effect" : "Cast"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="hint">
                            No selected/library spells here yet. Even magic
                            needs a to-do list.
                          </p>
                        )}
                        {diag.availableSpellNames.length > 0 ? (
                          <Tooltip
                            content={diag.availableSpellNames
                              .map((spellName) => spellTitle(spellName))
                              .join("\n\n")}
                            className="mf-tooltip-anchor-block"
                          >
                            <div className="hint">
                              Registry options:{" "}
                              {displaySpellNames(diag.availableSpellNames).join(
                                ", ",
                              )}
                            </div>
                          </Tooltip>
                        ) : null}
                      </div>
                    ) : null}
                  </details>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
