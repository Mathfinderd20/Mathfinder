import type { ParsedScrapedClassFeature, ParsedScrapedSpell } from "./types";

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export interface ClassFeatureLevelOverride {
  levels?: number[];
  levelOptional?: boolean;
}

const CLASS_FEATURE_LEVEL_PATTERNS: Array<{
  match: RegExp;
  override: ClassFeatureLevelOverride;
}> = [
  {
    match: /weapon and armor proficienc(?:y|ies)$/i,
    override: { levelOptional: true },
  },
  { match: /(?:^| )spells$/i, override: { levelOptional: true } },
  { match: /spellbooks?$/i, override: { levelOptional: true } },
  { match: /bonus languages$/i, override: { levelOptional: true } },
  { match: /spontaneous casting$/i, override: { levelOptional: true } },
  {
    match: /chaotic, evil, good, and lawful spells$/i,
    override: { levelOptional: true },
  },
  {
    match: /(?:small|medium) (?:cavaliers|paladins)$/i,
    override: { levelOptional: true },
  },
  { match: /code of conduct$/i, override: { levelOptional: true } },
  { match: /associates$/i, override: { levelOptional: true } },
  { match: /challenge$/i, override: { levels: [1] } },
  { match: /smite (?:evil|good)$/i, override: { levels: [1] } },
  { match: /judgment$/i, override: { levels: [1] } },
  { match: /favored enemy$/i, override: { levels: [1] } },
  { match: /favored terrain$/i, override: { levels: [3] } },
  { match: /bloodline$/i, override: { levels: [1] } },
  { match: /wild talents$/i, override: { levels: [1] } },
  { match: /hexes$/i, override: { levels: [2] } },
  { match: /talents$/i, override: { levels: [2] } },
  { match: /tricks$/i, override: { levels: [2] } },
  { match: /rage power$/i, override: { levels: [2] } },
  { match: /animal focuses$/i, override: { levels: [1] } },
  { match: /lore master$/i, override: { levels: [5] } },
  { match: /damage reduction$/i, override: { levels: [9] } },
  { match: /spell kenning$/i, override: { levels: [5] } },
  { match: /slayer['’]s advance$/i, override: { levels: [2] } },
  { match: /studied target$/i, override: { levels: [1] } },
  { match: /calm spirit$/i, override: { levels: [1] } },
  { match: /phantom recall$/i, override: { levels: [1] } },
  { match: /maker['’]s call$/i, override: { levels: [1] } },
  { match: /charmed life$/i, override: { levels: [2] } },
  { match: /rogue['’]s edge$/i, override: { levels: [1] } },
  { match: /brawler['’]s cunning$/i, override: { levels: [1] } },
  { match: /ac bonus$/i, override: { levels: [1] } },
  { match: /slow fall$/i, override: { levels: [4] } },
  { match: /oracle['’]s curse$/i, override: { levels: [1] } },
  { match: /witch['’]s familiar$/i, override: { levels: [1] } },
  { match: /phrenic amplifications$/i, override: { levels: [1] } },
  { match: /arcanist exploits$/i, override: { levels: [1] } },
];

const SPELL_OVERRIDES: Record<string, Partial<ParsedScrapedSpell>> = {
  [normalize("Armor of Darkness")]: {
    levelText: "cleric 2",
  },
};

export function applySpellOverrides(
  spell: ParsedScrapedSpell,
): ParsedScrapedSpell {
  const override =
    SPELL_OVERRIDES[normalize(spell.name)] ??
    SPELL_OVERRIDES[normalize(spell.sourceUrl)];
  return override ? { ...spell, ...override } : spell;
}

export function resolveClassFeatureLevelOverride(
  feature: ParsedScrapedClassFeature,
): ClassFeatureLevelOverride | undefined {
  const name = normalize(feature.name);
  for (const entry of CLASS_FEATURE_LEVEL_PATTERNS) {
    if (entry.match.test(name)) return entry.override;
  }
  return undefined;
}
