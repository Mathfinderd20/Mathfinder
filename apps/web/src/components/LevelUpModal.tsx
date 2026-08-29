import { useEffect, useMemo, useState } from "react";
import {
  buildCharacter,
  computeSheet,
  featContextFromSheet,
  planLevelUp,
  createPreLevelBuild,
  validateLevelUpSelection,
  SKILL_DEFINITIONS,
  type AbilityKey,
  type CharacterBuild,
  type LevelUpSelection,
  type SkillKey,
} from "@mathfinder/rules-engine";
import {
  RUNTIME_ARCHETYPES,
  RUNTIME_BUILD_GUIDES,
  RUNTIME_CLASS_FEATURES,
  RUNTIME_CLASSES,
  RUNTIME_FEATS,
  RUNTIME_SPELLS,
  RUNTIME_WEAPONS,
} from "../content";
import {
  buildSuggestions,
  type LevelPlannerSuggestions,
  type PlannerSuggestionChoice,
  type PlannerSuggestionNote,
  type SkillSuggestionChoice,
  type SpellSuggestionChoice,
} from "../buildSuggestions";
import { displaySpellName } from "../spellLabels";
import { featTitle, spellTitle } from "../rulesText";
import { featSlotTag } from "../featSlots";
import {
  buildFeatPickerOptions,
  collectFeatWeaponNames,
  normalizeSelectedFeatSelection,
} from "../featOptionData";
import { CompendiumPicker } from "./CompendiumPicker";
import { Tooltip } from "./Tooltip";

const ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const SKILL_NAME = new Map<string, string>(
  SKILL_DEFINITIONS.map((d) => [d.key, d.name]),
);
const CLASS_KEYS = Object.keys(RUNTIME_CLASSES);

function suggestionTone(choice: PlannerSuggestionChoice<string>) {
  return choice.emphasis ?? "ok";
}

