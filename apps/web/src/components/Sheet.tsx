import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ALIGNMENT_LABELS,
  deriveHealthStatus,
  SKILL_DEFINITIONS,
  spellLevelLabel,
  type AbilityKey,
  type BreakdownEntry,
  type DerivedSheet,
  type DeathRules,
  type DerivedStat,
  type InventoryEquipmentSlot,
  type WeaponAttackRolls,
} from "@mathfinder/rules-engine";
import {
  shouldDisplaySheetSkill,
  skillMetadataTooltip,
  skillTrainingFlag,
} from "../skillPresentation";
import type {
  AttackOutcome,
  SpellCastCounts,
  WeaponAttackHistory,
} from "../runtimeState";
import type { WealthSummary } from "../wealth";
import {
  displayDomainNames,
  displaySchoolName,
  displaySpellName,
} from "../spellLabels";
import { spellTitle } from "../rulesText";
import { sign } from "../util";
import {
  hitPointExpression,
  healthPresentation,
  partitionRaceNotes,
} from "../characterPresentation";
import { compatibleAmmoEntries } from "../ammoCatalog";
import { weaponAmmoUxLabel } from "../weaponUx";
import {
  HealthTracker,
  HealthStatusControls,
  healthConditionLabel,
  healthConditionTone,
} from "./HealthTracker";
import { Tooltip, TooltipTriggerContext } from "./Tooltip";
import { useCharacterUiState } from "../features/characters/CharacterUiSession";
import { CharacterDialog } from "./CharacterDialog";
import {
  CharacterReferenceRows,
  type ReferenceRuntime,
} from "./CharacterReferenceRows";
import { weaponAttackResults } from "../weaponAttackResults";

const SKILL_DEFINITION_BY_KEY = new Map(
  SKILL_DEFINITIONS.map((skill) => [skill.key, skill] as const),
);

const ABILITY_ORDER: readonly AbilityKey[] = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
];

function compactByLevel(values: Partial<Record<number, number>>) {
  return (
    Object.entries(values)
      .map(([lvl, n]) => `L${lvl}:${n}`)
      .join(" · ") || "—"
  );
}

function uniqueSpellNames(spellNames: string[]) {
  return [...new Set(spellNames.map((name) => name.trim()).filter(Boolean))];
}

function compactSpellCastHistory(casts: Record<string, number> | undefined) {
  if (!casts) return "—";
  const parts = Object.entries(casts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([spellName, count]) => `${displaySpellName(spellName)} ×${count}`);
  return parts.join(" · ") || "—";
}

function formatGp(value: number) {
  return Number.isInteger(value) ? `${value} gp` : `${value.toFixed(2)} gp`;
}

function formatWeight(value: number) {
  return Number.isInteger(value) ? `${value} lb` : `${value.toFixed(2)} lb`;
}

function displayEquipmentSlot(slot: InventoryEquipmentSlot) {
  return slot === "slotless" ? "slotless" : slot.replace(/-/g, " ");
}

function compactWeaponTags(tags: string[] | undefined) {
  return (tags ?? []).join(", ") || "—";
}

function compactDamageTypes(types: string[] | undefined) {
  const labels: Record<string, string> = {
    slashing: "S",
    piercing: "P",
    bludgeoning: "B",
  };
  return (
    (types ?? []).map((type) => labels[type.toLowerCase()] ?? type).join("/") ||
    "—"
  );
}

function titleCaseLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function weaponRuntimeKey(
  weapon: { name: string; weaponTemplateId?: string; category: string },
  index: number,
) {
  return `${weapon.weaponTemplateId ?? weapon.name.toLowerCase()}::${weapon.category}::${index}`;
}

function compactAttackHistory(
  entries:
    Array<{ at: string; outcome?: AttackOutcome; note?: string }> | undefined,
) {
  return (
    (entries ?? [])
      .slice(-3)
      .map((entry) => {
        const time = new Date(entry.at).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        });
        const bits = [
          time,
          entry.outcome?.toUpperCase(),
          entry.note ? `“${entry.note}”` : undefined,
        ].filter(Boolean);
        return bits.join(" ");
      })
      .join(" · ") || "—"
  );
}

function breakdownTooltip(total: string, breakdown: BreakdownEntry[]) {
  return [
    `Total ${total}`,
    ...breakdown.map((b) => `${b.source}: ${sign(b.value)}`),
  ].join(" • ");
}

function statTooltip(stat: DerivedStat, raw?: boolean) {
  return breakdownTooltip(
    raw ? `${stat.total}` : sign(stat.total),
    stat.breakdown,
  );
}

function CompactRollControl({
  label,
  value,
  onChange,
  total,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  total: number | undefined;
}) {
  const popoverRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      )
        popoverRef.current.open = false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && popoverRef.current?.open) {
        popoverRef.current.open = false;
        popoverRef.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details ref={popoverRef} className="sheet-roll-popover">
      <summary aria-label={`Roll ${label}`}>Roll</summary>
      <div className="sheet-roll-popover-body">
        <label>
          <span>d20 result</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="d20"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        <span className="sheet-roll-popover-total">
          Total <strong>{total === undefined ? "—" : sign(total)}</strong>
        </span>
      </div>
    </details>
  );
}

function contextualAcTooltip(
  profile: DerivedSheet["ac"]["contextual"][number],
) {
  return [
    `${profile.label} AC`,
    `Normal\n${statTooltip(profile.normal, true)}`,
    `Touch\n${statTooltip(profile.touch, true)}`,
    `Flat-Footed\n${statTooltip(profile.flatFooted, true)}`,
  ].join("\n\n");
}

function damageReductionTooltip(
  reduction: DerivedSheet["damageReductions"][number],
) {
  return [
    `${reduction.label}: ${reduction.value}/${reduction.bypass}`,
    `Applies against: ${reduction.appliesAgainst}`,
    ...reduction.breakdown.map(
      (entry) => `${entry.source}: ${entry.value}/${reduction.bypass}`,
    ),
  ].join("\n\n");
}

function weaponDamageTooltip(weapon: DerivedSheet["weapons"][number]) {
  return breakdownTooltip(weapon.damageDisplay, weapon.damageBreakdown);
}

function ordnanceSummary(weapon: DerivedSheet["weapons"][number]) {
  const profile = weapon.ordnanceProfile;
  if (!profile) return undefined;
  return [
    profile.saveDc && profile.saveType
      ? `DC ${profile.saveDc} ${profile.saveType.toUpperCase()}`
      : undefined,
    profile.area,
    profile.duration ? `Duration ${profile.duration}` : undefined,
    profile.directHitEffect,
  ]
    .filter(Boolean)
    .join(" · ");
}

function weaponAttackNote(weapon: DerivedSheet["weapons"][number]) {
  return [...(weapon.ammoNotes ?? []), ...(weapon.ordnanceProfile?.notes ?? [])]
    .filter(Boolean)
    .join(" · ");
}

function weaponCanAttack(weapon: DerivedSheet["weapons"][number]) {
  return (weapon.ammoAvailability ?? []).every(
    (entry) => entry.available >= entry.amount,
  );
}

function critMultiplier(crit: string) {
  const match = /x(\d+)/i.exec(crit);
  return match ? Math.max(1, Number(match[1]) || 1) : 1;
}

function abilityTooltip(score: number, breakdown: BreakdownEntry[]) {
  return breakdownTooltip(`${score}`, breakdown);
}

function encumbranceLabel(encumbrance: DerivedSheet["encumbrance"]) {
  return encumbrance.ignored ? "ignored" : encumbrance.band;
}

function encumbranceTooltip(encumbrance: DerivedSheet["encumbrance"]) {
  return [
    encumbrance.ignored
      ? `Load penalties ignored (actual load: ${encumbrance.actualBand})`
      : `Load: ${encumbrance.band}`,
    `Carried: ${formatWeight(encumbrance.carriedWeight)}`,
    `Light max: ${formatWeight(encumbrance.lightMax)}`,
    `Medium max: ${formatWeight(encumbrance.mediumMax)}`,
    `Heavy max: ${formatWeight(encumbrance.heavyMax)}`,
  ].join(" • ");
}

function hitPointTooltip(sheet: DerivedSheet) {
  const diceLines = sheet.hitPointDetails.dice.map(
    (entry) =>
      `${entry.count}d${entry.hitDie} (${entry.className}) = ${entry.hpFromRolls}`,
  );
  const parts = [
    `Total ${sheet.hitPoints.total}`,
    ...diceLines,
    `Hit die HP: +${sheet.hitPointDetails.rolledHpTotal}`,
    `Con bonus: ${sign(sheet.hitPointDetails.constitutionBonusTotal)}`,
  ];
  if (sheet.hitPointDetails.favoredClassHpTotal !== 0)
    parts.push(
      `Favored class HP: ${sign(sheet.hitPointDetails.favoredClassHpTotal)}`,
    );
  if (sheet.hitPointDetails.miscHpTotal !== 0)
    parts.push(`Misc HP: ${sign(sheet.hitPointDetails.miscHpTotal)}`);
  return parts.join(" • ");
}

