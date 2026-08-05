import {
  buildClassFeatureRegistry,
  buildFeatRegistry,
  buildSpellRegistry,
  equipmentMagicItemTemplate,
  getFeat,
  getSpell,
  type ArchetypeDefinitionLike,
  type CharacterBuild,
  type ClassDefinition,
  type ClassFeatureRegistry,
  type DomainDefinition,
  type FeatRegistry,
  type MagicItemDefinition,
  type SchoolDefinition,
  type SpellDefinition,
  type SpellRegistry,
  type WeaponDefinition,
} from "@mathfinder/rules-engine";
import {
  buildRulesDataIndex,
  type BuildGuideDefinition,
  type RulesDataSet,
} from "@mathfinder/rules-data";

export interface RuntimeMundaneEquipmentDefinition {
  id: string;
  name: string;
  source?: string;
  sourceUrl?: string;
  categoryRaw?: string;
  costGp?: number;
  weightLb?: number;
  description?: string;
}

export interface RuntimeArmorDefinition {
  id: string;
  name: string;
  source?: string;
  sourceUrl?: string;
  categoryRaw?: string;
  categoryNormalized?: "light" | "medium" | "heavy" | "shield";
  armorBonus?: number;
  maxDexBonus?: number;
  armorCheckPenalty?: number;
  arcaneSpellFailure?: number;
  speed30?: number;
  speed20?: number;
  costGp?: number;
  weightLb?: number;
  description?: string;
}

interface UsableContentAsset {
  rulesDataSet: RulesDataSet;
  normalized?: {
    spells?: SpellDefinition[];
    armor?: RuntimeArmorDefinition[];
    mundaneEquipment?: RuntimeMundaneEquipmentDefinition[];
  };
}

function replaceRecord<T extends object>(target: T, source: T) {
  for (const key of Object.keys(target)) {
    delete (target as Record<string, unknown>)[key];
  }
  Object.assign(target, source);
}

function replaceArray<T>(target: T[], source: T[]) {
  target.splice(0, target.length, ...source);
}

export function raceOptionsFromDataSet(
  data: RulesDataSet,
): Record<string, CharacterBuild["race"]> {
  return Object.fromEntries(
    data.packs
      .flatMap((pack) => pack.races)
      .map((race) => [
        race.id,
        {
          name: race.name,
          size: race.size,
          speed: race.speed,
          abilityModifiers: race.abilityModifiers,
          traits: race.traits,
          classSkills: race.classSkills,
          weaponProficiencies: race.weaponProficiencies,
          specificWeaponProficiencies: race.specificWeaponProficiencies,
          grantedWeapons: race.grantedWeapons,
          choiceOptions: race.choiceOptions,
          alternateTraits: race.alternateTraits,
          movementModes: race.movementModes,
          senses: race.senses,
          resistances: race.resistances,
          notes: race.notes,
        },
      ]),
  );
}

export function runtimeContentAssetUrl(origin: string) {
  return new URL("/usable-content.json", origin).toString();
}

async function fetchUsableContentAsset(): Promise<UsableContentAsset> {
  const assetUrl = runtimeContentAssetUrl(window.location.origin);
  const response = await fetch(assetUrl, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(
      `Failed to load runtime content from ${assetUrl} (${response.status} ${response.statusText})`,
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `Runtime content at ${assetUrl} returned ${contentType || "an unknown content type"} instead of JSON`,
    );
  }
  return response.json() as Promise<UsableContentAsset>;
}

let loadPromise: Promise<void> | null = null;
export const RUNTIME_CLASSES: Record<string, ClassDefinition> = {};
export const RUNTIME_ARCHETYPES: Record<string, ArchetypeDefinitionLike> = {};
export const RUNTIME_ARCHETYPES_BY_CLASS: Record<
  string,
  ArchetypeDefinitionLike[]
