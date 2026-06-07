import { useMemo, useState } from "react";
import {
  planLevelUp,
  validateLevelUpSelection,
  SAMPLE_CLASSES,
  SKILL_DEFINITIONS,
  type AbilityKey,
  type CharacterBuild,
  type LevelUpSelection,
  type SkillKey,
} from "@path-builder/rules-engine";
import { SAMPLE_FEATS } from "../data";

const ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const SKILL_NAME = new Map<string, string>(SKILL_DEFINITIONS.map((d) => [d.key, d.name]));
const CLASS_KEYS = Object.keys(SAMPLE_CLASSES);

interface Props {
  build: CharacterBuild;
  onConfirm: (selection: LevelUpSelection) => void;
  onClose: () => void;
}

/** Interactive level-up: prompts for class, HP, skill ranks, feat, ability bump. */
export function LevelUpModal({ build, onConfirm, onClose }: Props) {
  const [className, setClassName] = useState(
    build.levels[build.levels.length - 1]?.className ?? CLASS_KEYS[0] ?? "barbarian",
  );
  const plan = useMemo(() => planLevelUp(build, className), [build, className]);

  const [hp, setHp] = useState(plan.averageHitPoints);
  const [skills, setSkills] = useState<Set<SkillKey>>(new Set());
  const [feat, setFeat] = useState("");
  const [abilityIncrease, setAbilityIncrease] = useState<AbilityKey | undefined>();

  const remaining = plan.skillPoints - skills.size;

  const selection: LevelUpSelection = {
    className,
    hitPointRoll: hp,
    skillRanks: Object.fromEntries([...skills].map((k) => [k, 1])),
    feats: feat.trim() ? [feat.trim()] : undefined,
    abilityIncrease,
  };
  const issues = validateLevelUpSelection(plan, selection);
  const hasError = issues.some((i) => i.severity === "error");

  function toggleSkill(key: SkillKey) {
    setSkills((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (remaining > 0) next.add(key);
      return next;
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Level Up &rarr; Level {plan.characterLevel}</h2>

        <label className="field">
          <span>Class</span>
          <select value={className} onChange={(e) => setClassName(e.target.value)}>
            {CLASS_KEYS.map((key) => (
              <option key={key} value={key}>
                {SAMPLE_CLASSES[key]?.name ?? key}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Hit points (d{plan.hitDie}, avg {plan.averageHitPoints})</span>
          <input
            type="number"
            min={1}
            max={plan.hitDie}
            value={hp}
            onChange={(e) => setHp(Number(e.target.value))}
          />
        </label>

        <div className="field">
          <span>
            Skill ranks &mdash; {remaining} of {plan.skillPoints} left
            <span className="muted"> (max +1 per skill)</span>
          </span>
          <div className="skill-picker">
            {plan.classSkills
              .slice()
              .sort((a, b) => (SKILL_NAME.get(a) ?? a).localeCompare(SKILL_NAME.get(b) ?? b))
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
          <label className="field">
            <span>Feat (this level grants one)</span>
            <input
              list="feat-suggestions"
              value={feat}
              placeholder="e.g. Power Attack"
              onChange={(e) => setFeat(e.target.value)}
            />
            <datalist id="feat-suggestions">
              {SAMPLE_FEATS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </label>
        ) : null}

        {plan.grantsAbilityIncrease ? (
          <div className="field">
            <span>Ability score increase (+1)</span>
            <div className="ability-picker">
              {ABILITIES.map((a) => (
                <label key={a} className={`pick ${abilityIncrease === a ? "on" : ""}`}>
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
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button disabled={hasError} onClick={() => onConfirm(selection)}>
            Confirm Level {plan.characterLevel}
          </button>
        </div>
      </div>
    </div>
  );
}
