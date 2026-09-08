/** PF1e point buy applies to base scores, before ancestry/level modifiers. */
const COSTS = [-4, -2, -1, 0, 1, 2, 3, 5, 7, 10, 13, 17] as const;

export interface CharacterCreationRules {
  startingLevel: number;
  method: "manual" | "point-buy" | "array";
  pointBuyBudget: number;
  abilityArray: number[];
  buildGuide: string;
}

export const DEFAULT_CREATION_RULES: CharacterCreationRules = {
  startingLevel: 1,
  method: "manual",
  pointBuyBudget: 20,
  abilityArray: [15, 14, 13, 12, 10, 8],
  buildGuide: "",
};

export function parseCharacterCreationRules(
  value: unknown,
): CharacterCreationRules | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rules = value as Partial<CharacterCreationRules>;
  if (
    typeof rules.startingLevel !== "number" ||
    typeof rules.method !== "string" ||
    typeof rules.pointBuyBudget !== "number" ||
    !Array.isArray(rules.abilityArray) ||
    typeof rules.buildGuide !== "string"
  )
    return undefined;
  const candidate: CharacterCreationRules = {
    startingLevel: rules.startingLevel,
    method: rules.method as CharacterCreationRules["method"],
    pointBuyBudget: rules.pointBuyBudget,
    abilityArray: [...rules.abilityArray],
    buildGuide: rules.buildGuide,
  };
  return validateCreationRules(candidate).length ? undefined : candidate;
}

export function pointBuyCost(score: number): number {
  if (!Number.isInteger(score) || score < 7 || score > 18) {
    throw new RangeError(
      "Point-buy base scores must be integers from 7 to 18.",
    );
  }
  return COSTS[score - 7]!;
}

export function pointBuyTotal(scores: readonly number[]): number {
  if (scores.length !== 6)
    throw new RangeError("Provide all six base ability scores.");
  return scores.reduce((total, score) => total + pointBuyCost(score), 0);
}

export function validateCreationRules(rules: CharacterCreationRules): string[] {
  const errors: string[] = [];
  if (
    !Number.isInteger(rules.startingLevel) ||
    rules.startingLevel < 1 ||
    rules.startingLevel > 20
  )
    errors.push("Starting level must be an integer from 1 to 20.");
  if (!["manual", "point-buy", "array"].includes(rules.method))
    errors.push("Unknown ability generation method.");
  if (
    !Number.isInteger(rules.pointBuyBudget) ||
    rules.pointBuyBudget < 0 ||
    rules.pointBuyBudget > 102
  )
    errors.push("Point-buy budget must be an integer from 0 to 102.");
  if (
    rules.abilityArray.length !== 6 ||
    rules.abilityArray.some((s) => !Number.isInteger(s) || s < 7 || s > 18)
  )
    errors.push("An ability array needs six integers from 7 to 18.");
  if (rules.buildGuide.length > 5000)
    errors.push("Build guide must be at most 5000 characters.");
  return errors;
}

export function creationWarnings(
  scores: readonly number[],
  level: number,
  rules: CharacterCreationRules,
): string[] {
  const warnings = validateCreationRules(rules);
  if (level !== rules.startingLevel)
    warnings.push(
      `Campaign starts at level ${rules.startingLevel}; this character is level ${level}. Adjust it in the build editor or ask the GM about an exception.`,
    );
  if (rules.method === "point-buy") {
    try {
      const spent = pointBuyTotal(scores);
      if (spent > rules.pointBuyBudget)
        warnings.push(
          `Point buy is ${spent - rules.pointBuyBudget} points over budget (${spent}/${rules.pointBuyBudget}).`,
        );
    } catch {
      warnings.push("Point-buy base scores must be six integers from 7 to 18.");
    }
  }
  if (
    rules.method === "array" &&
    [...scores].sort((a, b) => a - b).join() !==
      [...rules.abilityArray].sort((a, b) => a - b).join()
  )
    warnings.push(
      `Assign the campaign array exactly once per score: ${rules.abilityArray.join(", ")}.`,
    );
  return warnings;
}
