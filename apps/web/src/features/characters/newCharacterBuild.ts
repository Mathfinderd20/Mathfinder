import type {
  AbilityKey,
  Alignment,
  CharacterBuild,
  SkillKey,
} from "@mathfinder/rules-engine";

interface FreshCharacterChoices {
  className: string;
  alignment: Alignment;
  hitPointRoll: number;
  baseAbilityScores: Record<AbilityKey, number>;
  flexibleAbility?: AbilityKey;
  raceBonusFeat?: string;
  skillRanks?: Partial<Record<SkillKey, number>>;
  feats?: string[];
  favoredClass?: string;
  favoredClassSelection?: string;
  ignoreAlignmentRestrictions?: boolean;
  ignoreEncumbrance?: boolean;
  alternateTraits?: string[];
  archetypes?: string[];
  spellLibrary?: CharacterBuild["spellLibrary"];
  spellSelections?: CharacterBuild["spellSelections"];
  spellDomains?: CharacterBuild["spellDomains"];
  spellSpecializations?: CharacterBuild["spellSpecializations"];
}

export function createFreshCharacterBuild(
  name: string,
  race: CharacterBuild["race"],
  choices: FreshCharacterChoices,
): CharacterBuild {
  const className = choices.className.trim();
  return {
    name: name.trim() || "Unnamed Hero",
    alignment: choices.alignment,
    race: {
      ...race,
      choiceSelection: {
        flexibleAbility: choices.flexibleAbility,
        bonusFeat: choices.raceBonusFeat?.trim() || undefined,
        alternateTraits: choices.alternateTraits ?? [],
      },
    },
    favoredClassName: className,
    classArchetypes: choices.archetypes?.length
      ? { [className.toLowerCase()]: choices.archetypes }
      : undefined,
    spellLibrary: choices.spellLibrary,
    spellSelections: choices.spellSelections,
    spellDomains: choices.spellDomains,
    spellSpecializations: choices.spellSpecializations,
    baseAbilityScores: choices.baseAbilityScores,
    levels: [
      {
        className,
        hitPointRoll: Math.max(1, choices.hitPointRoll),
        skillRanks: choices.skillRanks ?? {},
        feats: (choices.feats ?? []).filter((feat) => feat?.trim()),
        favoredClass: choices.favoredClass,
        favoredClassSelection: choices.favoredClassSelection,
        modifiers: [],
      },
    ],
    campaignRules: {
      firearmRules: "standard",
      ignoreAlignmentRestrictions:
        choices.ignoreAlignmentRestrictions || undefined,
      ignoreEncumbrance: choices.ignoreEncumbrance || undefined,
    },
    coinPurse: { pp: 0, gp: 0, sp: 0, cp: 0 },
    weapons: [],
    equipment: [],
  };
}
