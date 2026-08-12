import {
  deriveHealthStatus,
  stabilizationCheck,
  type DeathRules,
  type HealthCondition,
  type StabilizationCheckResult,
} from "@mathfinder/rules-engine";
import { useState } from "react";
import { Tooltip } from "./Tooltip";

interface HealthTrackerProps {
  maxHp: number;
  currentHp: number;
  hpDamageTaken: number;
  tempHp: number;
  nonlethalDamage: number;
  constitutionScore: number;
  stable: boolean;
  deathRules: DeathRules;
  fightOnSource?: "diehard" | "orc" | "half-orc";
  diehardActive: boolean;
  ferocityUsed: boolean;
  onApplyDamage: (amount: number, damageType?: string) => void;
  onApplyHealing: (amount: number) => void;
  onApplyHpLoss: (amount: number) => void;
  onSetTempHp: (amount: number) => void;
  onApplyNonlethal: (amount: number) => void;
  onHealNonlethal: (amount: number) => void;
  onSetStable: (value: boolean) => void;
  onSetDiehardActive: (value: boolean) => void;
  onSetFerocityActive: (value: boolean) => void;
  onSetFerocityUsed: (value: boolean) => void;
  onReset: () => void;
}

const STATUS_LABEL: Record<HealthCondition, string> = {
  healthy: "Healthy",
  wounded: "Wounded",
  staggered: "Staggered",
  unconscious: "Unconscious",
  disabled: "Disabled",
  "fighting-on": "Fighting On",
  dying: "Dying",
  stable: "Stable",
  dead: "Dead",
};

const STATUS_TONE: Record<HealthCondition, string> = {
  healthy: "ok",
  wounded: "warn",
  staggered: "warn",
  unconscious: "dead",
  disabled: "warn",
  "fighting-on": "warn",
  dying: "dead",
  stable: "warn",
  dead: "dead",
};

export function isCriticalHealth(currentHp: number, maxHp: number) {
  return maxHp > 0 && currentHp > 0 && currentHp / maxHp < 0.2;
}

export function healthConditionLabel(condition: HealthCondition) {
  return STATUS_LABEL[condition];
}

export function healthConditionTone(condition: HealthCondition) {
  return STATUS_TONE[condition];
}

function conditionRules(condition: HealthCondition, deathThreshold: number) {
  switch (condition) {
    case "healthy":
      return "At maximum hit points and conscious.";
    case "wounded":
      return "Below maximum hit points, but conscious and able to act normally.";
    case "staggered":
      return "Nonlethal damage equals current HP. Limited to a standard or move action each round.";
    case "unconscious":
      return "Nonlethal damage exceeds current HP. Unconscious, but not dying from lethal damage.";
    case "disabled":
      return "At exactly 0 HP. Staggered; taking a strenuous standard action causes 1 HP loss and begins dying.";
    case "fighting-on":
      return "Below 0 HP but conscious and staggered because a survival ability is active.";
    case "dying":
      return `Below 0 HP and unconscious. Attempt a stabilization check each round; death occurs at ${deathThreshold} HP.`;
    case "stable":
      return `Below 0 HP but no longer losing HP each round. Further damage resumes dying; death occurs at ${deathThreshold} HP.`;
    case "dead":
      return `At or below ${deathThreshold} HP. Ordinary healing cannot restore a dead character.`;
  }
}

