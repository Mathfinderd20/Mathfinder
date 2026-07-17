import type Database from "better-sqlite3";
import { load } from "cheerio";
import { fetch } from "undici";
import type {
  ParsedScrapedArmor,
  ParsedScrapedClassFeature,
  ParsedScrapedGear,
  ParsedScrapedFeat,
  ParsedScrapedMagicItem,
  ParsedScrapedRace,
  ParsedScrapedSpell,
  ParsedScrapedWeapon,
} from "./types";
import {
  applySpellOverrides,
  resolveClassFeatureLevelOverride,
} from "./overrides";

const AON_BASE = "https://www.aonprd.com/";

export const AON_BASE_CLASSES = [
  "Alchemist",
  "Antipaladin",
  "Arcanist",
  "Barbarian",
  "Barbarian (Unchained)",
  "Bard",
  "Bloodrager",
  "Brawler",
  "Cavalier",
  "Cleric",
  "Druid",
  "Fighter",
  "Gunslinger",
  "Hunter",
  "Inquisitor",
  "Investigator",
  "Kineticist",
  "Magus",
  "Medium",
  "Mesmerist",
  "Monk",
  "Monk (Unchained)",
  "Ninja",
  "Occultist",
  "Oracle",
  "Paladin",
  "Psychic",
  "Ranger",
  "Rogue",
  "Rogue (Unchained)",
  "Samurai",
  "Shaman",
  "Shifter",
  "Skald",
  "Slayer",
  "Sorcerer",
  "Spiritualist",
  "Summoner",
  "Summoner (Unchained)",
  "Swashbuckler",
  "Vigilante",
  "Warpriest",
  "Witch",
  "Wizard",
] as const;

export const AON_ARMOR_CATEGORIES = [
  "Light",
  "Medium",
  "Heavy",
  "Shield",
] as const;
export const AON_MISC_EQUIPMENT_CATEGORIES = [
  "AdventuringGear",
  "AlchemicalRemedies",
  "AlchemicalTools",
  "AlchemicalWeapons",
  "AnimalGear",
  "BlackMarket",
  "ChannelFoci",
  "Clothing",
  "Concoction",
  "Dragoncraft",
  "DungeonGuides",
  "Entertainment",
  "FoodDrink",
  "Herbs",
  "Kit",
  "LodgingServices",
  "MountsPets",
  "PFChronicle",
  "Tincture",
  "Tools",
  "Torture",
  "TransportAir",
  "TransportLand",
  "TransportSea",
] as const;

export const AON_WEAPON_PROFICIENCIES = [
  "Simple",
  "Martial",
  "Exotic",
  "Ammo",
  "Firearm",
  "Mod",
  "Siege",
  "Special",
] as const;

export const AON_WONDROUS_SLOTS = [
  "Belts",
  "Body",
  "Chest",
  "Eyes",
  "Feet",
  "Hands",
  "Head",
  "Headband",
  "Neck",
  "Shoulders",
  "Wrist",
  "Other",
  "Ioun",
] as const;

export const AON_ROD_CATEGORIES = ["Metamagic", "Other"] as const;
export const AON_RACE_CATEGORIES = ["Core", "NonCore"] as const;

type NamedLink = { name: string; url: string };
type ArmorListEntry = NamedLink & {
  cost?: string;
  armorBonus?: string;
  maxDexBonus?: string;
  armorCheckPenalty?: string;
  arcaneSpellFailure?: string;
  speed30?: string;
  speed20?: string;
  weight?: string;
  categoryPage: string;
};
type WeaponListEntry = NamedLink & {
  cost?: string;
  damageSmall?: string;
  damageMedium?: string;
  critical?: string;
  range?: string;
  weight?: string;
  type?: string;
  special?: string;
  proficiencyPage: string;
};
type MagicItemListEntry = NamedLink & {
  cost?: string;
  slotPage: string;
};
type GearListEntry = NamedLink & {
  cost?: string;
  weight?: string;
  categoryPage: string;
};

type ScrapeKind =
  | "spell"
  | "feat"
  | "magic-item"
  | "class-feature"
  | "weapon"
  | "race"
  | "armor"
  | "gear";

type CatalogResult = {
  total: number;
  results: Record<string, number>;
};

function absoluteUrl(href: string) {
  return new URL(href, AON_BASE).toString();
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeFieldText(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[;:,]+$/, "")
    .trim();
  return normalized || undefined;
}

function extractFieldRaw(blockHtml: string, label: string) {
  const regex = new RegExp(`<b>${label}<\\/b>\\s*([\\s\\S]*?)(?=<b>|$)`, "i");
  return blockHtml.match(regex)?.[1];
}

function extractFieldSingleLine(blockHtml: string, label: string) {
  const raw = extractFieldRaw(blockHtml, label);
  return normalizeFieldText(raw?.split(/<br\s*\/?>/i)[0]);
}

