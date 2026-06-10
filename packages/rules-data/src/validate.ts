import type { RulesDataSet, RulesPack, ValidationIssue } from "./types";

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pushDuplicateIssues(
  issues: ValidationIssue[],
  path: string,
  names: string[],
) {
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) issues.push({ path, message: `Duplicate name: ${name}` });
    else seen.add(key);
  }
}

function validatePack(pack: RulesPack, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!hasText(pack.id)) issues.push({ path: `${path}.id`, message: "Pack id is required." });
  if (!hasText(pack.name)) issues.push({ path: `${path}.name`, message: "Pack name is required." });
  if (!hasText(pack.sourceId)) issues.push({ path: `${path}.sourceId`, message: "Pack sourceId is required." });
  if (!hasText(pack.version)) issues.push({ path: `${path}.version`, message: "Pack version is required." });

  pushDuplicateIssues(issues, `${path}.classes`, pack.classes.map((item) => item.name));
  pushDuplicateIssues(issues, `${path}.feats`, pack.feats.map((item) => item.name));
  pushDuplicateIssues(issues, `${path}.races`, pack.races.map((item) => item.name));
  pushDuplicateIssues(issues, `${path}.skills`, pack.skills.map((item) => item.name));
  pushDuplicateIssues(issues, `${path}.spells`, pack.spells.map((item) => item.name));

  for (const [index, feat] of pack.feats.entries()) {
    if (!hasText(feat.id)) issues.push({ path: `${path}.feats[${index}].id`, message: "Feat id is required." });
    if (!hasText(feat.pack)) issues.push({ path: `${path}.feats[${index}].pack`, message: "Feat pack is required." });
  }
  for (const [index, race] of pack.races.entries()) {
    if (!hasText(race.id)) issues.push({ path: `${path}.races[${index}].id`, message: "Race id is required." });
    if (!hasText(race.pack)) issues.push({ path: `${path}.races[${index}].pack`, message: "Race pack is required." });
  }
  for (const [index, cls] of pack.classes.entries()) {
    if (cls.hitDie <= 0) issues.push({ path: `${path}.classes[${index}].hitDie`, message: "Hit die must be positive." });
  }

  return issues;
}

export function validateRulesDataSet(data: RulesDataSet): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!hasText(data.schemaVersion)) issues.push({ path: "schemaVersion", message: "schemaVersion is required." });
  if (!hasText(data.generatedAt)) issues.push({ path: "generatedAt", message: "generatedAt is required." });

  pushDuplicateIssues(issues, "sources", data.sources.map((source) => source.id));
  pushDuplicateIssues(issues, "packs", data.packs.map((pack) => pack.id));

  for (const [index, source] of data.sources.entries()) {
    if (!hasText(source.id)) issues.push({ path: `sources[${index}].id`, message: "Source id is required." });
    if (!hasText(source.name)) issues.push({ path: `sources[${index}].name`, message: "Source name is required." });
  }
  for (const [index, pack] of data.packs.entries()) {
    issues.push(...validatePack(pack, `packs[${index}]`));
  }

  return issues;
}
