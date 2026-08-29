import {
  buildCharacter,
  checkClassPrerequisites,
  checkPrerequisites,
  computeSheet,
  featContextFromSheet,
  favoredClassBonusOptions,
  listFeats,
  planLevelUp,
  type AbilityKey,
  type ArchetypeDefinitionLike,
  type CharacterBuild,
  type ClassDefinition,
  type ClassFeatureRegistry,
  type DerivedSpellcasting,
  type FeatDefinition,
  type FeatGrantKind,
  type FeatRegistry,
  type SkillKey,
  type SpellRegistry,
} from "@mathfinder/rules-engine";
import type {
  BuildGuideBranchDefinition,
  BuildGuideDefinition,
  BuildGuideProgressionBand,
} from "@mathfinder/rules-data";
import {
  scoreSpellSuggestion,
  spellSuggestionBadges,
  type SpellSuggestionProfile,
} from "./spellSuggestions";

export type SuggestionSourceKind =
  "guide" | "branch" | "band" | "heuristic" | "system";

export interface PlannerSuggestionChoice<T extends string> {
  value: T;
  label: string;
  reason: string;
  score: number;
  sourceKind?: SuggestionSourceKind;
  sourceLabel?: string;
  emphasis?: "top" | "strong" | "ok";
}

export interface PlannerSuggestionNote {
  label: string;
  text: string;
  sourceKind?: SuggestionSourceKind;
}

export interface PlannerFeatSlotSuggestions {
  slotIndex: number;
  slotLabel: string;
  slotSource: string;
  slotKind: FeatGrantKind;
  choices: PlannerSuggestionChoice<string>[];
}

export interface LevelPlannerSuggestions {
  guideChoices: PlannerSuggestionChoice<string>[];
  classChoices: PlannerSuggestionChoice<string>[];
  featChoices: PlannerSuggestionChoice<string>[];
  featChoicesBySlot: PlannerFeatSlotSuggestions[];
  favoredClassChoices: PlannerSuggestionChoice<string>[];
  abilityChoices: PlannerSuggestionChoice<AbilityKey>[];
  notes: PlannerSuggestionNote[];
}

export interface SkillSuggestionChoice {
  key: SkillKey;
  reason: string;
  score: number;
}

export interface SpellSuggestionChoice {
  spellName: string;
  reason: string;
  score: number;
  badges?: string[];
}

export interface BuildSuggestionBundle {
  planner: LevelPlannerSuggestions[];
  currentLevelSkills: SkillSuggestionChoice[];
  currentLevelSkillNotes: string[];
  spellChoices: Record<
    string,
    Partial<Record<number, SpellSuggestionChoice[]>>
  >;
}

interface BuildSuggestionArgs {
  build: CharacterBuild;
  currentLevel: number;
  sheetSpellcasting: DerivedSpellcasting[];
  classes: Record<string, ClassDefinition>;
  feats: FeatRegistry;
  spells: SpellRegistry;
  classFeatures: ClassFeatureRegistry;
  archetypes: Record<string, ArchetypeDefinitionLike>;
  buildGuides: BuildGuideDefinition[];
  includeGuides?: boolean;
  /** Zero-based planner rows to calculate. Omit to calculate all rows. */
  plannerLevelIndexes?: readonly number[];
}

interface BuildSuggestionSharedData {
  featList: FeatDefinition[];
  featByName: Map<string, FeatDefinition>;
}

interface BuildSuggestionLevelCache {
  previewSheet: ReturnType<typeof computeSheet>;
  levelContext: ReturnType<typeof featContextFromSheet>;
  weakestSave: "fort" | "ref" | "will";
  classPrerequisiteContext: ReturnType<typeof featContextFromSheet> & {
    skillRanks: Partial<Record<SkillKey, number>>;
    classLevels: Map<string, number>;
  };
}

interface GuideMatch {
  guide: BuildGuideDefinition;
  score: number;
}

interface ActiveBandMatch {
  guide: BuildGuideDefinition;
  band: BuildGuideProgressionBand;
  score: number;
}

interface ActiveBranchMatch {
  guide: BuildGuideDefinition;
  branch: BuildGuideBranchDefinition;
  score: number;
}

interface BuildProfile {
  dominantClassName?: string;
  dominantClass?: ClassDefinition;
  topAbilities: AbilityKey[];
  meleeFocus: boolean;
  rangedFocus: boolean;
  casterFocus: boolean;
  skillFocus: boolean;
  stealthFocus: boolean;
  craftFocus: boolean;
  siegeFocus: boolean;
  frontliner: boolean;
  castingAbility?: AbilityKey;
  weaponNames: string[];
  hasMeleeWeapon: boolean;
  hasRangedWeapon: boolean;
  hasFinesseWeapon: boolean;
  hasTwoHandedWeapon: boolean;
  hasShield: boolean;
  selectedFeatNames: Set<string>;
  archetypeText: string;
  raceText: string;
  matchedGuides: GuideMatch[];
  activeBands: ActiveBandMatch[];
  activeBranches: ActiveBranchMatch[];
}

const ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const EMPTY_LEVEL_SUGGESTIONS: LevelPlannerSuggestions = {
  guideChoices: [],
  classChoices: [],
  featChoices: [],
  featChoicesBySlot: [],
  favoredClassChoices: [],
  abilityChoices: [],
  notes: [],
};

function normalize(text: string | undefined) {
  return text?.trim().toLowerCase() ?? "";
}

function suggestionEmphasis(score: number): "top" | "strong" | "ok" {
  if (score >= 120) return "top";
  if (score >= 75) return "strong";
  return "ok";
}

function choiceWithMeta<T extends string>(
  choice: Omit<PlannerSuggestionChoice<T>, "emphasis">,
): PlannerSuggestionChoice<T> {
  return {
    ...choice,
    emphasis: suggestionEmphasis(choice.score),
  };
}

function noteWithMeta(
  label: string,
  text: string,
  sourceKind: SuggestionSourceKind = "heuristic",
): PlannerSuggestionNote {
  return { label, text, sourceKind };
}