function trimFieldAtNextLabel(value: string | undefined, nextLabels: string[]) {
  if (!value) return undefined;
  const trimmed = nextLabels
    .map((label) => {
      const index = value.search(
        new RegExp(
          `\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "i",
        ),
      );
      return index >= 0 ? index : Number.POSITIVE_INFINITY;
    })
    .reduce((min, index) => Math.min(min, index), Number.POSITIVE_INFINITY);
  const normalized = (
    trimmed === Number.POSITIVE_INFINITY ? value : value.slice(0, trimmed)
  ).trim();
  return normalized || undefined;
}

function normalizeSpellSchool(value: string | undefined) {
  if (!value) return undefined;
  let normalized = normalizeFieldText(value);
  if (!normalized) return undefined;
  normalized = normalized
    .replace(/\s*([()\]])\s*/g, "$1")
    .replace(/\s*\[\s*/g, " [")
    .replace(/\s*,\s*/g, ", ");
  const openSquare = (normalized.match(/\[/g) ?? []).length;
  const closeSquare = (normalized.match(/\]/g) ?? []).length;
  if (openSquare > closeSquare) normalized += "]";
  const openParen = (normalized.match(/\(/g) ?? []).length;
  const closeParen = (normalized.match(/\)/g) ?? []).length;
  if (openParen > closeParen) normalized += ")";
  return normalized;
}

function normalizeSpellLevelText(value: string | undefined) {
  if (!value) return undefined;
  const normalized = normalizeFieldText(value)
    ?.replace(/\s+Casting\b[\s\S]*$/i, "")
    .trim();
  return normalized || undefined;
}

function fallbackSpellNameFromUrl(sourceUrl: string) {
  const raw = new URL(sourceUrl).searchParams.get("ItemName") ?? "";
  return cleanText(decodeURIComponent(raw.replace(/\+/g, " ")));
}

function extractField(blockHtml: string, label: string) {
  return normalizeFieldText(extractFieldRaw(blockHtml, label));
}

function upsertScrapedEntity(
  db: Database.Database,
  kind: ScrapeKind,
  entityId: string,
  name: string,
  sourceUrl: string,
  payload: unknown,
) {
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
    VALUES (@entity_key, @kind, @entity_id, @name, NULL, 'scrape', 'aonprd', @source_url, NULL, @payload_json, @imported_at, @updated_at)
    ON CONFLICT(entity_key) DO UPDATE SET
      name=excluded.name,
      source_url=excluded.source_url,
      payload_json=excluded.payload_json,
      updated_at=excluded.updated_at
  `,
  ).run({
    entity_key: `${kind}:${entityId}`,
    kind,
    entity_id: entityId,
    name,
    source_url: sourceUrl,
    payload_json: JSON.stringify(payload),
    imported_at: now,
    updated_at: now,
  });
}

function insertScrapedEntity(
  db: Database.Database,
  kind: ScrapeKind,
  name: string,
  sourceUrl: string,
  payload: unknown,
) {
  upsertScrapedEntity(
    db,
    kind,
    `scrape-aon-${slug(name)}`,
    name,
    sourceUrl,
    payload,
  );
}

function beginIngestionRun(
  db: Database.Database,
  kind: ScrapeKind,
  meta: Record<string, unknown>,
) {
  return db
    .prepare(
      "INSERT INTO ingestion_runs (source, kind, status, started_at, meta_json) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      "aonprd",
      kind,
      "running",
      new Date().toISOString(),
      JSON.stringify(meta),
    );
}

function finishIngestionRun(
  db: Database.Database,
  runId: number | bigint,
  status: "completed" | "failed",
  meta: Record<string, unknown>,
) {
  db.prepare(
    "UPDATE ingestion_runs SET status = ?, finished_at = ?, meta_json = ? WHERE id = ?",
  ).run(status, new Date().toISOString(), JSON.stringify(meta), runId);
}

export async function fetchCachedPage(
  db: Database.Database,
  source: string,
  url: string,
) {
  const cached = db
    .prepare("SELECT html, status_code FROM page_cache WHERE url = ?")
    .get(url) as { html: string; status_code: number } | undefined;
  if (cached) return cached;
  const response = await fetch(url);
  const html = await response.text();
  db.prepare(
    "INSERT OR REPLACE INTO page_cache (url, source, status_code, fetched_at, html) VALUES (?, ?, ?, ?, ?)",
  ).run(url, source, response.status, new Date().toISOString(), html);
  return { html, status_code: response.status };
}

function parseLinksByPrefix(html: string, hrefPrefix: string) {
  const $ = load(html);
  const links = new Map<string, string>();
  $(`a[href^='${hrefPrefix}']`).each((_, element) => {
    const href = $(element).attr("href");
    const name = cleanText($(element).text());
    if (!href || !name) return;
    links.set(name, absoluteUrl(href));
  });
  return [...links.entries()].map(([name, url]) => ({ name, url }));
}

function detailBlock(html: string) {
  const $ = load(html);
  const contentCell = $("#MainContent_DataListTypes td")
    .filter((_, element) => $(element).find("h1.title").length > 0)
    .first();
  const block = contentCell.length
    ? contentCell
    : $("#MainContent_DataListTypes td").first();
  return { $, block, blockHtml: block.html() ?? "" };
}

function pageTitle(html: string) {
  const $ = load(html);
  return cleanText($("title").first().text());
}

function isGenericAonListingPageTitle(title: string) {
  const normalized = cleanText(title).toLowerCase();
  return normalized === "feats - archives of nethys: pathfinder rpg database";
}

function normalizeFeatureName(value: string) {
  return value
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+\+\d+(?:d\d+)?$/i, "")
    .replace(/\s+\d+\/-$/i, "")
    .replace(/\s+\d+\/—$/i, "")
    .replace(/\s+\d+d\d+$/i, "")
    .replace(/\s+\d+$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function featureNameCandidates(value: string) {
  const normalized = normalizeFeatureName(value);
  const candidates = new Set([normalized]);
  if (normalized.endsWith(" feats"))
    candidates.add(`${normalized.slice(0, -1)}`);
  if (normalized.endsWith(" feat")) candidates.add(`${normalized}s`);
  if (normalized.endsWith(" powers"))
    candidates.add(`${normalized.slice(0, -1)}`);
  if (normalized.endsWith(" power")) candidates.add(`${normalized}s`);
  return [...candidates].filter(Boolean);
}

function nodeTagName(node: unknown) {
  return typeof node === "object" &&
    node !== null &&
    "tagName" in node &&
    typeof (node as { tagName?: unknown }).tagName === "string"
    ? (node as { tagName: string }).tagName.toLowerCase()
    : undefined;
}

function parseLevelNumber(text: string) {
  const match = text.match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

export function parseAonSpellLinks(html: string): NamedLink[] {
  return parseLinksByPrefix(html, "SpellDisplay.aspx?ItemName=");
}

export function parseAonSpellDetail(
  html: string,
  sourceUrl: string,
): ParsedScrapedSpell {
  const { $, block } = detailBlock(html);
  const fallbackName = fallbackSpellNameFromUrl(sourceUrl);
  const targetName = cleanText(fallbackName).toLowerCase();
  const contentSpan = block
    .find("span")
    .filter((_, element) => $(element).find("h1.title").length > 0)
    .first();
  const container = contentSpan.length ? contentSpan : block;
  const sectionHtml = (() => {
    const nodes = container.contents().toArray();
    const headings = nodes.filter((node) => $(node).is("h1.title"));
    const matchingHeading =
      headings.find(
        (heading) => cleanText($(heading).text()).toLowerCase() === targetName,
      ) ?? headings[0];
    if (!matchingHeading) return block.html() ?? "";
    const startIndex = nodes.indexOf(matchingHeading);
    const endIndex = nodes.findIndex(
      (node, index) => index > startIndex && $(node).is("h1.title"),
    );
    return nodes
      .slice(startIndex, endIndex >= 0 ? endIndex : undefined)
      .map(
        (node) =>
          $.html(node) ??
          ("data" in node && typeof node.data === "string" ? node.data : ""),
      )
      .join("");
  })();
  const sectionRoot = load(`<div>${sectionHtml}</div>`)("div").first();
  const name =
    cleanText(sectionRoot.find("h1.title").first().text()) || fallbackName;
  sectionRoot.find("h1.title").first().remove();
  const blockHtml = sectionRoot.html() ?? block.html() ?? "";
  const bodyText = cleanText(sectionRoot.text());
  const labelRegex = (label: string) =>
    new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const spellField = (label: string, nextLabels: string[]) => {
    const htmlValue = trimFieldAtNextLabel(
      nextLabels.length === 0
        ? extractFieldSingleLine(blockHtml, label)
        : extractField(blockHtml, label),
      nextLabels,
    );
    if (htmlValue) return htmlValue;
    const startIndex = bodyText.search(labelRegex(label));
    if (startIndex < 0) return undefined;
    const raw = bodyText.slice(startIndex + label.length).trim();
    return trimFieldAtNextLabel(raw, nextLabels);
  };
  const source = spellField("Source", [
    "School",
    "Level",
    "Casting Time",
    "Components",
    "Range",
    "Target",
    "Effect",
    "Area",
    "Duration",
    "Saving Throw",
    "Spell Resistance",
    "Description",
  ]);
  const school = normalizeSpellSchool(
    spellField("School", [
      "Level",
      "Casting",
      "Casting Time",
      "Components",
      "Range",
      "Target",
      "Effect",
      "Area",
      "Duration",
      "Saving Throw",
      "Spell Resistance",
      "Description",
    ]),
  );
  const levelText = normalizeSpellLevelText(
    spellField("Level", [
      "Casting",
      "Casting Time",
      "Components",
      "Range",
      "Target",
      "Effect",
      "Area",
      "Duration",
      "Saving Throw",
      "Spell Resistance",
      "Description",
    ]),
  );
  const castingTime = spellField("Casting Time", [
    "Components",
    "Range",
    "Target",
    "Effect",
    "Area",
    "Duration",
    "Saving Throw",
    "Spell Resistance",
    "Description",
  ]);
  const components = spellField("Components", [
    "Range",
    "Target",
    "Effect",
    "Area",
    "Duration",
    "Saving Throw",
    "Spell Resistance",
    "Description",
  ]);
  const range = spellField("Range", [
    "Target",
    "Effect",
    "Area",
    "Duration",
    "Saving Throw",
    "Spell Resistance",
    "Description",
  ]);
  const targetEffectArea =
    spellField("Target", [
      "Effect",
      "Area",
      "Duration",
      "Saving Throw",
      "Spell Resistance",
      "Description",
    ]) ??
    spellField("Effect", [
      "Area",
      "Duration",
      "Saving Throw",
      "Spell Resistance",
      "Description",
    ]) ??
    spellField("Area", [
      "Duration",
      "Saving Throw",
      "Spell Resistance",
      "Description",
    ]);
  const duration = spellField("Duration", [
    "Saving Throw",
    "Spell Resistance",
    "Description",
  ]);
  const savingThrow = spellField("Saving Throw", [
    "Spell Resistance",
    "Description",
  ]);
  const spellResistance =
    extractFieldSingleLine(blockHtml, "Spell Resistance") ??
    spellField("Spell Resistance", ["Description"]);
  const explicitDescription =
    normalizeFieldText(
      blockHtml.match(/<h3[^>]*>\s*Description\s*<\/h3>\s*([\s\S]*)$/i)?.[1],
    ) ?? spellField("Description", []);
  const trailingLineDescription = normalizeFieldText(
    blockHtml.split(/<br\s*\/?>/i).pop(),
  )
    ?.replace(/^Description\s*/i, "")
    .trim();
  const description =
    explicitDescription ??
    trailingLineDescription ??
    (() => {
      const metadataFields = [
        ["Spell Resistance", spellResistance],
        ["Saving Throw", savingThrow],
        ["Duration", duration],
        ["Area", targetEffectArea],
        ["Effect", targetEffectArea],
        ["Target", targetEffectArea],
        ["Range", range],
        ["Components", components],
        ["Casting Time", castingTime],
        ["Level", levelText],
        ["School", school],
        ["Source", source],
      ] as const;
      for (const [label, value] of metadataFields) {
        const startIndex = bodyText.search(labelRegex(label));
        if (startIndex < 0) continue;
        let remainder = bodyText.slice(startIndex + label.length).trim();
        if (value && remainder.toLowerCase().startsWith(value.toLowerCase())) {
          remainder = remainder.slice(value.length).trim();
        }
        if (remainder) return remainder;
      }
      return bodyText;
    })();
  return applySpellOverrides({
    name,
    source,
    school,
    levelText,
    castingTime,
    components,
    range,
    targetEffectArea,
    duration,
    savingThrow,
    spellResistance,
    description,
    sourceUrl,
  });
}

export function parseAonFeatLinks(html: string): NamedLink[] {
  return parseLinksByPrefix(html, "FeatDisplay.aspx?ItemName=");
}

export function parseAonFeatCategories(html: string): string[] {
  const $ = load(html);
  const categories = new Set<string>();
  $("a[href^='Feats.aspx?Category=']").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    const category = new URL(href, AON_BASE).searchParams
      .get("Category")
      ?.trim();
    if (category) categories.add(category);
  });
  return [...categories];
}

export function parseAonFeatDetail(
  html: string,
  sourceUrl: string,
): ParsedScrapedFeat {
  const { block, blockHtml } = detailBlock(html);
  const rawTitle = cleanText(block.find("h1.title").first().text());
  const categoryMatch = rawTitle.match(/^(.*)\s+\(([^)]+)\)$/);
  const leadDescription = normalizeFieldText(
    blockHtml
      .replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, "")
      .replace(/<b>Source<\/b>[\s\S]*?(?:<br\s*\/?>\s*){1,2}/i, "")
      .split(/<b>(?:Prerequisites|Benefit|Normal|Special)<\/b>/i)[0],
  );
  const description = cleanText(block.text());
  const benefit = (
    extractFieldSingleLine(blockHtml, "Benefit") ??
    extractField(blockHtml, "Benefit")
  )?.replace(/^:\s*/, "");
  return {
    name: categoryMatch?.[1] ?? rawTitle,
    category: categoryMatch?.[2],
    source:
      extractFieldSingleLine(blockHtml, "Source") ??
      extractField(blockHtml, "Source"),
    prerequisites: (
      extractFieldSingleLine(blockHtml, "Prerequisites") ??
      extractField(blockHtml, "Prerequisites")
    )?.replace(/^:\s*/, ""),
    benefit,
    normal: (
      extractFieldSingleLine(blockHtml, "Normal") ??
      extractField(blockHtml, "Normal")
    )?.replace(/^:\s*/, ""),
    special: (
      extractFieldSingleLine(blockHtml, "Special") ??
      extractField(blockHtml, "Special")
    )?.replace(/^:\s*/, ""),
    description: leadDescription || benefit || description,
    sourceUrl,
  };
}

export function parseAonRaceLinks(html: string): NamedLink[] {
  return parseLinksByPrefix(html, "RacesDisplay.aspx?ItemName=");
}

function raceLabelValue(
  $: ReturnType<typeof load>,
  block: ReturnType<typeof detailBlock>["block"],
  label: string,
) {
  const bold = block
    .find("b")
    .filter((_, element) => cleanText($(element).text()) === label)
    .first();
  if (!bold.length) return undefined;
  const bits: string[] = [];
  let node = bold.get(0)?.nextSibling ?? null;
  while (node) {
    if (nodeTagName(node) === "b") break;
    bits.push(
      $.html(node) ??
        ("data" in node && typeof node.data === "string" ? node.data : ""),
    );
    node = node.nextSibling;
  }
  return normalizeFieldText(bits.join(" "))?.replace(/^:\s*/, "");
}

export function parseAonRaceDetail(
  html: string,
  sourceUrl: string,
  category?: string,
): ParsedScrapedRace {
  const { $, block } = detailBlock(html);
  const rawTitle = cleanText(block.find("h1.title").first().text());
  const urlName = cleanText(
    decodeURIComponent(
      new URL(sourceUrl).searchParams.get("ItemName")?.replace(/\+/g, " ") ??
        "",
    ),
  );
  const name = urlName || rawTitle;
  const labels = block
    .find("b")
    .toArray()
    .map((element) => cleanText($(element).text()));
  const firstSecondarySource = labels.findIndex(
    (label, index) => label === "Source" && index > 0,
  );
  const coreTraitLabels = labels.slice(
    0,
    firstSecondarySource > 0 ? firstSecondarySource : labels.length,
  );
  const speedLabel = coreTraitLabels.find((label) => /speed$/i.test(label));
  const speedValue = speedLabel
    ? raceLabelValue($, block, speedLabel)
    : undefined;
  const description = cleanText(
    block.text().replace(/^.*?Monster Entry\s*Link?/i, ""),
  ).slice(0, 2000);
  return {
    name,
    source: raceLabelValue($, block, "Source"),
    category,
    abilityScoreText: coreTraitLabels.find((label) =>
      /(?:^\+\d)|(?:to One Ability Score)/i.test(label),
    ),
    raceType: coreTraitLabels.find((label) =>
      /(?:^.*\b(?:humanoid|outsider|construct|monstrous humanoid|fey|aberration|plant|undead|dragon|elemental|animal|goblinoid|catfolk)\b.*$)/i.test(
        label,
      ),
    ),
    size: coreTraitLabels.find((label) =>
      /^(fine|diminutive|tiny|small|medium|large|huge|gargantuan|colossal)$/i.test(
        label,
      ),
    ),
    speedText: speedLabel
      ? `${speedLabel}${speedValue ? `: ${speedValue}` : ""}`
      : undefined,
    languages: raceLabelValue($, block, "Languages"),
    traitEntries: coreTraitLabels
      .filter(
        (label) =>
          ![
            "Source",
            "Monster Entry",
            "Physical Description",
            "Society",
            "Relations",
            "Alignment and Religion",
            "Adventurers",
            "Names",
            "Male Names",
            "Female Names",
            "Languages",
          ].includes(label),
      )
      .map((label) => ({ name: label, text: raceLabelValue($, block, label) })),
    description,
    sourceUrl,
  };
}

export function parseAonMagicItemList(
  html: string,
  slotPage: string,
  options: { gridSelector?: string; hrefPrefix?: string } = {},
): MagicItemListEntry[] {
  const {
    gridSelector = "#MainContent_GridViewMagicWondrous",
    hrefPrefix = "MagicWondrousDisplay.aspx?FinalName=",
  } = options;
  const $ = load(html);
  const rows = $(`${gridSelector} tr`).toArray();
  const entries: MagicItemListEntry[] = [];
  for (const row of rows.slice(1)) {
    const cells = $(row).find("td").toArray();
    if (cells.length < 2) continue;
    const anchor = $(cells[0]).find(`a[href^='${hrefPrefix}']`).first();
    const href = anchor.attr("href");
    const name = cleanText(anchor.text());
    if (!href || !name) continue;
    entries.push({
      name,
      url: absoluteUrl(href),
      cost: cleanText($(cells[1]).text()) || undefined,
      slotPage,
    });
  }
  return entries;
}

export function parseAonMagicItemDetail(
  html: string,
  sourceUrl: string,
): ParsedScrapedMagicItem {
  const { block } = detailBlock(html);
  const name = cleanText(block.find("h1.title").first().text());
  const content = (
    block.find("span").first().length ? block.find("span").first() : block
  ).clone();
  content.find("h1.title").first().remove();
  const contentHtml = content.html() ?? "";
  const trimmedHtml =
    contentHtml.split(/<h3[^>]*>\s*Construction\s*<\/h3>/i)[0] ?? contentHtml;
  const bodyText = cleanText(load(`<div>${trimmedHtml}</div>`).text());
  const fieldFromText = (label: string, nextLabels: string[]) => {
    const startIndex = bodyText.indexOf(label);
    if (startIndex < 0) return undefined;
    const from = startIndex + label.length;
    const endIndex = nextLabels
      .map((nextLabel) => bodyText.indexOf(nextLabel, from))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0];
    return (
      cleanText(bodyText.slice(from, endIndex ?? bodyText.length)).replace(
        /[;:,]$/,
        "",
      ) || undefined
    );
  };
  const auraField = fieldFromText("Aura", ["CL", "Slot", "Price", "Weight"]);
  const clField = fieldFromText("CL", ["Slot", "Price", "Weight"]);
  let aura = auraField;
  let cl = clField;
  if ((!aura || !cl) && auraField?.includes(";")) {
    const parts = auraField.split(";").map((part) => cleanText(part));
    aura = aura ?? parts[0];
    cl =
      cl ?? parts.find((part) => /^CL\b/i.test(part))?.replace(/^CL\s*/i, "");
  }
  const weight = fieldFromText("Weight", ["Description"]);
  const description = fieldFromText("Description", []);
  const weightAndDescription = fieldFromText("Weight", []);
  const fallbackWeightMatch = weightAndDescription?.match(
    /^(.*?(?:\d+\/\d+\s+lbs?\.?|\d+(?:\.\d+)?\s+lbs?\.?|\d+(?:\.\d+)?\s+oz\.?|—))(?:\s+(.*))?$/i,
  );
  return {
    name,
    source: fieldFromText("Source", [
      "Aura",
      "CL",
      "Slot",
      "Price",
      "Weight",
      "Description",
    ]),
    aura,
    cl,
    slot: fieldFromText("Slot", ["Price", "Weight", "Description"]),
    price: fieldFromText("Price", ["Weight", "Description"]),
    weight: weight ?? fallbackWeightMatch?.[1]?.trim(),
    description: description ?? cleanText(fallbackWeightMatch?.[2] ?? ""),
    sourceUrl,
  };
}

