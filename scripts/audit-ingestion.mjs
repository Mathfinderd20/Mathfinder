// Read-only catalogue inventory. Never opens a DB, uses credentials or classifies a domain as eligible.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const asset = path.join(root, "apps/web/public/usable-content.json");
const bytes = fs.readFileSync(asset);
const data = JSON.parse(bytes);
const byKind = {};
const duplicates = [];
for (const [kind, rows] of Object.entries(data.normalized)) {
  const names = new Map();
  let missingSourceUrl = 0;
  for (const row of rows) {
    if (!row.sourceUrl) missingSourceUrl++;
    const key = row.name?.trim().toLowerCase();
    if (key) names.set(key, [...(names.get(key) ?? []), row.id]);
  }
  for (const ids of names.values())
    if (ids.length > 1)
      duplicates.push({
        kind,
        ids,
        status: "ambiguous-name-collision-not-approved-duplicate",
      });
  byKind[kind] = {
    exportedRows: rows.length,
    missingSourceUrl,
    eligibility: "unknown-until-work-or-record-evidence-review",
  };
}
const copies = [
  "apps/web/public/usable-content.json",
  "apps/web/dist/usable-content.json",
  "apps/web/dist/usable-content-normalized.json",
  "apps/web/dist/usable-content-rules.json",
  "packages/content-db/data/mathfinder.sqlite",
  "sc-campaign.txt",
  "sc-perfect.txt",
];
const backupDir = path.join(root, ".cache/db-backups");
if (fs.existsSync(backupDir))
  for (const name of fs.readdirSync(backupDir))
    copies.push(`.cache/db-backups/${name}`);
const report = {
  generatedAt: new Date().toISOString(),
  scope: "repository artifact only; not a staging database inventory",
  assetSha256: createHash("sha256").update(bytes).digest("hex"),
  sourceSummary: data.summary,
  byKind,
  duplicateCandidates: duplicates,
  classification: {
    confirmedExcluded: 0,
    confirmedExcludedMeaning:
      "No record-level exclusion determination available; NOT a finding that all content is eligible",
    mixedContributions: "unknown: field lineage absent",
    legacyScrapedRecordsWithUnresolvedEligibility: data.summary.byOrigin.scrape,
    savageCompany:
      "exact source metadata exists; record membership and work scope still require review",
  },
  retainedCopies: copies.map((relative) => {
    const file = path.join(root, relative);
    return {
      path: relative,
      present: fs.existsSync(file),
      bytes: fs.existsSync(file) ? fs.statSync(file).size : null,
      action: "inventory-only; no deletion",
    };
  }),
  downstream: {
    stagingReferences: "not inspected: authenticated hosted access unavailable",
    areas: [
      "characters.build JSON",
      "character_runtime_states.state JSON",
      "campaign_effects.payload JSON",
      "campaign_events.payload JSON",
      "campaign session/notes/document payloads",
      "spellbooks/prepared spells/library spell IDs",
      "in-memory compendium indexes",
      "browser account caches and service worker caches",
    ],
    userData: "No user-created data inspected or changed",
  },
  inaccessibleCopies: [
    "other hosts' SQLite caches",
    "Supabase backups",
    "offline browsers",
    "Cloudflare immutable deployments",
    "Docker images",
    "external exports and Git clones",
  ],
  stagePurgeExecuted: false,
  productionTouched: false,
};
const destination = path.join(root, "docs/ingestion/REPOSITORY-IMPACT.json");
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      report: destination,
      byKind,
      duplicateGroups: duplicates.length,
      stagePurgeExecuted: false,
    },
    null,
    2,
  ),
);
