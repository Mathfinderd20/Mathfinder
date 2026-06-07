import type { AbilityKey, DerivedSheet, DerivedStat } from "./types";

const ABILITY_ORDER: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

function sign(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/**
 * Render a derived sheet to a plain-text block. Handy for CLI/debug output and
 * as a reference for the eventual UI's stat layout.
 */
export function renderSheet(sheet: DerivedSheet): string {
  const lines: string[] = [];
  lines.push(`${sheet.name}  (level ${sheet.level}, ${sheet.size})`);
  lines.push("=".repeat(48));

  const abilityCols = ABILITY_ORDER.map((k) => {
    const a = sheet.abilities[k];
    return `${k.toUpperCase()} ${a.score} (${sign(a.mod)})`;
  });
  lines.push(abilityCols.join("   "));
  lines.push("");

  lines.push(`HP ${sheet.hitPoints.total}    Speed ${sheet.speed.total} ft    Init ${sign(sheet.initiative.total)}`);
  lines.push(
    `AC ${sheet.ac.normal.total}   Touch ${sheet.ac.touch.total}   Flat-Footed ${sheet.ac.flatFooted.total}`,
  );
  lines.push(
    `Fort ${sign(sheet.saves.fort.total)}   Ref ${sign(sheet.saves.ref.total)}   Will ${sign(sheet.saves.will.total)}`,
  );
  lines.push(
    `BAB ${sign(sheet.baseAttackBonus)}   Melee ${sign(sheet.attack.melee.total)}   Ranged ${sign(sheet.attack.ranged.total)}   CMB ${sign(sheet.cmb.total)}   CMD ${sheet.cmd.total}`,
  );
  lines.push("");

  lines.push("Skills (ranked / class):");
  const skills = Object.values(sheet.skills)
    .filter((s) => s.ranks > 0 || s.isClassSkill)
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const s of skills) {
    const tags = [
      s.isClassSkill ? "class" : "",
      s.trainedOnly && !s.usable ? "untrained: N/A" : "",
    ].filter(Boolean);
    const tagStr = tags.length ? `  [${tags.join(", ")}]` : "";
    lines.push(`  ${s.name.padEnd(24)} ${sign(s.total).padStart(4)}${tagStr}`);
  }

  return lines.join("\n");
}

/** Render a single stat's breakdown, e.g. "10 base +5 armor +2 dex = 17". */
export function explainStat(stat: DerivedStat): string {
  const parts = stat.breakdown.map((b) => `${sign(b.value)} ${b.source}`);
  return `${parts.join(" ")} = ${stat.total}`;
}
