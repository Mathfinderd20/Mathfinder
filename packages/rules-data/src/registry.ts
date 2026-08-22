import type {
  ClassFeatureDefinition,
  ClassDefinition,
  DomainDefinition,
  FeatDefinition,
  MagicItemDefinition,
  SchoolDefinition,
  SkillDefinition,
  SpellDefinition,
  SpellEffectDefinition,
  WeaponDefinition,
} from "@mathfinder/rules-engine";
import type {
  ArchetypeDefinition,
  BlessingDefinition,
  BuildGuideDefinition,
  BloodlineDefinition,
  EidolonSubtypeDefinition,
  HexDefinition,
  KineticistElementDefinition,
  PhantomEmotionalFocusDefinition,
  RaceDefinition,
  RulesDataIndex,
  RulesDataSet,
  RulesPack,
  TrapOptionDefinition,
} from "./types";

function safeName(value: { name?: string } | null | undefined) {
  return value?.name?.trim() ?? "";
}

function byLowerId<T extends { id?: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(
    items
      .filter((item): item is T => !!item?.id?.trim())
      .map((item) => [item.id!.trim().toLowerCase(), item]),
  );
}

function byLowerName<T extends { name?: string }>(
  items: T[],
): Record<string, T> {
  return Object.fromEntries(
    items
      .filter((item): item is T => !!safeName(item))
      .map((item) => [safeName(item).toLowerCase(), item]),
  );
}

function groupArchetypes(
  archetypes: ArchetypeDefinition[],
): Record<string, ArchetypeDefinition[]> {
  const grouped: Record<string, ArchetypeDefinition[]> = {};
  for (const archetype of archetypes) {
    const key = archetype?.baseClassName?.trim().toLowerCase?.() ?? "";
    if (!key || !safeName(archetype)) continue;
    grouped[key] ??= [];
    grouped[key]!.push(archetype);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key] = grouped[key]!.filter((entry) => !!safeName(entry));
    grouped[key]!.sort((a, b) => safeName(a).localeCompare(safeName(b)));
  }
  return grouped;
}

function groupClassFeatures(
  features: ClassFeatureDefinition[],
): Record<string, ClassFeatureDefinition[]> {
  const grouped: Record<string, ClassFeatureDefinition[]> = {};
  for (const feature of features) {
    const key = feature?.className?.trim().toLowerCase?.() ?? "";
    if (!key || !safeName(feature)) continue;
    grouped[key] ??= [];
    grouped[key]!.push(feature);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key] = grouped[key]!.filter((entry) => !!safeName(entry));
    grouped[key]!.sort(
      (a, b) => a.level - b.level || safeName(a).localeCompare(safeName(b)),
    );
  }
  return grouped;
}

function flatten<T>(packs: RulesPack[], pick: (pack: RulesPack) => T[]): T[] {
  return packs.flatMap((pack) => pick(pack));
}

export function buildRulesDataIndex(data: RulesDataSet): RulesDataIndex {
  const packs = data.packs;
  const classes = flatten<ClassDefinition>(packs, (pack) => pack.classes);
  const archetypes = flatten<ArchetypeDefinition>(
    packs,
    (pack) => pack.archetypes,
  );
  const bloodlines = flatten<BloodlineDefinition>(
    packs,
    (pack) => pack.bloodlines,
  );
  const kineticistElements = flatten<KineticistElementDefinition>(
    packs,
    (pack) => pack.kineticistElements,
  );
  const phantomEmotionalFocuses = flatten<PhantomEmotionalFocusDefinition>(
    packs,
    (pack) => pack.phantomEmotionalFocuses,
  );
  const eidolonSubtypes = flatten<EidolonSubtypeDefinition>(
    packs,
    (pack) => pack.eidolonSubtypes,
  );
  const hexes = flatten<HexDefinition>(packs, (pack) => pack.hexes);
  const blessings = flatten<BlessingDefinition>(
    packs,
    (pack) => pack.blessings,
  );
  const trapOptions = flatten<TrapOptionDefinition>(
    packs,
    (pack) => pack.trapOptions,
  );
  const buildGuides = flatten<BuildGuideDefinition>(
    packs,
    (pack) => pack.buildGuides,
  );
  const classFeatures = flatten<ClassFeatureDefinition>(
    packs,
    (pack) => pack.classFeatures,
  );
  const feats = flatten<FeatDefinition>(packs, (pack) => pack.feats);
  const races = flatten<RaceDefinition>(packs, (pack) => pack.races);
  const skills = flatten<SkillDefinition>(packs, (pack) => pack.skills);
  const spells = flatten<SpellDefinition>(packs, (pack) => pack.spells);
  const weapons = flatten<WeaponDefinition>(packs, (pack) => pack.weapons);
  const magicItems = flatten<MagicItemDefinition>(
    packs,
    (pack) => pack.magicItems,
  );
  const domains = flatten<DomainDefinition>(packs, (pack) => pack.domains);
  const schools = flatten<SchoolDefinition>(packs, (pack) => pack.schools);
  const spellEffects = flatten<SpellEffectDefinition>(
    packs,
    (pack) => pack.spellEffects,
  );

  return {
    sources: Object.fromEntries(
      data.sources.map((source) => [source.id, source]),
    ),
    packs: Object.fromEntries(packs.map((pack) => [pack.id, pack])),
    classes: byLowerName(classes),
    archetypes: byLowerId(archetypes),
    archetypesByClass: groupArchetypes(archetypes),
    bloodlines: byLowerName(bloodlines),
    kineticistElements: byLowerName(kineticistElements),
    phantomEmotionalFocuses: byLowerName(phantomEmotionalFocuses),
    eidolonSubtypes: byLowerName(eidolonSubtypes),
    hexes: byLowerName(hexes),
    blessings: byLowerName(blessings),
    trapOptions: byLowerName(trapOptions),
    buildGuides: byLowerName(buildGuides),
    classFeaturesByClass: groupClassFeatures(classFeatures),
    feats: byLowerName(feats),
    races: byLowerName(races),
    skills: byLowerName(skills),
    spells: byLowerName(spells),
    weapons: byLowerName(weapons),
    magicItems: byLowerName(magicItems),
    domains: byLowerName(domains),
    schools: byLowerName(schools),
    spellEffects: Object.fromEntries(
      spellEffects.map((effect) => [effect.id, effect]),
    ),
  };
}
