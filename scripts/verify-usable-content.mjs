#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultAssetPath = path.resolve(
  repoRoot,
  "apps",
  "web",
  "public",
  "usable-content.json",
);
const assetPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : defaultAssetPath;

function fail(message) {
  console.error(`[content:verify] ${message}`);
  process.exit(1);
}

function assertArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
}

function countPackEntries(packs, key) {
  return packs.reduce((sum, pack) => {
    const value = pack?.[key];
    return sum + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

if (!fs.existsSync(assetPath)) {
  fail(`Runtime asset not found: ${assetPath}`);
}

const raw = fs.readFileSync(assetPath, "utf8");
if (!raw.trim()) fail(`Runtime asset is empty: ${assetPath}`);

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (error) {
  fail(
    `Runtime asset is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
  );
}

if (!parsed || typeof parsed !== "object") {
  fail("Runtime asset root must be an object.");
}

const rulesDataSet = parsed.rulesDataSet;
if (!rulesDataSet || typeof rulesDataSet !== "object") {
  fail("Runtime asset must contain a rulesDataSet object.");
}

assertArray(rulesDataSet.sources, "rulesDataSet.sources");
assertArray(rulesDataSet.packs, "rulesDataSet.packs");

if (rulesDataSet.sources.length === 0) {
  fail("rulesDataSet.sources must contain at least one source.");
}
if (rulesDataSet.packs.length === 0) {
  fail("rulesDataSet.packs must contain at least one pack.");
}

const sourceIds = new Set();
for (const source of rulesDataSet.sources) {
  if (!source || typeof source !== "object")
    fail("Every source must be an object.");
  if (typeof source.id !== "string" || !source.id.trim()) {
    fail("Every source must have a non-empty string id.");
  }
  if (sourceIds.has(source.id)) fail(`Duplicate source id: ${source.id}`);
  sourceIds.add(source.id);
}

const packIds = new Set();
for (const pack of rulesDataSet.packs) {
  if (!pack || typeof pack !== "object") fail("Every pack must be an object.");
  if (typeof pack.id !== "string" || !pack.id.trim()) {
    fail("Every pack must have a non-empty string id.");
  }
  if (packIds.has(pack.id)) fail(`Duplicate pack id: ${pack.id}`);
  packIds.add(pack.id);
  if (typeof pack.sourceId !== "string" || !pack.sourceId.trim()) {
    fail(`Pack ${pack.id} is missing sourceId.`);
  }
  if (!sourceIds.has(pack.sourceId)) {
    fail(`Pack ${pack.id} references unknown sourceId ${pack.sourceId}.`);
  }
}

const normalized = parsed.normalized;
if (normalized !== undefined) {
  if (!normalized || typeof normalized !== "object") {
    fail("normalized, when present, must be an object.");
  }
  if (normalized.archetypes !== undefined)
    assertArray(normalized.archetypes, "normalized.archetypes");
  if (normalized.spells !== undefined)
    assertArray(normalized.spells, "normalized.spells");
  if (normalized.armor !== undefined)
    assertArray(normalized.armor, "normalized.armor");
  if (normalized.mundaneEquipment !== undefined) {
    assertArray(normalized.mundaneEquipment, "normalized.mundaneEquipment");
  }
}

const archetypes = rulesDataSet.packs.flatMap((pack) => pack.archetypes ?? []);
const archetypeIds = new Set();
for (const archetype of archetypes) {
  if (!archetype.id || !archetype.name || !archetype.baseClassName) {
    fail(`Malformed archetype in pack ${archetype.pack ?? "<unknown>"}.`);
  }
  if (archetypeIds.has(archetype.id)) {
    fail(`Duplicate archetype id: ${archetype.id}`);
  }
  archetypeIds.add(archetype.id);
}

const favoredClassBonuses = rulesDataSet.packs.flatMap((pack) =>
  (pack.races ?? []).flatMap((race) =>
    (race.favoredClassBonuses ?? []).map((bonus) => ({ race, bonus })),
  ),
);
const favoredClassBonusIds = new Set();
for (const { race, bonus } of favoredClassBonuses) {
  if (!bonus.id || !bonus.className || !bonus.description) {
    fail(`Malformed favored-class bonus on race ${race.name ?? race.id}.`);
  }
  const scopedId = `${race.id}:${bonus.id}`;
  if (favoredClassBonusIds.has(scopedId)) {
    fail(`Duplicate favored-class bonus id ${bonus.id} on race ${race.name}.`);
  }
  favoredClassBonusIds.add(scopedId);
  if (bonus.automationStatus === "manual" && !bonus.sourceUrl) {
    fail(`Manual favored-class bonus ${bonus.id} is missing sourceUrl.`);
  }
}

const summary = {
  assetPath,
  sizeMb: Number((Buffer.byteLength(raw, "utf8") / (1024 * 1024)).toFixed(2)),
  sourceCount: rulesDataSet.sources.length,
  packCount: rulesDataSet.packs.length,
  classCount: countPackEntries(rulesDataSet.packs, "classes"),
  archetypeCount: archetypes.length,
  featCount: countPackEntries(rulesDataSet.packs, "feats"),
  raceCount: countPackEntries(rulesDataSet.packs, "races"),
  favoredClassBonusCount: favoredClassBonuses.length,
  spellCount: countPackEntries(rulesDataSet.packs, "spells"),
  weaponCount: countPackEntries(rulesDataSet.packs, "weapons"),
  magicItemCount: countPackEntries(rulesDataSet.packs, "magicItems"),
  normalizedSpellCount: Array.isArray(normalized?.spells)
    ? normalized.spells.length
    : 0,
  normalizedArmorCount: Array.isArray(normalized?.armor)
    ? normalized.armor.length
    : 0,
  normalizedMundaneEquipmentCount: Array.isArray(normalized?.mundaneEquipment)
    ? normalized.mundaneEquipment.length
    : 0,
};

console.log("[content:verify] Runtime content asset looks sane.");
console.log(JSON.stringify(summary, null, 2));
