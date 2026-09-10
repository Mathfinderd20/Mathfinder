import type { DerivedSpellcasting } from "@mathfinder/rules-engine";

export interface RuntimeBuffView {
  id: string;
  name: string;
  description: string;
  limitations?: string[];
  trackerLabel?: string;
  trackerMax?: number;
  modifiers: Array<{
    target: string;
    value: number;
    source: string;
    type?: string;
  }>;
}

/** Mixed trade-offs stay neutral; color is semantic, not an activation highlight. */
export function effectDisposition(effect: {
  name: string;
  modifiers?: Array<{ value: number }>;
  effects?: Array<{ value: number }>;
}) {
  if (
    /^(fatigued|exhausted|shaken|sickened|frightened|panicked|stunned|dazed|blinded|deafened|bane|doom|bestow curse|blindness\/deafness|hold person|slow|ray of enfeeblement)$/i.test(
      effect.name,
    )
  )
    return "detrimental";
  if (
    /^(bless|aid|shield|mage armor|mirror image|blur|displacement|haste|barkskin|stoneskin|protection from evil|resist energy)$/i.test(
      effect.name,
    )
  )
    return "beneficial";
  const modifiers = effect.modifiers ?? effect.effects ?? [];
  const positive = modifiers.some((modifier) => modifier.value > 0);
  const negative = modifiers.some((modifier) => modifier.value < 0);
  return positive && !negative
    ? "beneficial"
    : negative && !positive
      ? "detrimental"
      : "neutral";
}

export interface RuntimeProfile {
  classNames: string[];
  meleeFocus: boolean;
  rangedFocus: boolean;
  casterFocus: boolean;
  strengthScore: number;
  dexScore: number;
  conScore: number;
}

export function collectOwnedSpellNames(entries: DerivedSpellcasting[]) {
  const names = new Map<string, string>();
  for (const entry of entries) {
    const collections = [
      entry.grantedSpells,
      entry.librarySpells,
      entry.selectedPreparedSpells,
      entry.selectedKnownSpells,
    ];
    for (const collection of collections) {
      for (const levelNames of Object.values(collection)) {
        for (const name of levelNames ?? []) {
          const trimmed = name.trim();
          if (trimmed) names.set(trimmed.toLowerCase(), trimmed);
        }
      }
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

export type RuntimeTacticalCategory =
  "offense" | "defense" | "mobility" | "casting" | "utility";

export interface RuntimeBuffInsight {
  categories: RuntimeTacticalCategory[];
  primaryCategory: RuntimeTacticalCategory;
  score: number;
  reasons: string[];
  searchText: string;
}

function hasAny(targets: string[], candidates: string[]) {
  return candidates.some((candidate) => targets.includes(candidate));
}

export function tacticalCategoryLabel(category: RuntimeTacticalCategory) {
  switch (category) {
    case "offense":
      return "Offense";
    case "defense":
      return "Defense";
    case "mobility":
      return "Mobility";
    case "casting":
      return "Casting";
    case "utility":
      return "Utility";
  }
}

export function analyzeRuntimeBuff(
  buff: RuntimeBuffView,
  profile: RuntimeProfile,
): RuntimeBuffInsight {
  const targets = buff.modifiers.map((modifier) =>
    modifier.target.toLowerCase(),
  );
  const categories: RuntimeTacticalCategory[] = [];
  const reasons: string[] = [];
  let score = 0;

  const offense =
    hasAny(targets, ["attack", "cmb", "str", "dex"]) ||
    targets.some((target) => target.startsWith("weapon."));
  const defense =
    hasAny(targets, ["ac", "cmd", "hp", "con"]) ||
    targets.some((target) => target.startsWith("save."));
  const mobility = hasAny(targets, ["speed", "init"]);
  const casting =
    hasAny(targets, ["int", "wis", "cha"]) ||
    targets.some(
      (target) => target.includes("spell") || target.includes("concentration"),
    );
  const utility =
    targets.some((target) => target.startsWith("skill.")) ||
    (!offense && !defense && !mobility && !casting);

  if (offense) categories.push("offense");
  if (defense) categories.push("defense");
  if (mobility) categories.push("mobility");
  if (casting) categories.push("casting");
  if (utility) categories.push("utility");

  if (offense) {
    score += 2;
    reasons.push("improves combat pressure");
    if (profile.meleeFocus && hasAny(targets, ["str", "attack", "cmb"])) {
      score += 2;
      reasons.push("fits melee plan");
    }
    if (profile.rangedFocus && hasAny(targets, ["dex", "attack", "init"])) {
      score += 2;
      reasons.push("fits ranged plan");
    }
  }

  if (defense) {
    score += 2;
    reasons.push("helps survivability");
    if (profile.conScore >= 14 && hasAny(targets, ["con", "hp", "save.all"])) {
      score += 1;
      reasons.push("synergizes with sturdy front-line stats");
    }
  }

  if (mobility) {
    score += 1;
    reasons.push("helps positioning or initiative");
  }

  if (casting) {
    score += 1;
    if (profile.casterFocus) {
      score += 3;
      reasons.push("relevant to active caster setup");
    } else {
      reasons.push("mostly matters for spell support");
    }
  }

  if (utility) {
    score += 1;
    reasons.push("useful outside pure damage math");
  }

  if (profile.strengthScore >= 16 && targets.includes("str")) {
    score += 1;
    reasons.push("leans into strong STR base");
  }
  if (profile.dexScore >= 16 && targets.includes("dex")) {
    score += 1;
    reasons.push("leans into strong DEX base");
  }
  if (profile.conScore >= 14 && targets.includes("con")) {
    score += 1;
    reasons.push("leans into solid CON base");
  }

  const uniqueReasons = [...new Set(reasons)];
  return {
    categories,
    primaryCategory: categories[0] ?? "utility",
    score,
    reasons: uniqueReasons,
    searchText: [
      buff.name,
      buff.description,
      ...targets,
      ...categories,
      ...uniqueReasons,
    ]
      .join(" ")
      .toLowerCase(),
  };
}
