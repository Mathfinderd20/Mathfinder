import { resolveRaceChoice } from "./build/character";
import type { CharacterBuild } from "./build/types";

const ancestryLanguages: Record<string, string[]> = {
  human: ["Common"],
  elf: ["Common", "Elven"],
  dwarf: ["Common", "Dwarven"],
  gnome: ["Common", "Gnome", "Sylvan"],
  halfling: ["Common", "Halfling"],
  "half-elf": ["Common", "Elven"],
  "half-orc": ["Common", "Orc"],
  goblin: ["Goblin"],
  tengu: ["Common", "Tengu"],
};
export function uniqueLanguages(values: string[]) {
  return [
    ...new Map(
      values
        .map((value) => [value.trim().toLowerCase(), value.trim()] as const)
        .filter(([key]) => key),
    ).values(),
  ];
}
/** Permanent language entitlements only: temporary INT and skill bonuses grant no choices. */
export function deriveLanguages(build: CharacterBuild) {
  const race = resolveRaceChoice(build.race);
  const ancestry = race.name.trim().toLowerCase();
  const automatic = [
    ...(race.languageRules?.automatic ?? ancestryLanguages[ancestry] ?? []),
  ];
  if (build.levels.some((level) => level.className.toLowerCase() === "druid"))
    automatic.push("Druidic");
  const intelligence =
    build.baseAbilityScores.int +
    (race.abilityModifiers ?? [])
      .filter((mod) => mod.target === "int")
      .reduce((sum, mod) => sum + mod.value, 0) +
    (race.choiceSelection?.flexibleAbility === "int"
      ? (race.choiceOptions?.flexibleAbilityBonus?.value ?? 0)
      : 0);
  const traits = (race.traits ?? []).map((trait) => trait.source.toLowerCase());
  const alternates = (race.alternateTraits ?? []).filter((trait) =>
    race.choiceSelection?.alternateTraits?.some(
      (id) => id.toLowerCase() === trait.id.toLowerCase(),
    ),
  );
  traits.push(...alternates.map((trait) => trait.name.toLowerCase()));
  // ARG Gift of Tongues and Tengu Gifted Linguist grant two languages per rank.
  const replacedLinguist = alternates.some((trait) =>
    trait.replaces?.some((name) => name.toLowerCase() === "gifted linguist"),
  );
  const perRank =
    race.languageRules?.perLinguisticsRank ??
    ((ancestry === "tengu" && !replacedLinguist) ||
    traits.some(
      (name) => name === "gift of tongues" || name === "gifted linguist",
    )
      ? 2
      : 1);
  const ranks = build.levels.reduce(
    (sum, level) => sum + Math.max(0, level.skillRanks?.linguistics ?? 0),
    0,
  );
  const feats = [
    race.choiceSelection?.bonusFeat ?? "",
    ...build.levels.flatMap((level) => level.feats ?? []),
  ];
  const featBonus = feats.some((feat) => feat.toLowerCase() === "cosmopolitan")
    ? 2
    : 0;
  const startingCapacity = Math.max(0, Math.floor((intelligence - 10) / 2));
  const learnedCapacity = ranks * perRank + featBonus;
  return {
    automatic: uniqueLanguages(automatic),
    startingCapacity,
    learnedCapacity,
    all: uniqueLanguages([
      ...automatic,
      ...(build.languages?.starting ?? []),
      ...(build.languages?.learned ?? []),
      ...(build.languages?.additional ?? []),
    ]),
  };
}