export function parseAonArmorList(
  html: string,
  categoryPage: string,
): ArmorListEntry[] {
  const $ = load(html);
  const rows = $("tr").toArray();
  const entries: ArmorListEntry[] = [];
  for (const row of rows) {
    const cells = $(row).find("td").toArray();
    if (cells.length !== 9) continue;
    const anchor = $(cells[0])
      .find("a[href^='EquipmentArmorDisplay.aspx?ItemName=']")
      .first();
    const href = anchor.attr("href");
    const name = cleanText(anchor.text());
    if (!href || !name) continue;
    entries.push({
      name,
      url: absoluteUrl(href),
      cost: cleanText($(cells[1]).text()) || undefined,
      armorBonus: cleanText($(cells[2]).text()) || undefined,
      maxDexBonus: cleanText($(cells[3]).text()) || undefined,
      armorCheckPenalty: cleanText($(cells[4]).text()) || undefined,
      arcaneSpellFailure: cleanText($(cells[5]).text()) || undefined,
      speed30: cleanText($(cells[6]).text()) || undefined,
      speed20: cleanText($(cells[7]).text()) || undefined,
      weight: cleanText($(cells[8]).text()) || undefined,
      categoryPage,
    });
  }
  return entries;
}

export function parseAonArmorDetail(
  html: string,
  sourceUrl: string,
): ParsedScrapedArmor {
  const { block } = detailBlock(html);
  const name = cleanText(block.find("h1.title").first().text());
  const text = cleanText(block.text());
  const statisticsIndex = text.indexOf("Statistics");
  const descriptionIndex = text.indexOf(
    "Description",
    statisticsIndex >= 0 ? statisticsIndex : 0,
  );
  const sourceRegion =
    statisticsIndex >= 0 ? text.slice(0, statisticsIndex) : text;
  const statsRegion =
    statisticsIndex >= 0
      ? text.slice(
          statisticsIndex + "Statistics".length,
          descriptionIndex >= 0 ? descriptionIndex : text.length,
        )
      : text;
  const description =
    descriptionIndex >= 0
      ? cleanText(text.slice(descriptionIndex + "Description".length))
      : text;
  const fieldFromRegion = (region: string, label: string, end: string[]) => {
    const startIndex = region.indexOf(label);
    if (startIndex < 0) return undefined;
    const from = startIndex + label.length;
    const endIndex = end
      .map((marker) => region.indexOf(marker, from))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0];
    return (
      cleanText(region.slice(from, endIndex ?? region.length)).replace(
        /[;:,]$/,
        "",
      ) || undefined
    );
  };
  return {
    name,
    source: fieldFromRegion(sourceRegion, "Source", []),
    cost: fieldFromRegion(statsRegion, "Cost", [
      "Armor/Shield Bonus",
      "Maximum Dex Bonus",
      "Armor Check Penalty",
      "Arcane Spell Failure Chance",
      "Speed 30 ft.",
      "Speed 20 ft.",
      "Weight",
      "Category",
    ]),
    armorBonus: fieldFromRegion(statsRegion, "Armor/Shield Bonus", [
      "Maximum Dex Bonus",
      "Armor Check Penalty",
      "Arcane Spell Failure Chance",
      "Speed 30 ft.",
      "Speed 20 ft.",
      "Weight",
      "Category",
    ]),
    maxDexBonus: fieldFromRegion(statsRegion, "Maximum Dex Bonus", [
      "Armor Check Penalty",
      "Arcane Spell Failure Chance",
      "Speed 30 ft.",
      "Speed 20 ft.",
      "Weight",
      "Category",
    ]),
    armorCheckPenalty: fieldFromRegion(statsRegion, "Armor Check Penalty", [
      "Arcane Spell Failure Chance",
      "Speed 30 ft.",
      "Speed 20 ft.",
      "Weight",
      "Category",
    ]),
    arcaneSpellFailure: fieldFromRegion(
      statsRegion,
      "Arcane Spell Failure Chance",
      ["Speed 30 ft.", "Speed 20 ft.", "Weight", "Category"],
    ),
    speed30: fieldFromRegion(statsRegion, "Speed 30 ft.", [
      "Speed 20 ft.",
      "Weight",
      "Category",
    ]),
    speed20: fieldFromRegion(statsRegion, "Speed 20 ft.", [
      "Weight",
      "Category",
    ]),
    weight: fieldFromRegion(statsRegion, "Weight", ["Category"]),
    category: fieldFromRegion(statsRegion, "Category", []),
    description,
    sourceUrl,
  };
}

