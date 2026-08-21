import { useState } from "react";
import {
  ALIGNMENT_LABELS,
  deriveHealthStatus,
  SKILL_DEFINITIONS,
  type AbilityKey,
  type BreakdownEntry,
  type DerivedSheet,
  type DeathRules,
  type DerivedStat,
  type InventoryEquipmentSlot,
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
import { featTitle, spellTitle } from "../rulesText";
import { sign } from "../util";
import { compatibleAmmoEntries } from "../ammoCatalog";
import { weaponAmmoUxLabel } from "../weaponUx";
import {
  HealthTracker,
  healthConditionLabel,
  healthConditionTone,
} from "./HealthTracker";
import { Tooltip } from "./Tooltip";

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
  return (types ?? []).join("/") || "—";
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

function encumbranceTooltip(encumbrance: DerivedSheet["encumbrance"]) {
  return [
    `Load: ${encumbrance.band}`,
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
    `Level ${level} slots`,
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

function racialAbilitySummary(sheet: DerivedSheet) {
  return ABILITY_ORDER.flatMap((key) => {
    const total = sheet.abilities[key].breakdown
      .filter((entry) => entry.type === "racial")
      .reduce((sum, entry) => sum + entry.value, 0);
    return total === 0 ? [] : [`${key.toUpperCase()} ${sign(total)}`];
  });
}

/** The full read-only character sheet, rendered from a DerivedSheet. */
export function Sheet({
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
}: {
  sheet: DerivedSheet;
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
}) {
  const [attackNoteDrafts, setAttackNoteDrafts] = useState<
    Record<string, string>
  >({});
  const [attackRollDrafts, setAttackRollDrafts] = useState<
    Record<string, string>
  >({});
  const [damageRollDrafts, setDamageRollDrafts] = useState<
    Record<string, string>
  >({});
  const [saveRollDrafts, setSaveRollDrafts] = useState<Record<string, string>>(
    {},
  );
  const [skillRollDrafts, setSkillRollDrafts] = useState<
    Record<string, string>
  >({});
  const [initiativeRollDraft, setInitiativeRollDraft] = useState("");
  const [cmbRollDraft, setCmbRollDraft] = useState("");
  const rankedSkills = Object.values(sheet.skills)
    .filter(shouldDisplaySheetSkill)
    .sort((a, b) => a.name.localeCompare(b.name));

  const { race, classes, archetypes, feats, features, suppressedFeatures } =
    sheet.descriptor;
  const displayedFeatures = features.filter(
    (feature) => !/^bonus feats?$/i.test(feature.name.trim()),
  );
  const classLine = classes.map((c) => `${c.name} ${c.level}`).join(" / ");
  const archetypeLine = archetypes.map((a) => a.name).join(", ");
  const identity = [race, classLine, archetypeLine].filter(Boolean).join(" · ");
  const racialBonuses = racialAbilitySummary(sheet);

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

  return (
    <div className="sheet paper-sheet">
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
            <span>Size: {sheet.size}</span>
            <Tooltip content={encumbranceTooltip(sheet.encumbrance)}>
              <span>Load: {sheet.encumbrance.band}</span>
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

      <div className="sheet-top-grid">
        <section className="abilities paper-abilities panel paper-panel">
          <h2>Ability Scores</h2>
          {race && racialBonuses.length > 0 ? (
            <p className="hint">
              {race} racial adjustments: {racialBonuses.join(" · ")}
            </p>
          ) : null}
          <div className="abilities-grid">
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
          <section className="panel paper-panel">
            <h2>Defense Snapshot</h2>
            <div className="sheet-ac-grid">
              <Tooltip
                content={statTooltip(sheet.ac.normal, true)}
                className="mf-tooltip-anchor-block"
              >
                <div className="summary-box ac-primary">
                  <span className="summary-label">Armor Class</span>
                  <span className="summary-value">{sheet.ac.normal.total}</span>
                </div>
              </Tooltip>
              <Tooltip
                content={statTooltip(sheet.ac.touch, true)}
                className="mf-tooltip-anchor-block"
              >
                <div className="summary-box">
                  <span className="summary-label">Touch</span>
                  <span className="summary-value">{sheet.ac.touch.total}</span>
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
                    <span className="summary-label">AC {profile.label}</span>
                    <span className="summary-value">
                      {profile.normal.total}
                    </span>
                  </div>
                </Tooltip>
              ))}
              <Tooltip
                content={hitPointTooltip(sheet)}
                className="mf-tooltip-anchor-block"
              >
                <div className="summary-box">
                  <span className="summary-label">Hit Points</span>
                  <span className="summary-value">
                    {currentHp} / {sheet.hitPoints.total}
                  </span>
                </div>
              </Tooltip>
              <Tooltip
                content={statTooltip(sheet.saves.fort)}
                className="mf-tooltip-anchor-block"
              >
                <div className="summary-box">
                  <span className="summary-label">Fort</span>
                  <span className="summary-value">
                    {sign(sheet.saves.fort.total)}
                  </span>
                  <label className="sheet-roll-entry">
                    <span>Roll</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="d20"
                      value={saveRollDrafts.fort ?? ""}
                      onChange={(event) =>
                        setSaveRollDrafts((prev) => ({
                          ...prev,
                          fort: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <span className="sheet-roll-total">
                    {checkTotal(saveRollDrafts.fort, sheet.saves.fort.total) ===
                    undefined
                      ? "—"
                      : sign(
                          checkTotal(
                            saveRollDrafts.fort,
                            sheet.saves.fort.total,
                          ) ?? 0,
                        )}
                  </span>
                </div>
              </Tooltip>
              <Tooltip
                content={statTooltip(sheet.saves.ref)}
                className="mf-tooltip-anchor-block"
              >
                <div className="summary-box">
                  <span className="summary-label">Ref</span>
                  <span className="summary-value">
                    {sign(sheet.saves.ref.total)}
                  </span>
                  <label className="sheet-roll-entry">
                    <span>Roll</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="d20"
                      value={saveRollDrafts.ref ?? ""}
                      onChange={(event) =>
                        setSaveRollDrafts((prev) => ({
                          ...prev,
                          ref: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <span className="sheet-roll-total">
                    {checkTotal(saveRollDrafts.ref, sheet.saves.ref.total) ===
                    undefined
                      ? "—"
                      : sign(
                          checkTotal(
                            saveRollDrafts.ref,
                            sheet.saves.ref.total,
                          ) ?? 0,
                        )}
                  </span>
                </div>
              </Tooltip>
              <Tooltip
                content={statTooltip(sheet.saves.will)}
                className="mf-tooltip-anchor-block"
              >
                <div className="summary-box">
                  <span className="summary-label">Will</span>
                  <span className="summary-value">
                    {sign(sheet.saves.will.total)}
                  </span>
                  <label className="sheet-roll-entry">
                    <span>Roll</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="d20"
                      value={saveRollDrafts.will ?? ""}
                      onChange={(event) =>
                        setSaveRollDrafts((prev) => ({
                          ...prev,
                          will: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <span className="sheet-roll-total">
                    {checkTotal(saveRollDrafts.will, sheet.saves.will.total) ===
                    undefined
                      ? "—"
                      : sign(
                          checkTotal(
                            saveRollDrafts.will,
                            sheet.saves.will.total,
                          ) ?? 0,
                        )}
                  </span>
                </div>
              </Tooltip>
            </div>
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
              onApplyNonlethal={(amount) => onApplyNonlethal?.(amount)}
              onHealNonlethal={(amount) => onHealNonlethal?.(amount)}
              onSetStable={(value) => onSetStable?.(value)}
              onSetDiehardActive={(value) => onSetDiehardActive?.(value)}
              onSetFerocityActive={(value) => onSetFerocityActive?.(value)}
              onSetFerocityUsed={(value) => onSetFerocityUsed?.(value)}
              onReset={() => onResetHp?.()}
            />
          </section>

          <section className="panel paper-panel">
            <h2>Combat & Movement</h2>
            <div className="sheet-stat-grid sheet-stat-grid-compact paper-sheet-combat-grid">
              <div className="stat-card">
                <span className="summary-label">Base Attack</span>
                <span className="summary-value">
                  {sign(sheet.baseAttackBonus)}
                </span>
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
                  <label className="sheet-roll-entry">
                    <span>Roll</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="d20"
                      value={initiativeRollDraft}
                      onChange={(event) =>
                        setInitiativeRollDraft(event.target.value)
                      }
                    />
                  </label>
                  <span className="sheet-roll-total">
                    {checkTotal(initiativeRollDraft, sheet.initiative.total) ===
                    undefined
                      ? "—"
                      : sign(
                          checkTotal(
                            initiativeRollDraft,
                            sheet.initiative.total,
                          ) ?? 0,
                        )}
                  </span>
                </div>
              </Tooltip>
              <Tooltip
                content={statTooltip(sheet.speed, true)}
                className="mf-tooltip-anchor-block"
              >
                <div className="stat-card">
                  <span className="summary-label">Speed</span>
                  <span className="summary-value">{sheet.speed.total} ft</span>
                </div>
              </Tooltip>
              <Tooltip
                content={statTooltip(sheet.attack.melee)}
                className="mf-tooltip-anchor-block"
              >
                <div className="stat-card">
                  <span className="summary-label">Melee</span>
                  <span className="summary-value">
                    {sign(sheet.attack.melee.total)}
                  </span>
                </div>
              </Tooltip>
              <Tooltip
                content={statTooltip(sheet.attack.ranged)}
                className="mf-tooltip-anchor-block"
              >
                <div className="stat-card">
                  <span className="summary-label">Ranged</span>
                  <span className="summary-value">
                    {sign(sheet.attack.ranged.total)}
                  </span>
                </div>
              </Tooltip>
              <Tooltip
                content={statTooltip(sheet.cmb)}
                className="mf-tooltip-anchor-block"
              >
                <div className="stat-card">
                  <span className="summary-label">CMB</span>
                  <span className="summary-value">{sign(sheet.cmb.total)}</span>
                  <label className="sheet-roll-entry">
                    <span>Roll</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="d20"
                      value={cmbRollDraft}
                      onChange={(event) => setCmbRollDraft(event.target.value)}
                    />
                  </label>
                  <span className="sheet-roll-total">
                    {checkTotal(cmbRollDraft, sheet.cmb.total) === undefined
                      ? "—"
                      : sign(checkTotal(cmbRollDraft, sheet.cmb.total) ?? 0)}
                  </span>
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
                <div className="stat-card">
                  <span className="summary-label">Encumbrance</span>
                  <span className="summary-value smallcaps">
                    {sheet.encumbrance.band}
                  </span>
                </div>
              </Tooltip>
            </div>
            {sheet.raceMetadata ? (
              <div className="race-travel-grid">
                {sheet.raceMetadata.movementModes &&
                Object.keys(sheet.raceMetadata.movementModes).length > 0 ? (
                  <div className="race-meta-card">
                    <span className="spell-chip-label">Movement Modes</span>
                    <div className="spell-chip-list readonly">
                      {Object.entries(sheet.raceMetadata.movementModes).map(
                        ([mode, speed]) => (
                          <span
                            key={`move-${mode}`}
                            className="spell-name-chip"
                          >
                            {titleCaseLabel(mode)} {speed} ft
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}
                {sheet.raceMetadata.senses &&
                (sheet.raceMetadata.senses.darkvisionFeet ||
                  sheet.raceMetadata.senses.lowLightVision) ? (
                  <div className="race-meta-card">
                    <span className="spell-chip-label">Senses</span>
                    <div className="spell-chip-list readonly">
                      {sheet.raceMetadata.senses.darkvisionFeet ? (
                        <span className="spell-name-chip">
                          Darkvision {sheet.raceMetadata.senses.darkvisionFeet}{" "}
                          ft
                        </span>
                      ) : null}
                      {sheet.raceMetadata.senses.lowLightVision ? (
                        <span className="spell-name-chip">
                          Low-light vision
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {sheet.raceMetadata.resistances &&
                Object.keys(sheet.raceMetadata.resistances).length > 0 ? (
                  <div className="race-meta-card">
                    <span className="spell-chip-label">Resistances</span>
                    <div className="spell-chip-list readonly">
                      {Object.entries(sheet.raceMetadata.resistances).map(
                        ([kind, value]) => (
                          <span
                            key={`resist-${kind}`}
                            className="spell-name-chip accent"
                          >
                            {titleCaseLabel(kind)} {value}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {sheet.raceMetadata?.notes?.length ? (
              <details className="equipment-details" style={{ marginTop: 10 }}>
                <summary>Race Traits & Notes</summary>
                <div className="magic-item-meta-list">
                  {sheet.raceMetadata.notes.map((note, index) => (
                    <div key={`race-note-${index}`}>{note}</div>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        </div>
      </div>

      {sheet.weapons.length > 0 ? (
        <section className="panel paper-panel">
          <div className="editor-section-head tight">
            <h2>Weapons</h2>
            {Object.keys(sheet.rangedCombat.ammoByType).length > 0 &&
            onResetAmmo ? (
              <button className="ghost small" onClick={() => onResetAmmo()}>
                Reset Ammo
              </button>
            ) : null}
          </div>
          <div className="weapons paper-table">
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
                <div className="weapon" key={i}>
                  <span className="weapon-name">{w.name}</span>
                  <span className="weapon-stats">
                    <Tooltip content={statTooltip(w.attack)}>
                      <span className="weapon-atk">
                        Atk {sign(w.attack.total)}
                      </span>
                    </Tooltip>
                    <Tooltip content={weaponDamageTooltip(w)}>
                      <span className="weapon-dmg">Dmg {w.damageDisplay}</span>
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
                      <span className="weapon-crit">Reload {w.reloadType}</span>
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
                    <span className="weapon-crit">
                      Attacks {history.length}
                    </span>
                    {history.length > 0 ? (
                      <span className="weapon-crit">
                        Recent {compactAttackHistory(history)}
                      </span>
                    ) : null}
                    {latestAttack?.outcome ? (
                      <span className={`tag outcome ${latestAttack.outcome}`}>
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
                          (parsedRollTotal(attackRollDrafts[runtimeKey]) ?? 0) +
                            w.attack.total,
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
                            )
                          }
                        >
                          Attack
                        </button>{" "}
                        {onSetWeaponLoadedAmmo &&
                        compatibleAmmoEntries(w.ammoType).length > 0 ? (
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
                            {compatibleAmmoEntries(w.ammoType).map((entry) => (
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
                            ))}{" "}
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
                            onTagWeaponAttackOutcome?.(runtimeKey, "hit")
                          }
                        >
                          Hit
                        </button>{" "}
                        <button
                          className="ghost small"
                          disabled={history.length <= 0}
                          onClick={() =>
                            onTagWeaponAttackOutcome?.(runtimeKey, "miss")
                          }
                        >
                          Miss
                        </button>{" "}
                        <button
                          className="ghost small"
                          disabled={history.length <= 0}
                          onClick={() =>
                            onTagWeaponAttackOutcome?.(runtimeKey, "crit")
                          }
                        >
                          Crit
                        </button>{" "}
                        {onResetWeaponAttackHistory ? (
                          <button
                            className="ghost small"
                            disabled={history.length <= 0}
                            onClick={() =>
                              onResetWeaponAttackHistory(runtimeKey, w.name)
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
                        {history.length > 0 && onSetWeaponAttackNote ? (
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
                                  [`${runtimeKey}::latest`]: event.target.value,
                                }))
                              }
                            />
                            <button
                              className="ghost small"
                              onClick={() =>
                                saveAttackNote(runtimeKey, latestAttack?.note)
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
                        <summary>Full History ({history.length})</summary>
                        <div className="weapon-history-list">
                          {history
                            .slice()
                            .reverse()
                            .map((entry, historyIndex) => {
                              const attackId =
                                entry.id ?? `${runtimeKey}::${historyIndex}`;
                              const draftKey = `${runtimeKey}::${attackId}`;
                              return (
                                <div
                                  className="weapon-history-item"
                                  key={attackId}
                                >
                                  <div className="weapon-history-head">
                                    <span className="weapon-history-time">
                                      {new Date(entry.at).toLocaleTimeString(
                                        [],
                                        {
                                          hour: "numeric",
                                          minute: "2-digit",
                                          second: "2-digit",
                                        },
                                      )}
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
                                        setAttackNoteDrafts((prev) => ({
                                          ...prev,
                                          [draftKey]: event.target.value,
                                        }))
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
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="sheet-sections sheet-sections-wide-right">
        <section className="panel paper-panel">
          <h2>Skills</h2>
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
                  <label className="sheet-roll-entry skill-roll-entry-inline">
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="d20"
                      aria-label={`${skill.name} d20 roll`}
                      value={skillRollDrafts[skill.key] ?? ""}
                      onChange={(event) =>
                        setSkillRollDrafts((prev) => ({
                          ...prev,
                          [skill.key]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <span className="sheet-roll-total">
                    {checkTotal(skillRollDrafts[skill.key], skill.total) ===
                    undefined
                      ? "—"
                      : sign(
                          checkTotal(skillRollDrafts[skill.key], skill.total) ??
                            0,
                        )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="sheet-stack">
          {archetypes.length > 0 ||
          feats.length > 0 ||
          displayedFeatures.length > 0 ||
          suppressedFeatures.length > 0 ? (
            <section className="panel paper-panel">
              <h2>Feats & Special Abilities</h2>
              <div className="acquisitions">
                {archetypes.map((a, i) => (
                  <span className="chip feature" key={`arch-${i}`}>
                    {a.name}
                    <span className="chip-lvl">L{a.level}</span>
                  </span>
                ))}
                {displayedFeatures.map((f, i) => (
                  <span className="chip feature" key={`feat-${i}`}>
                    {f.name}
                    <span className="chip-lvl">L{f.level}</span>
                  </span>
                ))}
                {feats.map((f, i) => (
                  <Tooltip key={`ft-${i}`} content={featTitle(f.name)}>
                    <span className="chip">
                      {f.name}
                      <span className="chip-lvl">L{f.level}</span>
                    </span>
                  </Tooltip>
                ))}
                {suppressedFeatures.map((f, i) => (
                  <Tooltip key={`sup-${i}`} content={f.reason}>
                    <span className="chip suppressed">
                      {f.name}
                      <span className="chip-lvl">suppressed: {f.reason}</span>
                    </span>
                  </Tooltip>
                ))}
              </div>
            </section>
          ) : null}

          <section className="panel paper-panel">
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
                  <div className="inventory-item" key={`${item.name}-${index}`}>
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
                          <span className="tag feature">{item.carryState}</span>
                        ) : null}
                        {item.containerName ? (
                          <span className="tag feature">
                            in {item.containerName}
                          </span>
                        ) : null}
                        {typeof item.containerCapacityLb === "number" ? (
                          <span className="tag feature">
                            container {formatWeight(item.containerCapacityLb)}
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
                            uses {item.usesRemaining ?? 0}/{item.usesMax ?? 0}
                          </span>
                        ) : null}
                      </div>
                      <span className="inventory-qty">×{item.quantity}</span>
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
                          Speed Penalty:{" "}
                          {item.armor.speedPenalty
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
                          Uses: {item.usesRemaining ?? 0}/{item.usesMax ?? 0}
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
                            Type: {compactDamageTypes(item.weapon.damageTypes)}
                          </span>
                        ) : null}
                        {item.weapon.specialTags?.length ? (
                          <span className="chip">
                            Tags: {compactWeaponTags(item.weapon.specialTags)}
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

      {sheet.spellcasting.length > 0 ? (
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
                      const castHistory = spellCastCounts?.[classKey]?.[level];
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
                                Level {level}
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
                                    content={spellDcTooltip(c, level, spellDc)}
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
  );
}
