import type { CharacterBuild } from "../build/types";
import type { SpellLibraryState } from "../types";
import { CORE_BLOODLINE_SPELLS } from "./core-spell-grants";

export interface SpellBloodlineDefinition {
  id: string;
  name: string;
  bonusSpells?: string[];
  spellNotes?: Partial<Record<number, string>>;
}
export const BLOODLINES: Record<string, SpellBloodlineDefinition> =
  Object.fromEntries(CORE_BLOODLINE_SPELLS.map((entry) => [entry.id, entry]));
export function configureBloodlineCatalog(
  entries: SpellBloodlineDefinition[],
  legacy = false,
) {
  for (const key of Object.keys(BLOODLINES)) delete BLOODLINES[key];
  for (const entry of [...(legacy ? CORE_BLOODLINE_SPELLS : []), ...entries])
    BLOODLINES[entry.id.toLowerCase()] = entry;
}
export function selectedBloodline(
  build: CharacterBuild,
  className = "sorcerer",
) {
  const key = className.toLowerCase();
  if (key !== "sorcerer") return undefined;
  const explicit = build.spellBloodlines?.[key];
  if (explicit !== undefined) return explicit || undefined;
  // Preserve existing review/legacy builds that recorded the choice as a feature.
  const features = build.levels
    .filter((level) => level.className.toLowerCase() === key)
    .flatMap((level) => level.features ?? []);
  return Object.values(BLOODLINES).find((entry) =>
    features.some((feature) =>
      [
        entry.name.toLowerCase() + " bloodline",
        "bloodline: " + entry.name.toLowerCase(),
      ].includes(feature.trim().toLowerCase()),
    ),
  )?.id;
}
export function grantedBloodlineSpells(
  id: string | undefined,
  classLevel: number,
): SpellLibraryState {
  const spells: SpellLibraryState = {};
  if (!id) return spells;
  for (const [index, name] of (
    BLOODLINES[id.toLowerCase()]?.bonusSpells ?? []
  ).entries()) {
    const level = index + 1;
    if (name && classLevel >= 2 * level + 1) spells[level] = [name];
  }
  return spells;
}