export function parseAonGearCategories(html: string): string[] {
  const $ = load(html);
  const categories = new Set<string>();
  $("a[href^='EquipmentMisc.aspx?Category=']").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    const category = href.match(/[?&]Category=([^&]+)/)?.[1];
    if (category) categories.add(decodeURIComponent(category));
  });
  return [...categories];
}

export function parseAonGearList(
  html: string,
  categoryPage: string,
): GearListEntry[] {
  const $ = load(html);
  const rows = $("tr").toArray();
  const entries: GearListEntry[] = [];
  for (const row of rows) {
    const cells = $(row).find("td").toArray();
    if (cells.length !== 3) continue;
    const anchor = $(cells[0])
      .find("a[href^='EquipmentMiscDisplay.aspx?ItemName=']")
      .first();
    const href = anchor.attr("href");
    const name = cleanText(anchor.text());
    if (!href || !name) continue;
    entries.push({
      name,
      url: absoluteUrl(href),
      cost: cleanText($(cells[1]).text()) || undefined,
      weight: cleanText($(cells[2]).text()) || undefined,
      categoryPage,
    });
  }
  return entries;
}

export function parseAonGearDetail(
  html: string,
  sourceUrl: string,
): ParsedScrapedGear {
  const { block } = detailBlock(html);
  const name = cleanText(block.find("h1.title").first().text());
  const text = cleanText(block.text());
  const descriptionIndex = text.indexOf("Description");
  const fieldFromRegion = (region: string, label: string, end: string[]) => {
    const startIndex = region.indexOf(label);
    if (startIndex < 0) return undefined;
    const from = startIndex + label.length;
    const endIndex = end
      .map((marker) => region.indexOf(marker, from))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0];
    return (
      cleanText(region.slice(from, endIndex ?? region.length)).replace(
        /[;:,]$/,
        "",
      ) || undefined
    );
  };
  return {
    name,
    source: fieldFromRegion(text, "Source", [
      "Price",
      "Weight",
      "Category",
      "Description",
    ]),
    cost: fieldFromRegion(text, "Price", ["Weight", "Category", "Description"]),
    weight: fieldFromRegion(text, "Weight", ["Category", "Description"]),
    category: fieldFromRegion(text, "Category", ["Description"]),
    description:
      descriptionIndex >= 0
        ? cleanText(text.slice(descriptionIndex + "Description".length))
        : text,
    sourceUrl,
  };
}

