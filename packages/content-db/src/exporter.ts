import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import {
  validateRulesDataSet,
  type ArchetypeDefinition,
  type RaceDefinition,
  type RulesDataSet,
  type RulesPack,
} from "@mathfinder/rules-data";
import {
  buildScrapedArmorRecords,
  type NormalizedArmorRecord,
} from "./armor-normalization";
import {
  buildScrapedGearRecords,
  type NormalizedMundaneEquipmentRecord,
} from "./gear-normalization";
import {
  extractStructuredModifiers,
  deriveMagicItemAutomation,
} from "./rich-mapping";
import {
  SKILL_DEFINITIONS,
  type ClassDefinition,
  type ClassFeatureDefinition,
  type DomainDefinition,
  type FeatDefinition,
  type MagicItemDefinition,
  type Modifier,
  type Prerequisite,
  type SchoolDefinition,
  type SkillDefinition,
  type SkillKey,
  type Size,
  type SpellDefinition,
  type SpellEffectDefinition,
  type WeaponDefinition,
} from "@mathfinder/rules-engine";
import type {
  ContentEntityKind,
  ParsedScrapedArchetype,
  ParsedScrapedClassFeature,
  ParsedScrapedFeat,
  ParsedScrapedMagicItem,
  ParsedScrapedRace,
  ParsedScrapedRaceTrait,
  ParsedScrapedSpell,
  ParsedScrapedWeapon,
} from "./types";

const CONTENT_KINDS: readonly ContentEntityKind[] = [
  "class",
  "archetype",
  "class-feature",
  "feat",
  "race",
  "skill",
  "spell",
  "weapon",
  "armor",
  "gear",
  "magic-item",
  "domain",
  "school",
  "spell-effect",
] as const;

interface EntityExportRow {
  kind: ContentEntityKind;
  entityId: string;
  name: string;
  packId?: string;
  origin: "seed" | "scrape";
  externalSource?: string;
  sourceUrl?: string;
  sourcePage?: number;
  importedAt: string;
  updatedAt: string;
  payload: unknown;
}

interface ExportSummary {
  total: number;
  byKind: Record<ContentEntityKind, number>;
  byOrigin: Record<"seed" | "scrape", number>;
}

interface DbPackMeta {
  id: string;
  name: string;
  enabledByDefault: boolean;
  sourceId: string;
  version: string;
}

interface DbSourceMeta {
  id: string;
  name: string;
  publisher: string;
  product?: string;
  type: "first-party" | "owner-authored";
  license: "prdofficial" | "ogl" | "owner-approved" | "unknown";
  notes?: string;
}

function createRulesPack(
  base: Pick<
    RulesPack,
    "id" | "name" | "enabledByDefault" | "sourceId" | "version"
  >,
): RulesPack {
  return {
    ...base,
    classes: [],
    archetypes: [],
    bloodlines: [],
    kineticistElements: [],
    phantomEmotionalFocuses: [],
    eidolonSubtypes: [],
    hexes: [],
    blessings: [],
    trapOptions: [],
    buildGuides: [],
    classFeatures: [],
    feats: [],
    races: [],
    skills: [],
    spells: [],
    weapons: [],
    magicItems: [],
    domains: [],
    schools: [],
    spellEffects: [],
  };
}

interface QaIssueSample {
  entityId: string;
  name: string;
  sourceUrl?: string;
  detail?: string;
}

export interface ParserQaReport {
  generatedAt: string;
  totals: {
    scrapedSpells: number;
    scrapedFeats: number;
    scrapedMagicItems: number;
    scrapedClassFeatures: number;
  };
  issues: {
    spellsMissingSchool: { count: number; samples: QaIssueSample[] };
    spellsMissingClasses: { count: number; samples: QaIssueSample[] };
    spellsSuspiciousDescription: { count: number; samples: QaIssueSample[] };
    featsSuspiciousDescription: { count: number; samples: QaIssueSample[] };
    magicItemsSuspiciousDescription: {
      count: number;
      samples: QaIssueSample[];
    };
    classFeaturesMissingLevels: { count: number; samples: QaIssueSample[] };
  };
}

export interface NormalizedMagicItemRecord {
  id: string;
  name: string;
  pack: string;
  source?: string;
  sourceUrl?: string;
  sourcePage?: number;
  costGp?: number;
  weightLb?: number;
  slotRaw?: string;
  slotNormalized?: string;
  aura?: string;
  casterLevel?: number;
  tags: string[];
  description?: string;
  engineCompatible: boolean;
  engineItem?: MagicItemDefinition;
}

