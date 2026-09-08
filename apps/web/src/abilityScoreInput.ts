export const MIN_ABILITY_SCORE = 7;
export const MAX_ABILITY_SCORE = 18;

export function parseAbilityScoreInput(rawValue: string) {
  const normalized = rawValue.trim();
  if (!/^\d+$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return value >= MIN_ABILITY_SCORE && value <= MAX_ABILITY_SCORE
    ? value
    : undefined;
}
