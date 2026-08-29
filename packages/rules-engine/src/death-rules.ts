import type { CharacterBuild, RaceChoice } from "./build/types";
import type { FavoredClassBonusDefinition, FerocityMode } from "./types";

export interface DeathRules {
  hasDiehard: boolean;
  automaticallyStabilizes: boolean;
  ferocity?: FerocityMode;
  deathThresholdBonus: number;
}

function featBaseName(selection: string) {
  return selection
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase();
}

function selectedFeatNames(build: CharacterBuild) {
  return [
    build.race.choiceSelection?.bonusFeat,
    ...build.levels.flatMap((level) => level.feats ?? []),
  ]
    .filter((feat): feat is string => !!feat?.trim())
    .map(featBaseName);
}

function activeFerocity(race: RaceChoice) {
  if (!race.ferocity) return undefined;
  const selected = new Set(
    (race.choiceSelection?.alternateTraits ?? []).map((id) =>
      id.trim().toLowerCase(),
    ),
  );
  const replaced = (race.alternateTraits ?? [])
    .filter((trait) => selected.has(trait.id.trim().toLowerCase()))
    .flatMap((trait) => trait.replaces ?? [])
    .some((name) => {
      const normalized = name.trim().toLowerCase();
      return normalized === "orc ferocity" || normalized === "ferocity";
    });
  return replaced ? undefined : race.ferocity;
}

export function favoredClassBonusOptions(
  race: RaceChoice,
  className: string,
): FavoredClassBonusDefinition[] {
  const normalizedClass = className.trim().toLowerCase();
  return (race.favoredClassBonuses ?? []).filter((bonus) => {
    const bonusClass = bonus.className.trim().toLowerCase();
    return bonusClass === normalizedClass || bonusClass === "all";
  });
}

export function deriveDeathRules(build: CharacterBuild): DeathRules {
  const feats = selectedFeatNames(build);
  const hasDiehard = feats.includes("diehard");
  const deathThresholdBonus = build.levels.reduce((total, level) => {
    const isFavoredClassLevel =
      !!build.favoredClassName &&
      level.className.trim().toLowerCase() ===
        build.favoredClassName.trim().toLowerCase();
    if (!isFavoredClassLevel || !level.favoredClass) return total;
    const bonus = favoredClassBonusOptions(build.race, level.className).find(
      (entry) => entry.id === level.favoredClass,
    );
    return total + (bonus?.deathThresholdBonus ?? 0);
  }, 0);
  return {
    hasDiehard,
    automaticallyStabilizes: hasDiehard,
    ferocity: activeFerocity(build.race),
    deathThresholdBonus,
  };
}
