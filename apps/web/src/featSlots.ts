import type { CharacterBuild, FeatGrantKind, FeatGrantSlot } from "@mathfinder/rules-engine";

export function plannedFeatSlotsForLevel(
  build: CharacterBuild,
  levelIndex: number,
): FeatGrantSlot[] {
  const slots: FeatGrantSlot[] = [];
  const level = build.levels[levelIndex];
  if (!level) return slots;
  const characterLevel = levelIndex + 1;
  if (characterLevel % 2 === 1) {
    slots.push({
      kind: "general",
      label: "Character feat",
      source: `Level ${characterLevel}`,
    });
  }
  if (level.className.trim().toLowerCase() === "fighter") {
    const fighterLevel =
      build.levels
        .slice(0, levelIndex + 1)
        .filter((entry) => entry.className.trim().toLowerCase() === "fighter")
        .length;
    if (fighterLevel === 1 || fighterLevel % 2 === 0) {
      slots.push({
        kind: "fighter-bonus",
        label: "Fighter bonus feat",
        source: `Fighter ${fighterLevel}`,
      });
    }
  }
  return slots;
}

export function normalizeFeatListLength(
  feats: string[] | undefined,
  slotCount: number,
): string[] | undefined {
  const next = (feats ?? []).slice(0, slotCount).map((feat) => feat.trim());
  while (next.length < slotCount) next.push("");
  const trimmed = next.map((feat) => feat.trim());
  return trimmed.some((feat) => feat.length > 0) ? trimmed : undefined;
}

export function featSlotTag(kind: FeatGrantKind) {
  return kind === "fighter-bonus" ? "combat only" : "general";
}