export function HealthTracker({
  maxHp,
  currentHp,
  hpDamageTaken,
  tempHp,
  nonlethalDamage,
  constitutionScore,
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
  onReset,
}: HealthTrackerProps) {
  const [damageInput, setDamageInput] = useState("");
  const [damageType, setDamageType] = useState("untyped");
  const [healingInput, setHealingInput] = useState("");
  const [tempHpInput, setTempHpInput] = useState("");
  const [nonlethalInput, setNonlethalInput] = useState("");
  const [nonlethalHealingInput, setNonlethalHealingInput] = useState("");
  const [stabilizationRoll, setStabilizationRoll] = useState("");
  const [lastStabilization, setLastStabilization] =
    useState<StabilizationCheckResult>();

  const health = deriveHealthStatus({
    maxHp,
    currentHp,
    constitutionScore,
    nonlethalDamage,
    stable,
    fightOn: !!fightOnSource,
    deathThresholdBonus: deathRules.deathThresholdBonus,
  });
  const hpPercent = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
  const criticalHealth = isCriticalHealth(currentHp, maxHp);
  const constitutionModifier = Math.floor((constitutionScore - 10) / 2);
  const stabilizationModifier = constitutionModifier + Math.min(0, currentHp);
  const belowZeroAndAlive = currentHp < 0 && currentHp > health.deathThreshold;
  const canActivateHalfOrcFerocity =
    belowZeroAndAlive && deathRules.ferocity === "half-orc" && !ferocityUsed;

  function positiveAmount(raw: string) {
    return Math.max(0, Number(raw) || 0);
  }

  function applyDamage() {
    const amount = positiveAmount(damageInput);
    if (!amount) return;
    onApplyDamage(amount, damageType === "untyped" ? undefined : damageType);
    setLastStabilization(undefined);
    setDamageInput("");
  }

  function applyHealing() {
    const amount = positiveAmount(healingInput);
    if (!amount) return;
    onApplyHealing(amount);
    setLastStabilization(undefined);
    setHealingInput("");
  }

  function applyNonlethal() {
    const amount = positiveAmount(nonlethalInput);
    if (!amount) return;
    onApplyNonlethal(amount);
    setNonlethalInput("");
  }

  function attemptStabilization() {
    const roll = Number(stabilizationRoll);
    if (!Number.isFinite(roll) || roll < 1) return;
    const result = stabilizationCheck(currentHp, constitutionScore, roll);
    setLastStabilization(result);
    setStabilizationRoll("");
    if (result.success) onSetStable(true);
    else onApplyHpLoss(result.hpLoss);
  }

  return (
    <section
      className={`health-tracker health-${health.condition}${criticalHealth ? " health-critical" : ""}`}
    >
      <div className="health-tracker-head">
        <div>
          <span className="summary-label">Combat Health</span>
          <div className="health-current-line">
            <strong>{currentHp}</strong>
            <span>/ {maxHp} HP</span>
            {tempHp > 0 ? (
              <span className="health-temp">+{tempHp} temp</span>
            ) : null}
          </div>
        </div>
        <Tooltip
          content={`${conditionRules(health.condition, health.deathThreshold)}\n\nDeath threshold: ${health.deathThreshold} HP${deathRules.deathThresholdBonus > 0 ? ` (Constitution + ${deathRules.deathThresholdBonus} favored-class bonus)` : " (negative Constitution)"}.`}
        >
          <span
            className={`tag hp-status ${healthConditionTone(health.condition)}`}
          >
            {healthConditionLabel(health.condition)}
          </span>
        </Tooltip>
      </div>

      <div
        className="health-meter"
        aria-label={`${currentHp} of ${maxHp} hit points`}
      >
        <span style={{ width: `${hpPercent}%` }} />
      </div>

      <div className="health-stat-strip">
        <div>
          <span>Damage</span>
          <strong>{hpDamageTaken}</strong>
        </div>
        <div>
          <span>Temp HP</span>
          <strong>{tempHp}</strong>
        </div>
        <div>
          <span>Nonlethal</span>
          <strong>{nonlethalDamage}</strong>
        </div>
        <div>
          <span>Death at</span>
          <strong>{health.deathThreshold}</strong>
        </div>
      </div>

      {deathRules.ferocity === "half-orc" && ferocityUsed ? (
        <div className="health-daily-resource">
          <span>Orc Ferocity: expended</span>
          <button
            type="button"
            className="ghost small"
            onClick={() => {
              onSetFerocityActive(false);
              onSetFerocityUsed(false);
            }}
          >
            Reset Daily Use
          </button>
        </div>
      ) : null}

      <div className="health-action-grid">
        <div className="health-action-card">
          <h3>Damage</h3>
          <div className="health-input-row">
            <input
              aria-label="Damage amount"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Amount"
              value={damageInput}
              onChange={(event) => setDamageInput(event.target.value)}
            />
            <select
              aria-label="Damage type"
              value={damageType}
              onChange={(event) => setDamageType(event.target.value)}
            >
              <option value="untyped">Untyped</option>
              <option value="physical">Physical</option>
              <option value="acid">Acid</option>
              <option value="cold">Cold</option>
              <option value="electricity">Electricity</option>
              <option value="fire">Fire</option>
              <option value="sonic">Sonic</option>
            </select>
            <button type="button" onClick={applyDamage}>
              Apply
            </button>
          </div>
        </div>

        <div className="health-action-card">
          <h3>Recovery</h3>
          <div className="health-input-row">
            <input
              aria-label="Healing amount"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Healing"
              value={healingInput}
              onChange={(event) => setHealingInput(event.target.value)}
            />
            <button
              type="button"
              onClick={applyHealing}
              disabled={health.condition === "dead"}
            >
              Heal
            </button>
          </div>
          <div className="health-input-row">
            <input
              aria-label="Temporary hit points"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Temp HP"
              value={tempHpInput}
              onChange={(event) => setTempHpInput(event.target.value)}
            />
            <button
              type="button"
              className="ghost"
              onClick={() => {
                onSetTempHp(positiveAmount(tempHpInput));
                setTempHpInput("");
              }}
            >
              Set Temp
            </button>
            <button type="button" className="ghost" onClick={onReset}>
              Reset / Revive
            </button>
          </div>
        </div>

        <div className="health-action-card">
          <h3>Nonlethal</h3>
          <div className="health-input-row">
            <input
              aria-label="Nonlethal damage amount"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Damage"
              value={nonlethalInput}
              onChange={(event) => setNonlethalInput(event.target.value)}
            />
            <button type="button" onClick={applyNonlethal}>
              Apply
            </button>
          </div>
          <div className="health-input-row">
            <input
              aria-label="Nonlethal healing amount"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Recover"
              value={nonlethalHealingInput}
              onChange={(event) => setNonlethalHealingInput(event.target.value)}
            />
            <button
              type="button"
              className="ghost"
              onClick={() => {
                const amount = positiveAmount(nonlethalHealingInput);
                if (!amount) return;
                onHealNonlethal(amount);
                setNonlethalHealingInput("");
              }}
            >
              Recover
            </button>
          </div>
          {currentHp < 0 ? (
            <p className="hint">
              At negative HP, new nonlethal damage becomes lethal HP loss.
            </p>
          ) : null}
        </div>
      </div>

      {["disabled", "fighting-on", "dying", "stable", "dead"].includes(
        health.condition,
      ) ? (
        <div className="death-mechanics-panel">
          <div>
            <strong>{healthConditionLabel(health.condition)}</strong>
            <p>{conditionRules(health.condition, health.deathThreshold)}</p>
          </div>
          {health.condition === "dying" ? (
            <div className="stabilization-controls">
              <span>
                Stabilization: d20 {stabilizationModifier >= 0 ? "+" : ""}
                {stabilizationModifier} vs DC 10
              </span>
              <div className="health-input-row">
                <input
                  aria-label="Stabilization d20 roll"
                  type="number"
                  min={1}
                  max={20}
                  inputMode="numeric"
                  placeholder="d20"
                  value={stabilizationRoll}
                  onChange={(event) => setStabilizationRoll(event.target.value)}
                />
                <button type="button" onClick={attemptStabilization}>
                  Resolve Check
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setLastStabilization(undefined);
                    onSetStable(true);
                  }}
                >
                  Stabilize Directly
                </button>
              </div>
            </div>
          ) : null}
          {health.condition === "stable" ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setLastStabilization(undefined);
                onSetStable(false);
              }}
            >
              Resume Dying
            </button>
          ) : null}
          {health.condition === "disabled" && !fightOnSource ? (
            <button
              type="button"
              onClick={() => {
                setLastStabilization(undefined);
                onApplyHpLoss(1);
              }}
            >
              Take Strenuous Action (−1 HP)
            </button>
          ) : null}
          {belowZeroAndAlive &&
          deathRules.hasDiehard &&
          fightOnSource !== "half-orc" ? (
            <button
              type="button"
              className={diehardActive ? "active-template-choice" : "ghost"}
              onClick={() => onSetDiehardActive(!diehardActive)}
            >
              {diehardActive ? "Fall Unconscious" : "Fight On with Diehard"}
            </button>
          ) : null}
          {canActivateHalfOrcFerocity ? (
            <button
              type="button"
              onClick={() => {
                onSetStable(false);
                onSetFerocityUsed(true);
                onSetFerocityActive(true);
              }}
            >
              Activate Orc Ferocity
            </button>
          ) : null}
          {fightOnSource === "diehard" || fightOnSource === "half-orc" ? (
            <button type="button" onClick={() => onApplyHpLoss(1)}>
              Take Strenuous Action (−1 HP)
            </button>
          ) : null}
          {fightOnSource === "half-orc" ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                onSetStable(false);
                onSetFerocityActive(false);
              }}
            >
              End Ferocity Turn
            </button>
          ) : null}
          {fightOnSource === "orc" ? (
            <button type="button" onClick={() => onApplyHpLoss(1)}>
              End Ferocity Round (−1 HP)
            </button>
          ) : null}
          {lastStabilization ? (
            <div
              className={`stabilization-result ${lastStabilization.success ? "success" : "failure"}`}
            >
              Roll {lastStabilization.roll}{" "}
              {lastStabilization.modifier >= 0 ? "+" : ""}
              {lastStabilization.modifier} = {lastStabilization.total}:{" "}
              {lastStabilization.success ? "stable" : "failed; lose 1 HP"}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
