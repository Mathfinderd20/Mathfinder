import {
  SKILL_DEFINITIONS,
  type AbilityKey,
  type BonusType,
  type MagicItemDefinition,
  type Modifier,
  type SkillKey,
} from "@mathfinder/rules-engine";

const SKILL_NAME_TO_KEY = new Map<string, SkillKey>([
  ...SKILL_DEFINITIONS.map(
    (skill) => [skill.name.toLowerCase(), skill.key] as const,
  ),
  ["sleight of hand", "sleight-of-hand"],
  ["disable device", "disable-device"],
  ["escape artist", "escape-artist"],
  ["handle animal", "handle-animal"],
  ["sense motive", "sense-motive"],
  ["use magic device", "use-magic-device"],
]);

const BONUS_TYPE_BY_TEXT: Array<[pattern: RegExp, type: BonusType]> = [
  [/\bnatural armor\b/i, "natural-armor"],
  [/\bdeflection\b/i, "deflection"],
  [/\bdodge\b/i, "dodge"],
  [/\benhancement\b/i, "enhancement"],
  [/\binsight\b/i, "insight"],
  [/\bluck\b/i, "luck"],
  [/\bmorale\b/i, "morale"],
  [/\bprofane\b/i, "profane"],
  [/\brace?ial\b/i, "racial"],
  [/\bresistance\b/i, "resistance"],
  [/\bsacred\b/i, "sacred"],
  [/\bshield\b/i, "shield"],
  [/\bsize\b/i, "size"],
  [/\btrait\b/i, "trait"],
  [/\balchemical\b/i, "alchemical"],
  [/\bcircumstance\b/i, "circumstance"],
  [/\bcompetence\b/i, "competence"],
  [/\binherent\b/i, "inherent"],
  [/\barmor\b/i, "armor"],
];

const ABILITY_NAME_TO_KEY: Record<string, AbilityKey> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