function wealthTooltip(
  wealthSummary: WealthSummary,
  inventory: DerivedSheet["inventory"],
) {
  return [
    `Liquid wealth = ${wealthSummary.pp} pp + ${wealthSummary.gp} gp + ${wealthSummary.sp} sp + ${wealthSummary.cp} cp = ${formatGp(wealthSummary.liquidWealthGp)}`,
    `Coin weight = (${wealthSummary.pp} + ${wealthSummary.gp} + ${wealthSummary.sp} + ${wealthSummary.cp}) / 50 = ${formatWeight(wealthSummary.coinWeightLb)}`,
    `Owned gear = ${formatGp(wealthSummary.gearCostGp)}`,
    `Wishlist = ${formatGp(wealthSummary.wishlistCostGp)}`,
    `Inventory cost total = ${formatGp(inventory.totalCostGp)}`,
    `Total wealth = liquid + owned gear = ${formatGp(wealthSummary.totalWealthGp)}`,
  ].join(" • ");
}

function spellLevelMathTooltip(
  casting: DerivedSheet["spellcasting"][number],
  level: number,
  slotsMax: number,
  slotsLeft: number,
) {
  const bonus = casting.bonusSpellsPerDay[level] ?? 0;
  const extra = casting.extraSlotsPerDay[level] ?? 0;
  const used = casting.slotsUsed[level] ?? 0;
  const parts = [
    `${spellLevelLabel(casting, level)} slots`,
    `Base ${casting.baseSpellsPerDay[level] ?? 0}`,
    `Bonus ${sign(bonus)}`,
    `Extra ${sign(extra)}`,
    `Total ${slotsMax}`,
  ];
  if (!casting.selectionDiagnostics[level]?.isAtWill)
    parts.push(`Used ${used}`, `Remaining ${slotsLeft}`);
  return parts.join(" • ");
}

function spellDcTooltip(
  casting: DerivedSheet["spellcasting"][number],
  level: number,
  dc: number,
) {
  const abilityMod = Math.floor((casting.castingAbilityScore - 10) / 2);
  return [
    `Spell DC ${dc}`,
    `10 base`,
    `Spell level ${level}`,
    `${casting.castingAbility.toUpperCase()} mod ${sign(abilityMod)}`,
  ].join(" • ");
}

function spellcastingSummaryTooltip(
  casting: DerivedSheet["spellcasting"][number],
) {
  return [
    `Caster level ${casting.casterLevel}`,
    `Casting ability ${casting.castingAbility.toUpperCase()} ${casting.castingAbilityScore}`,
    `Concentration ${sign(casting.concentration.total)}`,
    `Max spell level ${casting.maxSpellLevel}`,
  ].join(" • ");
}

