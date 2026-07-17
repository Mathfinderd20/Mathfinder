import type { SpellExtraSlotsByLevel, SpellLibraryState } from "../types";

export interface DomainDefinition {
  id: string;
  name: string;
  className: "cleric";
  spells: Partial<Record<number, string>>;
}

export const CLERIC_DOMAINS: DomainDefinition[] = [
  {
    id: "good",
    name: "Good",
    className: "cleric",
    spells: {
      1: "Bless",
      2: "Aid",
    },
  },
  {
    id: "healing",
    name: "Healing",
    className: "cleric",
    spells: {
      1: "Cure Light Wounds",
      2: "Aid",
    },
  },
  {
    id: "protection",
    name: "Protection",
    className: "cleric",
    spells: {
      1: "Shield of Faith",
      2: "Resist Energy",
    },
  },
  {
    id: "sun",
    name: "Sun",
    className: "cleric",
    spells: {
      1: "Bless",
      2: "Aid",
    },
  },
  {
    id: "travel",
    name: "Travel",
    className: "cleric",
    spells: {
      1: "Longstrider",
      2: "Aid",
    },
  },
  {
    id: "war",
    name: "War",
    className: "cleric",
    spells: {
      1: "Magic Weapon",
      2: "Bull's Strength",
    },
  },
];

export const DOMAINS: Record<string, DomainDefinition> = Object.fromEntries(
  CLERIC_DOMAINS.map((domain) => [domain.id, domain]),
);

export function getDomain(id: string): DomainDefinition | undefined {
  return DOMAINS[id.toLowerCase()];
}

export function grantedDomainSpells(domainIds: string[]): SpellLibraryState {
  const byLevel: SpellLibraryState = {};
  for (const id of domainIds) {
    const domain = getDomain(id);
    if (!domain) continue;
    for (const [levelText, spellName] of Object.entries(domain.spells)) {
      if (!spellName) continue;
      const level = Number(levelText);
      const current = byLevel[level] ?? [];
      if (!current.includes(spellName))
        byLevel[level] = [...current, spellName];
    }
  }
  return byLevel;
}

export function domainExtraSlots(domainIds: string[]): SpellExtraSlotsByLevel {
  const spells = grantedDomainSpells(domainIds);
  const out: SpellExtraSlotsByLevel = {};
  for (const [levelText, names] of Object.entries(spells)) {
    const level = Number(levelText);
    if (level <= 0 || (names?.length ?? 0) === 0) continue;
    out[level] = 1;
  }
  return out;
}
