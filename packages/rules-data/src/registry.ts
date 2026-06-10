import type {
  ClassFeatureDefinition,
  ClassDefinition,
  FeatDefinition,
  SkillDefinition,
  SpellDefinition,
} from "@path-builder/rules-engine";
import type { RaceDefinition, RulesDataIndex, RulesDataSet, RulesPack } from "./types";

function byLowerName<T extends { name: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.name.toLowerCase(), item]));
}

function groupClassFeatures(features: ClassFeatureDefinition[]): Record<string, ClassFeatureDefinition[]> {
  const grouped: Record<string, ClassFeatureDefinition[]> = {};
  for (const feature of features) {
    const key = feature.className.toLowerCase();
    grouped[key] ??= [];
    grouped[key]!.push(feature);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key]!.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }
  return grouped;
}

function flatten<T>(packs: RulesPack[], pick: (pack: RulesPack) => T[]): T[] {
  return packs.flatMap((pack) => pick(pack));
}

export function buildRulesDataIndex(data: RulesDataSet): RulesDataIndex {
  const packs = data.packs;
  const classes = flatten<ClassDefinition>(packs, (pack) => pack.classes);
  const classFeatures = flatten<ClassFeatureDefinition>(packs, (pack) => pack.classFeatures);
  const feats = flatten<FeatDefinition>(packs, (pack) => pack.feats);
  const races = flatten<RaceDefinition>(packs, (pack) => pack.races);
  const skills = flatten<SkillDefinition>(packs, (pack) => pack.skills);
  const spells = flatten<SpellDefinition>(packs, (pack) => pack.spells);

  return {
    sources: Object.fromEntries(data.sources.map((source) => [source.id, source])),
    packs: Object.fromEntries(packs.map((pack) => [pack.id, pack])),
    classes: byLowerName(classes),
    classFeaturesByClass: groupClassFeatures(classFeatures),
    feats: byLowerName(feats),
    races: byLowerName(races),
    skills: byLowerName(skills),
    spells: byLowerName(spells),
  };
}
