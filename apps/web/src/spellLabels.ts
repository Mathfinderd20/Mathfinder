import { getRuntimeDomain, getRuntimeSchool, getRuntimeSpell } from "./content";

export function displayDomainName(domainId: string): string {
  return getRuntimeDomain(domainId)?.name ?? domainId;
}

export function displaySchoolName(schoolId: string | undefined): string {
  if (!schoolId) return "";
  return getRuntimeSchool(schoolId)?.name ?? schoolId;
}

export function displayDomainNames(domainIds: string[]): string[] {
  return domainIds.map(displayDomainName);
}

function titleCase(value: string): string {
  return value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function spellSchoolName(spellName: string): string | undefined {
  const school = getRuntimeSpell(spellName)?.school;
  return school ? titleCase(school) : undefined;
}

export function displaySpellName(spellName: string): string {
  const school = spellSchoolName(spellName);
  return school ? `${spellName} (${school})` : spellName;
}

export function displaySpellNames(spellNames: string[]): string[] {
  return spellNames.map(displaySpellName);
}

export function spellTitle(spellName: string): string {
  const school = spellSchoolName(spellName);
  return school ? `${spellName} — ${school}` : spellName;
}
