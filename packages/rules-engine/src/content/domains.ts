import type { SpellExtraSlotsByLevel, SpellLibraryState } from "../types";
import { CORE_DOMAIN_SPELLS } from "./core-spell-grants";

export interface DomainDefinition {
  id: string;
  name: string;
  className: "cleric";
  spells: Partial<Record<number, string>>;
  spellNotes?: Partial<Record<number, string>>;
}

export const CLERIC_DOMAINS: DomainDefinition[] = CORE_DOMAIN_SPELLS;

export const DOMAINS: Record<string, DomainDefinition> = Object.fromEntries(
  CLERIC_DOMAINS.map((domain) => [domain.id, domain]),
);

export function getDomain(id: string): DomainDefinition | undefined {
  return DOMAINS[id.trim().toLowerCase()];
}

/** Reviewed catalogs are authoritative; legacy catalogs use the corrected core tables. */
export function configureDomainCatalog(
  domains: DomainDefinition[],
  legacy = false,
) {
  for (const key of Object.keys(DOMAINS)) delete DOMAINS[key];
  for (const domain of [...domains, ...(legacy ? CLERIC_DOMAINS : [])])
    DOMAINS[domain.id.toLowerCase()] = domain;
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
