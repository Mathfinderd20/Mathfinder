import {
  getSpellEffectByName,
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
  classLevels: Record<string, number[]>;
  searchBlob: string;
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
  classNames?: string[],
): SpellCompendiumOption[] {
  const classKeys = new Set((classNames ?? []).map(normalize).filter(Boolean));
  return spellOptions.flatMap((spell) => {
    const fullSpell = getRuntimeSpell(spell.name);
    if (
      classKeys.size > 0 &&
      !fullSpell?.classes.some((entry) =>
        classKeys.has(normalize(entry.className)),
      )
    ) {
      return [];
    }
    const metaTag = spellMetaTag(fullSpell);
    const tagList = spellTags(fullSpell);
    const schoolTag = fullSpell?.school?.trim() ?? "";
    const sourceTag = fullSpell?.source?.trim() || spell.source?.trim() || "";
    const sourceUrl = fullSpell?.sourceUrl?.trim() || spell.sourceUrl?.trim();
    const support = spellSupportMeta(fullSpell);
    const classLevels: Record<string, number[]> = {};
    for (const entry of fullSpell?.classes ?? []) {
      const key = normalize(entry.className);
      classLevels[key] ??= [];
      if (!classLevels[key]!.includes(entry.level))
        classLevels[key]!.push(entry.level);
    }
    const searchText =
      buildSpellSearchText(fullSpell, {
        sourceTag,
        supportTag: support.supportTag,
        supportSummary: support.supportSummary,
      }) || spell.name;
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
      classLevels,
      searchBlob: [spell.name, spell.id, searchText, ...tagList]
        .join(" ")
        .toLowerCase(),
      tooltip: spellSuggestionTooltip(fullSpell, {
        sourceTag,
        supportSummary: support.supportSummary,
      }),
      searchText,
      tags: [metaTag, sourceTag, support.supportTag, ...tagList].filter(
        Boolean,
      ),
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
  return option.classLevels[normalize(classKey)] ?? [];
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
  const search = normalize(args.query);
  return search
    ? schoolFiltered.filter((option) => option.searchBlob.includes(search))
    : schoolFiltered;
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
