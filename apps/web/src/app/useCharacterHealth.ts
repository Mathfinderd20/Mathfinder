import { useEffect } from "react";
import {
  deriveDeathRules,
  deriveHealthStatus,
  type CharacterBuild,
  type DerivedSheet,
  type RuntimeAction,
} from "@mathfinder/rules-engine";
import type { RuntimeStateController } from "../useRuntimeState";
import {
  DIEHARD_ACTIVE_FLAG_ID,
  directHpLossRuntimeActions,
  FEROCITY_ACTIVE_FLAG_ID,
  FEROCITY_USED_FLAG_ID,
  healingRuntimeActions,
  HP_DAMAGE_RESOURCE_ID,
  NONLETHAL_DAMAGE_RESOURCE_ID,
  resetHealthRuntimeActions,
  STABLE_FLAG_ID,
  TEMP_HP_RESOURCE_ID,
} from "../runtimeMutations";

export function useCharacterHealth(
  build: CharacterBuild,
  sheet: DerivedSheet,
  resourceMaxes: Record<string, number>,
  runtime: RuntimeStateController,
) {
  const {
    applyActions,
    diehardActive,
    ferocityActive,
    ferocityUsed,
    setFlag,
    stable,
  } = runtime;
  const hpDamageTaken = Math.max(
    0,
    runtime.resourcesUsed[HP_DAMAGE_RESOURCE_ID] ?? 0,
  );
  const tempHp = Math.max(0, runtime.resourcesUsed[TEMP_HP_RESOURCE_ID] ?? 0);
  const nonlethalDamage = Math.max(
    0,
    runtime.resourcesUsed[NONLETHAL_DAMAGE_RESOURCE_ID] ?? 0,
  );
  const currentHp = sheet.hitPoints.total - hpDamageTaken;
  const deathRules = deriveDeathRules(build);
  const fightOnSource: "diehard" | "half-orc" | "orc" | undefined =
    currentHp < 0 && deathRules.hasDiehard && diehardActive
      ? "diehard"
      : currentHp <= 0 && deathRules.ferocity === "half-orc" && ferocityActive
        ? "half-orc"
        : currentHp <= 0 && deathRules.ferocity === "orc"
          ? "orc"
          : undefined;
  const healthStatus = deriveHealthStatus({
    maxHp: sheet.hitPoints.total,
    currentHp,
    constitutionScore: sheet.abilities.con.score,
    nonlethalDamage,
    stable,
    fightOn: !!fightOnSource,
    deathThresholdBonus: deathRules.deathThresholdBonus,
  });

  useEffect(() => {
    const belowZeroAndAlive =
      currentHp < 0 && currentHp > healthStatus.deathThreshold;
    const ferocityCanContinue =
      currentHp <= 0 && currentHp > healthStatus.deathThreshold;
    const actions: RuntimeAction[] = [];
    if (belowZeroAndAlive && deathRules.automaticallyStabilizes && !stable)
      actions.push({ type: "set-flag", key: STABLE_FLAG_ID, value: true });
    if ((!belowZeroAndAlive || !deathRules.hasDiehard) && diehardActive)
      actions.push({
        type: "set-flag",
        key: DIEHARD_ACTIVE_FLAG_ID,
        value: false,
      });
    if ((!ferocityCanContinue || !deathRules.ferocity) && ferocityActive)
      actions.push({
        type: "set-flag",
        key: FEROCITY_ACTIVE_FLAG_ID,
        value: false,
      });
    if (actions.length > 0) applyActions(actions);
  }, [
    currentHp,
    deathRules.automaticallyStabilizes,
    deathRules.ferocity,
    deathRules.hasDiehard,
    healthStatus.deathThreshold,
    diehardActive,
    ferocityActive,
    applyActions,
    stable,
  ]);

  function applyIncomingDamage(amount: number, damageType?: string) {
    const normalized = Math.max(0, amount);
    if (normalized <= 0) return;
    const spellAbsorptions: Array<{
      effectId: string;
      effectName?: string;
      max: number;
      perHitMaximum?: number;
    }> = [];
    if (damageType === "physical" && runtime.activeBuffs["spell-stoneskin"]) {
      const max = resourceMaxes["spell-stoneskin"];
      if (max !== undefined)
        spellAbsorptions.push({
          effectId: "spell-stoneskin",
          effectName: "Stoneskin",
          max,
          perHitMaximum: 10,
        });
    }
    if (
      ["acid", "cold", "electricity", "fire", "sonic"].includes(
        damageType ?? "",
      ) &&
      runtime.activeBuffs["spell-protection-from-energy"]
    ) {
      const max = resourceMaxes["spell-protection-from-energy"];
      if (max !== undefined)
        spellAbsorptions.push({
          effectId: "spell-protection-from-energy",
          effectName: "Protection from Energy",
          max,
        });
    }
    runtime.applyTrackedDamage(
      normalized,
      damageType,
      HP_DAMAGE_RESOURCE_ID,
      TEMP_HP_RESOURCE_ID,
      spellAbsorptions,
    );
  }

  function applyHealing(amount: number) {
    applyActions(
      healingRuntimeActions({
        amount,
        currentHp,
        maxHp: sheet.hitPoints.total,
        dead: healthStatus.condition === "dead",
      }),
    );
  }

  function applyDirectHpLoss(amount: number) {
    applyActions(directHpLossRuntimeActions(amount));
  }

  function applyNonlethalDamage(amount: number) {
    const normalized = Math.max(0, amount);
    if (normalized <= 0) return;
    if (currentHp < 0) {
      applyDirectHpLoss(normalized);
      return;
    }
    runtime.adjustResource(NONLETHAL_DAMAGE_RESOURCE_ID, normalized);
  }

  function resetHp() {
    applyActions(resetHealthRuntimeActions());
  }

  return {
    applyDirectHpLoss,
    applyHealing,
    applyIncomingDamage,
    applyNonlethalDamage,
    currentHp,
    deathRules,
    diehardActive: diehardActive,
    ferocityUsed: ferocityUsed,
    fightOnSource,
    healNonlethal: (amount: number) =>
      runtime.adjustResource(
        NONLETHAL_DAMAGE_RESOURCE_ID,
        -Math.max(0, amount),
      ),
    hpDamageTaken,
    nonlethalDamage,
    resetHp,
    setDiehardActive: (value: boolean) =>
      setFlag(DIEHARD_ACTIVE_FLAG_ID, value),
    setFerocityActive: (value: boolean) =>
      setFlag(FEROCITY_ACTIVE_FLAG_ID, value),
    setFerocityUsed: (value: boolean) => setFlag(FEROCITY_USED_FLAG_ID, value),
    setStable: (value: boolean) => setFlag(STABLE_FLAG_ID, value),
    setTempHp: (amount: number) =>
      runtime.adjustResource(TEMP_HP_RESOURCE_ID, Math.max(0, amount) - tempHp),
    stable: stable,
    tempHp,
  };
}