export interface UsableContentExport {
  schemaVersion: string;
  generatedAt: string;
  summary: ExportSummary;
  normalized: {
    classes: ClassDefinition[];
    archetypes: ArchetypeDefinition[];
    classFeatures: ClassFeatureDefinition[];
    feats: FeatDefinition[];
    races: RaceDefinition[];
    skills: SkillDefinition[];
    spells: SpellDefinition[];
    weapons: WeaponDefinition[];
    armor: NormalizedArmorRecord[];
    mundaneEquipment: NormalizedMundaneEquipmentRecord[];
    magicItems: NormalizedMagicItemRecord[];
    domains: DomainDefinition[];
    schools: SchoolDefinition[];
    spellEffects: SpellEffectDefinition[];
  };
  rulesDataSet: RulesDataSet;
  notes: string[];
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanText(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function ensureDirectory(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath: string, value: unknown) {
  ensureDirectory(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function defaultWebUsableContentMirrorPath() {
  return path.resolve(
    process.cwd(),
    "..",
    "..",
    "apps",
    "web",
    "public",
    "usable-content.json",
  );
}

function selectEntities(db: Database.Database) {
  return db
    .prepare(
      `
    SELECT
      kind,
      entity_id as entityId,
      name,
      pack_id as packId,
      origin,
      external_source as externalSource,
      source_url as sourceUrl,
      source_page as sourcePage,
      imported_at as importedAt,
      updated_at as updatedAt,
      payload_json as payloadJson
    FROM content_entities
    ORDER BY kind, name, entity_id
  `,
    )
    .all() as Array<Omit<EntityExportRow, "payload"> & { payloadJson: string }>;
}

function parseRows(
  rows: Array<Omit<EntityExportRow, "payload"> & { payloadJson: string }>,
): EntityExportRow[] {
  return rows.map(({ payloadJson, ...row }) => ({
    ...row,
    payload: JSON.parse(payloadJson),
  }));
}

function summarize(rows: EntityExportRow[]): ExportSummary {
  const byKind = Object.fromEntries(
    CONTENT_KINDS.map((kind) => [kind, 0]),
  ) as Record<ContentEntityKind, number>;
  const byOrigin: Record<"seed" | "scrape", number> = { seed: 0, scrape: 0 };
  for (const row of rows) {
    byKind[row.kind] += 1;
    byOrigin[row.origin] += 1;
  }
  return { total: rows.length, byKind, byOrigin };
}

function selectPackMeta(db: Database.Database) {
  return db
    .prepare(
      `
    SELECT id, name, enabled_by_default as enabledByDefault, source_id as sourceId, version
    FROM rules_packs
    ORDER BY id
  `,
    )
    .all() as Array<{
    id: string;
    name: string;
    enabledByDefault: number;
    sourceId: string;
    version: string;
  }>;
}

function selectSourceMeta(db: Database.Database) {
  return db
    .prepare(
      `
    SELECT id, name, publisher, product, type, license, notes
    FROM content_sources
    ORDER BY id
  `,
    )
    .all() as DbSourceMeta[];
}

export function exportContentEntitiesJson(
  db: Database.Database,
  filePath: string,
) {
  const rows = parseRows(selectEntities(db));
  const grouped = Object.fromEntries(
    CONTENT_KINDS.map((kind) => [
      kind,
      rows.filter((row) => row.kind === kind),
    ]),
  ) as Record<ContentEntityKind, EntityExportRow[]>;
  const output = {
    schemaVersion: "0.1.0",
    generatedAt: new Date().toISOString(),
    summary: summarize(rows),
    entities: grouped,
  };
  writeJson(filePath, output);
  return output.summary;
}

function dedupeByName<T extends { name: string }>(items: T[]) {
  return dedupeByKey(items, (item) => item.name.trim().toLowerCase());
}

function qaSamples<T extends EntityExportRow>(
  rows: T[],
  detail: (row: T) => string | undefined,
  limit = 10,
): QaIssueSample[] {
  return rows.slice(0, limit).map((row) => ({
    entityId: row.entityId,
    name: row.name,
    sourceUrl: row.sourceUrl,
    detail: detail(row),
  }));
}

function dedupeByKey<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = getKey(item).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function parseGp(raw: string | undefined) {
  const match = cleanText(raw)
    .replace(/,/g, "")
    .match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : undefined;
}

function parseWeightLb(raw: string | undefined) {
  const text = cleanText(raw).toLowerCase();
  if (!text || text === "—") return undefined;
  const lbMatch = text.match(/(\d+(?:\.\d+)?)\s*lbs?\.?/);
  if (lbMatch) return Number(lbMatch[1]);
  const ozMatch = text.match(/(\d+(?:\.\d+)?)\s*oz\.?/);
  if (ozMatch) return Number(ozMatch[1]) / 16;
  return undefined;
}

function parseCasterLevel(raw: string | undefined) {
  const match = cleanText(raw).match(/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function normalizeSchool(raw: string | undefined) {
  const text = cleanText(raw).toLowerCase();
  return text || undefined;
}

function parseSpellClasses(levelText: string | undefined) {
  const text = cleanText(levelText);
  if (!text) return [];
  const results: SpellDefinition["classes"] = [];
  for (const part of text
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    const match = part.match(/^(.+?)\s+(\d+)(?:\s*\([^)]*\))?$/);
    if (!match) continue;
    const classesRaw = (match[1] ?? "").replace(/\([^)]*\)/g, "").trim();
    const level = Number(match[2]);
    for (const className of classesRaw
      .split("/")
      .map((name) => name.trim())
      .filter(Boolean)) {
      results.push({ className: className.toLowerCase(), level });
    }
  }
  return results;
}

function parseCritRange(raw: string | undefined) {
  const text = cleanText(raw);
  const rangeMatch = text.match(/(\d+)\s*[-–]\s*20/i);
  if (rangeMatch) return Number(rangeMatch[1]);
  return undefined;
}

function parseCritMultiplier(raw: string | undefined) {
  const text = cleanText(raw);
  const match = text.match(/x(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

function parseRangeFeet(raw: string | undefined) {
  const match = cleanText(raw).match(/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function parseRaceSize(raw: string | undefined): Size | undefined {
  const text = cleanText(raw).toLowerCase();
  const allowed: Size[] = [
    "fine",
    "diminutive",
    "tiny",
    "small",
    "medium",
    "large",
    "huge",
    "gargantuan",
    "colossal",
  ];
  return allowed.find((size) => size === text);
}

function parseRaceSpeed(raw: string | undefined) {
  const text = cleanText(raw).toLowerCase();
  const match = text.match(/base speed of (\d+) feet|(\d+) feet/);
  return match ? Number(match[1] ?? match[2]) : undefined;
}

function parseRaceAbilityModifiers(
  raw: string | undefined,
  raceName: string,
): Modifier[] {
  const text = cleanText(raw).replace(/[–—−]/g, "-");
  if (!text) return [];
  if (/to one ability score/i.test(text)) return [];
  const out: Modifier[] = [];
  const regex =
    /([+-]\d+)\s*(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/gi;
  const abilityMap = {
    strength: "str",
    dexterity: "dex",
    constitution: "con",
    intelligence: "int",
    wisdom: "wis",
    charisma: "cha",
  } as const;
  for (const match of text.matchAll(regex)) {
    const value = Number(match[1]);
    const abilityName = match[2]?.toLowerCase();
    const ability = abilityName
      ? abilityMap[abilityName as keyof typeof abilityMap]
      : undefined;
    if (!ability || !Number.isFinite(value)) continue;
    out.push({
      target: ability,
      type: "racial",
      value,
      source: raceName,
      pack: "aon-scraped-races",
    });
  }
  return out;
}

const SKILL_NAME_TO_KEY = new Map<string, SkillKey>([
  ...SKILL_DEFINITIONS.map(
    (skill) => [skill.name.toLowerCase(), skill.key] as const,
  ),
  ["sleight of hand", "sleight-of-hand"],
  ["disable device", "disable-device"],
  ["escape artist", "escape-artist"],
  ["handle animal", "handle-animal"],
  ["sense motive", "sense-motive"],
  ["use magic device", "use-magic-device"],
]);

function normalizeSkillMention(text: string) {
  return text.toLowerCase().replace(/[()]/g, "").replace(/\s+/g, " ").trim();
}

function extractMentionedSkills(text: string): SkillKey[] {
  const normalized = normalizeSkillMention(text);
  const matches: SkillKey[] = [];
  for (const [name, key] of SKILL_NAME_TO_KEY.entries()) {
    const bare = normalizeSkillMention(name);
    if (normalized.includes(bare)) matches.push(key);
  }
  return [...new Set(matches)];
}

function modifierFromTraitText(
  raceName: string,
  traitName: string,
  text: string,
): Modifier[] {
  const normalized = cleanText(text).replace(/[–—−]/g, "-");
  if (!normalized) return [];
  const source = `${raceName}: ${traitName}`;
  if (
    /\bagainst\b|\bwhile\b|\bwhen\b|\bonce per day\b|\bcharge\b|\brun\b|\bwithdraw\b|\btrip\b|\bgrapple\b|\bpoison\b|\bfear\b|\billusion\b|\benchantment\b|\bspell-like\b/i.test(
      normalized,
    )
  )
    return [];

  const skillMatch = normalized.match(
    /([+-]?\d+)\s+racial bonus on\s+(.+?)\s+checks/i,
  );
  if (skillMatch) {
    const value = Number(skillMatch[1]);
    const skills = extractMentionedSkills(skillMatch[2] ?? "");
    return skills.map((skill) => ({
      target: `skill.${skill}` as const,
      type: "racial",
      value,
      source,
      pack: "aon-scraped-races",
    }));
  }

  const initMatch = normalized.match(
    /([+-]?\d+)\s+racial bonus on initiative checks/i,
  );
  if (initMatch) {
    return [
      {
        target: "init",
        type: "racial",
        value: Number(initMatch[1]),
        source,
        pack: "aon-scraped-races",
      },
    ];
  }

  const acMatch = normalized.match(/([+-]?\d+)\s+dodge bonus to AC\b/i);
  if (acMatch) {
    return [
      {
        target: "ac",
        type: "dodge",
        value: Number(acMatch[1]),
        source,
        pack: "aon-scraped-races",
      },
    ];
  }

  const allSaveMatch = normalized.match(
    /([+-]?\d+)\s+racial bonus on all saving throws/i,
  );
  if (allSaveMatch) {
    return [
      {
        target: "save.all",
        type: "racial",
        value: Number(allSaveMatch[1]),
        source,
        pack: "aon-scraped-races",
      },
    ];
  }

  const singleSaveMatch = normalized.match(
    /([+-]?\d+)\s+racial bonus on (Fortitude|Reflex|Will) saving throws/i,
  );
  if (singleSaveMatch) {
    const targetMap = {
      fortitude: "save.fort",
      reflex: "save.ref",
      will: "save.will",
    } as const;
    const saveName = singleSaveMatch[2]?.toLowerCase();
    const target = saveName
      ? targetMap[saveName as keyof typeof targetMap]
      : undefined;
    return target
      ? [
          {
            target,
            type: "racial",
            value: Number(singleSaveMatch[1]),
            source,
            pack: "aon-scraped-races",
          },
        ]
      : [];
  }

  return [];
}

function classSkillsFromText(text: string): SkillKey[] {
  const normalized = cleanText(text);
  if (!/class skill/i.test(normalized)) return [];
  return extractMentionedSkills(normalized);
}

function mergeMovementModes(
  ...sets: Array<Partial<Record<"swim" | "climb" | "fly" | "burrow", number>>>
) {
  const out: Partial<Record<"swim" | "climb" | "fly" | "burrow", number>> = {};
  for (const set of sets) {
    for (const [mode, value] of Object.entries(set)) {
      if (typeof value === "number" && Number.isFinite(value))
        out[mode as keyof typeof out] = value;
    }
  }
  return out;
}

function movementModesFromText(text: string | undefined) {
  const normalized = cleanText(text).replace(/[–—−]/g, "-");
  const out: Partial<Record<"swim" | "climb" | "fly" | "burrow", number>> = {};
  for (const match of normalized.matchAll(
    /\b(swim|climb|fly|burrow) speed(?: of)? (\d+) feet\b/gi,
  )) {
    const mode = match[1]?.toLowerCase() as keyof typeof out | undefined;
    const speed = Number(match[2]);
    if (mode && Number.isFinite(speed)) out[mode] = speed;
  }
  return out;
}

function sensesFromTraits(entries: ParsedScrapedRaceTrait[] | undefined) {
  const senses: { darkvisionFeet?: number; lowLightVision?: boolean } = {};
  for (const entry of entries ?? []) {
    const label = cleanText(entry.name).toLowerCase();
    const text = cleanText(entry.text);
    if (label === "darkvision") {
      const match = text.match(/(\d+) feet/i);
      senses.darkvisionFeet = match
        ? Number(match[1])
        : (senses.darkvisionFeet ?? 60);
    }
    if (
      label === "low-light vision" ||
      /can see twice as far as humans in conditions of dim light/i.test(text)
    ) {
      senses.lowLightVision = true;
    }
  }
  return senses;
}

function resistancesFromTraits(entries: ParsedScrapedRaceTrait[] | undefined) {
  const out: Partial<
    Record<"acid" | "cold" | "electricity" | "fire" | "sonic", number>
  > = {};
  for (const entry of entries ?? []) {
    const text = cleanText(entry.text).toLowerCase();
    for (const match of text.matchAll(
      /\b(acid|cold|electricity|fire|sonic) resistance (\d+)\b/g,
    )) {
      const energy = match[1] as keyof typeof out;
      const value = Number(match[2]);
      if (Number.isFinite(value)) out[energy] = value;
    }
  }
  return out;
}

function noteFromTraitEntry(entry: ParsedScrapedRaceTrait) {
  const text = cleanText(entry.text);
  return text ? `${entry.name}: ${text}` : entry.name;
}

function parseRaceTraitsAndClassSkills(
  raceName: string,
  payload: ParsedScrapedRace,
) {
  const traits: Modifier[] = [];
  const classSkills = new Set<SkillKey>();
  const notes: string[] = [];
  const traitEntries = payload.traitEntries ?? [];
  for (const entry of traitEntries) {
    if (!entry.text) {
      notes.push(noteFromTraitEntry(entry));
      continue;
    }
    const mappedTraits = modifierFromTraitText(
      raceName,
      entry.name,
      entry.text,
    );
    traits.push(...mappedTraits);
    for (const skill of classSkillsFromText(entry.text)) classSkills.add(skill);
    const shouldKeepAsNote =
      mappedTraits.length === 0 ||
      /(bonus feat|additional skill rank|skill focus|immune|immunity|spell-like ability|energy resistance|darkvision|low-light vision|swim speed|climb speed|fly speed|burrow speed|natural attacks?|weapon familiarity)/i.test(
        entry.text,
      );
    if (shouldKeepAsNote) notes.push(noteFromTraitEntry(entry));
  }
  if (payload.speedText) {
    for (const skill of classSkillsFromText(payload.speedText))
      classSkills.add(skill);
  }
  if (payload.languages) {
    for (const skill of classSkillsFromText(payload.languages))
      classSkills.add(skill);
  }
  return {
    traits: dedupeByKey(
      traits,
      (modifier) =>
        `${modifier.target}|${modifier.type}|${modifier.value}|${modifier.source}|${modifier.condition ?? ""}`,
    ),
    classSkills: [...classSkills].sort(),
    movementModes: mergeMovementModes(
      movementModesFromText(payload.speedText),
      ...traitEntries.map((entry) => movementModesFromText(entry.text)),
    ),
    senses: sensesFromTraits(traitEntries),
    resistances: resistancesFromTraits(traitEntries),
    notes: dedupeByKey(notes.filter(Boolean), (note) => note.toLowerCase()),
  };
}

function buildScrapedRaces(rows: EntityExportRow[]) {
  const items: RaceDefinition[] = [];
  for (const row of rows) {
    if (row.kind !== "race" || row.origin !== "scrape") continue;
    const payload = row.payload as ParsedScrapedRace;
    const urlName = row.sourceUrl
      ? cleanText(
          decodeURIComponent(
            new URL(row.sourceUrl).searchParams
              .get("ItemName")
              ?.replace(/\+/g, " ") ?? "",
          ),
        )
      : "";
    const name = cleanText(urlName || payload.name || row.name);
    const size = parseRaceSize(payload.size);
    const speed = parseRaceSpeed(payload.speedText);
    const favoredClassBonuses = (payload.favoredClassBonuses ?? []).map(
      (bonus, index) => ({
        id: `aon-${slug(name)}-${slug(bonus.className)}-${index + 1}`,
        className: bonus.className,
        label:
          bonus.description.length <= 90
            ? bonus.description
            : `${bonus.description.slice(0, 87).trimEnd()}…`,
        description: bonus.description,
        source: bonus.sources?.join("; "),
        sourceUrl: payload.sourceUrl,
        automationStatus: "manual" as const,
      }),
    );
    if (!name || ((!size || !speed) && favoredClassBonuses.length === 0))
      continue;
    const mapped = parseRaceTraitsAndClassSkills(name, payload);
    items.push({
      id: row.entityId || slug(name),
      name,
      pack: "aon-scraped-races",
      size: size ?? "medium",
      speed: speed ?? 30,
      abilityModifiers: parseRaceAbilityModifiers(
        payload.abilityScoreText,
        name,
      ),
      traits: mapped.traits,
      classSkills: mapped.classSkills,
      movementModes:
        Object.keys(mapped.movementModes).length > 0
          ? mapped.movementModes
          : undefined,
      senses:
        mapped.senses.darkvisionFeet || mapped.senses.lowLightVision
          ? mapped.senses
          : undefined,
      resistances:
        Object.keys(mapped.resistances).length > 0
          ? mapped.resistances
          : undefined,
      favoredClassBonuses,
      notes: mapped.notes.length > 0 ? mapped.notes : undefined,
    });
  }
  return dedupeByName(items);
}

function parseDamageTypes(
  raw: string | undefined,
): WeaponDefinition["damageTypes"] {
  const text = cleanText(raw).toUpperCase();
  if (!text || text === "—") return undefined;
  const out: WeaponDefinition["damageTypes"] = [];
  if (text.includes("B")) out.push("bludgeoning");
  if (text.includes("P")) out.push("piercing");
  if (text.includes("S")) out.push("slashing");
  return out.length > 0 ? out : undefined;
}

function parseSpecialTags(raw: string | undefined) {
  const text = cleanText(raw);
  if (!text || text === "—") return undefined;
  const tags = text
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

function parseWeaponCategory(
  raw: string | undefined,
): WeaponDefinition["category"] {
  return cleanText(raw).toLowerCase().includes("ranged") ? "ranged" : "melee";
}

function parseProficiencyGroup(
  raw: string | undefined,
): WeaponDefinition["proficiencyGroup"] {
  const text = cleanText(raw).toLowerCase();
  if (text.includes("simple")) return "simple";
  if (text.includes("martial")) return "martial";
  if (text.includes("exotic")) return "exotic";
  return undefined;
}

function normalizeMagicItemSlot(
  raw: string | undefined,
): MagicItemDefinition["slot"] {
  const text = cleanText(raw).toLowerCase();
  if (!text || text === "none" || text === "slotless") return "slotless";
  if (text.includes("ring")) return "ring";
  if (text.includes("belt")) return "belt";
  if (text.includes("body")) return "body";
  if (text.includes("chest")) return "chest";
  if (text.includes("eyes")) return "eyes";
  if (text.includes("feet")) return "feet";
  if (text.includes("hands")) return "hands";
  if (text.includes("headband") || text.includes("head")) return "head";
  if (text.includes("neck")) return "neck";
  if (text.includes("shoulders")) return "shoulders";
  if (text.includes("torso")) return "torso";
  if (text.includes("wrist")) return "wrists";
  if (
    text.includes("ioun") ||
    text.includes("rod") ||
    text.includes("staff") ||
    text.includes("other")
  )
    return "slotless";
  return "slotless";
}

function parseFeatPrereqsInternal(
  raw: string | undefined,
  knownFeatNames: Iterable<string> = [],
): Prerequisite[] {
  if (!raw) return [];
  const known = new Map<string, string>();
  for (const featName of knownFeatNames)
    known.set(featName.toLowerCase(), featName);
  const prereqs: Prerequisite[] = [];
  const seen = new Set<string>();
  const parts = raw
    .replace(/[.;]+/g, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const cleaned = part.replace(/^and\s+/i, "").trim();
    const abilityMatch = cleaned.match(/^(Str|Dex|Con|Int|Wis|Cha)\s+(\d+)$/i);
    if (abilityMatch) {
      const rawAbility = abilityMatch[1] ?? "";
      const ability = rawAbility.toLowerCase() as Prerequisite["ability"];
      const min = Number(abilityMatch[2]);
      const key = `ability:${ability}:${min}`;
      if (!seen.has(key)) {
        seen.add(key);
        prereqs.push({
          type: "ability",
          ability,
          min,
          description: `${rawAbility.charAt(0).toUpperCase()}${rawAbility.slice(1).toLowerCase()} ${min}`,
        });
      }
      continue;
    }

    const babMatch = cleaned.match(/^(?:base attack bonus|bab)\s*\+?(\d+)$/i);
    if (babMatch) {
      const min = Number(babMatch[1]);
      const key = `bab:${min}`;
      if (!seen.has(key)) {
        seen.add(key);
        prereqs.push({ type: "bab", min, description: `BAB +${min}` });
      }
      continue;
    }

    const levelMatch = cleaned.match(
      /^(?:(\d+)(?:st|nd|rd|th)? level|character level\s+(\d+))$/i,
    );
    if (levelMatch) {
      const min = Number(levelMatch[1] ?? levelMatch[2]);
      const key = `character-level:${min}`;
      if (!seen.has(key)) {
        seen.add(key);
        prereqs.push({
          type: "character-level",
          min,
          description: `Character level ${min}`,
        });
      }
      continue;
    }

    const featName = known.get(cleaned.toLowerCase());
    if (featName) {
      const key = `feat:${featName.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        prereqs.push({ type: "feat", featName, description: featName });
      }
    }
  }

  return prereqs;
}

export function parseFeatPrerequisites(
  raw: string | undefined,
  knownFeatNames: Iterable<string> = [],
) {
  return parseFeatPrereqsInternal(raw, knownFeatNames);
}

function buildSeedPackMap(
  rows: EntityExportRow[],
  packMetaById: Map<string, DbPackMeta>,
) {
  const packs = new Map<string, RulesDataSet["packs"][number]>();
  for (const row of rows.filter(
    (entry) => entry.origin === "seed" && entry.packId,
  )) {
    const meta = packMetaById.get(row.packId!);
    if (!meta) continue;
    const current =
      packs.get(meta.id) ??
      createRulesPack({
        id: meta.id,
        name: meta.name,
        enabledByDefault: meta.enabledByDefault,
        sourceId: meta.sourceId,
        version: meta.version,
      });
    if (row.kind === "class")
      current.classes.push(row.payload as ClassDefinition);
    else if (row.kind === "archetype")
      current.archetypes.push(row.payload as ArchetypeDefinition);
    else if (row.kind === "class-feature")
      current.classFeatures.push(row.payload as ClassFeatureDefinition);
    else if (row.kind === "feat")
      current.feats.push(row.payload as FeatDefinition);
    else if (row.kind === "race")
      current.races.push(row.payload as RaceDefinition);
    else if (row.kind === "skill")
      current.skills.push(row.payload as SkillDefinition);
    else if (row.kind === "spell")
      current.spells.push(row.payload as SpellDefinition);
    else if (row.kind === "weapon")
      current.weapons.push(row.payload as WeaponDefinition);
    else if (row.kind === "magic-item")
      current.magicItems.push(row.payload as MagicItemDefinition);
    else if (row.kind === "domain")
      current.domains.push(row.payload as DomainDefinition);
    else if (row.kind === "school")
      current.schools.push(row.payload as SchoolDefinition);
    else if (row.kind === "spell-effect")
      current.spellEffects.push(row.payload as SpellEffectDefinition);
    packs.set(meta.id, current);
  }
  return [...packs.values()];
}

function buildScrapedArchetypes(rows: EntityExportRow[]) {
  return dedupeByKey(
    rows
      .filter((row) => row.kind === "archetype" && row.origin === "scrape")
      .map((row) => {
        const payload = row.payload as ParsedScrapedArchetype;
        const name = payload.name || row.name;
        return {
          id: `${slug(payload.baseClassName)}-${slug(name)}`,
          name,
          pack: "aon-scraped-archetypes",
          baseClassName: payload.baseClassName,
          description: payload.description,
          replaces: payload.replaces,
          alters: payload.alters,
          features: payload.features.map((feature) => ({
            level: feature.level,
            name: feature.name,
            summary: feature.summary,
          })),
          notes: [
            `Source: ${payload.source || "Archives of Nethys"}`,
            `Reference: ${row.sourceUrl || payload.sourceUrl}`,
          ],
        } satisfies ArchetypeDefinition;
      })
      .filter(
        (archetype) =>
          cleanText(archetype.name).length > 0 &&
          cleanText(archetype.baseClassName).length > 0,
      ),
    (archetype) =>
      `${archetype.baseClassName.toLowerCase()}:${archetype.name.toLowerCase()}`,
  );
}

function buildScrapedFeats(rows: EntityExportRow[]) {
  const featRows = rows
    .filter((row) => row.kind === "feat" && row.origin === "scrape")
    .map((row) => ({
      row,
      payload: row.payload as ParsedScrapedFeat,
    }));
  const featNames = featRows
    .map(({ row, payload }) => payload.name || row.name)
    .filter(Boolean);
  return dedupeByName(
    featRows
      .map(({ row, payload }) => {
        const name = payload.name || row.name;
        const description =
          payload.benefit || payload.description || payload.special || "";
        const tags = cleanText(payload.category)
          .split(/\s*[,/;]\s*/)
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean);
        return {
          id: row.entityId || slug(name),
          name,
          pack: "aon-scraped-feats",
          description,
          tags: tags.length > 0 ? tags : undefined,
          prerequisites: parseFeatPrereqsInternal(
            payload.prerequisites,
            featNames,
          ),
          effects: extractStructuredModifiers(
            [payload.benefit, payload.description, payload.special]
              .filter(Boolean)
              .join(" "),
            name,
            "aon-scraped-feats",
          ),
        };
      })
      .filter((feat) => cleanText(feat.name).length > 0),
  );
}

function buildScrapedSpells(rows: EntityExportRow[]) {
  return dedupeByName(
    rows
      .filter((row) => row.kind === "spell" && row.origin === "scrape")
      .map((row) => {
        const payload = row.payload as ParsedScrapedSpell;
        return {
          id: row.entityId || slug(payload.name || row.name),
          name: payload.name || row.name,
          pack: "aon-scraped-spells",
          school: normalizeSchool(payload.school),
          classes: parseSpellClasses(payload.levelText),
          description: payload.description || undefined,
          source: payload.source || "Archives of Nethys",
          sourceUrl: row.sourceUrl,
        } satisfies SpellDefinition;
      })
      .filter((spell) => cleanText(spell.name).length > 0),
  );
}

function buildScrapedWeapons(rows: EntityExportRow[]) {
  return dedupeByName(
    rows
      .filter((row) => row.kind === "weapon" && row.origin === "scrape")
      .map((row) => {
        const payload = row.payload as ParsedScrapedWeapon;
        return {
          id: row.entityId || slug(payload.name || row.name),
          name: payload.name || row.name,
          category: parseWeaponCategory(payload.category),
          proficiencyGroup: parseProficiencyGroup(payload.proficiency),
          damageDice:
            cleanText(payload.damageMedium || payload.damageSmall) || "1d6",
          critRange: parseCritRange(payload.critical),
          critMultiplier: parseCritMultiplier(payload.critical),
          rangeIncrementFeet: parseRangeFeet(payload.range),
          damageTypes: parseDamageTypes(payload.type),
          specialTags: parseSpecialTags(payload.special),
          weightLb: parseWeightLb(payload.weight) ?? 0,
          costGp: parseGp(payload.cost) ?? 0,
        } satisfies WeaponDefinition;
      })
      .filter((weapon) => cleanText(weapon.name).length > 0),
  );
}

function buildScrapedClassFeatures(rows: EntityExportRow[]) {
  const features: ClassFeatureDefinition[] = [];
  for (const row of rows.filter(
    (entry) => entry.kind === "class-feature" && entry.origin === "scrape",
  )) {
    const payload = row.payload as ParsedScrapedClassFeature;
    const levels = payload.levels?.length ? payload.levels : [0];
    for (const level of levels) {
      const name = payload.name || row.name;
      features.push({
        id: `${row.entityId || slug(payload.className)}-l${level}`,
        name,
        className: cleanText(payload.className).toLowerCase(),
        level,
        pack: "aon-scraped-class-features",
        description: payload.description || "",
        effects: extractStructuredModifiers(
          payload.description,
          `${cleanText(payload.className)}: ${name}`,
          "aon-scraped-class-features",
        ),
      });
    }
  }
  return dedupeByName(
    features.map((feature) => ({
      ...feature,
      name: `${feature.className}:${feature.level}:${feature.name}`,
    })),
  ).map((feature) => ({
    ...feature,
    name: feature.name.split(":").slice(2).join(":"),
  }));
}

function buildScrapedMagicItems(rows: EntityExportRow[]) {
  const items: NormalizedMagicItemRecord[] = [];
  for (const row of rows.filter(
    (entry) => entry.kind === "magic-item" && entry.origin === "scrape",
  )) {
    const payload = row.payload as ParsedScrapedMagicItem & {
      magicItemType?: string;
      slotPage?: string;
    };
    const slotRaw = payload.slot ?? payload.slotPage;
    const slotNormalized = normalizeMagicItemSlot(slotRaw);
    const tags = [payload.magicItemType, payload.slotPage]
      .map((tag) => cleanText(tag))
      .filter(Boolean);
    const automation = deriveMagicItemAutomation(
      payload.name || row.name,
      row.sourceUrl,
      payload.description,
      "aon-scraped-magic-items",
    );
    const engineItem = {
      id: row.entityId || slug(payload.name || row.name),
      name: payload.name || row.name,
      slot: slotNormalized,
      weightLb: parseWeightLb(payload.weight) ?? 0,
      costGp: parseGp(payload.price) ?? 0,
      modifiers: automation.modifiers,
      source: payload.source || "AoN scrape",
      sourcePage: row.sourcePage,
      casterLevel: parseCasterLevel(payload.cl),
      aura: payload.aura,
      tags,
      rulesText: payload.description,
      automation: automation.automation,
      upgradeGroup: automation.upgradeGroup,
      upgradeTier: automation.upgradeTier,
    } satisfies MagicItemDefinition;
    items.push({
      id: row.entityId || slug(payload.name || row.name),
      name: payload.name || row.name,
      pack: "aon-scraped-magic-items",
      source: payload.source,
      sourceUrl: row.sourceUrl,
      sourcePage: row.sourcePage,
      costGp: parseGp(payload.price),
      weightLb: parseWeightLb(payload.weight),
      slotRaw,
      slotNormalized,
      aura: payload.aura,
      casterLevel: parseCasterLevel(payload.cl),
      tags,
      description: payload.description,
      engineCompatible: true,
      engineItem,
    });
  }
  return dedupeByName(items);
}

function buildNormalizedFromRows(rows: EntityExportRow[]) {
  const seed = {
    classes: rows
      .filter((row) => row.origin === "seed" && row.kind === "class")
      .map((row) => row.payload as ClassDefinition),
    archetypes: rows
      .filter((row) => row.origin === "seed" && row.kind === "archetype")
      .map((row) => row.payload as ArchetypeDefinition),
    classFeatures: rows
      .filter((row) => row.origin === "seed" && row.kind === "class-feature")
      .map((row) => row.payload as ClassFeatureDefinition),
    feats: rows
      .filter((row) => row.origin === "seed" && row.kind === "feat")
      .map((row) => row.payload as FeatDefinition),
    races: rows
      .filter((row) => row.origin === "seed" && row.kind === "race")
      .map((row) => row.payload as RaceDefinition),
    skills: rows
      .filter((row) => row.origin === "seed" && row.kind === "skill")
      .map((row) => row.payload as SkillDefinition),
    spells: rows
      .filter((row) => row.origin === "seed" && row.kind === "spell")
      .map((row) => row.payload as SpellDefinition),
    weapons: rows
      .filter((row) => row.origin === "seed" && row.kind === "weapon")
      .map((row) => row.payload as WeaponDefinition),
    domains: rows
      .filter((row) => row.origin === "seed" && row.kind === "domain")
      .map((row) => row.payload as DomainDefinition),
    schools: rows
      .filter((row) => row.origin === "seed" && row.kind === "school")
      .map((row) => row.payload as SchoolDefinition),
    spellEffects: rows
      .filter((row) => row.origin === "seed" && row.kind === "spell-effect")
      .map((row) => row.payload as SpellEffectDefinition),
  };
  const scrapedRaces = buildScrapedRaces(rows);
  const scrapedMagicItems = buildScrapedMagicItems(rows);
  return {
    classes: dedupeByName(seed.classes),
    archetypes: dedupeByKey(
      [...seed.archetypes, ...buildScrapedArchetypes(rows)],
      (archetype) =>
        `${archetype.baseClassName.toLowerCase()}:${archetype.name.toLowerCase()}`,
    ),
    classFeatures: [...seed.classFeatures, ...buildScrapedClassFeatures(rows)],
    feats: [...seed.feats, ...buildScrapedFeats(rows)],
    races: dedupeByName([...seed.races, ...scrapedRaces]),
    skills: dedupeByName(seed.skills),
    spells: [...seed.spells, ...buildScrapedSpells(rows)],
    weapons: [...seed.weapons, ...buildScrapedWeapons(rows)],
    armor: buildScrapedArmorRecords(rows),
    mundaneEquipment: buildScrapedGearRecords(rows),
    magicItems: scrapedMagicItems,
    domains: dedupeByName(seed.domains),
    schools: dedupeByName(seed.schools),
    spellEffects: dedupeByKey(seed.spellEffects, (effect) => effect.id),
  };
}

function buildRulesDataSetFromRows(
  db: Database.Database,
  rows: EntityExportRow[],
) {
  const packMeta = selectPackMeta(db).map((pack) => ({
    ...pack,
    enabledByDefault: !!pack.enabledByDefault,
  }));
  const packMetaById = new Map(
    packMeta.map((pack) => [pack.id, pack] satisfies [string, DbPackMeta]),
  );
  const seedPacks = buildSeedPackMap(rows, packMetaById);
  const scrapedArchetypes = buildScrapedArchetypes(rows);
  const scrapedFeats = buildScrapedFeats(rows);
  const scrapedSpells = buildScrapedSpells(rows);
  const scrapedWeapons = buildScrapedWeapons(rows);
  const scrapedFeatures = buildScrapedClassFeatures(rows);
  const scrapedRaces = buildScrapedRaces(rows);
  const scrapedMagicItems = buildScrapedMagicItems(rows).flatMap((item) =>
    item.engineItem ? [item.engineItem] : [],
  );
  const dataSet: RulesDataSet = {
    schemaVersion: "0.1.0",
    generatedAt: new Date().toISOString(),
    sources: [
      ...selectSourceMeta(db),
      {
        id: "aonprd-scrape",
        name: "Archives of Nethys Scraped Content",
        publisher: "Archives of Nethys / Paizo",
        product: "Pathfinder 1e Reference",
        type: "first-party",
        license: "unknown",
        notes:
          "Generated from SQLite scraped entities. Universal modifier extraction now maps common always-on and conditional mechanics, but unsupported bespoke rules still remain manual.",
      },
    ],
    packs: [
      ...seedPacks,
      {
        ...createRulesPack({
          id: "aon-scraped-archetypes",
          name: "AoN Scraped Archetypes",
          enabledByDefault: true,
          sourceId: "aonprd-scrape",
          version: new Date().toISOString().slice(0, 10),
        }),
        archetypes: scrapedArchetypes,
      },
      {
        ...createRulesPack({
          id: "aon-scraped-feats",
          name: "AoN Scraped Feats",
          enabledByDefault: false,
          sourceId: "aonprd-scrape",
          version: new Date().toISOString().slice(0, 10),
        }),
        feats: scrapedFeats,
      },
      {
        ...createRulesPack({
          id: "aon-scraped-spells",
          name: "AoN Scraped Spells",
          enabledByDefault: false,
          sourceId: "aonprd-scrape",
          version: new Date().toISOString().slice(0, 10),
        }),
        spells: scrapedSpells,
      },
      {
        ...createRulesPack({
          id: "aon-scraped-races",
          name: "AoN Scraped Races",
          enabledByDefault: false,
          sourceId: "aonprd-scrape",
          version: new Date().toISOString().slice(0, 10),
        }),
        races: scrapedRaces,
      },
      {
        ...createRulesPack({
          id: "aon-scraped-weapons",
          name: "AoN Scraped Weapons",
          enabledByDefault: false,
          sourceId: "aonprd-scrape",
          version: new Date().toISOString().slice(0, 10),
        }),
        weapons: scrapedWeapons,
      },
      {
        ...createRulesPack({
          id: "aon-scraped-class-features",
          name: "AoN Scraped Class Features",
          enabledByDefault: false,
          sourceId: "aonprd-scrape",
          version: new Date().toISOString().slice(0, 10),
        }),
        classFeatures: scrapedFeatures,
      },
      {
        ...createRulesPack({
          id: "aon-scraped-magic-items",
          name: "AoN Scraped Magic Items",
          enabledByDefault: false,
          sourceId: "aonprd-scrape",
          version: new Date().toISOString().slice(0, 10),
        }),
        magicItems: dedupeByName(scrapedMagicItems),
      },
    ],
  };
  const issues = validateRulesDataSet(dataSet);
  if (issues.length > 0)
    throw new Error(
      `Exported rules data failed validation: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`,
    );
  return dataSet;
}

export function buildScrapedFeatRulesDataSet(
  db: Database.Database,
): RulesDataSet {
  const rows = parseRows(selectEntities(db));
  const full = buildRulesDataSetFromRows(db, rows);
  return {
    ...full,
    packs: full.packs.filter((pack) => pack.id === "aon-scraped-feats"),
    sources: full.sources.filter((source) => source.id === "aonprd-scrape"),
  };
}

export function exportScrapedFeatRulesJson(
  db: Database.Database,
  filePath: string,
) {
  const dataSet = buildScrapedFeatRulesDataSet(db);
  writeJson(filePath, dataSet);
  return {
    featCount: dataSet.packs[0]?.feats.length ?? 0,
    filePath,
  };
}

export function buildParserQaReport(db: Database.Database): ParserQaReport {
  const rows = parseRows(selectEntities(db));
  const scrapedSpells = rows.filter(
    (row) => row.kind === "spell" && row.origin === "scrape",
  );
  const scrapedFeats = rows.filter(
    (row) => row.kind === "feat" && row.origin === "scrape",
  );
  const scrapedMagicItems = rows.filter(
    (row) => row.kind === "magic-item" && row.origin === "scrape",
  );
  const scrapedClassFeatures = rows.filter(
    (row) => row.kind === "class-feature" && row.origin === "scrape",
  );

  const spellsMissingSchool = scrapedSpells.filter(
    (row) => !normalizeSchool((row.payload as ParsedScrapedSpell).school),
  );
  const spellsMissingClasses = scrapedSpells.filter(
    (row) =>
      parseSpellClasses((row.payload as ParsedScrapedSpell).levelText)
        .length === 0,
  );
  const spellsSuspiciousDescription = scrapedSpells.filter((row) => {
    const description = cleanText(
      (row.payload as ParsedScrapedSpell).description,
    );
    return (
      !description ||
      /^(source|school|level|casting time|components|range|target|effect|area|duration|saving throw|spell resistance)\b/i.test(
        description,
      )
    );
  });
  const featsSuspiciousDescription = scrapedFeats.filter((row) => {
    const payload = row.payload as ParsedScrapedFeat;
    const description = cleanText(payload.description || payload.benefit || "");
    return (
      !description ||
      /^(source|prerequisites|benefit|normal|special)\b/i.test(description)
    );
  });
  const magicItemsSuspiciousDescription = scrapedMagicItems.filter((row) => {
    const description = cleanText(
      (row.payload as ParsedScrapedMagicItem).description,
    );
    return !description || /^(requirements|cost)\b/i.test(description);
  });
  const classFeaturesMissingLevels = scrapedClassFeatures.filter((row) => {
    const payload = row.payload as ParsedScrapedClassFeature;
    return !(payload.levelOptional || payload.levels?.length);
  });

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      scrapedSpells: scrapedSpells.length,
      scrapedFeats: scrapedFeats.length,
      scrapedMagicItems: scrapedMagicItems.length,
      scrapedClassFeatures: scrapedClassFeatures.length,
    },
    issues: {
      spellsMissingSchool: {
        count: spellsMissingSchool.length,
        samples: qaSamples(
          spellsMissingSchool,
          (row) => (row.payload as ParsedScrapedSpell).levelText,
        ),
      },
      spellsMissingClasses: {
        count: spellsMissingClasses.length,
        samples: qaSamples(
          spellsMissingClasses,
          (row) => (row.payload as ParsedScrapedSpell).levelText,
        ),
      },
      spellsSuspiciousDescription: {
        count: spellsSuspiciousDescription.length,
        samples: qaSamples(spellsSuspiciousDescription, (row) =>
          cleanText((row.payload as ParsedScrapedSpell).description).slice(
            0,
            160,
          ),
        ),
      },
      featsSuspiciousDescription: {
        count: featsSuspiciousDescription.length,
        samples: qaSamples(featsSuspiciousDescription, (row) =>
          cleanText(
            (row.payload as ParsedScrapedFeat).description ||
              (row.payload as ParsedScrapedFeat).benefit ||
              "",
          ).slice(0, 160),
        ),
      },
      magicItemsSuspiciousDescription: {
        count: magicItemsSuspiciousDescription.length,
        samples: qaSamples(magicItemsSuspiciousDescription, (row) =>
          cleanText((row.payload as ParsedScrapedMagicItem).description).slice(
            0,
            160,
          ),
        ),
      },
      classFeaturesMissingLevels: {
        count: classFeaturesMissingLevels.length,
        samples: qaSamples(
          classFeaturesMissingLevels,
          (row) => (row.payload as ParsedScrapedClassFeature).className,
        ),
      },
    },
  };
}

export function buildUsableContentExport(
  db: Database.Database,
): UsableContentExport {
  const rows = parseRows(selectEntities(db));
  const rulesDataSet = buildRulesDataSetFromRows(db, rows);
  const normalized = buildNormalizedFromRows(rows);
  const notes = [
    "rulesDataSet contains seed packs plus scraped packs normalized into current engine-friendly shapes.",
    "normalized.magicItems and rulesDataSet now both include all scraped magic items, with slotless used for rods, staves, ioun items, and other unslotted records.",
    "normalized.armor exposes scraped armor/shield equipment templates even though RulesDataSet does not yet have a first-class armor collection.",
    "normalized.mundaneEquipment exposes scraped non-magical gear templates from AoN misc equipment pages.",
    "Scraped feats/class features/magic items currently export with empty effects/modifiers unless explicit mapping exists.",
  ];
  return {
    schemaVersion: "0.1.0",
    generatedAt: new Date().toISOString(),
    summary: summarize(rows),
    normalized,
    rulesDataSet,
    notes,
  };
}

export function exportUsableContentJson(
  db: Database.Database,
  filePath: string,
) {
  const output = buildUsableContentExport(db);
  writeJson(filePath, output);
  writeJson(defaultWebUsableContentMirrorPath(), output);
  return {
    summary: output.summary,
    rulesPacks: output.rulesDataSet.packs.length,
    normalizedMagicItems: output.normalized.magicItems.length,
    normalizedMundaneEquipment: output.normalized.mundaneEquipment.length,
    engineCompatibleMagicItems: output.normalized.magicItems.filter(
      (item) => item.engineCompatible,
    ).length,
    filePath,
  };
}
