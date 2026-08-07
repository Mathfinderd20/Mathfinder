import {
  favoredClassBonusOptions,
  type CharacterBuild,
} from "@mathfinder/rules-engine";

export interface FavoredClassBonusOption {
  value: string;
  label: string;
  description: string;
}

export function buildFavoredClassBonusOptions(
  race: CharacterBuild["race"],
  className: string,
): FavoredClassBonusOption[] {
  return [
    {
      value: "",
      label: "None",
      description: "Do not claim a favored-class bonus.",
    },
    { value: "hp", label: "HP", description: "Gain 1 additional hit point." },
    {
      value: "skill",
      label: "Skill",
      description: "Gain 1 additional skill rank.",
    },
    ...favoredClassBonusOptions(race, className).map((bonus) => ({
      value: bonus.id,
      label: bonus.label,
      description: bonus.description,
    })),
  ];
}

export function favoredClassBonusLabel(
  race: CharacterBuild["race"],
  className: string,
  value: string | undefined,
) {
  if (!value) return "None";
  return (
    buildFavoredClassBonusOptions(race, className).find(
      (option) => option.value === value,
    )?.label ?? value
  );
}
