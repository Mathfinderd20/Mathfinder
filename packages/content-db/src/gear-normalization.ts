import type { EquipmentEntry } from "@mathfinder/rules-engine";
import type { ParsedScrapedGear } from "./types";

interface GearEntityRow {
  kind: string;
  origin: "seed" | "scrape";
  entityId: string;
  name: string;
  sourceUrl?: string;
  sourcePage?: number;
  payload: unknown;
}

export interface NormalizedMundaneEquipmentRecord {
  id: string;
  name: string;
  pack: string;
  source?: string;
  sourceUrl?: string;
  sourcePage?: number;
  categoryRaw?: string;
  costRaw?: string;
  costGp?: number;
  weightRaw?: string;
  weightLb?: number;
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

function parseFractionalNumber(raw: string) {
  const text = raw.trim();
  const fractionMatch = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) return Number(fractionMatch[1]) / Number(fractionMatch[2]);
  const mixedMatch = text.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch)
    return (
      Number(mixedMatch[1]) + Number(mixedMatch[2]) / Number(mixedMatch[3])
    );
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function parseCostGp(raw: string | undefined) {
  const text = cleanText(raw).toLowerCase().replace(/,/g, "");
  if (!text || text === "—") return undefined;
  const match = text.match(
    /(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+)\s*(pp|gp|sp|cp)/,
  );
  if (!match) return undefined;
  const amountToken = match[1];
  if (!amountToken) return undefined;
  const amount = parseFractionalNumber(amountToken);
  if (typeof amount !== "number") return undefined;
  switch (match[2]) {
    case "pp":
      return amount * 10;
    case "gp":
      return amount;
    case "sp":
      return amount / 10;
    case "cp":
      return amount / 100;
    default:
      return undefined;
  }
}

function parseWeightLb(raw: string | undefined) {
  const text = cleanText(raw).toLowerCase();
  if (!text || text === "—") return undefined;
  const match = text.match(
    /(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+)\s*(lb|lbs|oz)\.?/,
  );
  if (!match) return undefined;
  const amountToken = match[1];
  if (!amountToken) return undefined;
  const amount = parseFractionalNumber(amountToken);
  if (typeof amount !== "number") return undefined;
  return match[2] === "oz" ? amount / 16 : amount;
}

export function buildScrapedGearRecords(
  rows: GearEntityRow[],
): NormalizedMundaneEquipmentRecord[] {
  const out: NormalizedMundaneEquipmentRecord[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.kind !== "gear" || row.origin !== "scrape") continue;
    const payload = row.payload as ParsedScrapedGear & {
      categoryPage?: string;
    };
    const name = cleanText(payload.name || row.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const id = row.entityId || slug(name);
    const costRaw = cleanText(payload.cost) || undefined;
    const weightRaw = cleanText(payload.weight) || undefined;
    const categoryRaw =
      cleanText(payload.category || payload.categoryPage) || undefined;
    const costGp = parseCostGp(costRaw);
    const weightLb = parseWeightLb(weightRaw);
    const description = cleanText(payload.description) || undefined;
    const equipmentEntry: EquipmentEntry = {
      kind: "mundane",
      itemTemplateId: id,
      name,
      costGp,
      weight: weightLb,
      equipped: false,
    };
    out.push({
      id,
      name,
      pack: "aon-scraped-gear",
      source: payload.source,
      sourceUrl: row.sourceUrl,
      sourcePage: row.sourcePage,
      categoryRaw,
      costRaw,
      costGp,
      weightRaw,
      weightLb,
      description,
      engineCompatible: true,
      equipmentEntry,
    });
  }
  return out;
}
