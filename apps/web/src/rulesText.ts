import { getRuntimeFeat, getRuntimeSpell } from "./content";
import { displaySchoolName } from "./spellLabels";

function compactPrereqs(descriptions: string[]) {
  return descriptions.length > 0
    ? `Prereqs: ${descriptions.join(", ")}`
    : "Prereqs: none";
}

function compactSpellLevels(spellName: string) {
  const spell = getRuntimeSpell(spellName);
  if (!spell) return "";
  return spell.classes
    .slice()
    .sort((a, b) => a.level - b.level || a.className.localeCompare(b.className))
    .map(({ className, level }) => `${className} ${level}`)
    .join(", ");
}

export function featTitle(featName: string) {
  const feat = getRuntimeFeat(featName);
  if (!feat) return featName;
  return [
    feat.name,
    feat.description,
    compactPrereqs(feat.prerequisites.map((prereq) => prereq.description)),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function spellTitle(spellName: string) {
  const spell = getRuntimeSpell(spellName);
  if (!spell) return spellName;
  const school = spell.school ? displaySchoolName(spell.school) : undefined;
  const levels = compactSpellLevels(spellName);
  return [
    spell.name,
    school ? `School: ${school}` : undefined,
    levels ? `Class levels: ${levels}` : undefined,
    spell.description?.trim() ||
      "Description not loaded in this content pack yet.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
