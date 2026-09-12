import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { completeCoreSpellProgression } from "../packages/rules-engine/src/build/classes";
import type { UsableContentExport } from "../packages/content-db/src/exporter";

const root = path.resolve(import.meta.dirname, "..");
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const source = JSON.parse(
  fs.readFileSync(
    path.join(root, "apps/web/public/usable-content.json"),
    "utf8",
  ),
) as UsableContentExport;
function changedPaths(before: unknown, after: unknown, prefix = ""): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object"
  ) {
    const a = before as Record<string, unknown>,
      b = after as Record<string, unknown>;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) =>
      changedPaths(a[k], b[k], prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}
const comparisons = source.normalized.classes.map((before) => {
  const after = completeCoreSpellProgression(before);
  return {
    className: before.name,
    changedPaths: changedPaths(before, after),
    beforeHash: digest(JSON.stringify(before)),
    afterHash: digest(JSON.stringify(after)),
    before,
    after,
  };
});
const raceGroups = new Map<string, Array<{ id: string; bonusIds: string[] }>>();
for (const race of source.rulesDataSet.packs.flatMap((p) => p.races)) {
  const name = race.name.trim().toLowerCase();
  raceGroups.set(name, [
    ...(raceGroups.get(name) ?? []),
    {
      id: race.id,
      bonusIds: (race.favoredClassBonuses ?? []).map((b) => b.id),
    },
  ]);
}
const directory = path.join(
  root,
  "packages/content-db/data/quarantine-fixtures/runtime-review",
);
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(
  path.join(directory, "class-comparisons.json"),
  JSON.stringify(comparisons, null, 2),
);
const report = {
  generatedAt: new Date().toISOString(),
  status: "R17 user decision and authoritative table comparison pending",
  source: "Committed runtime export and current implementation; no mutation",
  runtimeRuleHash: digest(
    fs.readFileSync(
      path.join(root, "packages/rules-engine/src/build/classes.ts"),
      "utf8",
    ) +
      fs.readFileSync(
        path.join(
          root,
          "packages/rules-engine/src/build/divine-spell-progressions.ts",
        ),
        "utf8",
      ),
  ),
  classes: comparisons.map(({ before: _, after: __, ...metadata }) => metadata),
  raceNameGroupsWithDifferentIds: [...raceGroups]
    .filter(([, rows]) => new Set(rows.map((r) => r.id)).size > 1)
    .map(([name, records]) => ({ name, records })),
  privateBeforeAfter:
    "packages/content-db/data/quarantine-fixtures/runtime-review/class-comparisons.json",
  codeCitations: [
    "packages/rules-engine/src/build/classes.ts:getClassDefinition/completeCoreSpellProgression",
    "apps/web/src/content.ts:raceOptionsFromDataSet",
  ],
  authorityEvidence:
    "Code cites legacy.aonprd.com/coreRuleBook/classes/sorcerer.html; this does not verify every affected class or level.",
};
fs.writeFileSync(
  path.join(root, "docs/ingestion/R17-IMPACT.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    classesCompared: comparisons.length,
    classesChanged: comparisons
      .filter((c) => c.changedPaths.length)
      .map((c) => c.className),
    raceNameCollisionGroups: report.raceNameGroupsWithDifferentIds.length,
    privateBeforeAfter: report.privateBeforeAfter,
  }),
);
