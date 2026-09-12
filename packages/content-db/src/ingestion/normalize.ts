import type { SpellPayload, Warning } from "./model";

const casterNames = new Set([
  "alchemist",
  "antipaladin",
  "arcanist",
  "bard",
  "bloodrager",
  "cleric",
  "druid",
  "hunter",
  "inquisitor",
  "investigator",
  "magus",
  "medium",
  "mesmerist",
  "occultist",
  "oracle",
  "paladin",
  "psychic",
  "ranger",
  "shaman",
  "skald",
  "sorcerer",
  "spiritualist",
  "summoner",
  "unchained summoner",
  "warpriest",
  "witch",
  "wizard",
]);
export function normalizeSpellFields(fields: Record<string, string>): {
  classes: SpellPayload["classes"];
  subschool?: string;
  descriptors?: string[];
  warnings: Warning[];
} {
  const warnings: Warning[] = [];
  const classes: SpellPayload["classes"] = [];
  for (const segment of (fields.levelText ?? "")
    .split(/[,;]/)
    .filter(Boolean)) {
    const match = segment.trim().match(/^([a-z][a-z /-]*?)\s+([0-9])$/i);
    const names = match?.[1]?.split("/").map((c) => c.trim().toLowerCase());
    if (!match || !names?.every((name) => casterNames.has(name))) {
      warnings.push({
        field: "classes",
        code: "ambiguous-level",
        severity: "warning",
      });
      continue;
    }
    for (const className of names)
      classes.push({ className, level: Number(match[2]) });
  }
  const school = fields.school?.match(
    /^([a-z]+)(?:\s*\(([^)]+)\))?(?:\s*\[([^\]]+)\])?$/i,
  );
  if (fields.school && !school)
    warnings.push({
      field: "school",
      code: "exceptional-school",
      severity: "warning",
    });
  return {
    classes,
    subschool: school?.[2],
    descriptors: school?.[3]?.split(",").map((s) => s.trim()),
    warnings,
  };
}
export function validateSpell(payload: SpellPayload): Warning[] {
  const warnings: Warning[] = [];
  for (const field of [
    "name",
    "school",
    "levelText",
    "castingTime",
    "components",
    "range",
    "duration",
    "description",
  ] as const)
    if (!payload[field])
      warnings.push({
        field,
        code: "missing",
        severity: ["name", "description"].includes(field) ? "error" : "warning",
      });
  if (!payload.classes.length)
    warnings.push({
      field: "classes",
      code: "no-valid-levels",
      severity: "error",
    });
  return warnings;
}
