import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRuntimeRelease,
  verifyRuntimeRelease,
  type ReleaseDecision,
} from "../packages/content-db/src/ingestion/release";
import type { Evidence } from "../packages/content-db/src/ingestion/model";
import type { UsableContentExport } from "../packages/content-db/src/exporter";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [inputPath, reviewPath] = process.argv.slice(2);
if (!inputPath || !reviewPath)
  throw new Error(
    "Usage: node --import tsx scripts/prepare-catalogue-release.ts INPUT_JSON REVIEW_JSON",
  );
const input = JSON.parse(
  readFileSync(path.resolve(inputPath), "utf8"),
) as UsableContentExport;
const review = JSON.parse(readFileSync(path.resolve(reviewPath), "utf8")) as {
  transitionReference: string;
  decisions: ReleaseDecision[];
  evidence: Evidence[];
};
const release = buildRuntimeRelease(
  input,
  review.decisions,
  new Map(review.evidence.map((e) => [e.id, e])),
  review.transitionReference,
);
const contentHash = verifyRuntimeRelease(release);
const directory = path.join(
  root,
  "packages/content-db/data/releases",
  contentHash,
);
mkdirSync(directory, { recursive: true });
const output = path.join(directory, "usable-content.json");
writeFileSync(output, JSON.stringify(release));
console.log(
  JSON.stringify({
    output,
    contentHash,
    approvedCopies: release.catalogueManifest.approved.length,
    unavailableCopies: release.catalogueManifest.unavailable.length,
    activated: false,
  }),
);
