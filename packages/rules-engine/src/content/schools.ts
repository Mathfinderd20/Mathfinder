import type { SpellExtraSlotsByLevel, SpellLibraryState } from "../types";

export interface SchoolDefinition {
  id: string;
  name: string;
  className: "wizard";
  spells: Partial<Record<number, string[]>>;
}

export const WIZARD_SCHOOLS: SchoolDefinition[] = [
  {
    id: "conjuration",
    name: "Conjuration",
    className: "wizard",
    spells: {
      0: ["Acid Splash"],
      1: ["Grease", "Mage Armor"],
      2: ["Invisibility"],
    },
  },
  {
    id: "evocation",
    name: "Evocation",
    className: "wizard",
    spells: {
      1: ["Burning Hands", "Magic Missile"],
      2: ["Scorching Ray"],
    },
  },
  {
    id: "illusion",
    name: "Illusion",
    className: "wizard",
    spells: {
      1: ["Color Spray", "Silent Image"],
      2: ["Blur", "Invisibility"],
    },
  },
  {
    id: "abjuration",
    name: "Abjuration",
    className: "wizard",
    spells: {
      1: ["Protection from Evil", "Shield"],
      2: ["Resist Energy"],
    },
  },
];

export const SCHOOLS: Record<string, SchoolDefinition> = Object.fromEntries(
  WIZARD_SCHOOLS.map((school) => [school.id, school]),
);

export function getSchool(id: string): SchoolDefinition | undefined {
  return SCHOOLS[id.toLowerCase()];
}

export function grantedSchoolSpells(
  schoolId: string | undefined,
): SpellLibraryState {
  const school = schoolId ? getSchool(schoolId) : undefined;
  const byLevel: SpellLibraryState = {};
  if (!school) return byLevel;
  for (const [levelText, spellNames] of Object.entries(school.spells)) {
    const level = Number(levelText);
    const current = byLevel[level] ?? [];
    for (const spellName of spellNames ?? []) {
      if (!current.includes(spellName)) current.push(spellName);
    }
    if (current.length > 0) byLevel[level] = current;
  }
  return byLevel;
}

export function schoolExtraSlots(
  schoolId: string | undefined,
): SpellExtraSlotsByLevel {
  const spells = grantedSchoolSpells(schoolId);
  const out: SpellExtraSlotsByLevel = {};
  for (const [levelText, names] of Object.entries(spells)) {
    const level = Number(levelText);
    if (level <= 0 || (names?.length ?? 0) === 0) continue;
    out[level] = 1;
  }
  return out;
}