export function parseAonWeaponList(
  html: string,
  proficiencyPage: string,
): WeaponListEntry[] {
  const $ = load(html);
  const rows = $("tr").toArray();
  const entries: WeaponListEntry[] = [];
  for (const row of rows) {
    const cells = $(row).find("td").toArray();
    if (cells.length !== 9) continue;
    const anchor = $(cells[0])
      .find("a[href^='EquipmentWeaponsDisplay.aspx?ItemName=']")
      .first();
    const href = anchor.attr("href");
    const name = cleanText(anchor.text());
    if (!href || !name) continue;
    entries.push({
      name,
      url: absoluteUrl(href),
      cost: cleanText($(cells[1]).text()) || undefined,
      damageSmall: cleanText($(cells[2]).text()) || undefined,
      damageMedium: cleanText($(cells[3]).text()) || undefined,
      critical: cleanText($(cells[4]).text()) || undefined,
      range: cleanText($(cells[5]).text()) || undefined,
      weight: cleanText($(cells[6]).text()) || undefined,
      type: cleanText($(cells[7]).text()) || undefined,
      special: cleanText($(cells[8]).text()) || undefined,
      proficiencyPage,
    });
  }
  return entries;
}

export function parseAonWeaponDetail(
  html: string,
  sourceUrl: string,
): ParsedScrapedWeapon {
  const { block } = detailBlock(html);
  const name = cleanText(block.find("h1.title").first().text());
  const text = cleanText(block.text());
  const statisticsIndex = text.indexOf("Statistics");
  const descriptionIndex = text.indexOf(
    "Description",
    statisticsIndex >= 0 ? statisticsIndex : 0,
  );
  const sourceRegion =
    statisticsIndex >= 0 ? text.slice(0, statisticsIndex) : text;
  const statsRegion =
    statisticsIndex >= 0
      ? text.slice(
          statisticsIndex + "Statistics".length,
          descriptionIndex >= 0 ? descriptionIndex : text.length,
        )
      : text;
  const description =
    descriptionIndex >= 0
      ? cleanText(text.slice(descriptionIndex + "Description".length))
      : text;
  const fieldFromRegion = (region: string, label: string, end: string[]) => {
    const startIndex = region.indexOf(label);
    if (startIndex < 0) return undefined;
    const from = startIndex + label.length;
    const endIndex = end
      .map((marker) => region.indexOf(marker, from))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0];
    return (
      cleanText(region.slice(from, endIndex ?? region.length)).replace(
        /[;:,]$/,
        "",
      ) || undefined
    );
  };
  const damageField = fieldFromRegion(statsRegion, "Damage", [
    "Critical",
    "Range",
    "Type",
    "Special",
    "Category",
    "Proficiency",
    "Weapon Groups",
  ]);
  const damageMatch = damageField?.match(
    /([^;]+?)\s*\(small\),\s*([^;]+?)\s*\(medium\)/i,
  );
  return {
    name,
    source: fieldFromRegion(sourceRegion, "Source", []),
    cost: fieldFromRegion(statsRegion, "Cost", [
      "Weight",
      "Damage",
      "Category",
      "Proficiency",
      "Weapon Groups",
    ]),
    weight: fieldFromRegion(statsRegion, "Weight", [
      "Damage",
      "Category",
      "Proficiency",
      "Weapon Groups",
    ]),
    damageSmall: damageMatch?.[1]?.trim(),
    damageMedium: damageMatch?.[2]?.trim(),
    critical: fieldFromRegion(statsRegion, "Critical", [
      "Range",
      "Type",
      "Special",
      "Category",
      "Proficiency",
      "Weapon Groups",
    ]),
    range: fieldFromRegion(statsRegion, "Range", [
      "Type",
      "Special",
      "Category",
      "Proficiency",
      "Weapon Groups",
    ]),
    type: fieldFromRegion(statsRegion, "Type", [
      "Special",
      "Category",
      "Proficiency",
      "Weapon Groups",
    ]),
    special: fieldFromRegion(statsRegion, "Special", [
      "Category",
      "Proficiency",
      "Weapon Groups",
    ]),
    category: fieldFromRegion(statsRegion, "Category", [
      "Proficiency",
      "Weapon Groups",
    ]),
    proficiency: fieldFromRegion(statsRegion, "Proficiency", ["Weapon Groups"]),
    weaponGroups: fieldFromRegion(statsRegion, "Weapon Groups", []),
    description,
    sourceUrl,
  };
}

export function parseAonClassFeatureLevels(html: string) {
  const { $, block } = detailBlock(html);
  const rows = block.find("table").first().find("tr").toArray();
  const featureLevels = new Map<string, number[]>();
  for (const row of rows.slice(1)) {
    const cells = $(row).find("td").toArray();
    if (cells.length < 6) continue;
    const level = parseLevelNumber(cleanText($(cells[0]).text()));
    if (!level) continue;
    const specials = cleanText($(cells[5]).text())
      .split(",")
      .map((part) => cleanText(part))
      .filter(Boolean);
    for (const special of specials) {
      for (const normalized of featureNameCandidates(special)) {
        const levels = featureLevels.get(normalized) ?? [];
        levels.push(level);
        featureLevels.set(normalized, levels);
      }
    }
  }
  return featureLevels;
}

