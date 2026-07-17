import type { SpellDefinition } from "@mathfinder/rules-engine";

export interface SpellSuggestionProfile {
  dominantClassName?: string;
  casterClassName?: string;
  casterSpellLevel?: number;
  meleeFocus: boolean;
  rangedFocus: boolean;
  casterFocus: boolean;
  stealthFocus: boolean;
  frontliner: boolean;
}

export function defaultSpellSuggestionProfile(
  className: string,
  spellLevel = 1,
): SpellSuggestionProfile {
  const casterClass = normalize(className);
  return {
    dominantClassName: className,
    casterClassName: className,
    casterSpellLevel: spellLevel,
    meleeFocus: [
      "paladin",
      "bloodrager",
      "magus",
      "warpriest",
      "ranger",
      "inquisitor",
    ].includes(casterClass),
    rangedFocus: [
      "ranger",
      "wizard",
      "sorcerer",
      "arcanist",
      "witch",
      "psychic",
    ].includes(casterClass),
    casterFocus: true,
    stealthFocus: ["bard", "mesmerist", "ranger", "witch"].includes(
      casterClass,
    ),
    frontliner: [
      "paladin",
      "warpriest",
      "bloodrager",
      "magus",
      "ranger",
      "inquisitor",
      "cleric",
      "druid",
    ].includes(casterClass),
  };
}

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function classLevelSummary(spell: SpellDefinition) {
  return spell.classes
    .slice()
    .sort((a, b) => a.level - b.level || a.className.localeCompare(b.className))
    .slice(0, 8)
    .map((entry) => `${entry.className} ${entry.level}`)
    .join(", ");
}

export function spellSuggestionTooltip(
  spell: SpellDefinition | undefined,
  extra?: { sourceTag?: string; supportSummary?: string },
) {
  if (!spell) return "";
  const parts = [
    spell.school,
    classLevelSummary(spell),
    extra?.sourceTag ? `Source: ${extra.sourceTag}` : undefined,
    extra?.supportSummary,
    spell.description?.slice(0, 280),
  ].filter(Boolean);
  return parts.join("\n\n");
}

export function buildSpellSearchText(
  spell: SpellDefinition | undefined,
  extra?: { sourceTag?: string; supportTag?: string; supportSummary?: string },
) {
  if (!spell) return "";
  return [
    spell.name,
    spell.school,
    classLevelSummary(spell),
    extra?.sourceTag,
    extra?.supportTag,
    extra?.supportSummary,
    spell.description?.slice(0, 240),
    ...spellTags(spell),
  ]
    .filter(Boolean)
    .join(" ");
}

export function spellMetaTag(spell: SpellDefinition | undefined) {
  if (!spell) return "";
  return [spell.school, classLevelSummary(spell)].filter(Boolean).join(" · ");
}

export function spellTags(spell: SpellDefinition | undefined) {
  if (!spell) return [];
  const text = normalize(
    `${spell.name} ${spell.school ?? ""} ${spell.description ?? ""}`,
  );
  const tags = new Set<string>();
  if (
    /mage armor|shield|mirror image|displacement|stoneskin|protection|resist energy|barkskin|sanctuary|blur|heroism|deflection|ward/.test(
      text,
    )
  )
    tags.add("defense");
  if (
    /entangle|grease|web|glitterdust|stinking cloud|hold person|confusion|slow|silence|sleep|spray|fog|wall|black tentacles|nauseat|stun/.test(
      text,
    )
  )
    tags.add("control");
  if (
    /magic missile|burning hands|scorching ray|fireball|lightning|cone of cold|flame strike|ray|missile|blast|storm|bolt|explosion|damage/.test(
      text,
    )
  )
    tags.add("damage");
  if (
    /cure |heal |restoration|breath of life|remove disease|remove curse|remove fear|remove paralysis|lesser restoration/.test(
      text,
    )
  )
    tags.add("healing");
  if (
    /bless|aid|haste|divine favor|bull'?s strength|cat'?s grace|bear'?s endurance|prayer|blessing of fervor|heroism|enlarge person/.test(
      text,
    )
  )
    tags.add("buff");
  if (
    /invisibility|illusion|silent image|disguise|darkness|shadow|stealth|silence/.test(
      text,
    )
  )
    tags.add("stealth");
  if (/summon|monster|ally/.test(text)) tags.add("summon");
  if (
    /teleport|fly|dimension door|detect |identify|comprehend|dispel|see invisibility|water breathing|tongues/.test(
      text,
    )
  )
    tags.add("utility");
  return [...tags];
}

