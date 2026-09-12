import fs from "node:fs";
import path from "node:path";
import { parseD20Spell } from "../packages/content-db/src/ingestion/d20pfsrd";
import { hash } from "../packages/content-db/src/ingestion/model";

const root = path.resolve(import.meta.dirname, "..");
const directory = path.join(
  root,
  "packages/content-db/data/quarantine-fixtures",
);
if (!fs.existsSync(directory))
  throw new Error("Run the bounded sample acquisition first");
const results = [];
const fields = [
  "school",
  "levelText",
  "classes",
  "castingTime",
  "components",
  "range",
  "target",
  "effect",
  "area",
  "duration",
  "savingThrow",
  "spellResistance",
  "description",
  "copyrightNotice",
];
for (const file of fs
  .readdirSync(directory)
  .filter((f) => f.endsWith(".json") && f !== "report.json")) {
  const metadata = JSON.parse(
    fs.readFileSync(path.join(directory, file), "utf8"),
  );
  const htmlFile = path.join(directory, file.replace(/\.json$/, ".html"));
  const parsed = parseD20Spell(fs.readFileSync(htmlFile, "utf8"), metadata.url);
  fs.writeFileSync(htmlFile, parsed.raw);
  fs.writeFileSync(
    path.join(directory, file),
    JSON.stringify(
      {
        ...metadata,
        ...parsed,
        raw: undefined,
        hash: hash(parsed.raw),
        eligibility: "unknown",
      },
      null,
      2,
    ),
  );
  results.push({
    url: metadata.url,
    parserVersion: parsed.parserVersion,
    validationErrors: parsed.warnings.filter((w) => w.severity === "error"),
    warnings: parsed.warnings.filter((w) => w.severity === "warning"),
    presentFields: fields.filter((f) => {
      const value = parsed.payload[f as keyof typeof parsed.payload];
      return (
        value !== undefined &&
        value !== "" &&
        (!Array.isArray(value) || value.length > 0)
      );
    }),
    eligibility: "unknown",
    outcome: "quarantine",
  });
}
const acquisition = JSON.parse(
  fs.readFileSync(path.join(directory, "report.json"), "utf8"),
) as { success: boolean; url: string; error?: string }[];
const report = {
  generatedAt: new Date().toISOString(),
  scope:
    "Private fixture acquisition and local reprocessing; no staging import",
  requested: acquisition.length,
  retrieved: results.length,
  failures: acquisition.filter((r) => !r.success),
  counts: {
    additions: 0,
    enrichments: 0,
    corrections: 0,
    unchanged: 0,
    conflicts: 0,
    quarantine: results.length,
    exclusions: 0,
    failures: acquisition.filter((r) => !r.success).length,
  },
  fieldExtraction: Object.fromEntries(
    fields.map((f) => [
      f,
      {
        present: results.filter((r) => r.presentFields.includes(f)).length,
        total: results.length,
        flagged: results.filter((r) =>
          [...r.validationErrors, ...r.warnings].some((w) => w.field === f),
        ).length,
      },
    ]),
  ),
  meaning:
    "Presence is not correctness, completeness is not authority. Missing optional fields can be legitimate. Additional variants block promotion. No licence classifications are inferred from parser success.",
  results,
  hundredSpellRun:
    "Not started: sample includes unresolved variant/correction layouts, eligibility and staging access remain unresolved",
};
fs.writeFileSync(
  path.join(root, "docs/ingestion/SAMPLE-RESULTS.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      requested: report.requested,
      retrieved: report.retrieved,
      counts: report.counts,
      blockingValidation: results.filter((r) => r.validationErrors.length)
        .length,
      fieldExtraction: report.fieldExtraction,
    },
    null,
    2,
  ),
);
