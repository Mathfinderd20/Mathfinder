import {
  classFeaturesGrantedAt,
  type ArchetypeDefinitionLike,
  type CharacterBuild,
  type ClassFeatureDefinition,
  type ClassFeatureRegistry,
} from "@mathfinder/rules-engine";

export interface PlannedClassAbility {
  id: string;
  name: string;
  description: string;
  source: string;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function selectedArchetypes(
  build: CharacterBuild,
  className: string,
  registry: Record<string, ArchetypeDefinitionLike>,
) {
  return (build.classArchetypes?.[normalize(className)] ?? [])
    .map((id) => registry[normalize(id)])
    .filter((entry): entry is ArchetypeDefinitionLike => !!entry);
}

function featureIsReplaced(featureName: string, replacements: string[]) {
  const name = normalize(featureName);
  return replacements.some((replacement) => {
    const label = normalize(replacement);
    return name.includes(label) || label.includes(name);
  });
}

export function classLevelAt(build: CharacterBuild, levelIndex: number) {
  const className = build.levels[levelIndex]?.className;
  if (!className) return 0;
  return build.levels
    .slice(0, levelIndex + 1)
    .filter((level) => normalize(level.className) === normalize(className))
    .length;
}

export function classAbilitiesGrantedAtLevel(args: {
  build: CharacterBuild;
  levelIndex: number;
  classFeatures: ClassFeatureRegistry;
  archetypes: Record<string, ArchetypeDefinitionLike>;
}): PlannedClassAbility[] {
  const { build, levelIndex, classFeatures, archetypes } = args;
  const level = build.levels[levelIndex];
  if (!level) return [];
  const classLevel = classLevelAt(build, levelIndex);
  const activeArchetypes = selectedArchetypes(
    build,
    level.className,
    archetypes,
  );
  const replacements = activeArchetypes.flatMap(
    (archetype) => archetype.replaces ?? [],
  );
  let granted = classFeaturesGrantedAt(
    classFeatures,
    level.className,
    classLevel,
  ).filter((feature) => !featureIsReplaced(feature.name, replacements));

  const gunsEverywhereInfantryman =
    normalize(level.className) === "infantryman" &&
    build.campaignRules?.firearmRules === "guns-everywhere";
  if (gunsEverywhereInfantryman) {
    granted = granted.filter(
      (feature) => normalize(feature.name) !== "gunsmith",
    );
    if (classLevel === 1) {
      const gunTraining = (classFeatures.infantryman ?? []).find(
        (feature) => normalize(feature.name) === "gun training",
      );
      if (gunTraining) {
        granted.push({
          ...gunTraining,
          id: `${gunTraining.id}-guns-everywhere-l1`,
          level: 1,
          description: `${gunTraining.description} Granted at 1st level by Guns Everywhere, replacing Gunsmith.`,
        });
      }
    } else if (classLevel === 5) {
      granted = granted.filter(
        (feature) => normalize(feature.name) !== "gun training",
      );
    }
  }

  const baseAbilities = granted.map((feature: ClassFeatureDefinition) => ({
    id: feature.id,
    name: feature.name,
    description: feature.description,
    source: level.className,
  }));
  const archetypeAbilities = activeArchetypes.flatMap((archetype) =>
    (archetype.features ?? [])
      .filter((feature) => feature.level === classLevel)
      .map((feature) => ({
        id: `${archetype.id}-${feature.level}-${normalize(feature.name).replaceAll(" ", "-")}`,
        name: feature.name,
        description: feature.summary,
        source: archetype.name,
      })),
  );
  return [...baseAbilities, ...archetypeAbilities].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
