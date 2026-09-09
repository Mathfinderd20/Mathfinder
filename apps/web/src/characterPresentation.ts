import type { HealthCondition } from "@mathfinder/rules-engine";

export function healthPresentation(
  currentHp: number,
  maxHp: number,
  condition: HealthCondition,
) {
  const percent = Math.max(
    0,
    Math.min(100, Math.floor((currentHp / Math.max(1, maxHp)) * 100)),
  );
  if (condition !== "healthy" && condition !== "wounded") {
    const labels = {
      disabled: "Disabled",
      unconscious: "Unconscious",
      dying: "Dying",
      dead: "Dead",
      stable: "Unconscious · Stable",
      "fighting-on": "Fighting On",
      staggered: "Staggered",
    };
    return { percent, label: labels[condition], tone: "red" };
  }
  if (percent >= 100) return { percent, label: "Healthy", tone: "green" };
  if (percent >= 85) return { percent, label: "Minor Injury", tone: "yellow" };
  if (percent >= 50) return { percent, label: "Bloodied", tone: "orange" };
  return { percent, label: "Wounded", tone: "red" };
}

/** Presentation only: temporary HP never changes the character's actual health state. */
export function hitPointExpression(
  currentHp: number,
  maxHp: number,
  tempHp: number,
) {
  return `${currentHp}/${maxHp}${tempHp > 0 ? ` + ${tempHp}` : ""} HP`;
}

export function partitionRaceNotes(notes: readonly string[] = []) {
  const build: string[] = [];
  const traits: string[] = [];
  const defenses: string[] = [];
  const languagesAndSenses: string[] = [];
  for (const note of notes) {
    if (
      /^(flexible racial bonus:|extra skill ranks? per level:|bonus feat:)/i.test(
        note,
      )
    )
      build.push(note);
    else if (/\b(immun(?:e|ity|ities)|resistan(?:ce|ces|t))\b/i.test(note))
      defenses.push(note);
    else if (
      /\b(languages?|darkvision|low.light vision|senses?|blindsense|blindsight|tremorsense)\b/i.test(
        note,
      )
    )
      languagesAndSenses.push(note);
    else traits.push(note);
  }
  return { build, traits, defenses, languagesAndSenses };
}
