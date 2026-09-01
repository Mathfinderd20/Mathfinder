import type {
  AbilityKey,
  CharacterBuild,
  SkillKey,
} from "@mathfinder/rules-engine";

export interface SkillRankClassOption {
  name: string;
  skillRanksPerLevel: number;
}

function allocatedRanks(ranks: Partial<Record<SkillKey, number>> | undefined) {
  return Object.values(ranks ?? {}).reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );
}

export function effectiveRaceChoiceOptions(race: CharacterBuild["race"]) {
  const selectedIds = new Set(
    (race.choiceSelection?.alternateTraits ?? []).map((id) => id.toLowerCase()),
  );
  const activeTraits = (race.alternateTraits ?? []).filter((trait) =>
    selectedIds.has(trait.id.toLowerCase()),
  );
  const next = { ...(race.choiceOptions ?? {}) };
  for (const trait of activeTraits) {
    for (const key of trait.removeChoiceOptions ?? []) delete next[key];
    if (trait.choiceOptions?.flexibleAbilityBonus !== undefined)
      next.flexibleAbilityBonus = trait.choiceOptions.flexibleAbilityBonus;
    if (trait.choiceOptions?.bonusFeat !== undefined)
      next.bonusFeat = trait.choiceOptions.bonusFeat;
    if (trait.choiceOptions?.extraSkillRanksPerLevel !== undefined)
      next.extraSkillRanksPerLevel =
        trait.choiceOptions.extraSkillRanksPerLevel;
  }
  return next;
}

function racialAbilityBonus(build: CharacterBuild, ability: AbilityKey) {
  const fixedBonus = (build.race.abilityModifiers ?? []).reduce(
    (sum, modifier) =>
      modifier.target === ability ? sum + modifier.value : sum,
    0,
  );
  const choices = effectiveRaceChoiceOptions(build.race);
  return choices.flexibleAbilityBonus &&
    build.race.choiceSelection?.flexibleAbility === ability
    ? fixedBonus + choices.flexibleAbilityBonus.value
    : fixedBonus;
}

export function skillPointBudgetForLevel(
  build: CharacterBuild,
  classOptions: readonly SkillRankClassOption[],
  levelIndex: number,
) {
  const level = build.levels[levelIndex];
  if (!level) return 0;
  let intelligence =
    build.baseAbilityScores.int + racialAbilityBonus(build, "int");
  for (let index = 0; index <= levelIndex; index += 1) {
    if (build.levels[index]?.abilityIncrease === "int") intelligence += 1;
  }
  const classRanks =
    classOptions.find(
      (option) =>
        option.name.trim().toLowerCase() ===
        level.className.trim().toLowerCase(),
    )?.skillRanksPerLevel ?? 0;
  const favoredSkill =
    build.favoredClassName?.trim().toLowerCase() ===
      level.className.trim().toLowerCase() && level.favoredClass === "skill"
      ? 1
      : 0;
  return (
    Math.max(1, classRanks + Math.floor((intelligence - 10) / 2)) +
    favoredSkill +
    Math.max(
      0,
      effectiveRaceChoiceOptions(build.race).extraSkillRanksPerLevel ?? 0,
    )
  );
}

export function skillRanksThroughLevel(
  build: CharacterBuild,
  skillKey: SkillKey,
  levelIndex: number,
) {
  return build.levels
    .slice(0, Math.max(0, Math.floor(levelIndex)) + 1)
    .reduce((sum, level) => sum + (level.skillRanks?.[skillKey] ?? 0), 0);
}

export function totalSkillRanks(build: CharacterBuild, skillKey: SkillKey) {
  return skillRanksThroughLevel(build, skillKey, build.levels.length - 1);
}

export function totalSkillRankBudget(
  build: CharacterBuild,
  classOptions: readonly SkillRankClassOption[],
) {
  return build.levels.reduce(
    (sum, _level, index) =>
      sum + skillPointBudgetForLevel(build, classOptions, index),
    0,
  );
}

export function totalAllocatedSkillRanks(build: CharacterBuild) {
  return build.levels.reduce(
    (sum, level) => sum + allocatedRanks(level.skillRanks),
    0,
  );
}

export function continuedSkillKeys(
  build: CharacterBuild,
  levelIndex: number,
  skillPointBudget: number,
) {
  const totals = new Map<SkillKey, number>();
  for (const level of build.levels.slice(0, levelIndex)) {
    for (const [key, ranks] of Object.entries(level.skillRanks ?? {}) as [
      SkillKey,
      number,
    ][]) {
      totals.set(key, (totals.get(key) ?? 0) + ranks);
    }
  }
  return [...totals.entries()]
    .filter(([, ranks]) => ranks > 0)
    .sort(([leftKey, leftRanks], [rightKey, rightRanks]) =>
      rightRanks !== leftRanks
        ? rightRanks - leftRanks
        : leftKey.localeCompare(rightKey),
    )
    .slice(0, Math.max(0, skillPointBudget))
    .map(([key]) => key);
}

export function continuedSkillRanksForLevel(
  build: CharacterBuild,
  classOptions: readonly SkillRankClassOption[],
  levelIndex: number,
) {
  const budget = skillPointBudgetForLevel(build, classOptions, levelIndex);
  return Object.fromEntries(
    continuedSkillKeys(build, levelIndex, budget).map((key) => [key, 1]),
  ) as Partial<Record<SkillKey, number>>;
}

export function allocateTotalSkillRanks(
  build: CharacterBuild,
  classOptions: readonly SkillRankClassOption[],
  skillKey: SkillKey,
  requestedTotal: number,
) {
  const target = Number.isFinite(requestedTotal)
    ? Math.max(0, Math.min(build.levels.length, Math.floor(requestedTotal)))
    : 0;
  const levels = build.levels.map((level) => {
    const skillRanks = { ...(level.skillRanks ?? {}) };
    delete skillRanks[skillKey];
    return { ...level, skillRanks };
  });
  const nextBuild = { ...build, levels };
  let remaining = target;
  let cumulative = 0;

  for (let index = 0; index < levels.length && remaining > 0; index += 1) {
    const level = levels[index];
    if (!level) continue;
    const availablePoints = Math.max(
      0,
      skillPointBudgetForLevel(nextBuild, classOptions, index) -
        allocatedRanks(level.skillRanks),
    );
    const legalRanks = Math.max(0, index + 1 - cumulative);
    const ranks = Math.min(remaining, availablePoints, legalRanks);
    if (ranks <= 0) continue;
    level.skillRanks = { ...level.skillRanks, [skillKey]: ranks };
    cumulative += ranks;
    remaining -= ranks;
  }

  return nextBuild;
}