> = {};
export const RUNTIME_CLASS_FEATURES: ClassFeatureRegistry = {};
export const RUNTIME_FEATS: FeatRegistry = {};
export const RUNTIME_SPELLS: SpellRegistry = {};
export const RUNTIME_RACES: Record<string, CharacterBuild["race"]> = {};
export const RUNTIME_CLASS_OPTIONS: ClassDefinition[] = [];
export const RUNTIME_ARCHETYPE_OPTIONS: ArchetypeDefinitionLike[] = [];
export const RUNTIME_WEAPONS: WeaponDefinition[] = [];
export const RUNTIME_MAGIC_ITEMS: MagicItemDefinition[] = [];
export const RUNTIME_ARMOR: RuntimeArmorDefinition[] = [];
export const RUNTIME_MUNDANE_EQUIPMENT: RuntimeMundaneEquipmentDefinition[] =
  [];
export const RUNTIME_DOMAINS: DomainDefinition[] = [];
export const RUNTIME_SCHOOLS: SchoolDefinition[] = [];
export const RUNTIME_RACE_OPTIONS: Array<[string, CharacterBuild["race"]]> = [];
export const RUNTIME_SPELL_OPTIONS: Array<{
  id: string;
  name: string;
  source?: string;
  sourceUrl?: string;
}> = [];
export const RUNTIME_BUILD_GUIDES: BuildGuideDefinition[] = [];

let runtimeRulesIndex: ReturnType<typeof buildRulesDataIndex> | null = null;

function safeName(value: { name?: string } | null | undefined) {
  return value?.name?.trim() ?? "";
}

function bySafeName<T extends { name?: string }>(a: T, b: T) {
  return safeName(a).localeCompare(safeName(b));
}

