import type { FeatGrantSlot } from "./types";

export function classBonusFeatSlot(
  className: string,
  classLevel: number,
): FeatGrantSlot | undefined {
  const normalizedClass = className.trim().toLowerCase();
  if (
    normalizedClass === "fighter" &&
    (classLevel === 1 || classLevel % 2 === 0)
  ) {
    return {
      kind: "fighter-bonus",
      label: "Fighter bonus feat",
      source: `Fighter ${classLevel}`,
    };
  }
  if (normalizedClass === "infantryman" && classLevel % 4 === 0) {
    return {
      kind: "general",
      label: "Infantryman bonus feat",
      source: `Infantryman ${classLevel}`,
    };
  }
  return undefined;
}