export function spellSuggestionBadges(
  spell: SpellDefinition,
  profile: SpellSuggestionProfile,
) {
  const casterClass = normalize(
    profile.casterClassName || profile.dominantClassName,
  );
  const tags = spellTags(spell);
  const badges = [...tags];
  if (["wizard", "arcanist", "witch"].includes(casterClass))
    badges.push("arcane-control");
  if (
    ["cleric", "oracle", "warpriest", "inquisitor", "shaman"].includes(
      casterClass,
    )
  )
    badges.push("divine-support");
  if (["druid", "hunter", "ranger"].includes(casterClass))
    badges.push("nature-utility");
  if (["bard", "skald", "mesmerist"].includes(casterClass))
    badges.push("support-caster");
  if ((profile.casterSpellLevel ?? 0) <= 2) badges.push("low-level");
  return [...new Set(badges)].slice(0, 4);
}

export function scoreSpellSuggestion(
  spell: SpellDefinition,
  profile: SpellSuggestionProfile,
) {
  const text = normalize(
    `${spell.name} ${spell.school ?? ""} ${spell.description ?? ""}`,
  );
  const dominantClass = normalize(profile.dominantClassName);
  const casterClass = normalize(
    profile.casterClassName || profile.dominantClassName,
  );
  let score = 12 + Math.max(0, 6 - (profile.casterSpellLevel ?? 0));

  const tags = new Set(spellTags(spell));
  const isDefense = tags.has("defense");
  const isControl = tags.has("control");
  const isDamage = tags.has("damage");
  const isHealing = tags.has("healing");
  const isBuff = tags.has("buff");
  const isStealth = tags.has("stealth");
  const isSummon = tags.has("summon");
  const isUtility = tags.has("utility");
  const isSummonOrUtility = isSummon || isUtility;

  if (isDefense) score += profile.frontliner ? 22 : 14;
  if (isControl) score += profile.casterFocus || profile.stealthFocus ? 24 : 10;
  if (isDamage) score += profile.rangedFocus || profile.casterFocus ? 18 : 8;
  if (isHealing)
    score +=
      /cleric|druid|oracle|warpriest|paladin|inquisitor|ranger|hunter|shaman/.test(
        dominantClass,
      )
        ? 22
        : 10;
  if (isBuff)
    score +=
      profile.frontliner ||
      /bard|cleric|oracle|warpriest|inquisitor|skald/.test(dominantClass)
        ? 20
        : 10;
  if (isStealth) score += profile.stealthFocus ? 24 : 8;
  if (isSummonOrUtility) score += profile.casterFocus ? 16 : 8;
  if (
    /abjuration|divination|illusion|transmutation/.test(text) &&
    profile.casterFocus
  )
    score += 6;
  if (/conjuration\(healing\)|necromancy/.test(text) && isHealing) score += 4;

  if (["wizard", "arcanist", "witch"].includes(casterClass)) {
    if (isControl) score += 14;
    if (isUtility) score += 10;
    if (isDamage) score += 4;
    if (isHealing) score -= 12;
  }
  if (
    ["cleric", "oracle", "warpriest", "inquisitor", "shaman"].includes(
      casterClass,
    )
  ) {
    if (isHealing) score += 16;
    if (isBuff) score += 14;
    if (isDefense) score += 10;
    if (isDamage) score -= 4;
  }
  if (["druid", "hunter", "ranger"].includes(casterClass)) {
    if (isUtility) score += 12;
    if (isBuff) score += 10;
    if (isControl || isSummon) score += 10;
    if (isHealing) score += 6;
  }
  if (["bard", "skald", "mesmerist"].includes(casterClass)) {
    if (isBuff) score += 14;
    if (isControl) score += 12;
    if (isStealth) score += 8;
  }
  if (["sorcerer", "bloodrager", "magus", "psychic"].includes(casterClass)) {
    if (isDamage) score += 14;
    if (isBuff) score += 8;
    if (isControl) score += 6;
  }
  if (["paladin"].includes(casterClass)) {
    if (isDefense) score += 14;
    if (isBuff) score += 12;
    if (isHealing) score += 10;
  }

  return score;
}
