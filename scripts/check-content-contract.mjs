#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const CONTENT_AFFECTING_PREFIXES = [
  "packages/rules-data/",
  "packages/content-db/src/exporter.ts",
  "packages/content-db/src/seed-local.ts",
  "packages/content-db/src/armor-normalization.ts",
  "packages/content-db/src/gear-normalization.ts",
  "packages/content-db/src/rich-mapping.ts",
  "packages/content-db/src/overrides.ts",
];
const RUNTIME_ASSET_PATH = "apps/web/public/usable-content.json";

function fail(message) {
  console.error(`[content:contract] ${message}`);
  process.exit(1);
}

function gitDiffNames(baseRef, headRef) {
  const output = execFileSync(
    "git",
    ["diff", "--name-only", `${baseRef}...${headRef}`],
    { encoding: "utf8" },
  );
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasRelevantContentChange(filePath) {
  return CONTENT_AFFECTING_PREFIXES.some(
    (prefix) => filePath === prefix || filePath.startsWith(prefix),
  );
}

const [baseRef, headRef] = process.argv.slice(2);
if (!baseRef || !headRef) {
  fail("Usage: node scripts/check-content-contract.mjs <base-ref> <head-ref>");
}

const changedFiles = gitDiffNames(baseRef, headRef);
const relevantChanges = changedFiles.filter(hasRelevantContentChange);
const runtimeAssetChanged = changedFiles.includes(RUNTIME_ASSET_PATH);

if (relevantChanges.length === 0) {
  console.log(
    `[content:contract] No content-affecting source changes detected between ${baseRef} and ${headRef}.`,
  );
  process.exit(0);
}

if (!runtimeAssetChanged) {
  fail(
    [
      `Detected content-affecting changes between ${baseRef} and ${headRef} without a refreshed ${RUNTIME_ASSET_PATH}.`,
      "Relevant files:",
      ...relevantChanges.map((filePath) => `- ${filePath}`),
      `Required fix: run \`npm run content:refresh:web\` and commit ${RUNTIME_ASSET_PATH}.`,
    ].join("\n"),
  );
}

console.log(
  [
    `[content:contract] Content-affecting changes detected and runtime asset was refreshed.`,
    ...relevantChanges.map((filePath) => `- ${filePath}`),
    `- ${RUNTIME_ASSET_PATH}`,
  ].join("\n"),
);