/** The full read-only character sheet, rendered from a DerivedSheet. */
export function Sheet({
  characterId = "local",
  sheet,
  wealthSummary,
  currentHp,
  hpDamageTaken,
  tempHp,
  nonlethalDamage,
  stable,
  deathRules,
  fightOnSource,
  diehardActive,
  ferocityUsed,
  onApplyDamage,
  onApplyHealing,
  onApplyHpLoss,
  onSetTempHp,
  onApplyNonlethal,
  onHealNonlethal,
  onSetStable,
  onSetDiehardActive,
  onSetFerocityActive,
  onSetFerocityUsed,
  onResetHp,
  onRest,
  campaignTraits = [],
  referenceRuntime,
  languagesPanel,
  spellCastCounts,
  onCastSpell,
  onResetSpellSlotLevel,
  weaponAttackHistory,
  onWeaponAttack,
  onUndoWeaponAttack,
  onTagWeaponAttackOutcome,
  onSetWeaponAttackOutcome,
  onSetWeaponAttackNote,
  onSetSpecificWeaponAttackNote,
  onResetWeaponAttackHistory,
  onResetAmmo,
  onSetWeaponLoadedAmmo,
  showIdentity = true,
  showSpellcasting = true,
}: {
  characterId?: string;
  sheet: DerivedSheet;
  referenceRuntime?: ReferenceRuntime;
  languagesPanel?: ReactNode;
  wealthSummary: WealthSummary;
  currentHp: number;
  hpDamageTaken: number;
  tempHp: number;
  nonlethalDamage: number;
  stable: boolean;
  deathRules: DeathRules;
  fightOnSource?: "diehard" | "orc" | "half-orc";
  diehardActive: boolean;
  ferocityUsed: boolean;
  onApplyDamage?: (amount: number, damageType?: string) => void;
  onApplyHealing?: (amount: number) => void;
  onApplyHpLoss?: (amount: number) => void;
  onSetTempHp?: (amount: number) => void;
  onApplyNonlethal?: (amount: number) => void;
  onHealNonlethal?: (amount: number) => void;
  onSetStable?: (value: boolean) => void;
  onSetDiehardActive?: (value: boolean) => void;
  onSetFerocityActive?: (value: boolean) => void;
  onSetFerocityUsed?: (value: boolean) => void;
  onResetHp?: () => void;
  onRest?: () => void;
  campaignTraits?: string[];
  spellCastCounts?: SpellCastCounts;
  onCastSpell?: (
    classKey: string,
    level: number,
    max: number,
    spellName: string,
    remaining: number,
  ) => void;
  onResetSpellSlotLevel?: (classKey: string, level: number) => void;
  weaponAttackHistory?: WeaponAttackHistory;
  onWeaponAttack?: (
    weaponKey: string,
    weaponName: string,
    ammoType?: string,
    ammoSpent?: number,
    attackNote?: string,
    ammoEntries?: Array<{ ammoType: string; amount: number }>,
    rolls?: WeaponAttackRolls,
  ) => void;
  onSetWeaponLoadedAmmo?: (
    sourceKind: "race" | "equipment" | "build" | undefined,
    sourceIndex: number | undefined,
    loadedAmmoType?: string,
  ) => void;
  onUndoWeaponAttack?: (weaponKey: string, weaponName: string) => void;
  onTagWeaponAttackOutcome?: (
    weaponKey: string,
    outcome: AttackOutcome,
  ) => void;
  onSetWeaponAttackOutcome?: (
    weaponKey: string,
    attackId: string,
    outcome: AttackOutcome,
  ) => void;
  onSetWeaponAttackNote?: (weaponKey: string, note: string) => void;
  onSetSpecificWeaponAttackNote?: (
    weaponKey: string,
    attackId: string,
    note: string,
  ) => void;
  onResetWeaponAttackHistory?: (
    weaponKey?: string,
    weaponName?: string,
  ) => void;
  onResetAmmo?: (ammoType?: string) => void;
  showIdentity?: boolean;
  showSpellcasting?: boolean;
}) {
  const [attackNoteDrafts, setAttackNoteDrafts] = useCharacterUiState<
    Record<string, string>
  >(characterId, "weapon-notes", {});
  const [attackRollDrafts, setAttackRollDrafts] = useCharacterUiState<
    Record<string, string>
  >(characterId, "weapon-attack-rolls", {});
  const [damageRollDrafts, setDamageRollDrafts] = useCharacterUiState<
    Record<string, string>
  >(characterId, "weapon-damage-rolls", {});
  const [saveRollDrafts, setSaveRollDrafts] = useState<Record<string, string>>(
    {},
  );
  const [skillRollDrafts, setSkillRollDrafts] = useState<
    Record<string, string>
  >({});
  const [initiativeRollDraft, setInitiativeRollDraft] = useState("");
  const [cmbRollDraft, setCmbRollDraft] = useState("");
  const [healthManagerOpen, setHealthManagerOpen] = useCharacterUiState(
    characterId,
    "health-manager-open",
    false,
  );
  const [attackDialog, setAttackDialog] = useCharacterUiState<string | null>(
    characterId,
    "weapon-attack-dialog",
    null,
  );
  const [weaponsOpen, setWeaponsOpen] = useCharacterUiState(
    characterId,
    "weapons-open",
    true,
  );
  const [referenceOpen, setReferenceOpen] = useCharacterUiState(
    characterId,
    "reference-open",
    true,
  );
  const [abilitiesOpen, setAbilitiesOpen] = useCharacterUiState(
    characterId,
    "ability-scores-open",
    true,
  );
  const [defenseOpen, setDefenseOpen] = useCharacterUiState(
    characterId,
    "defense-open",
    true,
  );
  const [combatOpen, setCombatOpen] = useCharacterUiState(
    characterId,
    "combat-open",
    true,
  );
  function collapseButton(label: string, open: boolean, toggle: () => void) {
    return (
      <button
        type="button"
        className="ghost small"
        aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
        aria-expanded={open}
        onClick={toggle}
      >
        {open ? "−" : "+"}
      </button>
    );
  }
  const rankedSkills = Object.values(sheet.skills)
    .filter(shouldDisplaySheetSkill)
    .sort((a, b) => a.name.localeCompare(b.name));

  const { race, classes, archetypes } = sheet.descriptor;
  const classLine = classes.map((c) => `${c.name} ${c.level}`).join(" / ");
  const archetypeLine = archetypes.map((a) => a.name).join(", ");
  const identity = [race, classLine, archetypeLine].filter(Boolean).join(" · ");
  const raceNotes = partitionRaceNotes(sheet.raceMetadata?.notes);

  function noteDraftValue(draftKey: string, currentNote?: string) {
    return attackNoteDrafts[draftKey] ?? currentNote ?? "";
  }

  function saveAttackNote(weaponKey: string, currentNote?: string) {
    const nextNote = noteDraftValue(`${weaponKey}::latest`, currentNote);
    onSetWeaponAttackNote?.(weaponKey, nextNote);
    setAttackNoteDrafts((prev) => ({
      ...prev,
      [`${weaponKey}::latest`]: nextNote.trim(),
    }));
  }

  function saveSpecificAttackNote(
    weaponKey: string,
    attackId: string,
    currentNote?: string,
  ) {
    const draftKey = `${weaponKey}::${attackId}`;
    const nextNote = noteDraftValue(draftKey, currentNote);
    onSetSpecificWeaponAttackNote?.(weaponKey, attackId, nextNote);
    setAttackNoteDrafts((prev) => ({ ...prev, [draftKey]: nextNote.trim() }));
  }

  function parsedRollTotal(raw: string | undefined) {
    if (!raw || raw.trim() === "") return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }

  function checkTotal(raw: string | undefined, modifier: number) {
    const roll = parsedRollTotal(raw);
    return roll === undefined ? undefined : roll + modifier;
  }

  const healthStatus = deriveHealthStatus({
    maxHp: sheet.hitPoints.total,
    currentHp,
    constitutionScore: sheet.abilities.con.score,
    nonlethalDamage,
    stable,
    fightOn: !!fightOnSource,
    deathThresholdBonus: deathRules.deathThresholdBonus,
  });

  const healthDisplay = healthPresentation(
    currentHp,
    sheet.hitPoints.total,
    healthStatus.condition,
  );

  return (
    <TooltipTriggerContext.Provider value="click">
      <div className="sheet paper-sheet">
        {showIdentity ? (
          <section className="sheet-hero panel paper-panel">
            <div className="sheet-title-block">
              <div className="sheet-name-row">
                <h1>{sheet.name}</h1>
                <span className="paper-badge">Level {sheet.level}</span>
              </div>
              <div className="sheet-meta-line">
                <span>{identity || "Unspecified heroics"}</span>
                {sheet.descriptor.alignment ? (
                  <span>{ALIGNMENT_LABELS[sheet.descriptor.alignment]}</span>
                ) : null}
                <span>Size: {titleCaseLabel(sheet.size)}</span>
                <Tooltip content={encumbranceTooltip(sheet.encumbrance)}>
                  <span>Load: {encumbranceLabel(sheet.encumbrance)}</span>
                </Tooltip>
                <Tooltip
                  content={`Current HP ${currentHp} / ${sheet.hitPoints.total}\n\nDeath threshold ${healthStatus.deathThreshold} HP`}
                >
                  <span
                    className={`tag hp-status ${healthConditionTone(healthStatus.condition)}`}
                  >
                    {healthConditionLabel(healthStatus.condition)}
                  </span>
                </Tooltip>
              </div>
            </div>
          </section>
        ) : null}

        <div className="sheet-left-column">
          <div className="sheet-top-grid">
            <section className="abilities paper-abilities panel paper-panel">
              <div className="sheet-panel-heading">
                <h2>Ability Scores</h2>
                {collapseButton("Ability Scores", abilitiesOpen, () =>
                  setAbilitiesOpen(!abilitiesOpen),
                )}
              </div>
              <div className="abilities-grid" hidden={!abilitiesOpen}>
                {ABILITY_ORDER.map((key) => {
                  const a = sheet.abilities[key];
                  return (
                    <Tooltip
                      key={key}
                      content={abilityTooltip(a.score, a.breakdown)}
                      className="mf-tooltip-anchor-block"
                    >
                      <div className="ability paper-ability">
                        <div className="ability-key">{key.toUpperCase()}</div>
                        <div className="ability-score">{a.score}</div>
                        <div className="ability-mod">{sign(a.mod)}</div>
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </section>

            <div className="sheet-stack">
              <section className="panel paper-panel sheet-defense-panel">
                <div className="sheet-panel-heading">
                  <h2>Defense &amp; Health</h2>
                  {onRest ? (
                    <button
                      type="button"
                      className="ghost small"
                      onClick={onRest}
                    >
                      Rest
                    </button>
                  ) : null}
                  {collapseButton("Defense & Health", defenseOpen, () =>
                    setDefenseOpen(!defenseOpen),
                  )}
                </div>
                <div hidden={!defenseOpen}>
                  <div className="sheet-ac-grid">
                    <Tooltip
                      content={statTooltip(sheet.ac.normal, true)}
                      className="mf-tooltip-anchor-block"
                    >
                      <div className="summary-box ac-primary">
                        <span className="summary-label">Armor Class</span>
                        <span className="summary-value">
                          {sheet.ac.normal.total}
                        </span>
                      </div>
                    </Tooltip>
                    <Tooltip
                      content={statTooltip(sheet.ac.touch, true)}
                      className="mf-tooltip-anchor-block"
                    >
                      <div className="summary-box">
                        <span className="summary-label">Touch</span>
                        <span className="summary-value">
                          {sheet.ac.touch.total}
                        </span>
                      </div>
                    </Tooltip>
                    <Tooltip
                      content={statTooltip(sheet.ac.flatFooted, true)}
                      className="mf-tooltip-anchor-block"
                    >
                      <div className="summary-box">
                        <span className="summary-label">Flat-Footed</span>
                        <span className="summary-value">
                          {sheet.ac.flatFooted.total}
                        </span>
                      </div>
                    </Tooltip>
                    {sheet.ac.contextual.map((profile) => (
                      <Tooltip
                        key={profile.context}
                        content={contextualAcTooltip(profile)}
                        className="mf-tooltip-anchor-block"
                      >
                        <div className="summary-box ac-contextual">
                          <span className="summary-label">
                            AC {profile.label}
                          </span>
                          <span className="summary-value">
                            {profile.normal.total}
                          </span>
                        </div>
                      </Tooltip>
                    ))}
                    {sheet.damageReductions.map((reduction) => (
                      <Tooltip
                        key={reduction.id}
                        content={damageReductionTooltip(reduction)}
                        className="mf-tooltip-anchor-block"
                      >
                        <div className="summary-box defense-contextual">
                          <span className="summary-label">
                            {reduction.label}
                          </span>
                          <span className="summary-value">
                            {reduction.value}/{reduction.bypass}
                          </span>
                        </div>
                      </Tooltip>
                    ))}
                    <Tooltip
                      content={hitPointTooltip(sheet)}
                      className="mf-tooltip-anchor-block"
                    >
                      <div className="summary-box sheet-hp-summary">
                        <span className="summary-label">Hit Points</span>
                        <span className="summary-value">
                          {hitPointExpression(
                            currentHp,
                            sheet.hitPoints.total,
                            tempHp,
                          )}
                        </span>
                      </div>
                    </Tooltip>
                    <Tooltip
                      content={statTooltip(sheet.saves.fort)}
                      className="mf-tooltip-anchor-block"
                    >
                      <div className="summary-box save-summary">
                        <span className="summary-label">Fortitude</span>
                        <span className="summary-value">
                          {sign(sheet.saves.fort.total)}
                        </span>
                        <CompactRollControl
                          label="Fortitude"
                          value={saveRollDrafts.fort ?? ""}
                          onChange={(value) =>
                            setSaveRollDrafts((prev) => ({
                              ...prev,
                              fort: value,
                            }))
                          }
                          total={checkTotal(
                            saveRollDrafts.fort,
                            sheet.saves.fort.total,
                          )}
                        />
                      </div>
                    </Tooltip>
                    <Tooltip
                      content={statTooltip(sheet.saves.ref)}
                      className="mf-tooltip-anchor-block"
                    >
                      <div className="summary-box save-summary">
                        <span className="summary-label">Reflex</span>
                        <span className="summary-value">
                          {sign(sheet.saves.ref.total)}
                        </span>
                        <CompactRollControl
                          label="Reflex"
                          value={saveRollDrafts.ref ?? ""}
                          onChange={(value) =>
                            setSaveRollDrafts((prev) => ({
                              ...prev,
                              ref: value,
                            }))
                          }
                          total={checkTotal(
                            saveRollDrafts.ref,
                            sheet.saves.ref.total,
                          )}
                        />
                      </div>
                    </Tooltip>
                    <Tooltip
                      content={statTooltip(sheet.saves.will)}
                      className="mf-tooltip-anchor-block"
                    >
                      <div className="summary-box save-summary">
                        <span className="summary-label">Will</span>
                        <span className="summary-value">
                          {sign(sheet.saves.will.total)}
                        </span>
                        <CompactRollControl
                          label="Will"
                          value={saveRollDrafts.will ?? ""}
                          onChange={(value) =>
                            setSaveRollDrafts((prev) => ({
                              ...prev,
                              will: value,
                            }))
                          }
                          total={checkTotal(
                            saveRollDrafts.will,
                            sheet.saves.will.total,
                          )}
                        />
                      </div>
                    </Tooltip>
                  </div>
                  <div className="sheet-defense-reference">
                    <span className="summary-label">
                      Resistances &amp; Immunities
                    </span>
                    <div className="sheet-reference-notes">
                      {Object.entries(
                        sheet.raceMetadata?.resistances ?? {},
                      ).map(([kind, value]) => (
                        <span key={kind}>
                          {titleCaseLabel(kind)} {value}
                        </span>
                      ))}
                      {raceNotes.defenses.map((note, index) => (
                        <span key={index}>{note}</span>
                      ))}
                      {!Object.keys(sheet.raceMetadata?.resistances ?? {})
                        .length && !raceNotes.defenses.length ? (
                        <span className="hint">None recorded</span>
                      ) : null}
                    </div>
                  </div>
                  <HealthStatusControls
                    maxHp={sheet.hitPoints.total}
                    currentHp={currentHp}
                    constitutionScore={sheet.abilities.con.score}
                    nonlethalDamage={nonlethalDamage}
                    stable={stable}
                    fightOnSource={fightOnSource}
                    deathRules={deathRules}
                    diehardActive={diehardActive}
                    ferocityUsed={ferocityUsed}
                    onApplyHpLoss={(amount) => onApplyHpLoss?.(amount)}
                    onSetStable={(value) => onSetStable?.(value)}
                    onSetDiehardActive={(value) => onSetDiehardActive?.(value)}
                    onSetFerocityActive={(value) =>
                      onSetFerocityActive?.(value)
                    }
                    onSetFerocityUsed={(value) => onSetFerocityUsed?.(value)}
                  />
                  <div
                    className={`health-manager-details health-tone-${healthDisplay.tone}`}
                  >
                    <div className="health-inline-summary">
                      <span className="health-inline-value">
                        <strong>{currentHp}</strong> / {sheet.hitPoints.total}
                        {tempHp > 0 ? (
                          <span className="health-temp"> + {tempHp}</span>
                        ) : null}{" "}
                        HP
                      </span>
                      <span className="health-inline-meter" aria-hidden="true">
                        <i
                          style={{
                            width: `${healthDisplay.percent}%`,
                          }}
                        />
                      </span>
                      <span className="health-inline-stat">
                        Temp <strong>{tempHp}</strong>
                      </span>
                      <span className="health-inline-stat">
                        Nonlethal <strong>{nonlethalDamage}</strong>
                      </span>
                      <span className="health-inline-status">
                        {healthDisplay.label}
                      </span>
                      <button
                        type="button"
                        className="ghost small health-inline-action"
                        aria-expanded={healthManagerOpen}
                        onClick={() => setHealthManagerOpen((open) => !open)}
                      >
                        {healthManagerOpen
                          ? "Close Manage Health"
                          : "Manage Health"}
                      </button>
                    </div>
                    <div
                      className="health-manager-body"
                      hidden={!healthManagerOpen}
                    >
                      <HealthTracker
                        maxHp={sheet.hitPoints.total}
                        currentHp={currentHp}
                        hpDamageTaken={hpDamageTaken}
                        tempHp={tempHp}
                        nonlethalDamage={nonlethalDamage}
                        constitutionScore={sheet.abilities.con.score}
                        stable={stable}
                        deathRules={deathRules}
                        fightOnSource={fightOnSource}
                        diehardActive={diehardActive}
                        ferocityUsed={ferocityUsed}
                        onApplyDamage={(amount, damageType) =>
                          onApplyDamage?.(amount, damageType)
                        }
                        onApplyHealing={(amount) => onApplyHealing?.(amount)}
                        onApplyHpLoss={(amount) => onApplyHpLoss?.(amount)}
                        onSetTempHp={(amount) => onSetTempHp?.(amount)}
                        onApplyNonlethal={(amount) =>
                          onApplyNonlethal?.(amount)
                        }
                        onHealNonlethal={(amount) => onHealNonlethal?.(amount)}
                        onSetStable={(value) => onSetStable?.(value)}
                        onSetDiehardActive={(value) =>
                          onSetDiehardActive?.(value)
                        }
                        onSetFerocityActive={(value) =>
                          onSetFerocityActive?.(value)
                        }
                        onSetFerocityUsed={(value) =>
                          onSetFerocityUsed?.(value)
                        }
                        onReset={() => onResetHp?.()}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel paper-panel sheet-combat-panel">
                <div className="sheet-panel-heading">
                  <h2>Combat &amp; Movement</h2>
                  {collapseButton("Combat & Movement", combatOpen, () =>
                    setCombatOpen(!combatOpen),
                  )}
                </div>
                <div hidden={!combatOpen}>
                  <div className="sheet-stat-grid sheet-stat-grid-compact paper-sheet-combat-grid">
                    <div className="sheet-attack-group">
                      <div className="stat-card">
                        <span className="summary-label">Base Attack</span>
                        <span className="summary-value">
                          {sign(sheet.baseAttackBonus)}
                        </span>
                      </div>
                      <Tooltip
                        content={statTooltip(sheet.attack.melee)}
                        className="mf-tooltip-anchor-block"
                      >
                        <div className="stat-card combat-secondary-stat">
                          <span className="summary-label">Melee Attack</span>
                          <span className="summary-value">
                            {sign(sheet.attack.melee.total)}
                          </span>
                        </div>
                      </Tooltip>
                      <Tooltip
                        content={statTooltip(sheet.attack.ranged)}
                        className="mf-tooltip-anchor-block"
                      >
                        <div className="stat-card combat-secondary-stat">
                          <span className="summary-label">Ranged Attack</span>
                          <span className="summary-value">
                            {sign(sheet.attack.ranged.total)}
                          </span>
                        </div>
                      </Tooltip>
                    </div>
                    <Tooltip
                      content={statTooltip(sheet.initiative)}
                      className="mf-tooltip-anchor-block"
                    >
                      <div className="stat-card">
                        <span className="summary-label">Initiative</span>
                        <span className="summary-value">
                          {sign(sheet.initiative.total)}
                        </span>
                        <CompactRollControl
                          label="Initiative"
                          value={initiativeRollDraft}
                          onChange={setInitiativeRollDraft}
                          total={checkTotal(
                            initiativeRollDraft,
                            sheet.initiative.total,
                          )}
                        />
                      </div>
                    </Tooltip>
                    <Tooltip
                      content={statTooltip(sheet.cmb)}
                      className="mf-tooltip-anchor-block"
                    >
                      <div className="stat-card">
                        <span className="summary-label">CMB</span>
                        <span className="summary-value">
                          {sign(sheet.cmb.total)}
                        </span>
                        <CompactRollControl
                          label="CMB"
                          value={cmbRollDraft}
                          onChange={setCmbRollDraft}
                          total={checkTotal(cmbRollDraft, sheet.cmb.total)}
                        />
                      </div>
                    </Tooltip>
                    <Tooltip
                      content={statTooltip(sheet.cmd, true)}
                      className="mf-tooltip-anchor-block"
                    >
                      <div className="stat-card">
                        <span className="summary-label">CMD</span>
                        <span className="summary-value">{sheet.cmd.total}</span>
                      </div>
                    </Tooltip>
                    <Tooltip
                      content={encumbranceTooltip(sheet.encumbrance)}
                      className="mf-tooltip-anchor-block"
                    >
                      <div className="stat-card combat-secondary-stat">
                        <span className="summary-label">Encumbrance</span>
                        <span className="summary-value encumbrance-value">
                          {encumbranceLabel(sheet.encumbrance)}
                        </span>
                      </div>
                    </Tooltip>
                  </div>
                  <div className="sheet-movement-strip">
                    <Tooltip content={statTooltip(sheet.speed, true)}>
                      <span>
                        <small>Land</small>
                        <strong>{sheet.speed.total} ft</strong>
                      </span>
                    </Tooltip>
                    {(["fly", "swim", "burrow", "climb"] as const).map(
                      (mode) => (
                        <span key={mode}>
                          <small>{titleCaseLabel(mode)}</small>
                          <strong>
                            {sheet.raceMetadata?.movementModes?.[mode] ===
                            undefined
                              ? "—"
                              : `${sheet.raceMetadata.movementModes[mode]} ft`}
                          </strong>
                        </span>
                      ),
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>

          <section className="panel paper-panel sheet-weapons-panel">
            <div className="sheet-panel-heading">
              <h2>Weapons</h2>
              <button
                type="button"
                className="ghost small"
                aria-label={weaponsOpen ? "Collapse Weapons" : "Expand Weapons"}
                aria-expanded={weaponsOpen}
                onClick={() => setWeaponsOpen((open) => !open)}
              >
                {weaponsOpen ? "−" : "+"}
              </button>
            </div>
            <div hidden={!weaponsOpen}>
              {!sheet.weapons.length ? (
                <p className="weapon-empty-state">
                  No weapons recorded. Add or equip weapons in Inventory to see
                  them here.
                </p>
              ) : null}
              <div
                className="weapon-reference-table"
                role="table"
                aria-label="Weapons"
              >
                {sheet.weapons.length ? (
                  <div className="weapon-reference-heading" role="row">
                    {[
                      "Weapon",
                      "Attack",
                      "Damage",
                      "Critical",
                      "Type",
                      "Range",
                      "Ammunition",
                      "",
                    ].map((label, index) => (
                      <span key={index} role="columnheader">
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
                {sheet.weapons.map((w, i) => {
                  const runtimeKey = weaponRuntimeKey(w, i);
                  const history = weaponAttackHistory?.[runtimeKey] ?? [];
                  const latestAttack = history[history.length - 1];
                  const rawDamageTotal =
                    (parsedRollTotal(damageRollDrafts[runtimeKey]) ?? 0) +
                    w.damageBonus;
                  const displayedDamageTotal =
                    latestAttack?.outcome === "crit"
                      ? rawDamageTotal * critMultiplier(w.crit)
                      : rawDamageTotal;
                  return (
                    <Fragment key={runtimeKey}>
                      <div className="weapon-reference-row" role="row">
                        <span role="cell" className="weapon-reference-name">
                          {w.name}
                          <small>{w.specialTags?.join(" · ")}</small>
                        </span>
                        <span role="cell">
                          <Tooltip content={statTooltip(w.attack)}>
                            <strong>{sign(w.attack.total)}</strong>
                          </Tooltip>
                        </span>
                        <span role="cell">
                          <Tooltip content={weaponDamageTooltip(w)}>
                            <strong>{w.damageDisplay}</strong>
                          </Tooltip>
                        </span>
                        <span role="cell">{w.crit}</span>
                        <span role="cell">
                          {compactDamageTypes(w.damageTypes)}
                        </span>
                        <span role="cell">
                          {w.rangeIncrementFeet
                            ? `${w.rangeIncrementFeet} ft`
                            : "—"}
                        </span>
                        <span role="cell" className="weapon-reference-ammo">
                          {w.ammoAvailability?.length
                            ? w.ammoAvailability
                                .map(
                                  (entry) =>
                                    `${entry.available} ${entry.ammoType}`,
                                )
                                .join(" + ")
                            : "—"}
                          {w.loadedAmmoType ? (
                            <small>Loaded: {w.loadedAmmoType}</small>
                          ) : null}
                        </span>
                        <span role="cell">
                          <button
                            type="button"
                            className="ghost small"
                            onClick={() => setAttackDialog(runtimeKey)}
                          >
                            Attack
                          </button>
                        </span>
                      </div>
                      {attackDialog === runtimeKey ? (
                        <CharacterDialog
                          label={`${w.name} attack`}
                          onClose={() => setAttackDialog(null)}
                        >
                          <section
                            className="modal weapon-attack-dialog"
                            onMouseDown={(event) => event.stopPropagation()}
                          >
                            <div className="modal-head">
                              <div>
                                <span className="character-eyebrow">
                                  Weapon attack
                                </span>
                                <h2>{w.name}</h2>
                              </div>
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => setAttackDialog(null)}
                              >
                                Close
                              </button>
                            </div>
                            <p className="hint">
                              Enter your dice results, record the attack, then
                              mark its outcome. Recording consumes the existing
                              ammunition cost.
                            </p>
                            <span className="weapon-stats">
                              <Tooltip content={statTooltip(w.attack)}>
                                <span className="weapon-atk">
                                  Atk {sign(w.attack.total)}
                                </span>
                              </Tooltip>
                              <Tooltip content={weaponDamageTooltip(w)}>
                                <span className="weapon-dmg">
                                  Dmg {w.damageDisplay}
                                </span>
                              </Tooltip>
                              <span className="weapon-crit">Crit {w.crit}</span>
                              {w.rangeIncrementFeet ? (
                                <span className="weapon-crit">
                                  Range {w.rangeIncrementFeet} ft
                                </span>
                              ) : null}
                              {w.damageTypes?.length ? (
                                <span className="weapon-crit">
                                  Type {compactDamageTypes(w.damageTypes)}
                                </span>
                              ) : null}
                              {w.specialTags?.length ? (
                                <span className="weapon-crit">
                                  Tags {compactWeaponTags(w.specialTags)}
                                </span>
                              ) : null}
                              {w.ammoAvailability?.length ? (
                                <span className="weapon-crit">
                                  Ammo{" "}
                                  {w.ammoAvailability
                                    .map(
                                      (entry) =>
                                        `${entry.available} ${entry.ammoType}${entry.available === 1 ? "" : "s"}`,
                                    )
                                    .join(" + ")}
                                </span>
                              ) : null}
                              {w.loadedAmmoType ? (
                                <span className="weapon-crit">
                                  Loaded {w.loadedAmmoType}
                                </span>
                              ) : null}
                              {weaponAmmoUxLabel(w) ? (
                                <span className="weapon-crit">
                                  Load {weaponAmmoUxLabel(w)}
                                </span>
                              ) : null}
                              {w.reloadType ? (
                                <span className="weapon-crit">
                                  Reload {w.reloadType}
                                </span>
                              ) : null}
                              {w.weaponTechnology ? (
                                <span className="weapon-crit">
                                  Tech {w.weaponTechnology}
                                </span>
                              ) : null}
                              {ordnanceSummary(w) ? (
                                <span className="weapon-crit">
                                  Payload {ordnanceSummary(w)}
                                </span>
                              ) : null}
                              {w.ammoNotes?.length ? (
                                <span className="weapon-crit">
                                  Notes {w.ammoNotes.join(", ")}
                                </span>
                              ) : null}
                              {onResetAmmo ? (
                                <button
                                  className="ghost small"
                                  onClick={() => onResetAmmo()}
                                >
                                  Reset All Ammo
                                </button>
                              ) : null}
                              <span className="weapon-crit">
                                Attacks {history.length}
                              </span>
                              {history.length > 0 ? (
                                <span className="weapon-crit">
                                  Recent {compactAttackHistory(history)}
                                </span>
                              ) : null}
                              {latestAttack?.outcome ? (
                                <span
                                  className={`tag outcome ${latestAttack.outcome}`}
                                >
                                  latest {latestAttack.outcome}
                                </span>
                              ) : null}
                              {latestAttack?.note ? (
                                <span className="weapon-crit weapon-note">
                                  Note “{latestAttack.note}”
                                </span>
                              ) : null}
                              <span className="weapon-crit weapon-actions-block">
                                <label className="weapon-note-editor">
                                  <span>Roll</span>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    placeholder="d20"
                                    value={attackRollDrafts[runtimeKey] ?? ""}
                                    onChange={(event) =>
                                      setAttackRollDrafts((prev) => ({
                                        ...prev,
                                        [runtimeKey]: event.target.value,
                                      }))
                                    }
                                  />
                                </label>
                                <span className="weapon-crit">
                                  Attack Total{" "}
                                  {sign(
                                    (parsedRollTotal(
                                      attackRollDrafts[runtimeKey],
                                    ) ?? 0) + w.attack.total,
                                  )}
                                </span>
                                <label className="weapon-note-editor">
                                  <span>Dmg Roll</span>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    placeholder="dice"
                                    value={damageRollDrafts[runtimeKey] ?? ""}
                                    onChange={(event) =>
                                      setDamageRollDrafts((prev) => ({
                                        ...prev,
                                        [runtimeKey]: event.target.value,
                                      }))
                                    }
                                  />
                                </label>
                                <span className="weapon-crit">
                                  Damage Total {displayedDamageTotal}
                                  {latestAttack?.outcome === "crit"
                                    ? ` (${critMultiplier(w.crit)}×)`
                                    : ""}
                                </span>
                              </span>
                              {onWeaponAttack ? (
                                <span className="weapon-crit weapon-actions-block">
                                  <button
                                    className="ghost small"
                                    disabled={!weaponCanAttack(w)}
                                    onClick={() =>
                                      onWeaponAttack(
                                        runtimeKey,
                                        w.name,
                                        w.ammoType,
                                        w.ammoPerAttack ?? 1,
                                        weaponAttackNote(w),
                                        w.ammoConsumptions,
                                        weaponAttackResults(
                                          attackRollDrafts[runtimeKey],
                                          damageRollDrafts[runtimeKey],
                                          w.attack.total,
                                          w.damageBonus,
                                          critMultiplier(w.crit),
                                        ),
                                      )
                                    }
                                  >
                                    Record Attack
                                  </button>{" "}
                                  {onSetWeaponLoadedAmmo &&
                                  compatibleAmmoEntries(w.ammoType).length >
                                    0 ? (
                                    <>
                                      <button
                                        className="ghost small"
                                        onClick={() =>
                                          onSetWeaponLoadedAmmo(
                                            w.sourceKind,
                                            w.sourceIndex,
                                            undefined,
                                          )
                                        }
                                      >
                                        Base Ammo
                                      </button>{" "}
                                      {compatibleAmmoEntries(w.ammoType).map(
                                        (entry) => (
                                          <button
                                            key={`${runtimeKey}::${entry.ammoType}`}
                                            className="ghost small"
                                            onClick={() =>
                                              onSetWeaponLoadedAmmo(
                                                w.sourceKind,
                                                w.sourceIndex,
                                                entry.ammoType,
                                              )
                                            }
                                          >
                                            {entry.name}
                                          </button>
                                        ),
                                      )}{" "}
                                    </>
                                  ) : null}
                                  <button
                                    className="ghost small"
                                    disabled={history.length <= 0}
                                    onClick={() =>
                                      onUndoWeaponAttack?.(runtimeKey, w.name)
                                    }
                                  >
                                    Undo Attack
                                  </button>{" "}
                                  <button
                                    className="ghost small"
                                    disabled={history.length <= 0}
                                    onClick={() =>
                                      onTagWeaponAttackOutcome?.(
                                        runtimeKey,
                                        "hit",
                                      )
                                    }
                                  >
                                    Hit
                                  </button>{" "}
                                  <button
                                    className="ghost small"
                                    disabled={history.length <= 0}
                                    onClick={() =>
                                      onTagWeaponAttackOutcome?.(
                                        runtimeKey,
                                        "miss",
                                      )
                                    }
                                  >
                                    Miss
                                  </button>{" "}
                                  <button
                                    className="ghost small"
                                    disabled={history.length <= 0}
                                    onClick={() =>
                                      onTagWeaponAttackOutcome?.(
                                        runtimeKey,
                                        "crit",
                                      )
                                    }
                                  >
                                    Crit
                                  </button>{" "}
                                  {onResetWeaponAttackHistory ? (
                                    <button
                                      className="ghost small"
                                      disabled={history.length <= 0}
                                      onClick={() =>
                                        onResetWeaponAttackHistory(
                                          runtimeKey,
                                          w.name,
                                        )
                                      }
                                    >
                                      Reset History
                                    </button>
                                  ) : null}{" "}
                                  {w.ammoType && onResetAmmo ? (
                                    <button
                                      className="ghost small"
                                      onClick={() => onResetAmmo(w.ammoType!)}
                                    >
                                      Restock
                                    </button>
                                  ) : null}
                                  {history.length > 0 &&
                                  onSetWeaponAttackNote ? (
                                    <span className="weapon-note-editor">
                                      <input
                                        type="text"
                                        placeholder="Damage / result note"
                                        value={noteDraftValue(
                                          `${runtimeKey}::latest`,
                                          latestAttack?.note,
                                        )}
                                        onChange={(event) =>
                                          setAttackNoteDrafts((prev) => ({
                                            ...prev,
                                            [`${runtimeKey}::latest`]:
                                              event.target.value,
                                          }))
                                        }
                                      />
                                      <button
                                        className="ghost small"
                                        onClick={() =>
                                          saveAttackNote(
                                            runtimeKey,
                                            latestAttack?.note,
                                          )
                                        }
                                      >
                                        Save Note
                                      </button>
                                    </span>
                                  ) : null}
                                </span>
                              ) : null}
                              {history.length > 0 ? (
                                <details className="weapon-history-editor">
                                  <summary>
                                    Full History ({history.length})
                                  </summary>
                                  <div className="weapon-history-list">
                                    {history
                                      .slice()
                                      .reverse()
                                      .map((entry, historyIndex) => {
                                        const attackId =
                                          entry.id ??
                                          `${runtimeKey}::${historyIndex}`;
                                        const draftKey = `${runtimeKey}::${attackId}`;
                                        return (
                                          <div
                                            className="weapon-history-item"
                                            key={attackId}
                                          >
                                            <div className="weapon-history-head">
                                              <span className="weapon-history-time">
                                                {new Date(
                                                  entry.at,
                                                ).toLocaleTimeString([], {
                                                  hour: "numeric",
                                                  minute: "2-digit",
                                                  second: "2-digit",
                                                })}
                                              </span>
                                              <div className="weapon-history-actions">
                                                <button
                                                  className="ghost small"
                                                  onClick={() =>
                                                    onSetWeaponAttackOutcome?.(
                                                      runtimeKey,
                                                      attackId,
                                                      "hit",
                                                    )
                                                  }
                                                >
                                                  Hit
                                                </button>
                                                <button
                                                  className="ghost small"
                                                  onClick={() =>
                                                    onSetWeaponAttackOutcome?.(
                                                      runtimeKey,
                                                      attackId,
                                                      "miss",
                                                    )
                                                  }
                                                >
                                                  Miss
                                                </button>
                                                <button
                                                  className="ghost small"
                                                  onClick={() =>
                                                    onSetWeaponAttackOutcome?.(
                                                      runtimeKey,
                                                      attackId,
                                                      "crit",
                                                    )
                                                  }
                                                >
                                                  Crit
                                                </button>
                                                {entry.outcome ? (
                                                  <span
                                                    className={`tag outcome ${entry.outcome}`}
                                                  >
                                                    {entry.outcome}
                                                  </span>
                                                ) : null}
                                              </div>
                                            </div>
                                            <div className="weapon-history-note-row">
                                              <input
                                                type="text"
                                                placeholder="Damage / result note"
                                                value={noteDraftValue(
                                                  draftKey,
                                                  entry.note,
                                                )}
                                                onChange={(event) =>
                                                  setAttackNoteDrafts(
                                                    (prev) => ({
                                                      ...prev,
                                                      [draftKey]:
                                                        event.target.value,
                                                    }),
                                                  )
                                                }
                                              />
                                              <button
                                                className="ghost small"
                                                onClick={() =>
                                                  onSetSpecificWeaponAttackNote &&
                                                  saveSpecificAttackNote(
                                                    runtimeKey,
                                                    attackId,
                                                    entry.note,
                                                  )
                                                }
                                              >
                                                Save Note
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </details>
                              ) : null}
                            </span>
                          </section>
                        </CharacterDialog>
                      ) : null}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="sheet-sections sheet-sections-wide-right">
            <div className="sheet-stack">
              <section className="panel paper-panel sheet-reference-panel">
                <div className="sheet-panel-heading">
                  <h2>Feats &amp; Special Abilities</h2>
                  <button
                    type="button"
                    className="ghost small"
                    aria-label={
                      referenceOpen
                        ? "Collapse Feats & Special Abilities"
                        : "Expand Feats & Special Abilities"
                    }
                    aria-expanded={referenceOpen}
                    onClick={() => setReferenceOpen((open) => !open)}
                  >
                    {referenceOpen ? "−" : "+"}
                  </button>
                </div>
                <div hidden={!referenceOpen}>
                  <CharacterReferenceRows
                    characterId={characterId}
                    sheet={sheet}
                    campaignTraits={campaignTraits}
                    runtime={referenceRuntime}
                  />
                </div>
              </section>

              <section className="panel paper-panel sheet-inventory-panel">
                <h2>Inventory</h2>
                <div className="sheet-stat-grid sheet-stat-grid-compact">
                  <div className="stat-card">
                    <span className="summary-label">Items</span>
                    <span className="summary-value">
                      {sheet.inventory.itemCount}
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="summary-label">Equipped</span>
                    <span className="summary-value">
                      {sheet.inventory.equippedCount}
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="summary-label">Gear Weight</span>
                    <span className="summary-value">
                      {formatWeight(sheet.inventory.totalWeight)}
                    </span>
                  </div>
                  <Tooltip
                    content={wealthTooltip(wealthSummary, sheet.inventory)}
                    className="mf-tooltip-anchor-block"
                  >
                    <div className="stat-card">
                      <span className="summary-label">Gear Cost</span>
                      <span className="summary-value">
                        {formatGp(sheet.inventory.totalCostGp)}
                      </span>
                    </div>
                  </Tooltip>
                  <Tooltip
                    content={wealthTooltip(wealthSummary, sheet.inventory)}
                    className="mf-tooltip-anchor-block"
                  >
                    <div className="stat-card">
                      <span className="summary-label">Coinpurse</span>
                      <span className="summary-value">
                        {formatGp(wealthSummary.liquidWealthGp)}
                      </span>
                    </div>
                  </Tooltip>
                  <Tooltip
                    content={wealthTooltip(wealthSummary, sheet.inventory)}
                    className="mf-tooltip-anchor-block"
                  >
                    <div className="stat-card">
                      <span className="summary-label">Coin Weight</span>
                      <span className="summary-value">
                        {formatWeight(wealthSummary.coinWeightLb)}
                      </span>
                    </div>
                  </Tooltip>
                  <Tooltip
                    content={wealthTooltip(wealthSummary, sheet.inventory)}
                    className="mf-tooltip-anchor-block"
                  >
                    <div className="stat-card">
                      <span className="summary-label">Wishlist</span>
                      <span className="summary-value">
                        {formatGp(wealthSummary.wishlistCostGp)}
                      </span>
                    </div>
                  </Tooltip>
                  <Tooltip
                    content={wealthTooltip(wealthSummary, sheet.inventory)}
                    className="mf-tooltip-anchor-block"
                  >
                    <div className="stat-card">
                      <span className="summary-label">Total Wealth</span>
                      <span className="summary-value">
                        {formatGp(wealthSummary.totalWealthGp)}
                      </span>
                    </div>
                  </Tooltip>
                </div>
                {wealthSummary.pp +
                  wealthSummary.gp +
                  wealthSummary.sp +
                  wealthSummary.cp >
                0 ? (
                  <p className="hint">
                    Coinpurse: {wealthSummary.pp} pp · {wealthSummary.gp} gp ·{" "}
                    {wealthSummary.sp} sp · {wealthSummary.cp} cp
                  </p>
                ) : null}
                {Object.keys(sheet.rangedCombat.ammoByType).length > 0 ? (
                  <p className="hint">
                    Ammo:{" "}
                    {Object.entries(sheet.rangedCombat.ammoByType)
                      .map(([type, qty]) => `${type} ×${qty}`)
                      .join(" · ")}
                  </p>
                ) : null}
                {sheet.inventoryItems.length > 0 ? (
                  <div className="inventory-list">
                    {sheet.inventoryItems.map((item, index) => (
                      <div
                        className="inventory-item"
                        key={`${item.name}-${index}`}
                      >
                        <div className="inventory-item-head">
                          <div className="inventory-item-title-row">
                            <strong>{item.name}</strong>
                            {item.equipped ? (
                              <span className="tag">equipped</span>
                            ) : null}
                            {item.slot ? (
                              <span className="tag">
                                {displayEquipmentSlot(item.slot)}
                              </span>
                            ) : null}
                            {item.armor ? (
                              <span className="tag feature">
                                {item.armor.category} armor
                              </span>
                            ) : null}
                            {item.weapon ? (
                              <span className="tag feature">weapon</span>
                            ) : null}
                            {item.carryState ? (
                              <span className="tag feature">
                                {item.carryState}
                              </span>
                            ) : null}
                            {item.containerName ? (
                              <span className="tag feature">
                                in {item.containerName}
                              </span>
                            ) : null}
                            {typeof item.containerCapacityLb === "number" ? (
                              <span className="tag feature">
                                container{" "}
                                {formatWeight(item.containerCapacityLb)}
                              </span>
                            ) : null}
                            {item.componentCategory ? (
                              <span className="tag feature">
                                {item.componentCategory}
                              </span>
                            ) : null}
                            {item.spellTriggerNames?.length ? (
                              <span className="tag feature">
                                spells {item.spellTriggerNames.join(", ")}
                              </span>
                            ) : null}
                            {item.ammoType ? (
                              <span className="tag feature">
                                ammo {item.ammoType}
                              </span>
                            ) : null}
                            {typeof item.usesRemaining === "number" ||
                            typeof item.usesMax === "number" ? (
                              <span className="tag feature">
                                uses {item.usesRemaining ?? 0}/
                                {item.usesMax ?? 0}
                              </span>
                            ) : null}
                          </div>
                          <span className="inventory-qty">
                            ×{item.quantity}
                          </span>
                        </div>
                        <div className="inventory-item-stats">
                          <span>
                            Weight: {formatWeight(item.totalWeight)}
                            {item.quantity > 1
                              ? ` (${formatWeight(item.weightEach)} each)`
                              : ""}
                          </span>
                          <span>
                            Cost: {formatGp(item.totalCostGp)}
                            {item.quantity > 1
                              ? ` (${formatGp(item.costEachGp)} each)`
                              : ""}
                          </span>
                        </div>
                        {item.armor ? (
                          <div className="inventory-armor-details">
                            <span className="chip">
                              Armor AC: {item.armor.acBonus ?? 0}
                            </span>
                            <span className="chip">
                              Max Dex: {item.armor.maxDexBonus ?? "—"}
                            </span>
                            <span className="chip">
                              ACP: {item.armor.checkPenalty ?? 0}
                            </span>
                            <span className="chip">
                              Speed:{" "}
                              {item.armor.speed30 !== undefined ||
                              item.armor.speed20 !== undefined
                                ? `${item.armor.speed30 ?? "—"}/${item.armor.speed20 ?? "—"} ft profile`
                                : item.armor.speedPenalty
                                  ? `${sign(-item.armor.speedPenalty)} ft`
                                  : "—"}
                            </span>
                          </div>
                        ) : null}
                        {item.shield ? (
                          <div className="inventory-armor-details">
                            <span className="chip">
                              Shield AC: {item.shield.acBonus ?? 0}
                            </span>
                            <span className="chip">
                              Shield ACP: {item.shield.checkPenalty ?? 0}
                            </span>
                          </div>
                        ) : null}
                        {item.ammoType && !item.weapon ? (
                          <div className="inventory-armor-details">
                            <span className="chip">
                              Ammo Stack: {item.ammoType}
                            </span>
                          </div>
                        ) : null}
                        {typeof item.usesRemaining === "number" ||
                        typeof item.usesMax === "number" ? (
                          <div className="inventory-armor-details">
                            <span className="chip">
                              Uses: {item.usesRemaining ?? 0}/
                              {item.usesMax ?? 0}
                            </span>
                          </div>
                        ) : null}
                        {item.weapon ? (
                          <div className="inventory-armor-details">
                            <span className="chip">
                              Weapon: {item.weapon.category}
                            </span>
                            <span className="chip">
                              Damage: {item.weapon.damageDice}
                            </span>
                            <span className="chip">
                              Prof: {item.weapon.proficiencyGroup ?? "—"}
                            </span>
                            <span className="chip">
                              Crit:{" "}
                              {(item.weapon.critRange ?? 20) >= 20
                                ? "20"
                                : `${item.weapon.critRange}-20`}
                              /x{item.weapon.critMultiplier ?? 2}
                            </span>
                            {item.weapon.rangeIncrementFeet ? (
                              <span className="chip">
                                Range: {item.weapon.rangeIncrementFeet} ft
                              </span>
                            ) : null}
                            {item.weapon.damageTypes?.length ? (
                              <span className="chip">
                                Type:{" "}
                                {compactDamageTypes(item.weapon.damageTypes)}
                              </span>
                            ) : null}
                            {item.weapon.specialTags?.length ? (
                              <span className="chip">
                                Tags:{" "}
                                {compactWeaponTags(item.weapon.specialTags)}
                              </span>
                            ) : null}
                            {item.weapon.ammoType ? (
                              <span className="chip">
                                Ammo Type: {item.weapon.ammoType}
                              </span>
                            ) : null}
                            {item.weapon.loadedAmmoType ? (
                              <span className="chip">
                                Loaded: {item.weapon.loadedAmmoType}
                              </span>
                            ) : null}
                            {weaponAmmoUxLabel(item.weapon) ? (
                              <span className="chip">
                                Load: {weaponAmmoUxLabel(item.weapon)}
                              </span>
                            ) : null}
                            {item.weapon.reloadType ? (
                              <span className="chip">
                                Reload: {item.weapon.reloadType}
                              </span>
                            ) : null}
                            {item.weapon.weaponTechnology ? (
                              <span className="chip">
                                Tech: {item.weapon.weaponTechnology}
                              </span>
                            ) : null}
                            {item.weapon.ordnanceProfile ? (
                              <span className="chip">
                                Payload:{" "}
                                {[
                                  item.weapon.ordnanceProfile.saveDc &&
                                  item.weapon.ordnanceProfile.saveType
                                    ? `DC ${item.weapon.ordnanceProfile.saveDc} ${item.weapon.ordnanceProfile.saveType.toUpperCase()}`
                                    : undefined,
                                  item.weapon.ordnanceProfile.area,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hint">
                    No inventory yet. Bold strategy for an adventurer.
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>
        <section className="panel paper-panel sheet-skills-panel">
          <div className="sheet-section-heading">
            <h2>Skills</h2>
            <span>Choose Roll to make a check</span>
          </div>
          <div className="skill-table-heading" aria-hidden="true">
            <span>Skill</span>
            <span>Ability</span>
            <span>Total</span>
            <span />
          </div>
          <div className="skills single-column-skills paper-skill-grid">
            {rankedSkills.map((skill) => {
              const definition = SKILL_DEFINITION_BY_KEY.get(skill.key);
              const metadata = skillMetadataTooltip({
                ability: skill.ability,
                isClassSkill: skill.isClassSkill,
                trainedOnly: skill.trainedOnly,
                usable: skill.usable,
                armorCheckPenalty: definition?.armorCheckPenalty ?? false,
              });
              return (
                <div className="skill" key={skill.key}>
                  <Tooltip content={metadata} className="skill-name-tooltip">
                    <span className="skill-name">
                      <span className="skill-name-text">{skill.name}</span>
                      <span className="skill-flags">
                        {skill.isClassSkill ? (
                          <span className="skill-flag">C</span>
                        ) : null}
                        <span
                          className={`skill-flag ${skill.usable ? (skill.trainedOnly ? "" : "muted") : "warn"}`}
                        >
                          {skillTrainingFlag(skill.trainedOnly, skill.usable)}
                        </span>
                        {definition?.armorCheckPenalty ? (
                          <span className="skill-flag">A</span>
                        ) : null}
                      </span>
                    </span>
                  </Tooltip>
                  <Tooltip
                    content={breakdownTooltip(
                      sign(skill.total),
                      skill.breakdown,
                    )}
                    className="skill-value-tooltip"
                  >
                    <span className="skill-value">{sign(skill.total)}</span>
                  </Tooltip>
                  <span className="skill-ability-key">
                    {skill.ability.toUpperCase()}
                  </span>
                  <CompactRollControl
                    label={skill.name}
                    value={skillRollDrafts[skill.key] ?? ""}
                    onChange={(value) =>
                      setSkillRollDrafts((prev) => ({
                        ...prev,
                        [skill.key]: value,
                      }))
                    }
                    total={checkTotal(skillRollDrafts[skill.key], skill.total)}
                  />
                </div>
              );
            })}
          </div>
          <details className="sheet-skill-details">
            <summary>Languages</summary>
            {languagesPanel ?? (
              <div className="sheet-reference-notes">
                {raceNotes.languagesAndSenses
                  .filter((note) => /language/i.test(note))
                  .map((note, i) => (
                    <span key={i}>{note}</span>
                  ))}
                {!raceNotes.languagesAndSenses.some((note) =>
                  /language/i.test(note),
                ) && <span className="hint">Languages not recorded</span>}
              </div>
            )}
          </details>
          <details className="sheet-skill-details">
            <summary>Senses</summary>
            <div className="sheet-reference-notes">
              {sheet.raceMetadata?.senses?.darkvisionFeet ? (
                <span>
                  Darkvision {sheet.raceMetadata.senses.darkvisionFeet} ft
                </span>
              ) : null}
              {sheet.raceMetadata?.senses?.lowLightVision ? (
                <span>Low-light vision</span>
              ) : null}
              {raceNotes.languagesAndSenses
                .filter((note) => !/language/i.test(note))
                .map((note, i) => (
                  <span key={i}>{note}</span>
                ))}
              {!sheet.raceMetadata?.senses?.darkvisionFeet &&
                !sheet.raceMetadata?.senses?.lowLightVision &&
                !raceNotes.languagesAndSenses.some(
                  (note) => !/language/i.test(note),
                ) && (
                  <span className="hint">No additional senses recorded</span>
                )}
            </div>
          </details>
        </section>

        {showSpellcasting && sheet.spellcasting.length > 0 ? (
          <section className="panel paper-panel">
            <h2>Spellcasting</h2>
            <div className="spell-sheet-grid">
              {sheet.spellcasting.map((c, i) => {
                const classKey = c.className.toLowerCase();
                const levels = Object.keys(c.selectionDiagnostics)
                  .map(Number)
                  .sort((a, b) => a - b);
                return (
                  <div className="spell-sheet-card" key={i}>
                    <div className="editor-section-head tight">
                      <h3>{c.className}</h3>
                      <span className="paper-badge">{c.castingType}</span>
                    </div>
                    <div className="spell-sheet-meta spell-sheet-meta-cards">
                      <Tooltip
                        content={spellcastingSummaryTooltip(c)}
                        className="mf-tooltip-anchor-block"
                      >
                        <div className="spell-summary-card">
                          <span className="spell-summary-label">
                            Caster Level
                          </span>
                          <strong>{c.casterLevel}</strong>
                        </div>
                      </Tooltip>
                      <Tooltip
                        content={spellcastingSummaryTooltip(c)}
                        className="mf-tooltip-anchor-block"
                      >
                        <div className="spell-summary-card">
                          <span className="spell-summary-label">
                            Casting Stat
                          </span>
                          <strong>
                            {c.castingAbility.toUpperCase()}{" "}
                            {c.castingAbilityScore}
                          </strong>
                        </div>
                      </Tooltip>
                      <Tooltip
                        content={statTooltip(c.concentration)}
                        className="mf-tooltip-anchor-block"
                      >
                        <div className="spell-summary-card">
                          <span className="spell-summary-label">
                            Concentration
                          </span>
                          <strong>{sign(c.concentration.total)}</strong>
                        </div>
                      </Tooltip>
                      <Tooltip
                        content={compactByLevel(c.slotsRemaining)}
                        className="mf-tooltip-anchor-block"
                      >
                        <div className="spell-summary-card">
                          <span className="spell-summary-label">Slots</span>
                          <strong>{compactByLevel(c.slotsRemaining)}</strong>
                        </div>
                      </Tooltip>
                      {c.domains.length > 0 ? (
                        <span className="chip">
                          Domains: {displayDomainNames(c.domains).join(", ")}
                        </span>
                      ) : null}
                      {c.specialistSchool ? (
                        <span className="chip">
                          School: {displaySchoolName(c.specialistSchool)}
                        </span>
                      ) : null}
                      {Object.entries(c.spellSaveDcBonusesBySchool)
                        .filter(([, bonus]) => bonus.total !== 0)
                        .map(([school, bonus]) => (
                          <Tooltip
                            key={`${classKey}-spell-dc-${school}`}
                            content={bonus.breakdown
                              .map(
                                (entry) =>
                                  `${entry.source}: ${sign(entry.value)} ${entry.type}`,
                              )
                              .join("\n")}
                          >
                            <span className="chip">
                              {displaySchoolName(school)} DC {sign(bonus.total)}
                            </span>
                          </Tooltip>
                        ))}
                    </div>
                    <div className="spell-level-list">
                      {levels.map((level) => {
                        const diag = c.selectionDiagnostics[level];
                        if (!diag) return null;
                        const selected =
                          c.castingType === "prepared"
                            ? (c.selectedPreparedSpells[level] ?? [])
                            : (c.selectedKnownSpells[level] ?? []);
                        const library = c.librarySpells[level] ?? [];
                        const granted = c.grantedSpells[level] ?? [];
                        const castables = uniqueSpellNames(
                          selected.length > 0
                            ? selected
                            : [...granted, ...library],
                        );
                        const slotsMax = c.spellsPerDay[level] ?? 0;
                        const slotsLeft = c.slotsRemaining[level] ?? slotsMax;
                        const spellDc = c.spellSaveDcs[level];
                        const castHistory =
                          spellCastCounts?.[classKey]?.[level];
                        const canSpendSlot = diag.isAtWill || slotsLeft > 0;
                        return (
                          <details
                            className="spell-level-sheet-block spell-level-details"
                            key={`${classKey}-${level}`}
                            open
                          >
                            <summary className="spell-level-summary-head spell-level-sheet-head">
                              <div>
                                <div className="subsection-title spell-level-sheet-title">
                                  {spellLevelLabel(c, level)}
                                </div>
                                <div className="spell-level-sheet-stats">
                                  <Tooltip
                                    content={spellLevelMathTooltip(
                                      c,
                                      level,
                                      slotsMax,
                                      slotsLeft,
                                    )}
                                  >
                                    <span>
                                      {diag.isAtWill
                                        ? "At will"
                                        : `${slotsLeft}/${slotsMax} slots left`}
                                    </span>
                                  </Tooltip>
                                  {spellDc ? (
                                    <Tooltip
                                      content={spellDcTooltip(
                                        c,
                                        level,
                                        spellDc,
                                      )}
                                    >
                                      <span>DC {spellDc}</span>
                                    </Tooltip>
                                  ) : null}
                                  {diag.capacity > 0 ? (
                                    <span>
                                      {selected.length}/{diag.capacity} ready
                                    </span>
                                  ) : null}
                                  {c.bonusSpellsPerDay[level] ? (
                                    <span>
                                      Bonus +{c.bonusSpellsPerDay[level]}
                                    </span>
                                  ) : null}
                                  {c.extraSlotsPerDay[level] ? (
                                    <span>
                                      Extra +{c.extraSlotsPerDay[level]}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="spell-level-head-meta">
                                {!diag.isAtWill && slotsMax > 0 ? (
                                  <span>Reset below</span>
                                ) : (
                                  <span>Open to cast</span>
                                )}
                              </div>
                            </summary>

                            <div className="spell-level-sheet-actions">
                              {!diag.isAtWill && slotsMax > 0 ? (
                                <button
                                  className="ghost small"
                                  onClick={() =>
                                    onResetSpellSlotLevel?.(classKey, level)
                                  }
                                >
                                  Reset Slots
                                </button>
                              ) : null}
                            </div>

                            {castables.length > 0 ? (
                              <div className="spell-chip-section spell-cast-panel">
                                <div className="spell-chip-label">
                                  Ready To Cast
                                </div>
                                <div className="spell-chip-list">
                                  {castables.map((spellName) => (
                                    <Tooltip
                                      key={`${classKey}-${level}-${spellName}`}
                                      content={spellTitle(spellName)}
                                    >
                                      <button
                                        className="spell-cast-chip spell-cast-chip-large"
                                        type="button"
                                        disabled={!canSpendSlot}
                                        onClick={() =>
                                          onCastSpell?.(
                                            classKey,
                                            level,
                                            slotsMax,
                                            spellName,
                                            slotsLeft,
                                          )
                                        }
                                      >
                                        {displaySpellName(spellName)}
                                      </button>
                                    </Tooltip>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="hint">
                                No spells queued here yet. Wizard admin failure.
                              </p>
                            )}

                            {selected.length > 0 ? (
                              <div className="spell-chip-section">
                                <div className="spell-chip-label">
                                  {c.castingType === "prepared"
                                    ? "Prepared Today"
                                    : "Known Right Now"}
                                </div>
                                <div className="spell-chip-list readonly">
                                  {selected.map((spellName, index) => (
                                    <Tooltip
                                      key={`${classKey}-${level}-selected-${index}`}
                                      content={spellTitle(spellName)}
                                    >
                                      <span className="spell-name-chip">
                                        {displaySpellName(spellName)}
                                      </span>
                                    </Tooltip>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {granted.length > 0 ? (
                              <div className="spell-chip-section">
                                <div className="spell-chip-label">
                                  Always Available / Granted
                                </div>
                                <div className="spell-chip-list readonly">
                                  {granted.map((spellName, index) => (
                                    <Tooltip
                                      key={`${classKey}-${level}-granted-${index}`}
                                      content={spellTitle(spellName)}
                                    >
                                      <span className="spell-name-chip accent">
                                        {displaySpellName(spellName)}
                                      </span>
                                    </Tooltip>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {library.length > 0 ? (
                              <details className="spell-reference-details">
                                <summary>
                                  Reference library ({library.length})
                                </summary>
                                <div className="spell-chip-list readonly spell-reference-list">
                                  {library.map((spellName, index) => (
                                    <Tooltip
                                      key={`${classKey}-${level}-library-${index}`}
                                      content={spellTitle(spellName)}
                                    >
                                      <span className="spell-name-chip">
                                        {displaySpellName(spellName)}
                                      </span>
                                    </Tooltip>
                                  ))}
                                </div>
                              </details>
                            ) : null}

                            {castHistory ? (
                              <Tooltip
                                content={compactSpellCastHistory(castHistory)}
                              >
                                <div className="spell-cast-history">
                                  Cast this session:{" "}
                                  {compactSpellCastHistory(castHistory)}
                                </div>
                              </Tooltip>
                            ) : null}
                          </details>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </TooltipTriggerContext.Provider>
  );
}