function uniqueTopChoices<T extends string>(
  choices: PlannerSuggestionChoice<T>[],
  max = 3,
) {
  const seen = new Set<string>();
  return choices
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .filter((choice) => {
      const key = normalize(choice.value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

function uniqueTopSkillChoices(choices: SkillSuggestionChoice[], max = 6) {
  const seen = new Set<string>();
  return choices
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .filter((choice) => {
      const key = normalize(choice.key);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

function uniqueTopSpellChoices(choices: SpellSuggestionChoice[], max = 5) {
  const seen = new Set<string>();
  return choices
    .sort((a, b) => b.score - a.score || a.spellName.localeCompare(b.spellName))
    .filter((choice) => {
      const key = normalize(choice.spellName);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

function selectedArchetypesForClass(
  build: CharacterBuild,
  className: string,
  archetypes: Record<string, ArchetypeDefinitionLike>,
) {
  return (build.classArchetypes?.[normalize(className)] ?? [])
    .map((id) => archetypes[normalize(id)])
    .filter((entry): entry is ArchetypeDefinitionLike => !!entry);
}

function classCounts(build: CharacterBuild, limit: number) {
  const counts = new Map<string, number>();
  for (const level of build.levels.slice(0, limit)) {
    const key = normalize(level.className);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function classDefinitionByName(
  classes: Record<string, ClassDefinition>,
  className: string | undefined,
) {
  return Object.values(classes).find(
    (entry) => normalize(entry.name) === normalize(className),
  );
}

function preferredClassKey(
  build: CharacterBuild,
  classes: Record<string, ClassDefinition>,
  limit: number,
) {
  const counts = classCounts(build, limit);
  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const top = sorted[0]?.[0];
  if (top && classes[top]) return top;
  return Object.keys(classes).find(
    (key) =>
      normalize(classes[key]?.name) === normalize(build.favoredClassName),
  );
}

function currentAbilityScore(
  build: CharacterBuild,
  ability: AbilityKey,
  previewLevel: number,
) {
  let score = build.baseAbilityScores[ability];
  score += (build.race.abilityModifiers ?? []).reduce(
    (sum, mod) => (mod.target === ability ? sum + mod.value : sum),
    0,
  );
  if (build.race.choiceSelection?.flexibleAbility === ability)
    score += build.race.choiceOptions?.flexibleAbilityBonus?.value ?? 0;
  for (const level of build.levels.slice(0, previewLevel))
    if (level.abilityIncrease === ability) score += 1;
  return score;
}

function raceChoiceText(build: CharacterBuild) {
  const parts = [
    build.race.id ?? build.race.name,
    build.race.name,
    ...(build.race.notes ?? []),
  ];
  const flex = build.race.choiceSelection?.flexibleAbility;
  if (flex) parts.push(`flex ${flex}`);
  if (build.race.choiceOptions?.extraSkillRanksPerLevel)
    parts.push("extra skills");
  if (build.race.choiceSelection?.bonusFeat)
    parts.push(`bonus feat ${build.race.choiceSelection.bonusFeat}`);
  return normalize(parts.join(" "));
}

function scoreGuide(
  build: CharacterBuild,
  guide: BuildGuideDefinition,
  previewLevel: number,
): number {
  let score = guide.priority ?? 0;
  const currentClasses = new Set(
    build.levels
      .slice(0, previewLevel)
      .map((level) => normalize(level.className)),
  );
  const currentArchetypes = new Set(
    Object.values(build.classArchetypes ?? {}).flatMap((ids) =>
      (ids ?? []).map((id) => normalize(id)),
    ),
  );
  const raceId = normalize(build.race.id ?? build.race.name);
  if (guide.classNames?.length) {
    const matches = guide.classNames.filter((name) =>
      currentClasses.has(normalize(name)),
    ).length;
    if (matches === 0) return -999;
    score += matches * 30;
  }
  if (guide.archetypeIds?.length) {
    const matches = guide.archetypeIds.filter((id) =>
      currentArchetypes.has(normalize(id)),
    ).length;
    if (matches === 0) return -999;
    score += matches * 40;
  }
  if (guide.raceIds?.length) {
    if (!guide.raceIds.some((id) => normalize(id) === raceId)) return -999;
    score += 20;
  }
  if (
    guide.favoredClassName &&
    normalize(guide.favoredClassName) === normalize(build.favoredClassName)
  )
    score += 18;
  return score;
}

function bandApplies(level: number, band: BuildGuideProgressionBand) {
  return (band.minLevel ?? 1) <= level && level <= (band.maxLevel ?? 20);
}

function branchApplies(
  build: CharacterBuild,
  previewLevel: number,
  branch: BuildGuideBranchDefinition,
) {
  const when = branch.when;
  if (
    (when.minLevel ?? 1) > previewLevel ||
    (when.maxLevel ?? 20) < previewLevel
  )
    return false;
  if (when.favoredClassMatches && !build.favoredClassName) return false;
  if (when.favoredClassMatches) {
    const currentClass = build.levels[Math.max(0, previewLevel - 1)]?.className;
    if (normalize(currentClass) !== normalize(build.favoredClassName))
      return false;
  }
  if (when.classNamesAny?.length) {
    const currentClasses = new Set(
      build.levels
        .slice(0, previewLevel)
        .map((level) => normalize(level.className)),
    );
    if (!when.classNamesAny.some((name) => currentClasses.has(normalize(name))))
      return false;
  }
  if (when.archetypeIdsAny?.length) {
    const currentArchetypes = new Set(
      Object.values(build.classArchetypes ?? {}).flatMap((ids) =>
        (ids ?? []).map((id) => normalize(id)),
      ),
    );
    if (
      !when.archetypeIdsAny.some((id) => currentArchetypes.has(normalize(id)))
    )
      return false;
  }
  if (when.featNamesAny?.length) {
    const feats = new Set(priorFeatNames(build, previewLevel));
    if (!when.featNamesAny.some((name) => feats.has(normalize(name))))
      return false;
  }
  if (when.abilityAtLeast) {
    for (const [ability, min] of Object.entries(when.abilityAtLeast)) {
      if (
        currentAbilityScore(build, ability as AbilityKey, previewLevel) <
        (min ?? 0)
      )
        return false;
    }
  }
  return true;
}

function matchingGuides(
  build: CharacterBuild,
  previewLevel: number,
  guides: BuildGuideDefinition[],
) {
  return guides
    .map((guide) => ({ guide, score: scoreGuide(build, guide, previewLevel) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.guide.name.localeCompare(b.guide.name),
    )
    .slice(0, 4);
}

function activeBands(level: number, matches: GuideMatch[]) {
  return matches.flatMap(({ guide, score }) =>
    (guide.progression ?? [])
      .filter((band) => bandApplies(level, band))
      .map((band) => ({ guide, band, score: score + 20 })),
  );
}

function activeBranches(
  build: CharacterBuild,
  previewLevel: number,
  matches: GuideMatch[],
) {
  return matches.flatMap(({ guide, score }) =>
    (guide.branches ?? [])
      .filter((branch) => branchApplies(build, previewLevel, branch))
      .map((branch) => ({ guide, branch, score: score + 35 })),
  );
}

function buildProfile(
  build: CharacterBuild,
  previewLevel: number,
  classes: Record<string, ClassDefinition>,
  archetypes: Record<string, ArchetypeDefinitionLike>,
  guides: BuildGuideDefinition[],
): BuildProfile {
  const dominantClassKey = preferredClassKey(build, classes, previewLevel);
  const dominantClass = dominantClassKey
    ? classes[dominantClassKey]
    : undefined;
  const topAbilities = [...ABILITIES].sort(
    (a, b) =>
      build.baseAbilityScores[b] - build.baseAbilityScores[a] ||
      ABILITIES.indexOf(a) - ABILITIES.indexOf(b),
  );
  const selectedArchetypes = [
    ...new Set(
      build.levels
        .slice(0, previewLevel)
        .map((level) => normalize(level.className)),
    ),
  ].flatMap((classKey) =>
    selectedArchetypesForClass(build, classKey, archetypes),
  );
  const archetypeText = normalize(
    selectedArchetypes
      .map((archetype) =>
        [
          archetype.id,
          archetype.name,
          archetype.description,
          ...(archetype.notes ?? []),
        ].join(" "),
      )
      .join(" "),
  );
  const raceText = raceChoiceText(build);
  const matchedGuides = matchingGuides(build, previewLevel, guides);
  const bands = activeBands(previewLevel, matchedGuides);
  const branches = activeBranches(build, previewLevel, matchedGuides);
  const guideText = normalize(
    [
      ...matchedGuides.flatMap(({ guide }) => [
        guide.name,
        guide.description,
        ...(guide.notes ?? []),
      ]),
      ...bands.flatMap(({ band }) => band.notes ?? []),
      ...branches.flatMap(({ branch }) => branch.notes ?? []),
    ].join(" "),
  );
  const skillRankBase = dominantClass?.skillRanksPerLevel ?? 2;
  const spellcasting = dominantClass?.spellcasting;
  const weapons = [
    ...(build.weapons ?? []),
    ...(build.equipment ?? [])
      .filter((item) => item.equipped && item.weapon)
      .map((item) => ({ name: item.name, ...item.weapon! })),
  ];
  const weaponNames = [...new Set(weapons.map((weapon) => weapon.name))];
  const hasMeleeWeapon = weapons.some((weapon) => weapon.category === "melee");
  const hasRangedWeapon = weapons.some(
    (weapon) => weapon.category === "ranged",
  );
  const hasFinesseWeapon = weapons.some(
    (weapon) =>
      weapon.category === "melee" &&
      (weapon.handedness === "light" ||
        weapon.specialTags?.some((tag) => /finesse/i.test(tag))),
  );
  const selectedFeatNames = new Set(
    [
      build.race.choiceSelection?.bonusFeat,
      ...build.levels
        .slice(0, previewLevel)
        .flatMap((level) => level.feats ?? []),
    ]
      .filter((feat): feat is string => !!feat)
      .map((feat) => normalize(feat.replace(/\s*\([^)]*\)\s*$/, ""))),
  );
  const dexHigh =
    currentAbilityScore(build, "dex", previewLevel) >=
    currentAbilityScore(build, "str", previewLevel);
  const rangedKeywords =
    /gun|firearm|shot|sniper|scout|bow|ranged|rifle|pistol|musket/;
  const stealthKeywords = /covert|infiltrat|stealth|skirmish|scout|rogue/;
  const craftKeywords = /craft|alchem|wright|smith/;
  const siegeKeywords = /siege|artiller|bombard/;
  return {
    dominantClassName: dominantClass?.name,
    dominantClass,
    topAbilities,
    meleeFocus:
      hasMeleeWeapon ||
      (!hasRangedWeapon &&
        !spellcasting &&
        (currentAbilityScore(build, "str", previewLevel) >=
          currentAbilityScore(build, "dex", previewLevel) ||
          (dominantClass?.bab === "full" &&
            !rangedKeywords.test(archetypeText)))),
    rangedFocus:
      hasRangedWeapon ||
      (!hasMeleeWeapon && dexHigh) ||
      rangedKeywords.test(archetypeText) ||
      rangedKeywords.test(raceText) ||
      rangedKeywords.test(guideText),
    casterFocus: !!spellcasting,
    skillFocus:
      skillRankBase >= 6 ||
      build.baseAbilityScores.int >= 14 ||
      raceText.includes("extra skills"),
    stealthFocus:
      stealthKeywords.test(archetypeText) ||
      stealthKeywords.test(guideText) ||
      !!dominantClass?.classSkills.some((skill) =>
        ["stealth", "disable-device", "sleight-of-hand"].includes(skill),
      ),
    craftFocus:
      craftKeywords.test(archetypeText) ||
      craftKeywords.test(guideText) ||
      !!dominantClass?.classSkills.includes("craft"),
    siegeFocus:
      siegeKeywords.test(archetypeText) || siegeKeywords.test(guideText),
    frontliner:
      dominantClass?.bab === "full" ||
      build.baseAbilityScores.str >= 14 ||
      build.baseAbilityScores.con >= 14,
    castingAbility: spellcasting?.castingAbility,
    weaponNames,
    hasMeleeWeapon,
    hasRangedWeapon,
    hasFinesseWeapon,
    hasTwoHandedWeapon: weapons.some((weapon) => weapon.handedness === "two"),
    hasShield: (build.equipment ?? []).some(
      (item) => item.equipped && !!item.shield,
    ),
    selectedFeatNames,
    archetypeText,
    raceText,
    matchedGuides,
    activeBands: bands,
    activeBranches: branches,
  };
}

function buildLevelCache(
  args: BuildSuggestionArgs,
  levelIndex: number,
): BuildSuggestionLevelCache {
  const levels = args.build.levels
    .slice(0, levelIndex + 1)
    .map((level, index) =>
      index === levelIndex
        ? { ...level, feats: undefined, abilityIncrease: undefined }
        : level,
    );
  const previewSheet = computeSheet(
    buildCharacter(
      { ...args.build, levels },
      args.classes,
      args.feats,
      args.classFeatures,
      args.archetypes,
    ),
    { spellRegistry: args.spells },
  );
  const levelContext = featContextFromSheet(previewSheet);
  const runningSkillRanks = args.build.levels
    .slice(0, levelIndex)
    .reduce<Partial<Record<SkillKey, number>>>((acc, level) => {
      for (const [skill, ranks] of Object.entries(level.skillRanks ?? {}) as [
        SkillKey,
        number,
      ][]) {
        acc[skill] = (acc[skill] ?? 0) + ranks;
      }
      return acc;
    }, {});
  const runningClassLevels = args.build.levels
    .slice(0, levelIndex)
    .reduce<Map<string, number>>((acc, level) => {
      const key = level.className.toLowerCase();
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
  const saves: Array<["fort" | "ref" | "will", number]> = [
    ["fort", previewSheet.saves.fort.total],
    ["ref", previewSheet.saves.ref.total],
    ["will", previewSheet.saves.will.total],
  ];
  return {
    previewSheet,
    levelContext,
    weakestSave: saves.sort((a, b) => a[1] - b[1])[0]?.[0] ?? "will",
    classPrerequisiteContext: {
      ...levelContext,
      skillRanks: runningSkillRanks,
      classLevels: runningClassLevels,
    },
  };
}

function buildSharedSuggestionData(
  feats: FeatRegistry,
): BuildSuggestionSharedData {
  const featList = listFeats(feats);
  return {
    featList,
    featByName: new Map(featList.map((feat) => [normalize(feat.name), feat])),
  };
}

function priorFeatNames(build: CharacterBuild, upToLevelIndex: number) {
  const taken = build.levels
    .slice(0, upToLevelIndex)
    .flatMap((level) => level.feats ?? []);
  if (build.race.choiceSelection?.bonusFeat)
    taken.push(build.race.choiceSelection.bonusFeat);
  return taken.map((name) => normalize(name));
}

function effectScore(
  feat: FeatDefinition,
  profile: BuildProfile,
  weakestSave: "fort" | "ref" | "will",
) {
  return feat.effects.reduce((score, effect) => {
    if (
      (effect.target === "attack" ||
        effect.target === "attack.melee" ||
        effect.target === "damage" ||
        effect.target === "damage.melee") &&
      profile.meleeFocus
    )
      return score + 8;
    if (
      (effect.target === "attack.ranged" ||
        effect.target === "damage.ranged") &&
      profile.rangedFocus
    )
      return score + 8;
    if (effect.target === "ac") return score + 6;
    if (effect.target === "init") return score + 6;
    if (effect.target === `save.${weakestSave}`) return score + 8;
    if (effect.target === "hp") return score + 6;
    return score + 2;
  }, 0);
}

function scoreFeat(
  feat: FeatDefinition,
  profile: BuildProfile,
  levelContext: ReturnType<typeof featContextFromSheet>,
  weakestSave: "fort" | "ref" | "will",
  taken: Set<string>,
  slotKind: FeatGrantKind,
) {
  if (
    slotKind === "fighter-bonus" &&
    !(feat.tags ?? []).some((tag) => tag.toLowerCase() === "combat")
  )
    return null;
  const key = normalize(feat.name);
  const featId = normalize(feat.id);
  if (taken.has(key) || !checkPrerequisites(feat, levelContext).met)
    return null;
  let score = effectScore(feat, profile, weakestSave);
  let reason = feat.description.trim() || "No mechanical summary is loaded.";
  if (featId === "power-attack") {
    score +=
      profile.hasMeleeWeapon && levelContext.abilityScores.str >= 13
        ? profile.hasTwoHandedWeapon
          ? 52
          : 40
        : -24;
    reason = `Strength ${levelContext.abilityScores.str}, BAB +${levelContext.baseAttackBonus}, and ${profile.hasTwoHandedWeapon ? "a two-handed weapon" : "current melee gear"} support trading attack for scaling melee damage.`;
  } else if (featId === "deadly-aim") {
    score +=
      profile.hasRangedWeapon && levelContext.abilityScores.dex >= 13
        ? 44
        : -24;
    reason = `Dexterity ${levelContext.abilityScores.dex}, BAB +${levelContext.baseAttackBonus}, and ${
      profile.weaponNames
        .filter((name) => profile.hasRangedWeapon && name)
        .slice(0, 2)
        .join("/") || "current ranged gear"
    } support trading attack for scaling ranged damage.`;
  } else if (featId === "weapon-finesse") {
    if (!profile.hasFinesseWeapon) return null;
    score +=
      levelContext.abilityScores.dex > levelContext.abilityScores.str
        ? 44
        : -18;
    reason = `Dexterity ${levelContext.abilityScores.dex} exceeds Strength ${levelContext.abilityScores.str}; use Dex on eligible melee attack rolls.`;
  } else if (featId === "weapon-focus") {
    if (profile.weaponNames.length === 0) return null;
    score += 32;
    reason = `Adds +1 attack with a chosen current weapon: ${profile.weaponNames.slice(0, 3).join(", ")}.`;
  } else if (featId === "improved-initiative") {
    score += 24 + (profile.stealthFocus || profile.rangedFocus ? 8 : 0);
    reason =
      "Adds +4 initiative; useful for acting before enemies in round one.";
  } else if (featId === "toughness") {
    score += profile.frontliner ? 20 : 10;
    reason = "Adds 3 HP now and +1 HP at every level after 3rd.";
  } else if (featId === "iron-will") {
    score += weakestSave === "will" ? 26 : 8;
    reason = `Will is the lowest projected save; this adds +2.`;
  } else if (featId === "great-fortitude") {
    score += weakestSave === "fort" ? 26 : 8;
    reason = `Fortitude is the lowest projected save; this adds +2.`;
  } else if (featId === "lightning-reflexes") {
    score += weakestSave === "ref" ? 26 : 8;
    reason = `Reflex is the lowest projected save; this adds +2.`;
  } else if (featId === "master-craftsman") {
    score += profile.craftFocus ? 34 : -8;
    reason = "Best for craft-heavy plans.";
  } else if (featId === "craft-construct") {
    score += profile.craftFocus ? 28 : -12;
    reason = "Only shines once a crafting plan already exists.";
  } else if (featId === "siege-engineer") {
    score += profile.siegeFocus ? 36 : -10;
    reason = "Great if the build is telegraphing siege nonsense.";
  } else if (featId === "master-siege-engineer") {
    score += profile.siegeFocus && taken.has("siege engineer") ? 38 : -12;
    reason = "A follow-up for siege specialists.";
  }
  return choiceWithMeta({
    value: feat.name,
    label: feat.name,
    reason,
    score,
    sourceKind: "heuristic",
    sourceLabel: "Build read",
  }) satisfies PlannerSuggestionChoice<string>;
}

function bandFeatChoices(
  profile: BuildProfile,
  levelContext: ReturnType<typeof featContextFromSheet>,
  taken: Set<string>,
  featByName: Map<string, FeatDefinition>,
  slotKind: FeatGrantKind,
) {
  const picks: PlannerSuggestionChoice<string>[] = [];
  const bandSources = [
    ...profile.activeBranches.map(({ guide, branch, score }) => ({
      guideName: guide.name,
      description: guide.description,
      score: score + 10,
      priorities: branch.featPriorities ?? [],
    })),
    ...profile.activeBands.map(({ guide, band, score }) => ({
      guideName: guide.name,
      description: guide.description,
      score,
      priorities: band.featPriorities ?? [],
    })),
    ...profile.matchedGuides.map(({ guide, score }) => ({
      guideName: guide.name,
      description: guide.description,
      score,
      priorities: guide.featPriorities ?? [],
    })),
  ];
  for (const source of bandSources) {
    source.priorities.forEach((featName, index) => {
      const feat = featByName.get(normalize(featName));
      if (
        !feat ||
        taken.has(normalize(feat.name)) ||
        !checkPrerequisites(feat, levelContext).met ||
        (slotKind === "fighter-bonus" &&
          !(feat.tags ?? []).some((tag) => tag.toLowerCase() === "combat"))
      )
        return;
      picks.push(
        choiceWithMeta({
          value: feat.name,
          label: feat.name,
          reason: source.description,
          score: 100 + source.score - index * 4,
          sourceKind: "guide",
          sourceLabel: source.guideName,
        }),
      );
    });
  }
  return picks;
}

function suggestFeatChoiceSlots(
  args: BuildSuggestionArgs,
  levelIndex: number,
  profile: BuildProfile,
  shared: BuildSuggestionSharedData,
  levelCache: BuildSuggestionLevelCache,
) {
  const reserved = new Set(priorFeatNames(args.build, levelIndex));
  const plan = planLevelUp(
    { ...args.build, levels: args.build.levels.slice(0, levelIndex) },
    args.build.levels[levelIndex]?.className ?? "Fighter",
    args.classes,
    args.archetypes,
  );
  return plan.featSlots.map((slot, slotIndex) => {
    const choices = uniqueTopChoices([
      ...bandFeatChoices(
        profile,
        levelCache.levelContext,
        reserved,
        shared.featByName,
        slot.kind,
      ),
      ...shared.featList
        .map((feat) =>
          scoreFeat(
            feat,
            profile,
            levelCache.levelContext,
            levelCache.weakestSave,
            reserved,
            slot.kind,
          ),
        )
        .filter(
          (choice): choice is PlannerSuggestionChoice<string> =>
            !!choice && choice.score > 0,
        ),
    ]);
    const top = choices[0]?.value;
    if (top) reserved.add(normalize(top));
    return {
      slotIndex,
      slotLabel: slot.label,
      slotSource: slot.source,
      slotKind: slot.kind,
      choices,
    } satisfies PlannerFeatSlotSuggestions;
  });
}

function suggestAbilityChoices(profile: BuildProfile) {
  const primaryCombatAbility: AbilityKey =
    profile.rangedFocus && !profile.meleeFocus
      ? "dex"
      : profile.meleeFocus
        ? "str"
        : (profile.topAbilities[0] ?? "str");
  const choices: PlannerSuggestionChoice<AbilityKey>[] = [
    {
      value: primaryCombatAbility,
      label: primaryCombatAbility.toUpperCase(),
      reason:
        primaryCombatAbility === "str"
          ? "Strength improves melee attack and damage rolls."
          : primaryCombatAbility === "dex"
            ? "Dexterity improves ranged attacks, initiative, Reflex, and AC within armor limits."
            : `${primaryCombatAbility.toUpperCase()} is currently the build's highest ability.`,
      score: 60,
    },
    {
      value: "con",
      label: "CON",
      reason: "Constitution is the timeless art of not dying.",
      score: profile.frontliner ? 42 : 28,
    },
    {
      value: "dex",
      label: "DEX",
      reason: "Dexterity helps initiative, AC, and ranged plans.",
      score: profile.rangedFocus || profile.stealthFocus ? 44 : 20,
    },
    {
      value: "wis",
      label: "WIS",
      reason: "Wisdom props up Will saves and Perception.",
      score: profile.castingAbility === "wis" ? 50 : 18,
    },
    {
      value: "int",
      label: "INT",
      reason: "Intelligence matters for skill-heavy or prepared-caster plans.",
      score: profile.skillFocus || profile.castingAbility === "int" ? 36 : 8,
    },
    {
      value: "cha",
      label: "CHA",
      reason: "Charisma matters if the build actually runs on it.",
      score: profile.castingAbility === "cha" ? 46 : 6,
    },
  ];
  const prioritySources = [
    ...profile.activeBranches.map(({ guide, branch, score }) => ({
      guideName: guide.name,
      description: guide.description,
      score: score + 10,
      priorities: branch.statPriorities ?? [],
    })),
    ...profile.activeBands.map(({ guide, band, score }) => ({
      guideName: guide.name,
      description: guide.description,
      score,
      priorities: band.statPriorities ?? [],
    })),
    ...profile.matchedGuides.map(({ guide, score }) => ({
      guideName: guide.name,
      description: guide.description,
      score,
      priorities: guide.statPriorities ?? [],
    })),
  ];
  for (const source of prioritySources) {
    source.priorities.forEach((ability, index) => {
      choices.push(
        choiceWithMeta({
          value: ability,
          label: ability.toUpperCase(),
          reason: source.description,
          score: 80 + source.score - index * 6,
          sourceKind: "guide",
          sourceLabel: source.guideName,
        }),
      );
    });
  }
  if (profile.castingAbility)
    choices.push(
      choiceWithMeta({
        value: profile.castingAbility,
        label: profile.castingAbility.toUpperCase(),
        reason: `Raising ${profile.castingAbility.toUpperCase()} improves spell DCs and may unlock bonus spell slots.`,
        score: 58,
        sourceKind: "heuristic",
        sourceLabel: "Caster lane",
      }),
    );
  return uniqueTopChoices(choices);
}

function suggestFavoredClassChoices(
  build: CharacterBuild,
  levelIndex: number,
  profile: BuildProfile,
  classes: Record<string, ClassDefinition>,
) {
  const className = build.levels[levelIndex]?.className;
  const classDef = classDefinitionByName(classes, className);
  if (
    !className ||
    normalize(build.favoredClassName) !== normalize(className)
  ) {
    return [
      {
        value: "none",
        label: "None",
        reason:
          "This level isn’t in the favored class, so there’s no favored bonus to claim.",
        score: 80,
      } satisfies PlannerSuggestionChoice<"none">,
    ];
  }
  const hpScore =
    (profile.frontliner ? 48 : 28) + ((classDef?.hitDie ?? 8) <= 8 ? 8 : 0);
  const skillScore =
    (profile.skillFocus ? 46 : 18) +
    ((classDef?.skillRanksPerLevel ?? 2) >= 6 ? 10 : 0);
  const guideChoices = [
    ...profile.activeBranches.flatMap(({ guide, branch, score }) =>
      (branch.favoredClassBonusPriority ?? []).map((value, index) =>
        choiceWithMeta({
          value,
          label: value.toUpperCase(),
          reason: guide.description,
          score: 98 + score - index * 8,
          sourceKind: "branch",
          sourceLabel: guide.name,
        }),
      ),
    ),
    ...profile.activeBands.flatMap(({ guide, band, score }) =>
      (band.favoredClassBonusPriority ?? []).map((value, index) =>
        choiceWithMeta({
          value,
          label: value.toUpperCase(),
          reason: guide.description,
          score: 90 + score - index * 8,
          sourceKind: "band",
          sourceLabel: guide.name,
        }),
      ),
    ),
    ...profile.matchedGuides.flatMap(({ guide, score }) =>
      (guide.favoredClassBonusPriority ?? []).map((value, index) =>
        choiceWithMeta({
          value,
          label: value.toUpperCase(),
          reason: guide.description,
          score: 84 + score - index * 8,
          sourceKind: "guide",
          sourceLabel: guide.name,
        }),
      ),
    ),
  ] as PlannerSuggestionChoice<string>[];
  const racialChoices = favoredClassBonusOptions(build.race, className).map(
    (bonus) => ({
      value: bonus.id,
      label: bonus.label,
      reason: bonus.description,
      score: profile.frontliner ? 66 : 36,
      sourceKind: "system" as const,
      sourceLabel: build.race.name,
    }),
  );
  return uniqueTopChoices<string>([
    ...guideChoices,
    ...racialChoices,
    {
      value: "hp",
      label: "HP",
      reason: "Adds exactly +1 maximum HP for this favored-class level.",
      score: hpScore,
    },
    {
      value: "skill",
      label: "Skill",
      reason:
        "Adds exactly +1 skill rank to spend for this favored-class level.",
      score: skillScore,
    },
    {
      value: "none",
      label: "None",
      reason:
        "Claims no bonus for this level; choose only when intentionally leaving it unused.",
      score: 4,
    },
  ]);
}

function scoreClassChoice(
  classDef: ClassDefinition,
  build: CharacterBuild,
  levelIndex: number,
  profile: BuildProfile,
  archetypes: Record<string, ArchetypeDefinitionLike>,
  classPrerequisiteContext: BuildSuggestionLevelCache["classPrerequisiteContext"],
) {
  let score = 0;
  let reason = `${classDef.name} provides d${classDef.hitDie} HP, ${classDef.bab} BAB, ${classDef.skillRanksPerLevel} base skill ranks, and ${classDef.goodSaves.length ? `good ${classDef.goodSaves.join("/")} saves` : "no good saves"}.`;
  if (classDef.prerequisites?.length) {
    const unmet = checkClassPrerequisites(classDef, classPrerequisiteContext);
    if (unmet.length > 0) {
      return choiceWithMeta({
        value: classDef.name,
        label: classDef.name,
        reason: `Needs ${unmet.map((entry) => entry.description).join(", ")}.`,
        score: -100,
        sourceKind: "system",
        sourceLabel: "Prerequisites",
      }) satisfies PlannerSuggestionChoice<string>;
    }
  }
  const previousClass = build.levels[levelIndex - 1]?.className;
  if (normalize(previousClass) === normalize(classDef.name)) {
    score += 50;
    reason = `Continues ${classDef.name}: d${classDef.hitDie} HP, ${classDef.bab} BAB, ${classDef.skillRanksPerLevel} base skill ranks, and ${classDef.goodSaves.length ? `good ${classDef.goodSaves.join("/")} saves` : "no good saves"}.`;
  }
  if (normalize(build.favoredClassName) === normalize(classDef.name)) {
    score += 26;
    reason =
      normalize(previousClass) === normalize(classDef.name)
        ? `Continues ${classDef.name} and remains eligible for this level's favored-class bonus.`
        : `${classDef.name} is favored, so this level can claim +1 HP, +1 skill rank, or a loaded ancestry option.`;
  }
  if (selectedArchetypesForClass(build, classDef.name, archetypes).length > 0)
    score += 10;
  if (
    profile.casterFocus &&
    classDef.spellcasting?.castingAbility === profile.castingAbility
  )
    score += 18;
  if (profile.meleeFocus && classDef.bab === "full") score += 16;
  if (profile.rangedFocus && classDef.classSkills.includes("perception"))
    score += 6;
  if (profile.skillFocus && classDef.skillRanksPerLevel >= 6) score += 14;
  return choiceWithMeta({
    value: classDef.name,
    label: classDef.name,
    reason,
    score,
    sourceKind: "heuristic",
    sourceLabel: "Class lane",
  }) satisfies PlannerSuggestionChoice<string>;
}

function suggestClassChoices(
  args: BuildSuggestionArgs,
  levelIndex: number,
  profile: BuildProfile,
  levelCache: BuildSuggestionLevelCache,
) {
  const guideChoices = [
    ...profile.activeBranches.flatMap(({ guide, branch, score }) =>
      (branch.classNames ?? []).map(
        (className, index) =>
          ({
            value: className,
            label: className,
            reason: `${guide.name}: ${guide.description}`,
            score: 102 + score - index * 4,
            sourceKind: "branch",
            sourceLabel: guide.name,
          }) satisfies PlannerSuggestionChoice<string>,
      ),
    ),
    ...profile.activeBands.flatMap(({ guide, band, score }) =>
      (band.classNames ?? []).map(
        (className, index) =>
          ({
            value: className,
            label: className,
            reason: `${guide.name}: ${guide.description}`,
            score: 94 + score - index * 4,
            sourceKind: "band",
            sourceLabel: guide.name,
          }) satisfies PlannerSuggestionChoice<string>,
      ),
    ),
  ];
  return uniqueTopChoices([
    ...guideChoices,
    ...Object.values(args.classes)
      .map((classDef) =>
        scoreClassChoice(
          classDef,
          args.build,
          levelIndex,
          profile,
          args.archetypes,
          levelCache.classPrerequisiteContext,
        ),
      )
      .filter((choice) => choice.score > 0),
  ]);
}

function describeBandRange(band: BuildGuideProgressionBand) {
  const min = band.minLevel ?? 1;
  const max = band.maxLevel ?? 20;
  if (min === max) return `Level ${min}`;
  if (min <= 1) return `Levels 1-${max}`;
  if (max >= 20) return `Levels ${min}+`;
  return `Levels ${min}-${max}`;
}

function titleCaseWords(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function suggestGuideChoices(profile: BuildProfile) {
  const branchChoices = profile.activeBranches.map(({ guide, branch, score }) =>
    choiceWithMeta({
      value: `${guide.id}::branch::${branch.id}`,
      label: `${guide.name} — ${titleCaseWords(branch.id)}`,
      reason: branch.notes?.[0] ?? guide.description,
      score: 124 + score,
      sourceKind: "branch",
      sourceLabel: guide.name,
    }),
  );
  const bandChoices = profile.activeBands.map(({ guide, band, score }) =>
    choiceWithMeta({
      value: `${guide.id}::band::${band.minLevel ?? 1}-${band.maxLevel ?? 20}`,
      label: `${guide.name} — ${describeBandRange(band)}`,
      reason: band.notes?.[0] ?? guide.description,
      score: 112 + score,
      sourceKind: "band",
      sourceLabel: guide.name,
    }),
  );
  const guideChoices = profile.matchedGuides.map(({ guide, score }) =>
    choiceWithMeta({
      value: guide.id,
      label: guide.name,
      reason: guide.notes?.[0] ?? guide.description,
      score: 96 + score,
      sourceKind: "guide",
      sourceLabel: guide.pack,
    }),
  );
  return uniqueTopChoices(
    [...branchChoices, ...bandChoices, ...guideChoices],
    4,
  );
}

function suggestNotes(
  build: CharacterBuild,
  levelIndex: number,
  profile: BuildProfile,
) {
  const level = build.levels[levelIndex];
  const notes: PlannerSuggestionNote[] = [];
  if (profile.matchedGuides[0]) {
    notes.push(
      noteWithMeta(
        "Guide",
        `Matched ${profile.matchedGuides[0].guide.name}.`,
        "guide",
      ),
    );
  }
  if (profile.activeBranches[0]?.branch.notes?.[0]) {
    notes.push(
      noteWithMeta(
        "Branch",
        profile.activeBranches[0].branch.notes[0],
        "branch",
      ),
    );
  } else if (profile.activeBands[0]?.band.notes?.[0]) {
    notes.push(
      noteWithMeta("Band", profile.activeBands[0].band.notes[0], "band"),
    );
  }
  if (profile.dominantClassName) {
    notes.push(
      noteWithMeta(
        "Lane",
        `Assumes ${profile.dominantClassName} stays the main lane.`,
        "heuristic",
      ),
    );
  }
  if (profile.castingAbility) {
    notes.push(
      noteWithMeta(
        "Stat",
        `${profile.castingAbility.toUpperCase()} looks like the casting stat to protect.`,
        "heuristic",
      ),
    );
  }
  if (profile.weaponNames.length > 0) {
    notes.push(
      noteWithMeta(
        "Current gear",
        `${profile.weaponNames.slice(0, 3).join(", ")} drive the combat recommendations${profile.hasShield ? "; the equipped shield favors one-handed/defensive choices" : profile.hasTwoHandedWeapon ? "; the two-handed setup raises the value of Strength damage scaling" : ""}.`,
        "system",
      ),
    );
  } else if (profile.meleeFocus || profile.rangedFocus) {
    notes.push(
      noteWithMeta(
        "Missing gear",
        "No weapon is selected, so combat recommendations rely on abilities and class rather than an actual loadout.",
        "system",
      ),
    );
  }
  if (
    profile.hasRangedWeapon &&
    !profile.selectedFeatNames.has("deadly aim") &&
    !profile.selectedFeatNames.has("point-blank shot")
  ) {
    notes.push(
      noteWithMeta(
        "Next gap",
        "The equipped ranged weapon has no loaded ranged damage/accuracy feat supporting it yet.",
        "heuristic",
      ),
    );
  } else if (
    profile.hasMeleeWeapon &&
    !profile.selectedFeatNames.has("power attack") &&
    !profile.selectedFeatNames.has("weapon finesse")
  ) {
    notes.push(
      noteWithMeta(
        "Next gap",
        profile.hasFinesseWeapon
          ? "Current melee gear can support either Strength damage scaling or Dexterity-based accuracy; the ability scores decide which is efficient."
          : "Current melee gear has no loaded attack/damage style feat supporting it yet.",
        "heuristic",
      ),
    );
  }
  if (build.race.choiceOptions?.extraSkillRanksPerLevel) {
    notes.push(
      noteWithMeta(
        "Race",
        `${build.race.name} is bringing extra skill ranks to the party.`,
        "system",
      ),
    );
  }
  if (
    level?.className &&
    normalize(build.favoredClassName) &&
    normalize(level.className) !== normalize(build.favoredClassName)
  ) {
    notes.push(
      noteWithMeta(
        "Favored",
        `Level ${levelIndex + 1} is off favored class, so favored bonus suggestions stay off.`,
        "system",
      ),
    );
  }
  return notes.slice(0, 4);
}

function guideSkillChoices(profile: BuildProfile) {
  const picks: SkillSuggestionChoice[] = [];
  const prioritySources = [
    ...profile.activeBranches.map(({ guide, branch, score }) => ({
      guideName: guide.name,
      description: guide.description,
      score: score + 10,
      priorities: branch.skillPriorities ?? [],
    })),
    ...profile.activeBands.map(({ guide, band, score }) => ({
      guideName: guide.name,
      description: guide.description,
      score,
      priorities: band.skillPriorities ?? [],
    })),
    ...profile.matchedGuides.map(({ guide, score }) => ({
      guideName: guide.name,
      description: guide.description,
      score,
      priorities: guide.skillPriorities ?? [],
    })),
  ];
  for (const source of prioritySources) {
    source.priorities.forEach((key, index) =>
      picks.push({
        key,
        reason: `${source.guideName}: ${source.description}`,
        score: 90 + source.score - index * 4,
      }),
    );
  }
  return picks;
}

function suggestCurrentLevelSkills(args: BuildSuggestionArgs) {
  const currentLevelIndex = Math.max(0, args.currentLevel - 1);
  const level = args.build.levels[currentLevelIndex];
  const activeBuildGuides = args.includeGuides ? args.buildGuides : [];
  const profile = buildProfile(
    args.build,
    args.currentLevel,
    args.classes,
    args.archetypes,
    activeBuildGuides,
  );
  const classDef = classDefinitionByName(args.classes, level?.className);
  const fallback: SkillSuggestionChoice[] = [];
  const prioritySkills: SkillKey[] = [
    ...(profile.stealthFocus
      ? (["stealth", "disable-device", "acrobatics"] as SkillKey[])
      : []),
    ...(profile.craftFocus
      ? (["craft", "knowledge.engineering"] as SkillKey[])
      : []),
    ...(profile.casterFocus ? (["spellcraft"] as SkillKey[]) : []),
    "perception",
  ];
  for (const key of [...prioritySkills, ...(classDef?.classSkills ?? [])]) {
    let score = 40;
    if (key === "perception") score = 66;
    else if (
      key.startsWith("knowledge.") &&
      (profile.skillFocus || profile.casterFocus)
    )
      score = 58;
    else if (key === "spellcraft" && profile.casterFocus) score = 64;
    else if (
      ["stealth", "disable-device"].includes(key) &&
      profile.stealthFocus
    )
      score = 68;
    else if (key === "craft" && profile.craftFocus) score = 62;
    fallback.push({
      key,
      reason: "Fits the current class/archetype lane.",
      score,
    });
  }
  const notes = [
    profile.activeBands[0]?.band.notes?.[0],
    profile.skillFocus
      ? "This build is skill-hungry, so spend ranks where the class actually shines."
      : undefined,
    classDef
      ? `${classDef.name} class skills are weighted more heavily.`
      : undefined,
  ]
    .filter((note): note is string => !!note)
    .slice(0, 3);
  return {
    choices: uniqueTopSkillChoices([
      ...guideSkillChoices(profile),
      ...fallback,
    ]),
    notes,
  };
}

function spellSuggestionProfile(
  profile: BuildProfile,
  caster: DerivedSpellcasting,
  level: number,
): SpellSuggestionProfile {
  return {
    dominantClassName: profile.dominantClassName,
    casterClassName: caster.className,
    casterSpellLevel: level,
    meleeFocus: profile.meleeFocus,
    rangedFocus: profile.rangedFocus,
    casterFocus: profile.casterFocus,
    stealthFocus: profile.stealthFocus,
    frontliner: profile.frontliner,
  };
}

function spellReasonFromBadges(
  className: string,
  level: number,
  badges: string[] | undefined,
) {
  const extras = badges?.length ? ` Tagged: ${badges.join(", ")}.` : "";
  return `Good ${className} level ${level} fit for the current lane.${extras}`;
}

function guideSpellChoices(profile: BuildProfile) {
  return [
    ...profile.activeBranches.flatMap(({ guide, branch, score }) =>
      (branch.spellPriorities ?? []).map((spellName, index) => ({
        spellName,
        reason: `${guide.name}: ${guide.description}`,
        score: 104 + score - index * 4,
        badges: ["guide"],
      })),
    ),
    ...profile.activeBands.flatMap(({ guide, band, score }) =>
      (band.spellPriorities ?? []).map((spellName, index) => ({
        spellName,
        reason: `${guide.name}: ${guide.description}`,
        score: 96 + score - index * 4,
        badges: ["band"],
      })),
    ),
    ...profile.matchedGuides.flatMap(({ guide, score }) =>
      (guide.spellPriorities ?? []).map((spellName, index) => ({
        spellName,
        reason: `${guide.name}: ${guide.description}`,
        score: 88 + score - index * 4,
        badges: ["guide"],
      })),
    ),
  ] as SpellSuggestionChoice[];
}

function suggestSpellsForCaster(
  caster: DerivedSpellcasting,
  args: BuildSuggestionArgs,
) {
  const activeBuildGuides = args.includeGuides ? args.buildGuides : [];
  const profile = buildProfile(
    args.build,
    args.currentLevel,
    args.classes,
    args.archetypes,
    activeBuildGuides,
  );
  const classKey = normalize(caster.className);
  const out: Partial<Record<number, SpellSuggestionChoice[]>> = {};
  const guideChoices = guideSpellChoices(profile);
  for (const levelText of Object.keys(caster.selectionDiagnostics)) {
    const level = Number(levelText);
    const available = Object.values(args.spells).filter((spell) =>
      spell.classes.some(
        (entry) =>
          normalize(entry.className) === classKey && entry.level === level,
      ),
    );
    const spellProfile = spellSuggestionProfile(profile, caster, level);
    const currentSelected = new Set(
      [
        ...(caster.librarySpells[level] ?? []),
        ...(caster.selectedPreparedSpells[level] ?? []),
        ...(caster.selectedKnownSpells[level] ?? []),
      ].map((name) => normalize(name)),
    );
    const heuristics = available
      .filter((spell) => !currentSelected.has(normalize(spell.name)))
      .map((spell) => {
        const badges = spellSuggestionBadges(spell, spellProfile);
        return {
          spellName: spell.name,
          reason: spellReasonFromBadges(caster.className, level, badges),
          score: scoreSpellSuggestion(spell, spellProfile),
          badges,
        };
      })
      .filter((choice) => choice.score > 24);
    const guided = guideChoices.filter(
      (choice) =>
        available.some(
          (spell) => normalize(spell.name) === normalize(choice.spellName),
        ) && !currentSelected.has(normalize(choice.spellName)),
    );
    out[level] = uniqueTopSpellChoices([...guided, ...heuristics]);
  }
  return out;
}

export function buildSuggestions(
  args: BuildSuggestionArgs,
): BuildSuggestionBundle {
  const shared = buildSharedSuggestionData(args.feats);
  const activeBuildGuides = args.includeGuides ? args.buildGuides : [];
  const requestedLevels = new Set(
    args.plannerLevelIndexes ?? Array.from({ length: 20 }, (_, index) => index),
  );
  const levelCaches = new Map(
    [...requestedLevels]
      .filter((levelIndex) => levelIndex >= 0 && levelIndex < 20)
      .map((levelIndex) => [levelIndex, buildLevelCache(args, levelIndex)]),
  );
  const planner = Array.from({ length: 20 }, (_, levelIndex) => {
    if (!requestedLevels.has(levelIndex)) return EMPTY_LEVEL_SUGGESTIONS;
    const profile = buildProfile(
      args.build,
      levelIndex + 1,
      args.classes,
      args.archetypes,
      activeBuildGuides,
    );
    const levelBuild = {
      ...args.build,
      levels: args.build.levels.slice(0, levelIndex),
    };
    const plan = planLevelUp(
      levelBuild,
      args.build.levels[levelIndex]?.className ??
        profile.dominantClassName ??
        "Fighter",
      args.classes,
      args.archetypes,
    );
    const grantsAbilityIncrease = (levelIndex + 1) % 4 === 0;
    const levelCache =
      levelCaches.get(levelIndex) ?? buildLevelCache(args, levelIndex);
    const featChoicesBySlot =
      plan.featSlots.length > 0
        ? suggestFeatChoiceSlots(args, levelIndex, profile, shared, levelCache)
        : [];
    return {
      guideChoices: suggestGuideChoices(profile),
      classChoices: suggestClassChoices(args, levelIndex, profile, levelCache),
      featChoices: featChoicesBySlot[0]?.choices ?? [],
      featChoicesBySlot,
      favoredClassChoices: suggestFavoredClassChoices(
        args.build,
        levelIndex,
        profile,
        args.classes,
      ),
      abilityChoices: grantsAbilityIncrease
        ? suggestAbilityChoices(profile)
        : [],
      notes: suggestNotes(args.build, levelIndex, profile),
    } satisfies LevelPlannerSuggestions;
  });
  const currentLevelSkills = suggestCurrentLevelSkills(args);
  const spellChoices = Object.fromEntries(
    args.sheetSpellcasting.map((caster) => [
      normalize(caster.className),
      suggestSpellsForCaster(caster, args),
    ]),
  );
  return {
    planner,
    currentLevelSkills: currentLevelSkills.choices,
    currentLevelSkillNotes: currentLevelSkills.notes,
    spellChoices,
  };
}
