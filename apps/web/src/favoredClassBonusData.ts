import {
  favoredClassBonusOptions,
  type CharacterBuild,
} from "@mathfinder/rules-engine";

export interface FavoredClassBonusOption {
  value: string;
  label: string;
  description: string;
  disabled?: boolean;
  detail?: FavoredClassBonusDetail;
}

export interface FavoredClassBonusDetail {
  label: string;
  control: "text" | "select";
  options?: string[];
}

const FAVORED_TERRAINS = [
  "Cold",
  "Desert",
  "Forest",
  "Jungle",
  "Mountain",
  "Plains",
  "Planes (choose one)",
  "Swamp",
  "Underground",
  "Urban",
  "Water",
];

function detailForDescription(
  description: string,
): FavoredClassBonusDetail | undefined {
  if (
    /terrain type from the ranger['’]s favored terrain list/i.test(description)
  )
    return {
      label: "Chosen favored terrain",
      control: "select",
      options: FAVORED_TERRAINS,
    };
  if (/\b(?:select|choose) (?:one )?bloodline power\b/i.test(description))
    return { label: "Chosen bloodline power", control: "text" };
  return undefined;
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
      detail: detailForDescription(bonus.description),
    })),
  ];
}

export function favoredClassBonusDetailIsComplete(
  options: FavoredClassBonusOption[],
  value: string | undefined,
  detailValue: string | undefined,
) {
  const selected = options.find((option) => option.value === value);
  return !selected?.detail || !!detailValue?.trim();
}

export function favoredClassBonusCoverage(
  race: CharacterBuild["race"],
  className: string,
) {
  const ancestryOptions = favoredClassBonusOptions(race, className);
  return {
    hasAncestrySpecificOptions: ancestryOptions.length > 0,
    message:
      ancestryOptions.length > 0
        ? `${ancestryOptions.length} ancestry-specific option${ancestryOptions.length === 1 ? "" : "s"} loaded for ${race.name} ${className}.`
        : `Universal +1 HP and +1 skill rank are available. No ancestry-specific ${race.name} ${className} bonus is loaded yet.`,
  };
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
