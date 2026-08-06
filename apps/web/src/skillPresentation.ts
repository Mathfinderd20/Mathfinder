import type { AbilityKey } from "@mathfinder/rules-engine";

interface SkillMetadata {
  ability: AbilityKey;
  isClassSkill: boolean;
  trainedOnly: boolean;
  usable: boolean;
  armorCheckPenalty: boolean;
  className?: string;
}

export function skillTrainingFlag(trainedOnly: boolean, usable: boolean) {
  if (!trainedOnly) return "U";
  return usable ? "T" : "TU";
}

export function skillMetadataTooltip({
  ability,
  isClassSkill,
  trainedOnly,
  usable,
  armorCheckPenalty,
  className,
}: SkillMetadata) {
  const classContext = className ? ` for ${className}` : "";
  const training = !trainedOnly
    ? "U — Usable untrained."
    : usable
      ? "T — Trained-only and currently usable because the character has ranks."
      : "TU — Trained-only and currently unusable without at least 1 rank.";
  return [
    `${ability.toUpperCase()} — Key ability.`,
    isClassSkill
      ? `C — Class skill${classContext}; gains the +3 class-skill bonus once ranked.`
      : `Not a class skill${classContext}.`,
    training,
    armorCheckPenalty
      ? "A — Armor check penalty applies."
      : "Armor check penalty does not apply.",
  ].join("\n\n");
}