export function parseAonClassFeatureDetails(
  html: string,
  sourceUrl: string,
): ParsedScrapedClassFeature[] {
  const { $, block } = detailBlock(html);
  const className = cleanText(block.find("h1.title").first().text());
  const featureLevels = parseAonClassFeatureLevels(html);
  const container = block.find("span").first();
  const nodes = container.contents().toArray();
  const features: ParsedScrapedClassFeature[] = [];
  let seenTable = false;

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!node) continue;
    const tag = nodeTagName(node);
    if (tag === "table") {
      seenTable = true;
      continue;
    }
    if (!seenTable) continue;
    if (tag === "h2") break;
    if (tag !== "b") continue;

    const rawTitle = cleanText($(node).text());
    if (!rawTitle || rawTitle === "Source" || rawTitle === "here") continue;

    let chunk = "";
    for (let cursor = index + 1; cursor < nodes.length; cursor += 1) {
      const nextNode = nodes[cursor];
      if (!nextNode) continue;
      const nextTag = nodeTagName(nextNode);
      if (nextTag === "b" || nextTag === "h2") break;
      chunk += $.html(nextNode) ?? "";
    }

    const description = cleanText(load(`<div>${chunk}</div>`).text());
    const titleMatch = rawTitle.match(/^(.*?)(?:\s+\(([^)]+)\))?$/);
    const name = cleanText(titleMatch?.[1] ?? rawTitle);
    const featureType = titleMatch?.[2];
    const levels = featureNameCandidates(name)
      .flatMap((candidate) => featureLevels.get(candidate) ?? [])
      .filter((level, idx, arr) => arr.indexOf(level) === idx)
      .sort((a, b) => a - b);
    const baseFeature: ParsedScrapedClassFeature = {
      className,
      name,
      featureType,
      source: extractField(chunk, "Source"),
      levels,
      description,
      sourceUrl,
    };
    const override =
      levels.length > 0
        ? undefined
        : resolveClassFeatureLevelOverride(baseFeature);

    features.push({
      ...baseFeature,
      levels: override?.levels ?? baseFeature.levels,
      levelOptional: override?.levelOptional,
    });
  }

  return features;
}