function SuggestionCardRow<T extends string>({
  title,
  choices,
  selectedValue,
  onPick,
}: {
  title: string;
  choices: PlannerSuggestionChoice<T>[];
  selectedValue?: string;
  onPick: (value: T) => void;
}) {
  if (choices.length === 0) return null;
  return (
    <div className="planner-suggestion-stack modal-guidance-stack">
      <div className="planner-suggestion-stack-title">{title}</div>
      <div className="planner-suggestions planner-suggestions-rich modal-guidance-chips">
        {choices.map((choice, index) => {
          const active =
            selectedValue?.trim().toLowerCase() ===
            choice.value.trim().toLowerCase();
          return (
            <button
              key={`${choice.value}-${choice.reason}`}
              type="button"
              className={`ghost tiny planner-suggestion-chip planner-suggestion-card ${active ? "active" : ""} tone-${suggestionTone(choice as PlannerSuggestionChoice<string>)}`}
              onClick={() => onPick(choice.value)}
            >
              <span className="planner-suggestion-card-head">
                <span className="planner-suggestion-rank">#{index + 1}</span>
                {choice.sourceLabel ? (
                  <span className="planner-suggestion-source">
                    {choice.sourceLabel}
                  </span>
                ) : null}
                {choice.sourceKind ? (
                  <span className="planner-suggestion-kind">
                    {choice.sourceKind}
                  </span>
                ) : null}
              </span>
              <span className="planner-suggestion-card-label">
                {choice.label}
              </span>
              <span className="planner-suggestion-card-reason">
                {choice.reason}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SuggestionNotesList({ notes }: { notes: PlannerSuggestionNote[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="planner-suggestion-notes planner-suggestion-notes-rich compact">
      {notes.map((note) => (
        <li key={`${note.label}-${note.text}`}>
          <span className="planner-note-label">{note.label}</span>
          <span>{note.text}</span>
        </li>
      ))}
    </ul>
  );
}

function normalizeClassKey(className: string | undefined) {
  const normalized = className?.trim().toLowerCase() ?? "";
  if (normalized && RUNTIME_CLASSES[normalized]) return normalized;
  return (
    CLASS_KEYS.find(
      (key) =>
        (RUNTIME_CLASSES[key]?.name?.toLowerCase?.() ?? "") === normalized,
    ) ??
    CLASS_KEYS[0] ??
    "barbarian"
  );
}

export interface LevelUpSpellSeedPlan {
  classKey: string;
  mode: "prepared" | "known";
  level: number;
  spells: string[];
}

interface Props {
  build: CharacterBuild;
  plannerSuggestions: LevelPlannerSuggestions;
  skillSuggestions: SkillSuggestionChoice[];
  skillSuggestionNotes: string[];
  onConfirm: (
    selection: LevelUpSelection,
    spellSeedPlans: LevelUpSpellSeedPlan[],
  ) => void;
  onClose: () => void;
}

/** Interactive level-up: prompts for class, HP, skill ranks, feat, ability bump. */
export function LevelUpModal({
  build,
  plannerSuggestions,
  skillSuggestions,
  skillSuggestionNotes,
  onConfirm,
  onClose,
}: Props) {
  const [className, setClassName] = useState(() =>
    normalizeClassKey(
      plannerSuggestions.classChoices[0]?.value ??
        build.levels[build.levels.length - 1]?.className,
    ),
  );
  const plan = useMemo(
    () => planLevelUp(build, className, RUNTIME_CLASSES, RUNTIME_ARCHETYPES),
    [build, className],
  );

  const [hpInput, setHpInput] = useState(`${plan.averageHitPoints}`);
  const [hpValue, setHpValue] = useState(plan.averageHitPoints);
  const [skills, setSkills] = useState<Set<SkillKey>>(new Set());
  const [selectedFeats, setSelectedFeats] = useState<string[]>([]);
  const [abilityIncrease, setAbilityIncrease] = useState<
    AbilityKey | undefined
  >();
  const [favoredClass, setFavoredClass] = useState<
    "hp" | "skill" | undefined
  >();
  const [selectedSpellSeeds, setSelectedSpellSeeds] = useState<
    Record<string, true>
  >({});

  const remaining = plan.skillPoints - skills.size;

  const hp = Math.max(
    1,
    Math.min(plan.hitDie, hpValue || plan.averageHitPoints),
  );
  const resolvedClassName = RUNTIME_CLASSES[className]?.name ?? className;
  const favoredClassEligible =
    !!build.favoredClassName &&
    build.favoredClassName.toLowerCase() === resolvedClassName.toLowerCase();

  const preview = useMemo(
    () =>
      createPreLevelBuild(
        build,
        {
          className: resolvedClassName,
          hitPointRoll: hp,
          skillRanks: Object.fromEntries([...skills].map((k) => [k, 1])),
          abilityIncrease,
          favoredClass: favoredClassEligible ? favoredClass : undefined,
          feats: selectedFeats.map((feat) => feat.trim()).filter(Boolean),
        },
        RUNTIME_CLASSES,
        RUNTIME_ARCHETYPES,
      ),
    [
      abilityIncrease,
      build,
      favoredClass,
      favoredClassEligible,
      hp,
      selectedFeats,
      resolvedClassName,
      skills,
    ],
  );
  const currentSheet = useMemo(
    () =>
      computeSheet(
        buildCharacter(
          build,
          RUNTIME_CLASSES,
          RUNTIME_FEATS,
          RUNTIME_CLASS_FEATURES,
          RUNTIME_ARCHETYPES,
        ),
      ),
    [build],
  );
  const previewSheet = useMemo(
    () =>
      computeSheet(
        buildCharacter(
          preview.build,
          RUNTIME_CLASSES,
          RUNTIME_FEATS,
          RUNTIME_CLASS_FEATURES,
          RUNTIME_ARCHETYPES,
        ),
      ),
    [preview.build],
  );
  const selectedSkillNames = [...skills]
    .map((key) => SKILL_NAME.get(key) ?? key)
    .sort((a, b) => a.localeCompare(b));
  const suggestedFeatNames = new Set(
    plannerSuggestions.featChoicesBySlot.flatMap((slot) =>
      slot.choices.map((choice) => choice.value.toLowerCase()),
    ),
  );
  const suggestedAbilities = new Set(
    plannerSuggestions.abilityChoices.map((choice) => choice.value),
  );
  const suggestedSkills = skillSuggestions.filter((choice) =>
    plan.classSkills.includes(choice.key),
  );

  const modalSuggestionBundle = useMemo(
    () =>
      buildSuggestions({
        build: preview.build,
        currentLevel: preview.build.levels.length,
        sheetSpellcasting: previewSheet.spellcasting,
        classes: RUNTIME_CLASSES,
        feats: RUNTIME_FEATS,
        spells: RUNTIME_SPELLS,
        classFeatures: RUNTIME_CLASS_FEATURES,
        archetypes: RUNTIME_ARCHETYPES,
        buildGuides: RUNTIME_BUILD_GUIDES,
      }),
    [preview.build, previewSheet.spellcasting],
  );

  // Project the character one level forward to evaluate feat prerequisites
  // against the BAB/abilities they'll actually have when taking the feat.
  useEffect(() => {
    setHpInput(`${plan.averageHitPoints}`);
    setHpValue(plan.averageHitPoints);
  }, [className, plan.averageHitPoints]);

  useEffect(() => {
    if (!favoredClassEligible && favoredClass !== undefined)
      setFavoredClass(undefined);
  }, [favoredClass, favoredClassEligible]);

  useEffect(() => {
    setSelectedFeats((prev) => prev.slice(0, plan.featSlots.length));
  }, [plan.featSlots.length]);

  const featOptionsBySlot = useMemo(() => {
    const ctx = featContextFromSheet(
      computeSheet(
        buildCharacter(
          preview.build,
          RUNTIME_CLASSES,
          RUNTIME_FEATS,
          RUNTIME_CLASS_FEATURES,
          RUNTIME_ARCHETYPES,
        ),
      ),
    );
    const availableWeaponNames = collectFeatWeaponNames(
      preview.build,
      RUNTIME_WEAPONS,
    );
    return plan.featSlots.map((slot, slotIndex) =>
      buildFeatPickerOptions({
        featRegistry: RUNTIME_FEATS,
        featContext: ctx,
        grantKind: slot.kind,
        takenSelections: ctx.featNames,
        currentSelection: selectedFeats[slotIndex],
        availableWeaponNames,
        suggestedFeatNames,
      }),
    );
  }, [plan.featSlots, preview.build, selectedFeats, suggestedFeatNames]);

  const spellSeedGroups: Array<{
    classKey: string;
    className: string;
    mode: "prepared" | "known";
    level: number;
    capacity: number;
    suggestions: SpellSuggestionChoice[];
  }> = previewSheet.spellcasting.flatMap((caster) => {
    const classKey = caster.className.toLowerCase();
    const mode = caster.castingType === "prepared" ? "prepared" : "known";
    return Object.entries(
      modalSuggestionBundle.spellChoices[classKey] ?? {},
    ).flatMap(([levelText, choices]) => {
      const level = Number(levelText);
      const suggestions = ((choices ?? []) as SpellSuggestionChoice[]).slice(
        0,
        4,
      );
      const capacity = caster.selectionDiagnostics[level]?.capacity ?? 0;
      if (suggestions.length === 0 || capacity <= 0) return [];
      return [
        {
          classKey,
          className: caster.className,
          mode,
          level,
          capacity,
          suggestions,
        },
      ];
    });
  });

  const spellSeedPlans: LevelUpSpellSeedPlan[] = spellSeedGroups
    .map((group) => {
      const selected = group.suggestions
        .filter(
          (entry) =>
            selectedSpellSeeds[
              `${group.classKey}:${group.level}:${entry.spellName}`
            ],
        )
        .map((entry) => entry.spellName)
        .slice(0, group.capacity);
      return selected.length > 0
        ? {
            classKey: group.classKey,
            mode: group.mode,
            level: group.level,
            spells: selected,
          }
        : null;
    })
    .filter((entry): entry is LevelUpSpellSeedPlan => !!entry);

  const issues = validateLevelUpSelection(preview.plan, preview.selection);
  const hasError = issues.some((i) => i.severity === "error");

  function commitHpInput(nextInput = hpInput) {
    const parsed = Number(nextInput);
    const normalized = Number.isFinite(parsed)
      ? Math.max(1, Math.min(plan.hitDie, parsed))
      : plan.averageHitPoints;
    setHpValue(normalized);
    setHpInput(`${normalized}`);
  }

  function toggleSkill(key: SkillKey) {
    setSkills((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (remaining > 0) next.add(key);
      return next;
    });
  }

  function applySuggestedSkill(key: SkillKey) {
    setSkills((prev) => {
      if (prev.has(key) || prev.size >= plan.skillPoints) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }

  function applyTopSkillSuggestions() {
    setSkills((prev) => {
      const next = new Set(prev);
      for (const suggestion of suggestedSkills) {
        if (next.size >= plan.skillPoints) break;
        next.add(suggestion.key);
      }
      return next;
    });
  }

  function toggleSpellSeed(classKey: string, level: number, spellName: string) {
    const key = `${classKey}:${level}:${spellName}`;
    setSelectedSpellSeeds((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: true };
    });
  }

  function applyTopSpellSuggestions(
    classKey: string,
    level: number,
    spellNames: string[],
    capacity: number,
  ) {
    setSelectedSpellSeeds((prev) => {
      const next = { ...prev };
      let selectedForGroup = Object.keys(next).filter((key) =>
        key.startsWith(`${classKey}:${level}:`),
      ).length;
      for (const spellName of spellNames) {
        if (selectedForGroup >= capacity) break;
        const key = `${classKey}:${level}:${spellName}`;
        if (!next[key]) {
          next[key] = true;
          selectedForGroup += 1;
        }
      }
      return next;
    });
  }

  function clearSpellSuggestions(classKey: string, level: number) {
    setSelectedSpellSeeds(
      (prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(
            ([key]) => !key.startsWith(`${classKey}:${level}:`),
          ),
        ) as Record<string, true>,
    );
  }

  function confirmLevel() {
    const parsed = Number(hpInput);
    const normalizedHp = Number.isFinite(parsed)
      ? Math.max(1, Math.min(plan.hitDie, parsed))
      : plan.averageHitPoints;
    setHpValue(normalizedHp);
    setHpInput(`${normalizedHp}`);
    onConfirm(
      {
        className: resolvedClassName,
        hitPointRoll: normalizedHp,
        skillRanks: Object.fromEntries([...skills].map((k) => [k, 1])),
        feats: selectedFeats.map((entry) => entry.trim()).filter(Boolean),
        abilityIncrease,
        favoredClass: favoredClassEligible ? favoredClass : undefined,
      },
      spellSeedPlans,
    );
  }

  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-up-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="level-up-modal-title">
          Level Up &rarr; Level {plan.characterLevel}
        </h2>
        <p className="hint">
          Choose your next class level, feat, skills, and any stat increase,
          then review the preview before applying it.
        </p>

        <label className="field">
          <span>Class</span>
          <select
            autoFocus
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          >
            {CLASS_KEYS.map((key) => (
              <option key={key} value={key}>
                {RUNTIME_CLASSES[key]?.name ?? key}
              </option>
            ))}
          </select>
          <SuggestionCardRow
            title="Why these class picks"
            choices={plannerSuggestions.classChoices}
            selectedValue={className}
            onPick={(value) => setClassName(value.toLowerCase())}
          />
        </label>

        <label className="field">
          <span>
            Hit points (d{plan.hitDie}, avg {plan.averageHitPoints})
          </span>
          <input
            type="number"
            min={1}
            max={plan.hitDie}
            value={hpInput}
            onChange={(e) => setHpInput(e.target.value)}
            onBlur={() => commitHpInput()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitHpInput((e.target as HTMLInputElement).value);
              }
            }}
          />
        </label>

        <div className="field">
          <span>
            Skill ranks &mdash; {remaining} of {plan.skillPoints} left
            <span className="muted"> (max +1 per skill)</span>
          </span>
          {suggestedSkills.length > 0 ? (
            <>
              <div className="planner-suggestions modal-guidance-chips">
                <button
                  type="button"
                  className="ghost tiny planner-suggestion-chip"
                  onClick={applyTopSkillSuggestions}
                >
                  Fill Suggested
                </button>
                {suggestedSkills.map((choice) => (
                  <button
                    key={`skill-suggestion-${choice.key}`}
                    type="button"
                    className={`ghost tiny planner-suggestion-chip ${skills.has(choice.key) ? "active" : ""}`}
                    title={choice.reason}
                    disabled={skills.has(choice.key) || remaining <= 0}
                    onClick={() => applySuggestedSkill(choice.key)}
                  >
                    + {SKILL_NAME.get(choice.key) ?? choice.key}
                  </button>
                ))}
              </div>
              {skillSuggestionNotes.length > 0 ? (
                <ul className="planner-suggestion-notes compact">
                  {skillSuggestionNotes.map((note) => (
                    <li key={`levelup-skill-note-${note}`}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
          <div className="skill-picker">
            {plan.classSkills
              .slice()
              .sort((a, b) =>
                (SKILL_NAME.get(a) ?? a).localeCompare(SKILL_NAME.get(b) ?? b),
              )
              .map((key) => {
                const checked = skills.has(key);
                return (
                  <label key={key} className={`pick ${checked ? "on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && remaining <= 0}
                      onChange={() => toggleSkill(key)}
                    />
                    {SKILL_NAME.get(key) ?? key}
                  </label>
                );
              })}
          </div>
        </div>

        {plan.grantsFeat ? (
          <div className="field">
            <span>
              Feats ({plan.featSlots.length} slot
              {plan.featSlots.length === 1 ? "" : "s"} this level)
            </span>
            {plan.featSlots.map((slot, slotIndex) => {
              const selectedFeat = selectedFeats[slotIndex] ?? "";
              const options = featOptionsBySlot[slotIndex] ?? [];
              return (
                <label
                  key={`feat-slot-${slot.source}-${slotIndex}`}
                  className="field compact"
                >
                  <span>
                    {slot.label}
                    <span className="muted">
                      {" "}
                      · {slot.source} · {featSlotTag(slot.kind)}
                    </span>
                  </span>
                  <CompendiumPicker
                    value={selectedFeat}
                    onChange={(value) =>
                      setSelectedFeats((prev) => {
                        const next = [...prev];
                        next[slotIndex] = normalizeSelectedFeatSelection(
                          RUNTIME_FEATS,
                          value,
                        );
                        return next;
                      })
                    }
                    options={options}
                    placeholder="Search legal feat"
                    tooltip={featTitle(selectedFeat)}
                  />
                  <SuggestionCardRow
                    title={`Why these ${slot.label.toLowerCase()} picks`}
                    choices={
                      plannerSuggestions.featChoicesBySlot.find(
                        (entry) => entry.slotIndex === slotIndex,
                      )?.choices ?? []
                    }
                    selectedValue={selectedFeat}
                    onPick={(value) =>
                      setSelectedFeats((prev) => {
                        const next = [...prev];
                        next[slotIndex] = normalizeSelectedFeatSelection(
                          RUNTIME_FEATS,
                          value,
                        );
                        return next;
                      })
                    }
                  />
                  {options.length === 0 ? (
                    <span className="hint">
                      No legal feats found for this slot yet.
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        ) : null}

        {favoredClassEligible ? (
          <div className="field">
            <span>Favored class bonus</span>
            <SuggestionCardRow
              title="Why these favored bonus picks"
              choices={plannerSuggestions.favoredClassChoices}
              selectedValue={favoredClass ?? "none"}
              onPick={(value) =>
                setFavoredClass(
                  (value === "none" ? undefined : value) as
                    | "hp"
                    | "skill"
                    | undefined,
                )
              }
            />
            <div className="ability-picker">
              <label
                className={`pick ${favoredClass === undefined ? "on" : ""}`}
              >
                <input
                  type="radio"
                  name="fcb"
                  checked={favoredClass === undefined}
                  onChange={() => setFavoredClass(undefined)}
                />
                None
              </label>
              <label className={`pick ${favoredClass === "hp" ? "on" : ""}`}>
                <input
                  type="radio"
                  name="fcb"
                  checked={favoredClass === "hp"}
                  onChange={() => setFavoredClass("hp")}
                />
                HP
              </label>
              <label className={`pick ${favoredClass === "skill" ? "on" : ""}`}>
                <input
                  type="radio"
                  name="fcb"
                  checked={favoredClass === "skill"}
                  onChange={() => setFavoredClass("skill")}
                />
                Skill
              </label>
            </div>
          </div>
        ) : null}

        {plan.grantsAbilityIncrease ? (
          <div className="field">
            <span>Ability score increase (+1)</span>
            <SuggestionCardRow
              title="Why these ASI picks"
              choices={plannerSuggestions.abilityChoices}
              selectedValue={abilityIncrease ?? ""}
              onPick={(value) => setAbilityIncrease(value)}
            />
            <div className="ability-picker">
              {ABILITIES.map((a) => (
                <label
                  key={a}
                  className={`pick ${abilityIncrease === a ? "on" : ""} ${suggestedAbilities.has(a) ? "suggested" : ""}`}
                >
                  <input
                    type="radio"
                    name="asi"
                    checked={abilityIncrease === a}
                    onChange={() => setAbilityIncrease(a)}
                  />
                  {a.toUpperCase()}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <section className="modal-preview">
          <div className="modal-preview-header">
            <strong>Preview</strong>
            <span className="muted">
              {currentSheet.level} → {previewSheet.level}
            </span>
          </div>
          <div className="modal-preview-grid">
            <div className="modal-preview-card">
              <div className="modal-preview-label">Class</div>
              <div className="modal-preview-value">
                {preview.plan.className}
              </div>
              <div className="modal-preview-note">
                d{preview.plan.hitDie} HD · {preview.plan.skillPoints} skill
                point{preview.plan.skillPoints === 1 ? "" : "s"}
              </div>
            </div>
            <div className="modal-preview-card">
              <div className="modal-preview-label">Hit Points</div>
              <div className="modal-preview-value">
                {currentSheet.hitPoints.total} → {previewSheet.hitPoints.total}
              </div>
              <div className="modal-preview-note">
                +{previewSheet.hitPoints.total - currentSheet.hitPoints.total}{" "}
                total HP
              </div>
            </div>
            <div className="modal-preview-card">
              <div className="modal-preview-label">BAB</div>
              <div className="modal-preview-value">
                +{currentSheet.baseAttackBonus} → +
                {previewSheet.baseAttackBonus}
              </div>
              <div className="modal-preview-note">
                Melee {currentSheet.attack.melee.total >= 0 ? "+" : ""}
                {currentSheet.attack.melee.total} →{" "}
                {previewSheet.attack.melee.total >= 0 ? "+" : ""}
                {previewSheet.attack.melee.total}
              </div>
            </div>
            <div className="modal-preview-card">
              <div className="modal-preview-label">Saves</div>
              <div className="modal-preview-value">
                F {currentSheet.saves.fort.total >= 0 ? "+" : ""}
                {currentSheet.saves.fort.total} →{" "}
                {previewSheet.saves.fort.total >= 0 ? "+" : ""}
                {previewSheet.saves.fort.total}
              </div>
              <div className="modal-preview-note">
                R {currentSheet.saves.ref.total >= 0 ? "+" : ""}
                {currentSheet.saves.ref.total} →{" "}
                {previewSheet.saves.ref.total >= 0 ? "+" : ""}
                {previewSheet.saves.ref.total} · W{" "}
                {currentSheet.saves.will.total >= 0 ? "+" : ""}
                {currentSheet.saves.will.total} →{" "}
                {previewSheet.saves.will.total >= 0 ? "+" : ""}
                {previewSheet.saves.will.total}
              </div>
            </div>
          </div>
          <div className="modal-preview-subsection">
            <div className="modal-preview-label">Abilities</div>
            <div className="modal-preview-abilities">
              {ABILITIES.map((ability) => {
                const before = currentSheet.abilities[ability];
                const after = previewSheet.abilities[ability];
                const changed =
                  before.score !== after.score || before.mod !== after.mod;
                return (
                  <div
                    key={ability}
                    className={`modal-preview-ability ${changed ? "changed" : ""}`}
                  >
                    <strong>{ability.toUpperCase()}</strong>
                    <span>
                      {before.score} ({before.mod >= 0 ? "+" : ""}
                      {before.mod}) → {after.score} ({after.mod >= 0 ? "+" : ""}
                      {after.mod})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {plannerSuggestions.notes.length > 0 ? (
            <div className="modal-preview-subsection">
              <div className="modal-preview-label">Guide Notes</div>
              <SuggestionNotesList notes={plannerSuggestions.notes} />
            </div>
          ) : null}
          <div className="modal-preview-subsection">
            <div className="modal-preview-label">This level</div>
            <ul className="modal-preview-list">
              <li>HP roll: {preview.selection.hitPointRoll}</li>
              <li>
                Skills:{" "}
                {selectedSkillNames.length > 0
                  ? selectedSkillNames.join(", ")
                  : "none assigned yet"}
              </li>
              <li>
                Feats:{" "}
                {preview.selection.feats?.length
                  ? preview.selection.feats.join(", ")
                  : preview.plan.grantsFeat
                    ? "not chosen yet"
                    : "none granted"}
              </li>
              <li>
                Favored class bonus:{" "}
                {favoredClassEligible
                  ? (preview.selection.favoredClass?.toUpperCase() ??
                    "none selected")
                  : "not applicable"}
              </li>
              <li>
                Ability increase:{" "}
                {preview.selection.abilityIncrease?.toUpperCase() ??
                  (preview.plan.grantsAbilityIncrease
                    ? "not chosen yet"
                    : "none granted")}
              </li>
            </ul>
          </div>
          {spellSeedGroups.length > 0 ? (
            <div className="modal-preview-subsection">
              <div className="modal-preview-label">Spell Suggestions</div>
              <div className="spell-seed-groups">
                {spellSeedGroups.map((group) => {
                  const selectedCount = group.suggestions.filter(
                    (entry) =>
                      selectedSpellSeeds[
                        `${group.classKey}:${group.level}:${entry.spellName}`
                      ],
                  ).length;
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
                          {selectedCount}/{group.capacity} queued for{" "}
                          {group.mode}
                        </span>
                      </div>
                      <div className="planner-suggestions modal-guidance-chips">
                        <button
                          type="button"
                          className="ghost tiny planner-suggestion-chip"
                          onClick={() =>
                            applyTopSpellSuggestions(
                              group.classKey,
                              group.level,
                              group.suggestions.map((entry) => entry.spellName),
                              group.capacity,
                            )
                          }
                        >
                          Use Top Picks
                        </button>
                        <button
                          type="button"
                          className="ghost tiny planner-suggestion-chip"
                          onClick={() =>
                            clearSpellSuggestions(group.classKey, group.level)
                          }
                        >
                          Clear
                        </button>
                      </div>
                      <div className="planner-suggestions modal-guidance-chips">
                        {group.suggestions.map((entry) => {
                          const selected =
                            !!selectedSpellSeeds[
                              `${group.classKey}:${group.level}:${entry.spellName}`
                            ];
                          const groupSelectedCount = group.suggestions.filter(
                            (choice) =>
                              selectedSpellSeeds[
                                `${group.classKey}:${group.level}:${choice.spellName}`
                              ],
                          ).length;
                          const disabled =
                            !selected && groupSelectedCount >= group.capacity;
                          return (
                            <Tooltip
                              key={`spell-seed-chip-${group.classKey}-${group.level}-${entry.spellName}`}
                              content={spellTitle(entry.spellName)}
                            >
                              <button
                                type="button"
                                className={`ghost tiny planner-suggestion-chip spell-suggestion-chip ${selected ? "active" : ""}`}
                                title={entry.reason}
                                disabled={disabled}
                                onClick={() =>
                                  toggleSpellSeed(
                                    group.classKey,
                                    group.level,
                                    entry.spellName,
                                  )
                                }
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
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        {issues.length > 0 ? (
          <ul className="modal-issues">
            {issues.map((i, idx) => (
              <li key={idx} className={i.severity}>
                {i.message}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="modal-actions">
          <button className="ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={hasError} onClick={confirmLevel}>
            Confirm Level {plan.characterLevel}
          </button>
        </div>
      </div>
    </div>
  );
}