export async function loadRuntimeContent() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const usableContent = await fetchUsableContentAsset();
    const rulesData = usableContent.rulesDataSet;
    const rulesIndex = buildRulesDataIndex(rulesData);
    const sourceById = Object.fromEntries(
      rulesData.sources.map((source) => [source.id, source] as const),
    );
    const packById = Object.fromEntries(
      rulesData.packs.map((pack) => [pack.id, pack] as const),
    );
    const normalizedSpellById = new Map(
      (usableContent.normalized?.spells ?? []).map((spell) => [
        spell.id,
        spell,
      ]),
    );
    const normalizedSpellByName = new Map(
      (usableContent.normalized?.spells ?? []).map((spell) => [
        spell.name.trim().toLowerCase(),
        spell,
      ]),
    );
    const classes = Object.fromEntries(
      Object.values(rulesIndex.classes)
        .filter(
          (cls): cls is ClassDefinition =>
            !!cls && typeof cls.name === "string" && cls.name.trim().length > 0,
        )
        .map((cls) => [cls.name.toLowerCase(), cls]),
    ) as Record<string, ClassDefinition>;
    const races = raceOptionsFromDataSet(rulesData);
    const archetypes = rulesIndex.archetypes as Record<
      string,
      ArchetypeDefinitionLike
    >;
    const archetypesByClass = rulesIndex.archetypesByClass as Record<
      string,
      ArchetypeDefinitionLike[]
    >;
    const classFeatures = buildClassFeatureRegistry(
      ...rulesData.packs.map((pack) => pack.classFeatures),
    );
    const feats = buildFeatRegistry(
      ...rulesData.packs.map((pack) => pack.feats),
    );
    const spells = buildSpellRegistry(
      ...rulesData.packs.map((pack) =>
        pack.spells.map((spell) => {
          const packMeta = packById[spell.pack] ?? pack;
          const sourceMeta = sourceById[packMeta?.sourceId ?? pack.sourceId];
          const normalizedSpell =
            normalizedSpellById.get(spell.id) ??
            normalizedSpellByName.get(spell.name.trim().toLowerCase());
          return {
            ...normalizedSpell,
            ...spell,
            description: spell.description ?? normalizedSpell?.description,
            source:
              spell.source ??
              normalizedSpell?.source ??
              sourceMeta?.product ??
              sourceMeta?.name,
            sourceUrl: spell.sourceUrl ?? normalizedSpell?.sourceUrl,
          } satisfies SpellDefinition;
        }),
      ),
    );

    runtimeRulesIndex = rulesIndex;
    replaceRecord(RUNTIME_CLASSES, classes);
    replaceRecord(RUNTIME_ARCHETYPES, archetypes);
    replaceRecord(RUNTIME_ARCHETYPES_BY_CLASS, archetypesByClass);
    replaceRecord(RUNTIME_CLASS_FEATURES, classFeatures);
    replaceRecord(RUNTIME_FEATS, feats);
    replaceRecord(RUNTIME_SPELLS, spells);
    replaceRecord(RUNTIME_RACES, races);
    replaceArray(
      RUNTIME_CLASS_OPTIONS,
      Object.values(classes)
        .filter((entry) => !!safeName(entry))
        .sort(bySafeName),
    );
    replaceArray(
      RUNTIME_ARCHETYPE_OPTIONS,
      Object.values(archetypes)
        .filter((entry) => !!safeName(entry))
        .sort(bySafeName),
    );
    replaceArray(
      RUNTIME_WEAPONS,
      Object.values(rulesIndex.weapons)
        .filter((entry) => !!safeName(entry))
        .sort(bySafeName),
    );
    replaceArray(
      RUNTIME_MAGIC_ITEMS,
      Object.values(rulesIndex.magicItems)
        .filter((entry) => !!safeName(entry))
        .sort(bySafeName),
    );
    replaceArray(
      RUNTIME_ARMOR,
      [...(usableContent.normalized?.armor ?? [])]
        .filter((entry) => !!safeName(entry))
        .sort(bySafeName),
    );
    replaceArray(
      RUNTIME_MUNDANE_EQUIPMENT,
      [...(usableContent.normalized?.mundaneEquipment ?? [])]
        .filter((entry) => !!safeName(entry))
        .sort(bySafeName),
    );
    replaceArray(
      RUNTIME_DOMAINS,
      Object.values(rulesIndex.domains)
        .filter((entry) => !!safeName(entry))
        .sort(bySafeName),
    );
    replaceArray(
      RUNTIME_SCHOOLS,
      Object.values(rulesIndex.schools)
        .filter((entry) => !!safeName(entry))
        .sort(bySafeName),
    );
    replaceArray(
      RUNTIME_RACE_OPTIONS,
      Object.entries(races)
        .filter((entry) => !!safeName(entry[1]))
        .sort((a, b) => bySafeName(a[1], b[1])),
    );
    replaceArray(
      RUNTIME_SPELL_OPTIONS,
      Object.values(spells)
        .filter((entry) => !!safeName(entry))
        .sort(bySafeName),
    );
    replaceArray(
      RUNTIME_BUILD_GUIDES,
      Object.values(rulesIndex.buildGuides)
        .filter((entry) => !!safeName(entry))
        .sort(bySafeName),
    );
  })();
  return loadPromise;
}

function requireRulesIndex() {
  if (!runtimeRulesIndex) throw new Error("Runtime content not loaded");
  return runtimeRulesIndex;
}

export function getRuntimeMagicItem(id: string) {
  return requireRulesIndex().magicItems[id.toLowerCase()];
}

export function getRuntimeDomain(id: string) {
  return requireRulesIndex().domains[id.toLowerCase()];
}

export function getRuntimeSchool(id: string | undefined) {
  return id ? requireRulesIndex().schools[id.toLowerCase()] : undefined;
}

export function getRuntimeFeat(name: string) {
  return getFeat(RUNTIME_FEATS, name);
}

export function getRuntimeSpell(name: string) {
  return getSpell(RUNTIME_SPELLS, name);
}

export { equipmentMagicItemTemplate };