export async function refreshCachedAonFeats(
  db: Database.Database,
  limit?: number,
) {
  const run = beginIngestionRun(db, "feat", {
    refreshCached: true,
    limit: limit ?? null,
  });
  try {
    const rows = db
      .prepare(
        `
      SELECT ce.entity_id as entityId, ce.name, ce.source_url as sourceUrl, pc.html
      FROM content_entities ce
      JOIN page_cache pc ON pc.url = ce.source_url
      WHERE ce.kind = 'feat'
        AND ce.origin = 'scrape'
        AND ce.source_url LIKE '%FeatDisplay.aspx?ItemName=%'
      ORDER BY ce.updated_at ASC
      LIMIT ?
    `,
      )
      .all(limit ?? Number.MAX_SAFE_INTEGER) as Array<{
      entityId: string;
      name: string;
      sourceUrl: string;
      html: string;
    }>;
    let refreshed = 0;
    let skipped = 0;
    for (const row of rows) {
      if (isGenericAonListingPageTitle(pageTitle(row.html))) {
        skipped += 1;
        continue;
      }
      const parsed = parseAonFeatDetail(row.html, row.sourceUrl);
      const merged = { ...parsed, name: parsed.name || row.name };
      if (
        !merged.name ||
        (!merged.description && !merged.benefit && !merged.prerequisites)
      ) {
        skipped += 1;
        continue;
      }
      upsertScrapedEntity(
        db,
        "feat",
        row.entityId,
        merged.name,
        merged.sourceUrl,
        merged,
      );
      refreshed += 1;
    }
    finishIngestionRun(db, run.lastInsertRowid, "completed", {
      refreshed,
      skipped,
      scanned: rows.length,
    });
    return { refreshed, skipped, scanned: rows.length };
  } catch (error) {
    finishIngestionRun(db, run.lastInsertRowid, "failed", {
      limit: limit ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function refreshCachedAonMagicItems(
  db: Database.Database,
  limit?: number,
) {
  const run = beginIngestionRun(db, "magic-item", {
    refreshCached: true,
    limit: limit ?? null,
  });
  try {
    const rows = db
      .prepare(
        `
      SELECT ce.entity_id as entityId, ce.name, ce.source_url as sourceUrl, pc.html
      FROM content_entities ce
      JOIN page_cache pc ON pc.url = ce.source_url
      WHERE ce.kind = 'magic-item'
        AND ce.origin = 'scrape'
        AND (
          ce.source_url LIKE '%MagicWondrousDisplay.aspx?FinalName=%'
          OR ce.source_url LIKE '%MagicRingsDisplay.aspx?FinalName=%'
          OR ce.source_url LIKE '%MagicRodsDisplay.aspx?FinalName=%'
          OR ce.source_url LIKE '%MagicStavesDisplay.aspx?ItemName=%'
        )
      ORDER BY ce.updated_at ASC
      LIMIT ?
    `,
      )
      .all(limit ?? Number.MAX_SAFE_INTEGER) as Array<{
      entityId: string;
      name: string;
      sourceUrl: string;
      html: string;
    }>;
    let refreshed = 0;
    let skipped = 0;
    for (const row of rows) {
      const parsed = parseAonMagicItemDetail(row.html, row.sourceUrl);
      const merged = { ...parsed, name: parsed.name || row.name };
      if (!merged.name) {
        skipped += 1;
        continue;
      }
      upsertScrapedEntity(
        db,
        "magic-item",
        row.entityId,
        merged.name,
        merged.sourceUrl,
        merged,
      );
      refreshed += 1;
    }
    finishIngestionRun(db, run.lastInsertRowid, "completed", {
      refreshed,
      skipped,
      scanned: rows.length,
    });
    return { refreshed, skipped, scanned: rows.length };
  } catch (error) {
    finishIngestionRun(db, run.lastInsertRowid, "failed", {
      limit: limit ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function refreshCachedAonSpells(
  db: Database.Database,
  limit?: number,
) {
  const run = beginIngestionRun(db, "spell", {
    refreshCached: true,
    limit: limit ?? null,
  });
  try {
    const rows = db
      .prepare(
        `
      SELECT ce.entity_id as entityId, ce.name, ce.source_url as sourceUrl, pc.html
      FROM content_entities ce
      JOIN page_cache pc ON pc.url = ce.source_url
      WHERE ce.kind = 'spell'
        AND ce.origin = 'scrape'
        AND ce.source_url LIKE '%SpellDisplay.aspx?ItemName=%'
      ORDER BY ce.updated_at ASC
      LIMIT ?
    `,
      )
      .all(limit ?? Number.MAX_SAFE_INTEGER) as Array<{
      entityId: string;
      name: string;
      sourceUrl: string;
      html: string;
    }>;
    let refreshed = 0;
    let skipped = 0;
    for (const row of rows) {
      const parsed = parseAonSpellDetail(row.html, row.sourceUrl);
      const merged = { ...parsed, name: parsed.name || row.name };
      if (!merged.name) {
        skipped += 1;
        continue;
      }
      upsertScrapedEntity(
        db,
        "spell",
        row.entityId,
        merged.name,
        merged.sourceUrl,
        merged,
      );
      refreshed += 1;
    }
    finishIngestionRun(db, run.lastInsertRowid, "completed", {
      refreshed,
      skipped,
      scanned: rows.length,
    });
    return { refreshed, skipped, scanned: rows.length };
  } catch (error) {
    finishIngestionRun(db, run.lastInsertRowid, "failed", {
      limit: limit ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function scrapeAonSpells(
  db: Database.Database,
  className = "Wizard",
  limit?: number,
) {
  const run = beginIngestionRun(db, "spell", {
    className,
    limit: limit ?? null,
  });
  try {
    const listUrl = `${AON_BASE}Spells.aspx?Class=${encodeURIComponent(className)}`;
    const { html } = await fetchCachedPage(db, "aonprd", listUrl);
    const links = parseAonSpellLinks(html).slice(0, limit);
    for (const link of links) {
      const detail = await fetchCachedPage(db, "aonprd", link.url);
      const parsed = parseAonSpellDetail(detail.html, link.url);
      const merged = {
        ...parsed,
        name: parsed.name || link.name,
      };
      if (!merged.name) continue;
      insertScrapedEntity(db, "spell", merged.name, merged.sourceUrl, merged);
    }
    finishIngestionRun(db, run.lastInsertRowid, "completed", {
      className,
      imported: links.length,
    });
    return links.length;
  } catch (error) {
    finishIngestionRun(db, run.lastInsertRowid, "failed", {
      className,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function scrapeAonFeats(
  db: Database.Database,
  category = "Combat",
  limit?: number,
) {
  const run = beginIngestionRun(db, "feat", { category, limit: limit ?? null });
  try {
    const listUrl = `${AON_BASE}Feats.aspx?Category=${encodeURIComponent(category)}`;
    const { html } = await fetchCachedPage(db, "aonprd", listUrl);
    const links = parseAonFeatLinks(html).slice(0, limit);
    for (const link of links) {
      const detail = await fetchCachedPage(db, "aonprd", link.url);
      if (isGenericAonListingPageTitle(pageTitle(detail.html))) continue;
      const parsed = parseAonFeatDetail(detail.html, link.url);
      const merged = {
        ...parsed,
        name: parsed.name || link.name,
        category: parsed.category ?? category,
      };
      if (
        !merged.name ||
        (!merged.description && !merged.benefit && !merged.prerequisites)
      )
        continue;
      insertScrapedEntity(db, "feat", merged.name, merged.sourceUrl, merged);
    }
    finishIngestionRun(db, run.lastInsertRowid, "completed", {
      category,
      imported: links.length,
    });
    return links.length;
  } catch (error) {
    finishIngestionRun(db, run.lastInsertRowid, "failed", {
      category,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function scrapeAonFeatCatalog(
  db: Database.Database,
  options: { categories?: string[]; limitPerCategory?: number } = {},
): Promise<CatalogResult> {
  const discoveryUrl = `${AON_BASE}Feats.aspx?Category=Combat`;
  const { html } = await fetchCachedPage(db, "aonprd", discoveryUrl);
  const categories = options.categories?.length
    ? options.categories
    : parseAonFeatCategories(html);
  const results: Record<string, number> = {};
  let total = 0;
  for (const category of categories) {
    const imported = await scrapeAonFeats(
      db,
      category,
      options.limitPerCategory,
    );
    results[category] = imported;
    total += imported;
  }
  return { total, results };
}

export async function scrapeAonRaces(
  db: Database.Database,
  category = "NonCore",
  limit?: number,
) {
  const run = beginIngestionRun(db, "race", { category, limit: limit ?? null });
  try {
    const listUrl = `${AON_BASE}Races.aspx?Category=${encodeURIComponent(category)}`;
    const { html } = await fetchCachedPage(db, "aonprd", listUrl);
    const links = parseAonRaceLinks(html).slice(0, limit);
    for (const link of links) {
      const detail = await fetchCachedPage(db, "aonprd", link.url);
      const parsed = parseAonRaceDetail(detail.html, link.url, category);
      const merged = { ...parsed, name: link.name || parsed.name, category };
      if (!merged.name || !merged.size || !merged.speedText) continue;
      insertScrapedEntity(db, "race", merged.name, merged.sourceUrl, merged);
    }
    finishIngestionRun(db, run.lastInsertRowid, "completed", {
      category,
      imported: links.length,
    });
    return links.length;
  } catch (error) {
    finishIngestionRun(db, run.lastInsertRowid, "failed", {
      category,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function scrapeAonRaceCatalog(
  db: Database.Database,
  options: { categories?: string[]; limitPerCategory?: number } = {},
): Promise<CatalogResult> {
  const categories = options.categories?.length
    ? options.categories
    : [...AON_RACE_CATEGORIES];
  const results: Record<string, number> = {};
  let total = 0;
  for (const category of categories) {
    const imported = await scrapeAonRaces(
      db,
      category,
      options.limitPerCategory,
    );
    results[category] = imported;
    total += imported;
  }
  return { total, results };
}

export async function scrapeAonMagicItemUrls(
  db: Database.Database,
  urls: string[],
) {
  const normalizedUrls = urls.map((url) => absoluteUrl(url));
  const run = beginIngestionRun(db, "magic-item", { urls: normalizedUrls });
  try {
    for (const url of normalizedUrls) {
      const detail = await fetchCachedPage(db, "aonprd", url);
      const parsed = parseAonMagicItemDetail(detail.html, url);
      insertScrapedEntity(
        db,
        "magic-item",
        parsed.name,
        parsed.sourceUrl,
        parsed,
      );
    }
    finishIngestionRun(db, run.lastInsertRowid, "completed", {
      imported: normalizedUrls.length,
      urls: normalizedUrls,
    });
    return normalizedUrls.length;
  } catch (error) {
    finishIngestionRun(db, run.lastInsertRowid, "failed", {
      urls: normalizedUrls,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function scrapeAonMagicItemCatalog(
  db: Database.Database,
  meta: Record<string, unknown>,
  pages: Array<{
    page: string;
    listUrl: string;
    gridSelector: string;
    hrefPrefix: string;
    magicItemType: string;
    extra?: Record<string, unknown>;
  }>,
) {
  const run = beginIngestionRun(db, "magic-item", meta);
  try {
    const results: Record<string, number> = {};
    let total = 0;
    for (const page of pages) {
      const { html } = await fetchCachedPage(db, "aonprd", page.listUrl);
      const entries = parseAonMagicItemList(html, page.page, {
        gridSelector: page.gridSelector,
        hrefPrefix: page.hrefPrefix,
      });
      for (const entry of entries) {
        const detail = await fetchCachedPage(db, "aonprd", entry.url);
        const parsed = parseAonMagicItemDetail(detail.html, entry.url);
        const merged = {
          ...parsed,
          name: parsed.name || entry.name,
          price: parsed.price ?? entry.cost,
          slotPage: page.page,
          magicItemType: page.magicItemType,
          ...page.extra,
        };
        insertScrapedEntity(
          db,
          "magic-item",
          merged.name,
          merged.sourceUrl,
          merged,
        );
      }
      results[page.page] = entries.length;
      total += entries.length;
    }
    finishIngestionRun(db, run.lastInsertRowid, "completed", {
      total,
      results,
      ...meta,
    });
    return { total, results };
  } catch (error) {
    finishIngestionRun(db, run.lastInsertRowid, "failed", {
      ...meta,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function scrapeAonWondrousItems(db: Database.Database) {
  return scrapeAonMagicItemCatalog(
    db,
    { slots: AON_WONDROUS_SLOTS, magicItemType: "Wondrous" },
    AON_WONDROUS_SLOTS.map((slot) => ({
      page: slot,
      listUrl: `${AON_BASE}MagicWondrous.aspx?FinalSlot=${encodeURIComponent(slot)}`,
      gridSelector: "#MainContent_GridViewMagicWondrous",
      hrefPrefix: "MagicWondrousDisplay.aspx?FinalName=",
      magicItemType: "Wondrous",
    })),
  );
}

export async function scrapeAonRings(db: Database.Database) {
  return scrapeAonMagicItemCatalog(
    db,
    { pages: ["Rings"], magicItemType: "Ring" },
    [
      {
        page: "Rings",
        listUrl: `${AON_BASE}MagicRings.aspx`,
        gridSelector: "#MainContent_GridViewMagicRings",
        hrefPrefix: "MagicRingsDisplay.aspx?FinalName=",
        magicItemType: "Ring",
      },
    ],
  );
}

export async function scrapeAonRods(db: Database.Database) {
  return scrapeAonMagicItemCatalog(
    db,
    { categories: AON_ROD_CATEGORIES, magicItemType: "Rod" },
    AON_ROD_CATEGORIES.map((category) => ({
      page: category,
      listUrl: `${AON_BASE}MagicRods.aspx?Category=${encodeURIComponent(category)}`,
      gridSelector: "#MainContent_GridViewMagicRods",
      hrefPrefix: "MagicRodsDisplay.aspx?FinalName=",
      magicItemType: "Rod",
      extra: { rodCategory: category },
    })),
  );
}

export async function scrapeAonStaves(db: Database.Database) {
  return scrapeAonMagicItemCatalog(
    db,
    { pages: ["Staves"], magicItemType: "Staff" },
    [
      {
        page: "Staves",
        listUrl: `${AON_BASE}MagicStaves.aspx`,
        gridSelector: "#MainContent_GridViewMagicStaves",
        hrefPrefix: "MagicStavesDisplay.aspx?ItemName=",
        magicItemType: "Staff",
      },
    ],
  );
}

export async function refreshCachedAonClassFeatures(
  db: Database.Database,
  limit?: number,
) {
  const run = beginIngestionRun(db, "class-feature", {
    refreshCached: true,
    limit: limit ?? null,
  });
  try {
    const rows = db
      .prepare(
        `
      SELECT ce.entity_id as entityId, ce.name, ce.source_url as sourceUrl, pc.html
      FROM content_entities ce
      JOIN page_cache pc ON pc.url = ce.source_url
      WHERE ce.kind = 'class-feature'
        AND ce.origin = 'scrape'
        AND ce.source_url LIKE '%ClassDisplay.aspx?ItemName=%'
      ORDER BY ce.updated_at ASC
      LIMIT ?
    `,
      )
      .all(limit ?? Number.MAX_SAFE_INTEGER) as Array<{
      entityId: string;
      name: string;
      sourceUrl: string;
      html: string;
    }>;
    const grouped = new Map<string, { sourceUrl: string; html: string }>();
    for (const row of rows) {
      if (!grouped.has(row.sourceUrl))
        grouped.set(row.sourceUrl, {
          sourceUrl: row.sourceUrl,
          html: row.html,
        });
    }
    let refreshed = 0;
    let skipped = 0;
    for (const { sourceUrl, html } of grouped.values()) {
      const parsed = parseAonClassFeatureDetails(html, sourceUrl);
      for (const feature of parsed) {
        const entityName = `${feature.className} ${feature.name}`.trim();
        if (!entityName) {
          skipped += 1;
          continue;
        }
        upsertScrapedEntity(
          db,
          "class-feature",
          `scrape-aon-${slug(entityName)}`,
          entityName,
          feature.sourceUrl,
          feature,
        );
        refreshed += 1;
      }
    }
    finishIngestionRun(db, run.lastInsertRowid, "completed", {
      refreshed,
      skipped,
      scanned: rows.length,
      pages: grouped.size,
    });
    return { refreshed, skipped, scanned: rows.length, pages: grouped.size };
  } catch (error) {
    finishIngestionRun(db, run.lastInsertRowid, "failed", {
      limit: limit ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function scrapeAonClassFeatures(
  db: Database.Database,
  className = "Fighter",
) {
  const run = beginIngestionRun(db, "class-feature", { className });
  try {
    const sourceUrl = `${AON_BASE}ClassDisplay.aspx?ItemName=${encodeURIComponent(className)}`;
    const { html } = await fetchCachedPage(db, "aonprd", sourceUrl);
    const parsed = parseAonClassFeatureDetails(html, sourceUrl);
    for (const feature of parsed) {
      insertScrapedEntity(
        db,
        "class-feature",
        `${feature.className} ${feature.name}`,
        feature.sourceUrl,
        feature,
      );
    }
    finishIngestionRun(db, run.lastInsertRowid, "completed", {
      className,
      imported: parsed.length,
    });
    return parsed.length;
  } catch (error) {
    finishIngestionRun(db, run.lastInsertRowid, "failed", {
      className,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function scrapeAonBaseClassFeatures(db: Database.Database) {
  const results: Record<string, number> = {};
  let total = 0;
  for (const className of AON_BASE_CLASSES) {
    const imported = await scrapeAonClassFeatures(db, className);
    results[className] = imported;
    total += imported;
  }
  return { total, results };
}

export async function scrapeAonArmor(db: Database.Database) {
  const run = beginIngestionRun(db, "armor", {
    categories: AON_ARMOR_CATEGORIES,
  });
  try {
    const results: Record<string, number> = {};
    let total = 0;
    for (const category of AON_ARMOR_CATEGORIES) {
      const listUrl = `${AON_BASE}EquipmentArmor.aspx?Category=${encodeURIComponent(category)}`;
      const { html } = await fetchCachedPage(db, "aonprd", listUrl);
      const entries = parseAonArmorList(html, category);
      for (const entry of entries) {
        const detail = await fetchCachedPage(db, "aonprd", entry.url);
        const parsed = parseAonArmorDetail(detail.html, entry.url);
        const merged = {
          ...parsed,
          name: parsed.name || entry.name,
          categoryPage: category,
          cost: parsed.cost ?? entry.cost,
          armorBonus: parsed.armorBonus ?? entry.armorBonus,
          maxDexBonus: parsed.maxDexBonus ?? entry.maxDexBonus,
          armorCheckPenalty:
            parsed.armorCheckPenalty ?? entry.armorCheckPenalty,
          arcaneSpellFailure:
            parsed.arcaneSpellFailure ?? entry.arcaneSpellFailure,
          speed30: parsed.speed30 ?? entry.speed30,
          speed20: parsed.speed20 ?? entry.speed20,
          weight: parsed.weight ?? entry.weight,
        };
        insertScrapedEntity(db, "armor", merged.name, merged.sourceUrl, merged);
      }
      results[category] = entries.length;
      total += entries.length;
    }
    finishIngestionRun(db, run.lastInsertRowid, "completed", {
      total,
      results,
    });
    return { total, results };
  } catch (error) {
    finishIngestionRun(db, run.lastInsertRowid, "failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function scrapeAonGear(db: Database.Database) {
  const run = beginIngestionRun(db, "gear", {
    categories: AON_MISC_EQUIPMENT_CATEGORIES,
  });
  try {
    const results: Record<string, number> = {};
    let total = 0;
    for (const category of AON_MISC_EQUIPMENT_CATEGORIES) {
      const listUrl = `${AON_BASE}EquipmentMisc.aspx?Category=${encodeURIComponent(category)}`;
      const { html } = await fetchCachedPage(db, "aonprd", listUrl);
      const entries = parseAonGearList(html, category);
      for (const entry of entries) {
        const detail = await fetchCachedPage(db, "aonprd", entry.url);
        const parsed = parseAonGearDetail(detail.html, entry.url);
        const merged = {
          ...parsed,
          name: parsed.name || entry.name,
          categoryPage: category,
          cost: parsed.cost ?? entry.cost,
          weight: parsed.weight ?? entry.weight,
        };
        insertScrapedEntity(db, "gear", merged.name, merged.sourceUrl, merged);
      }
      results[category] = entries.length;
      total += entries.length;
    }
    finishIngestionRun(db, run.lastInsertRowid, "completed", {
      total,
      results,
    });
    return { total, results };
  } catch (error) {
    finishIngestionRun(db, run.lastInsertRowid, "failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function scrapeAonWeapons(db: Database.Database) {
  const run = beginIngestionRun(db, "weapon", {
    proficiencies: AON_WEAPON_PROFICIENCIES,
  });
  try {
    const results: Record<string, number> = {};
    let total = 0;
    for (const proficiency of AON_WEAPON_PROFICIENCIES) {
      const listUrl = `${AON_BASE}EquipmentWeapons.aspx?Proficiency=${encodeURIComponent(proficiency)}`;
      const { html } = await fetchCachedPage(db, "aonprd", listUrl);
      const entries = parseAonWeaponList(html, proficiency);
      for (const entry of entries) {
        const detail = await fetchCachedPage(db, "aonprd", entry.url);
        const parsed = parseAonWeaponDetail(detail.html, entry.url);
        const merged = {
          ...parsed,
          name: parsed.name || entry.name,
          proficiencyPage: proficiency,
          cost: parsed.cost ?? entry.cost,
          weight: parsed.weight ?? entry.weight,
          damageSmall: parsed.damageSmall ?? entry.damageSmall,
          damageMedium: parsed.damageMedium ?? entry.damageMedium,
          critical: parsed.critical ?? entry.critical,
          range: parsed.range ?? entry.range,
          type: parsed.type ?? entry.type,
          special: parsed.special ?? entry.special,
        };
        insertScrapedEntity(
          db,
          "weapon",
          merged.name,
          merged.sourceUrl,
          merged,
        );
      }
      results[proficiency] = entries.length;
      total += entries.length;
    }
    finishIngestionRun(db, run.lastInsertRowid, "completed", {
      total,
      results,
    });
    return { total, results };
  } catch (error) {
    finishIngestionRun(db, run.lastInsertRowid, "failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
