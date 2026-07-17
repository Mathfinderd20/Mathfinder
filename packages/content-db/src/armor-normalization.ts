import type { EquipmentEntry } from "@mathfinder/rules-engine";
import type { ParsedScrapedArmor } from "./types";

interface ArmorEntityRow {
  kind: string;
  origin: "seed" | "scrape";
  entityId: string;
  name: string;
  sourceUrl?: string;
  sourcePage?: number;
  payload: unknown;
}

export interface NormalizedArmorRecord {
  id: string;
  name: string;
  pack: string;
  source?: string;
  sourceUrl?: string;
  sourcePage?: number;
  costGp?: number;
  weightLb?: number;
  categoryRaw?: string;
  categoryNormalized?: "light" | "medium" | "heavy" | "shield";
  armorBonus?: number;
  maxDexBonus?: number;
  armorCheckPenalty?: number;
  arcaneSpellFailure?: number;
  speed30?: number;
  speed20?: number;
  description?: string;
  engineCompatible: boolean;
  equipmentEntry?: EquipmentEntry;
}

function cleanText(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseNumber(raw: string | undefined) {
  const match = cleanText(raw)
    .replace(/,/g, "")
    .match(/([+-]?\d+(?:\.\d+)?)/);
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

function parseSpeedFeet(raw: string | undefined) {
  return parseNumber(raw);
}

function parsePercent(raw: string | undefined) {
  return parseNumber(raw);
}

function normalizeArmorCategory(raw: string | undefined) {
  const text = cleanText(raw).toLowerCase();
  if (text.includes("shield")) return "shield" as const;
  if (text.includes("light")) return "light" as const;
  if (text.includes("medium")) return "medium" as const;
  if (text.includes("heavy")) return "heavy" as const;
  return undefined;
}

export function buildScrapedArmorRecords(
  rows: ArmorEntityRow[],
): NormalizedArmorRecord[] {
  const out: NormalizedArmorRecord[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.kind !== "armor" || row.origin !== "scrape") continue;
    const payload = row.payload as ParsedScrapedArmor & {
      categoryPage?: string;
    };
    const name = cleanText(payload.name || row.name);
    if (!name) continue;
    const id = row.entityId || slug(name);
    const categoryRaw =
      cleanText(payload.category || payload.categoryPage) || undefined;
    const categoryNormalized = normalizeArmorCategory(categoryRaw);
    const armorBonus = parseNumber(payload.armorBonus);
    const maxDexBonus = parseNumber(payload.maxDexBonus);
    const armorCheckPenalty = parseNumber(payload.armorCheckPenalty);
    const arcaneSpellFailure = parsePercent(payload.arcaneSpellFailure);
    const speed30 = parseSpeedFeet(payload.speed30);
    const speed20 = parseSpeedFeet(payload.speed20);
    const weightLb = parseWeightLb(payload.weight);
    const costGp = parseNumber(payload.cost);
    const description = cleanText(payload.description) || undefined;

    const equipmentEntry: EquipmentEntry | undefined =
      categoryNormalized === "shield"
        ? {
            kind: "mundane",
            itemTemplateId: id,
            name,
            costGp,
            weight: weightLb,
            equipped: true,
            slot: "shield",
            shield: {
              acBonus: armorBonus,
              checkPenalty: armorCheckPenalty,
            },
          }
        : categoryNormalized
          ? {
              kind: "mundane",
              itemTemplateId: id,
              name,
              costGp,
              weight: weightLb,
              equipped: true,
              slot: "armor",
              armor: {
                category: categoryNormalized,
                acBonus: armorBonus,
                maxDexBonus,
                checkPenalty: armorCheckPenalty,
                speedPenalty:
                  typeof speed30 === "number" && typeof speed20 === "number"
                    ? speed30 - speed20
                    : undefined,
              },
            }
          : undefined;

    const record: NormalizedArmorRecord = {
      id,
      name,
      pack: "aon-scraped-armor",
      source: payload.source,
      sourceUrl: row.sourceUrl,
      sourcePage: row.sourcePage,
      costGp,
      weightLb,
      categoryRaw,
      categoryNormalized,
      armorBonus,
      maxDexBonus,
      armorCheckPenalty,
      arcaneSpellFailure,
      speed30,
      speed20,
      description,
      engineCompatible: !!equipmentEntry,
      equipmentEntry,
    };

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(record);
  }
  return out;
}
