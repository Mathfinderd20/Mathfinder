import {
  getSpellEffectByName,
  BLOODLINES,
  spellLevelLabel,
  type DerivedSpellcasting,
} from "@mathfinder/rules-engine";
import { useMemo, useState } from "react";
import { SpellRulesText } from "./SpellRulesText";
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

interface ReprepareRequest {
  classKey: string;
  index: number;
  level: number;
  mode: SpellMode;
  options: string[];
  spellName: string;
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

export interface SpellcastingManagerProps {
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
    copies?: number,
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
    source?: string[],
  ) => void;
  onUpdateDomains: (classKey: string, index: number, value: string) => void;
  onUpdateBloodline?: (classKey: string, value: string) => void;
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
  defaultOpen?: boolean;
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
  onUpdateBloodline,
  onUpdateSpecialization,
  onAdjustExtraSpellSlots,
  onAdjustSpellSlot,
  onCastSpell,
  onResetSpellSlotLevel,
  onResetSpellRuntimeClass,
  defaultOpen = false,
}: SpellcastingManagerProps) {
  const [spellLevelTabs, setSpellLevelTabs] = useState<
    Record<string, SpellLevelTab>
  >({});
  const [spellTagFilters, setSpellTagFilters] = useState<
    Record<string, string | null>
  >({});
  const [spellSchoolFilters, setSpellSchoolFilters] = useState<
    Record<string, string | null>
  >({});
  const [managerOpen, setManagerOpen] = useState(defaultOpen);
  const [spellDetailName, setSpellDetailName] = useState<string>();
  const [reprepare, setReprepare] = useState<ReprepareRequest>();
  const [replacementSpell, setReplacementSpell] = useState("");
  const spellCompendiumOptions = useMemo(
    () =>
      casters.length > 0 && managerOpen
        ? buildSpellCompendiumOptions(
            spellOptions,
            casters.map((caster) => caster.className),
          )
        : [],
    [casters, managerOpen, spellOptions],
  );
  const detailOption = spellDetailName
    ? findSpellOption(spellCompendiumOptions, spellDetailName)
    : undefined;

  if (casters.length === 0) return null;

  if (!managerOpen) {
    return (
      <section className="planner-builder">
        <div className="planner-builder-summary">
          <span className="subsection-title planner-builder-title">Magic</span>
          <div className="planner-builder-controls">
            <span className="planner-builder-meta">
              {casters.length} caster{casters.length === 1 ? "" : "s"}
            </span>
            <button
              className="ghost small"
              type="button"
              onClick={() => setManagerOpen(true)}
            >
              Expand
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="editor-section-head">
        <h3>Magic</h3>
        <button
          className="ghost small"
          type="button"
          onClick={() => setManagerOpen(false)}
        >
          Collapse
        </button>
      </div>
      <p className="hint">
        Manage each casting source independently: its library, prepared or known
        spells, save DCs, and runtime usage all remain tied to that source.
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
            <div
              className="item-card spellcasting-source-card"
              key={`spellcasting-${classKey}`}
            >
              <div className="editor-section-head tight">
                <h3>{caster.className} Spellcasting</h3>
                <div className="resource-buttons">
                  <button
                    className="ghost small"
                    onClick={() => onResetLibraryForClass(classKey, levels)}
                  >
                    {caster.spellAccess === "full-list"
                      ? "Clear Added Spells"
                      : "Clear Library"}
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
              {classKey === "sorcerer" && onUpdateBloodline && (
                <div className="item-card">
                  <label className="field compact">
                    <span>Bloodline</span>
                    <select
                      value={caster.bloodline ?? ""}
                      onChange={(event) =>
                        onUpdateBloodline(classKey, event.target.value)
                      }
                    >
                      <option value="">Select bloodline</option>
                      {Object.values(BLOODLINES).map((bloodline) => (
                        <option key={bloodline.id} value={bloodline.id}>
                          {bloodline.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
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
                onOpenSpell={setSpellDetailName}
              />

              {levels.map((level) => {
                const diag = caster.selectionDiagnostics[level];
                if (!diag) return null;
                const current = selections[level] ?? [];
                const library = caster.librarySpells[level] ?? [];
                const manualLibrary = caster.manualLibrarySpells[level] ?? [];
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
                const extraSlots = caster.extraSlotsPerDay[level] ?? 0;
                const restrictedSlots =
                  caster.restrictedExtraSlotsPerDay[level] ?? 0;
                const domainSlotModel =
                  mode === "prepared" && caster.domains.length > 0;
                const restrictedNames =
                  diag.restrictedSlotEligibleSpellNames.map((name) =>
                    name.toLowerCase(),
                  );
                const restrictedSelected = current.filter((name) =>
                  restrictedNames.includes(name.toLowerCase()),
                ).length;
                const normalSelected = current.length - restrictedSelected;
                const normalCapacity = Math.max(
                  0,
                  diag.capacity - restrictedSlots,
                );
                const canAddSelection = domainSlotModel
                  ? normalSelected < normalCapacity
                  : diag.selectedCount < diag.capacity;
                const canAddNamedSelection = (spellName: string) =>
                  domainSlotModel &&
                  restrictedNames.includes(spellName.toLowerCase())
                    ? restrictedSelected < restrictedSlots
                    : canAddSelection;
                const grantedAtLevel = uniqueSpellNames(
                  caster.grantedSpells[level] ?? [],
                );
                const autoFillSelectionNames =
                  mode === "known"
                    ? [
                        ...grantedAtLevel,
                        ...diag.librarySpellNames
                          .filter(
                            (name) =>
                              !grantedAtLevel.some(
                                (grant) =>
                                  grant.toLowerCase() === name.toLowerCase(),
                              ),
                          )
                          .slice(0, diag.capacity),
                      ]
                    : domainSlotModel
                      ? [
                          ...diag.restrictedSlotEligibleSpellNames.slice(
                            0,
                            restrictedSlots,
                          ),
                          ...diag.librarySpellNames
                            .filter(
                              (name) =>
                                !restrictedNames.includes(name.toLowerCase()),
                            )
                            .slice(0, normalCapacity),
                        ]
                      : diag.librarySpellNames;
                const autoFillCapacity =
                  mode === "known"
                    ? diag.capacity + grantedAtLevel.length
                    : diag.capacity;
                const knownTotal = uniqueSpellNames([
                  ...current,
                  ...grantedAtLevel,
                ]).length;
                const runtimeMax = caster.spellsPerDay[level] ?? 0;
                const runtimeRemaining =
                  caster.slotsRemaining[level] ?? runtimeMax;
                const restrictedUsed = Math.min(
                  restrictedSlots,
                  Object.entries(
                    spellCastCounts[classKey]?.[level] ?? {},
                  ).reduce(
                    (total, [spellName, count]) =>
                      total +
                      (restrictedNames.includes(spellName.toLowerCase())
                        ? count
                        : 0),
                    0,
                  ),
                );
                const normalRuntimeMax = Math.max(
                  0,
                  runtimeMax - restrictedSlots,
                );
                const normalRuntimeUsed = Math.max(
                  0,
                  runtimeMax - runtimeRemaining - restrictedUsed,
                );
                const normalRuntimeRemaining = Math.max(
                  0,
                  normalRuntimeMax - normalRuntimeUsed,
                );
                const restrictedRemaining = Math.max(
                  0,
                  restrictedSlots - restrictedUsed,
                );
                const isAtWill = diag.isAtWill;
                const castables = uniqueSpellNames(
                  current.length > 0
                    ? [...current, ...(caster.grantedSpells[level] ?? [])]
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
                        detail:
                          diag.restrictedSlotEligibleSelectedCount >
                          diag.restrictedSlotCapacity
                            ? `Only ${diag.restrictedSlotCapacity} dedicated domain spell may be prepared at this level; ${diag.restrictedSlotEligibleSelectedCount} are selected.`
                            : `Need ${diag.restrictedSlotCapacity} granted spell pick(s); only ${diag.restrictedSlotEligibleSelectedCount} qualify.`,
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
                          {spellLevelLabel(caster, level)}
                        </div>
                        <div className="spell-level-head-meta">
                          <span>
                            {mode === "prepared"
                              ? `${current.length}/${diag.capacity} prepared`
                              : `${knownTotal} known`}
                          </span>
                          <span>
                            {isAtWill
                              ? "At will"
                              : domainSlotModel
                                ? `${normalRuntimeRemaining}/${normalRuntimeMax} slots + domain ${restrictedRemaining}/${restrictedSlots}`
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
                          {mode === "prepared"
                            ? `${current.length}/${diag.capacity}`
                            : knownTotal}
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
                            : domainSlotModel
                              ? `${normalRuntimeRemaining}/${normalRuntimeMax} + ${restrictedRemaining}/${restrictedSlots}`
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
                        Extra slots: +
                        {Math.max(0, extraSlots - restrictedSlots)}
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
                              autoFillCapacity,
                              autoFillSelectionNames,
                            )
                          }
                        >
                          Auto Fill
                        </button>
                        <button
                          className="ghost small"
                          onClick={() => onResetLibraryLevel(classKey, level)}
                          disabled={manualLibrary.length === 0}
                        >
                          Clear Added Spells
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
                          {caster.spellAccess === "full-list"
                            ? "Additional Library Spells"
                            : "Library / Learnable Pool"}
                        </div>
                        <p className="hint">
                          {caster.spellAccess === "full-list"
                            ? "Class spells are included automatically at unlocked spell levels. Manage additional spells here; choose daily preparations separately."
                            : "Record spells acquired through level choices, a spellbook, or special grants. Choose prepared or known spells separately."}
                        </p>
                        <div className="item-list compact-list">
                          {manualLibrary.map((spellName, index) => {
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
                                {spellName ? (
                                  <button
                                    type="button"
                                    className="spell-detail-trigger"
                                    onClick={() =>
                                      setSpellDetailName(spellName)
                                    }
                                  >
                                    <strong>
                                      {displaySpellName(spellName)}
                                    </strong>
                                    <span>
                                      {option?.spell?.description ||
                                        "Open full spell details"}
                                    </span>
                                  </button>
                                ) : null}
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
                                  {mode === "prepared" ? (
                                    <button
                                      className="ghost small"
                                      type="button"
                                      onClick={() => {
                                        const options = uniqueSpellNames(
                                          library.length > 0
                                            ? library
                                            : levelSpellOptions.map(
                                                (entry) => entry.name,
                                              ),
                                        );
                                        setReplacementSpell(spellName);
                                        setReprepare({
                                          classKey,
                                          index,
                                          level,
                                          mode,
                                          options,
                                          spellName,
                                        });
                                      }}
                                    >
                                      Reprepare
                                    </button>
                                  ) : null}
                                </div>
                                {spellName ? (
                                  <button
                                    type="button"
                                    className="spell-detail-trigger"
                                    onClick={() =>
                                      setSpellDetailName(spellName)
                                    }
                                  >
                                    <strong>
                                      {displaySpellName(spellName)}
                                    </strong>
                                    <span>
                                      DC {caster.spellSaveDcs[level] ?? "—"} ·
                                      Components{" "}
                                      {option?.spell?.components || "—"}
                                      {diag.restrictedSlotEligibleSpellNames.some(
                                        (name) =>
                                          name.toLowerCase() ===
                                          spellName.toLowerCase(),
                                      )
                                        ? ` · ${classKey === "cleric" ? "Domain spell" : "Restricted spell"}`
                                        : ""}
                                      {option?.spell?.description
                                        ? ` · ${option.spell.description}`
                                        : ""}
                                    </span>
                                  </button>
                                ) : null}
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
                                    !canAddNamedSelection(entry.spellName) ||
                                    diag.capacity <= 0
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
                                    !canAddNamedSelection(spellName) ||
                                    diag.capacity <= 0
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
                              : domainSlotModel
                                ? `Slots: ${normalRuntimeRemaining}/${normalRuntimeMax} normal · ${restrictedRemaining}/${restrictedSlots} domain`
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
                              const usesRestrictedSlot =
                                domainSlotModel &&
                                restrictedNames.includes(
                                  spellName.toLowerCase(),
                                );
                              const poolRuntimeRemaining = usesRestrictedSlot
                                ? restrictedRemaining
                                : domainSlotModel
                                  ? normalRuntimeRemaining
                                  : runtimeRemaining;
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
                                      <button
                                        type="button"
                                        className="resource-label spell-runtime-name"
                                        onClick={() =>
                                          setSpellDetailName(spellName)
                                        }
                                      >
                                        {displaySpellName(spellName)} ×
                                        {castCount}
                                        {spellEffect
                                          ? " · activates effect"
                                          : ""}
                                      </button>
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
                                        !isAtWill && poolRuntimeRemaining <= 0
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
      {spellDetailName ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setSpellDetailName(undefined)}
        >
          <section
            className="modal spell-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="spell-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="character-eyebrow">Spell reference</span>
                <h2 id="spell-detail-title">
                  {displaySpellName(spellDetailName)}
                </h2>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={() => setSpellDetailName(undefined)}
              >
                Close
              </button>
            </div>
            <div className="spell-detail-facts">
              <span>{detailOption?.schoolTag || "School unavailable"}</span>
              <span>{detailOption?.metaTag || "Level varies by class"}</span>
              <span>Components: {detailOption?.spell?.components || "—"}</span>
              {detailOption?.sourceTag ? (
                <span>{detailOption.sourceTag}</span>
              ) : null}
            </div>
            <dl className="spell-detail-rules">
              <div>
                <dt>Casting time</dt>
                <dd>{detailOption?.spell?.castingTime || "—"}</dd>
              </div>
              <div>
                <dt>Range</dt>
                <dd>{detailOption?.spell?.range || "—"}</dd>
              </div>
              <div>
                <dt>Target / Area</dt>
                <dd>{detailOption?.spell?.targetEffectArea || "—"}</dd>
              </div>
              {[
                ["Target", detailOption?.spell?.target],
                ["Effect", detailOption?.spell?.effect],
                ["Area", detailOption?.spell?.area],
                ["Class levels", detailOption?.spell?.levelText],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              <div>
                <dt>Duration</dt>
                <dd>{detailOption?.spell?.duration || "—"}</dd>
              </div>
              <div>
                <dt>Saving throw</dt>
                <dd>{detailOption?.spell?.savingThrow || "—"}</dd>
              </div>
              <div>
                <dt>Spell resistance</dt>
                <dd>{detailOption?.spell?.spellResistance || "—"}</dd>
              </div>
            </dl>
            <div className="spell-detail-description">
              <SpellRulesText
                spell={detailOption?.spell}
                fallback={spellTitle(spellDetailName)}
              />
            </div>
            {detailOption?.supportSummary ? (
              <p className="hint">{detailOption.supportSummary}</p>
            ) : null}
            <div className="modal-actions">
              {detailOption?.sourceUrl ? (
                <a
                  className="button-link ghost"
                  href={detailOption.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open full source
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setSpellDetailName(undefined)}
              >
                Done
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {reprepare ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setReprepare(undefined)}
        >
          <section
            className="modal reprepare-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reprepare-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="character-eyebrow">
                  Prepared slot · Level {reprepare.level}
                </span>
                <h2 id="reprepare-title">
                  Reprepare {displaySpellName(reprepare.spellName)}
                </h2>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={() => setReprepare(undefined)}
              >
                Close
              </button>
            </div>
            <p>
              Choose a replacement from this casting source’s spell library.
              Confirming changes only this prepared slot.
            </p>
            <label className="field compact">
              <span>Replacement spell</span>
              <select
                value={replacementSpell}
                onChange={(event) => setReplacementSpell(event.target.value)}
              >
                {reprepare.options.map((spellName) => (
                  <option key={`reprepare-${spellName}`} value={spellName}>
                    {displaySpellName(spellName)}
                  </option>
                ))}
              </select>
            </label>
            <div className="reprepare-preview">
              <span>{displaySpellName(reprepare.spellName)}</span>
              <strong>→</strong>
              <span>{displaySpellName(replacementSpell)}</span>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setReprepare(undefined)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!replacementSpell}
                onClick={() => {
                  onUpdateSelectionName(
                    reprepare.classKey,
                    reprepare.mode,
                    reprepare.level,
                    reprepare.index,
                    replacementSpell,
                  );
                  setReprepare(undefined);
                }}
              >
                Confirm Reprepare
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