function cleanText(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeSkillMention(text: string) {
  return text.toLowerCase().replace(/[()]/g, "").replace(/\s+/g, " ").trim();
}

function extractMentionedSkills(text: string): SkillKey[] {
  const normalized = normalizeSkillMention(text);
  const matches: SkillKey[] = [];
  for (const [name, key] of SKILL_NAME_TO_KEY.entries()) {
    const bare = normalizeSkillMention(name);
    if (normalized.includes(bare)) matches.push(key);
  }
  return [...new Set(matches)];
}

function splitClauses(text: string) {
  return cleanText(text)
    .replace(/[–—−]/g, "-")
    .split(/(?<=[.;])\s+|<br\s*\/?>/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function detectBonusType(text: string, fallback: BonusType = "untyped") {
  for (const [pattern, type] of BONUS_TYPE_BY_TEXT) {
    if (pattern.test(text)) return type;
  }
  return fallback;
}

const CONDITION_PATTERNS = [
  /\bagainst [^.;,]+/gi,
  /\bvs\.? [^.;,]+/gi,
  /\bversus [^.;,]+/gi,
  /\bwhile [^.;,]+/gi,
  /\bwhen [^.;,]+/gi,
  /\bduring [^.;,]+/gi,
  /\bwearing [^.;,]+/gi,
  /\bwielding [^.;,]+/gi,
  /\busing [^.;,]+/gi,
  /\bmounted\b[^.;,]*/gi,
  /\bunderwater\b[^.;,]*/gi,
  /\bto avoid [^.;,]+/gi,
  /\bto confirm [^.;,]+/gi,
  /\bmade to [^.;,]+/gi,
  /\bused to [^.;,]+/gi,
  /\bon charges?[^.;,]*/gi,
  /\bwith (?:(?:a|an|the|one|two|light|heavy)\s+)?[^.;,]*(?:weapon|weapons|shield|shields|bow|bows|crossbow|crossbows|firearm|firearms|melee attacks?|ranged attacks?|unarmed attacks?|natural attacks?|combat maneuver checks?)\b[^.;,]*/gi,
] as const;

function detectCondition(text: string) {
  const normalized = cleanText(text);
  const matches: string[] = [];
  for (const pattern of CONDITION_PATTERNS) {
    for (const match of normalized.matchAll(pattern)) {
      const value = match[0]?.trim();
      if (value) matches.push(value);
    }
  }
  const unique = [...new Set(matches.map((value) => value.toLowerCase()))].map(
    (value) => matches.find((entry) => entry.toLowerCase() === value) ?? value,
  );
  const filtered = unique.filter((value, index) => {
    const lower = value.toLowerCase();
    return !unique.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        other.length > value.length &&
        other.toLowerCase().includes(lower),
    );
  });
  return filtered.join("; ") || undefined;
}

function modifierKey(modifier: Modifier) {
  return [
    modifier.target,
    modifier.type,
    modifier.value,
    modifier.source,
    modifier.condition ?? "",
    modifier.enabled === false ? "disabled" : "enabled",
  ].join("|");
}

function pushModifier(out: Modifier[], modifier: Modifier) {
  if (!Number.isFinite(modifier.value)) return;
  if (out.some((entry) => modifierKey(entry) === modifierKey(modifier))) return;
  out.push(modifier);
}

function buildModifier(
  target: Modifier["target"],
  value: number,
  source: string,
  pack: string,
  typeText: string,
  condition?: string,
): Modifier {
  return {
    target,
    type: detectBonusType(typeText),
    value,
    source,
    pack,
    ...(condition ? { condition, enabled: false } : {}),
  };
}

export function extractStructuredModifiers(
  text: string | undefined,
  source: string,
  pack: string,
) {
  const modifiers: Modifier[] = [];
  for (const clause of splitClauses(text ?? "")) {
    const condition = detectCondition(clause);

    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus on all saving throws/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "save.all",
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus on (Fortitude|Reflex|Will) saves?(?:\b|\s)/gi,
    )) {
      const target = {
        Fortitude: "save.fort",
        Reflex: "save.ref",
        Will: "save.will",
      }[match[3] ?? ""] as Modifier["target"] | undefined;
      if (!target) continue;
      pushModifier(
        modifiers,
        buildModifier(
          target,
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus on initiative checks/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "init",
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus to AC\b/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "ac",
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus on melee attack rolls/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "attack.melee",
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus on ranged attack rolls/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "attack.ranged",
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus on attack rolls/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "attack",
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus on attack rolls made to ([^.]+?)(?:\b|,|;)/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "attack",
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus on combat maneuver checks/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "cmb",
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus to CMD\b/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "cmd",
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus on melee damage rolls/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "damage.melee",
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus on ranged damage rolls/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "damage.ranged",
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus on damage rolls/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "damage",
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus on critical confirmation rolls/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "attack",
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition || "to confirm critical hits",
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus on ([^.]+?) checks/gi,
    )) {
      const skills = extractMentionedSkills(match[3] ?? "");
      for (const skill of skills) {
        pushModifier(
          modifiers,
          buildModifier(
            `skill.${skill}`,
            Number(match[1]),
            source,
            pack,
            match[2] ?? "",
            condition,
          ),
        );
      }
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)\s+([a-z -]+?)?bonus to (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?:\b| score\b)/gi,
    )) {
      const ability = ABILITY_NAME_TO_KEY[(match[3] ?? "").toLowerCase()];
      if (!ability) continue;
      pushModifier(
        modifiers,
        buildModifier(
          ability,
          Number(match[1]),
          source,
          pack,
          match[2] ?? "",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(/([+-]?\d+) hit points?\b/gi)) {
      pushModifier(
        modifiers,
        buildModifier(
          "hp",
          Number(match[1]),
          source,
          pack,
          "untyped",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /([+-]?\d+)[- ]foot\s+([a-z -]+?)?bonus to (?:base land )?speed\b/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "speed",
          Number(match[1]),
          source,
          pack,
          match[2] ?? "enhancement",
          condition,
        ),
      );
    }
    for (const match of clause.matchAll(
      /speed increases by ([+-]?\d+) feet\b/gi,
    )) {
      pushModifier(
        modifiers,
        buildModifier(
          "speed",
          Number(match[1]),
          source,
          pack,
          "enhancement",
          condition,
        ),
      );
    }
  }
  return modifiers;
}

function parseTierFromNameOrUrl(name: string, sourceUrl: string | undefined) {
  const explicit = cleanText(name).match(/\+\s*(\d+)\b/);
  if (explicit) return Number(explicit[1]);
  if (!sourceUrl) return undefined;
  const decoded = decodeURIComponent(sourceUrl.replace(/\+/g, " "));
  const finalName = decoded.match(/[?&]FinalName=([^&#]+)/i)?.[1] ?? decoded;
  const trailing = finalName.match(/(\d+)$/);
  return trailing ? Number(trailing[1]) : undefined;
}

function templateModifier(
  target: Modifier["target"],
  type: BonusType,
  value: number,
  source: string,
  pack: string,
): Modifier {
  return { target, type, value, source, pack };
}

export function deriveMagicItemAutomation(
  name: string,
  sourceUrl: string | undefined,
  rulesText: string | undefined,
  pack: string,
): Pick<
  MagicItemDefinition,
  "modifiers" | "automation" | "upgradeGroup" | "upgradeTier"
> {
  const normalizedName = cleanText(name).toLowerCase();
  const tier = parseTierFromNameOrUrl(name, sourceUrl);
  const modifiers = extractStructuredModifiers(rulesText, name, pack);
  let upgradeGroup: string | undefined;

  const maybePushTemplate = (
    target: Modifier["target"],
    type: BonusType,
    value: number,
  ) => {
    pushModifier(modifiers, templateModifier(target, type, value, name, pack));
  };

  if (tier) {
    if (normalizedName.includes("belt of giant strength")) {
      upgradeGroup = "belt-of-giant-strength";
      maybePushTemplate("str", "enhancement", tier);
    } else if (normalizedName.includes("belt of incredible dexterity")) {
      upgradeGroup = "belt-of-incredible-dexterity";
      maybePushTemplate("dex", "enhancement", tier);
    } else if (normalizedName.includes("belt of mighty constitution")) {
      upgradeGroup = "belt-of-mighty-constitution";
      maybePushTemplate("con", "enhancement", tier);
    } else if (normalizedName.includes("headband of vast intelligence")) {
      upgradeGroup = "headband-of-vast-intelligence";
      maybePushTemplate("int", "enhancement", tier);
    } else if (normalizedName.includes("headband of inspired wisdom")) {
      upgradeGroup = "headband-of-inspired-wisdom";
      maybePushTemplate("wis", "enhancement", tier);
    } else if (normalizedName.includes("headband of alluring charisma")) {
      upgradeGroup = "headband-of-alluring-charisma";
      maybePushTemplate("cha", "enhancement", tier);
    } else if (normalizedName.includes("cloak of resistance")) {
      upgradeGroup = "cloak-of-resistance";
      maybePushTemplate("save.all", "resistance", tier);
    } else if (normalizedName.includes("ring of protection")) {
      upgradeGroup = "ring-of-protection";
      maybePushTemplate("ac", "deflection", tier);
    } else if (normalizedName.includes("amulet of natural armor")) {
      upgradeGroup = "amulet-of-natural-armor";
      maybePushTemplate("ac", "natural-armor", tier);
    } else if (normalizedName.includes("bracers of armor")) {
      upgradeGroup = "bracers-of-armor";
      maybePushTemplate("ac", "armor", tier);
    }
  }

  if (normalizedName.includes("boots of striding and springing")) {
    upgradeGroup = upgradeGroup ?? "boots-of-striding-and-springing";
    maybePushTemplate("speed", "enhancement", 10);
  }

  const conditionalCount = modifiers.filter(
    (modifier) => modifier.enabled === false,
  ).length;
  const status =
    modifiers.length === 0
      ? "manual"
      : conditionalCount > 0
        ? "partial"
        : "automated";
  const notes =
    status === "manual"
      ? "No reliable universal modifier mapping extracted yet."
      : conditionalCount > 0
        ? "Includes extracted conditional modifiers; disabled by default until condition-aware automation is richer."
        : "Mapped from universal item templates/text patterns.";

  return {
    modifiers,
    automation: { status, notes },
    upgradeGroup,
    upgradeTier: tier,
  };
}
