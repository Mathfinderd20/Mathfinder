import {
  getSpellEffectByName,
  searchCompendiumEntries,
  type SpellDefinition,
} from "@mathfinder/rules-engine";
import { getRuntimeSpell } from "./content";
import type { CompendiumOption } from "./components/CompendiumPicker";
import {
  buildSpellSearchText,
  spellMetaTag,
  spellSuggestionTooltip,
  spellTags,
} from "./spellSuggestions";

export interface SpellCompendiumOption extends CompendiumOption {
  spell?: SpellDefinition;
  metaTag: string;
  tagList: string[];
  schoolTag: string;
  sourceTag: string;
  sourceUrl?: string;
  supportTag: string;
  supportSummary: string;
  hasTrackedEffect: boolean;
}

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function spellSupportMeta(spell: SpellDefinition | undefined) {
  if (!spell)
    return {
      hasTrackedEffect: false,
      supportTag: "catalog-only",
      supportSummary: "Catalog entry only.",
    };
  const effect = getSpellEffectByName(spell.name);
  const hasTrackedEffect = !!effect;
  return hasTrackedEffect
    ? {
        hasTrackedEffect,
        supportTag: "tracked-effect",
        supportSummary: [
          effect.description,
          ...(effect.limitations ?? []).map((entry) => `Manual: ${entry}`),
        ].join(" "),
      }
    : {
        hasTrackedEffect,
        supportTag: "manual-resolution",
        supportSummary:
          "Runtime casting and cast logging available, but spell mechanics resolve manually.",
      };
}

export function buildSpellCompendiumOptions(
  spellOptions: Array<{
    id: string;
    name: string;
    source?: string;
    sourceUrl?: string;
  }>,
): SpellCompendiumOption[] {
  return spellOptions.map((spell) => {
    const fullSpell = getRuntimeSpell(spell.name);
    const metaTag = spellMetaTag(fullSpell);
    const tagList = spellTags(fullSpell);
    const schoolTag = fullSpell?.school?.trim() ?? "";
    const sourceTag = fullSpell?.source?.trim() || spell.source?.trim() || "";
    const sourceUrl = fullSpell?.sourceUrl?.trim() || spell.sourceUrl?.trim();
    const support = spellSupportMeta(fullSpell);
    return {
      id: spell.id,
      name: spell.name,
      spell: fullSpell,
      metaTag,
      tagList,
      schoolTag,
      sourceTag,
      sourceUrl,
      supportTag: support.supportTag,
      supportSummary: support.supportSummary,
      hasTrackedEffect: support.hasTrackedEffect,
      tooltip: spellSuggestionTooltip(fullSpell, {
        sourceTag,
        supportSummary: support.supportSummary,
      }),
      searchText:
        buildSpellSearchText(fullSpell, {
          sourceTag,
          supportTag: support.supportTag,
          supportSummary: support.supportSummary,
        }) || spell.name,
      tags: [metaTag, sourceTag, support.supportTag, ...tagList].filter(Boolean),
    };
  });
}

export function spellMatchesClassLevel(
  option: SpellCompendiumOption,
  classKey: string,
  level: number,
) {
  return !!option.spell?.classes?.some(
    (entry) =>
      normalize(entry.className) === normalize(classKey) &&
      entry.level === level,
  );
}

export function spellAvailableLevels(
  option: SpellCompendiumOption,
  classKey: string,
) {
  return [
    ...new Set(
      (option.spell?.classes ?? [])
        .filter((entry) => normalize(entry.className) === normalize(classKey))
        .map((entry) => entry.level),
    ),
  ].sort((a, b) => a - b);
}

export function filterSpellCompendiumOptions(
  options: SpellCompendiumOption[],
  args: {
    classKey?: string;
    level?: number | null;
    tag?: string | null;
    school?: string | null;
    query?: string;
  },
) {
  const classKey = normalize(args.classKey);
  const tag = normalize(args.tag ?? undefined);
  const school = normalize(args.school ?? undefined);
  const levelFiltered = options.filter((option) => {
    if (!classKey) return true;
    const levels = spellAvailableLevels(option, classKey);
    if (levels.length === 0) return false;
    return args.level == null ? true : levels.includes(args.level);
  });
  const tagFiltered = tag
    ? levelFiltered.filter((option) =>
        option.tagList.some((entry) => normalize(entry) === tag),
      )
    : levelFiltered;
  const schoolFiltered = school
    ? tagFiltered.filter((option) => normalize(option.schoolTag) === school)
    : tagFiltered;
  return searchCompendiumEntries(schoolFiltered, args.query ?? "", [
    (option) => option.searchText,
  ]);
}

export function collectSpellTags(options: SpellCompendiumOption[]) {
  return [...new Set(options.flatMap((option) => option.tagList))].sort(
    (a, b) => a.localeCompare(b),
  );
}

export function collectSpellSchools(options: SpellCompendiumOption[]) {
  return [
    ...new Set(options.map((option) => option.schoolTag).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
}
