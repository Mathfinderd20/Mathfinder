import type { Dispatch, SetStateAction } from "react";
import type { CharacterBuild, SkillKey } from "@mathfinder/rules-engine";
import { RUNTIME_CLASSES, RUNTIME_CLASS_OPTIONS } from "../content";
import { buildFavoredClassBonusOptions } from "../favoredClassBonusData";
import {
  normalizeFeatListLength,
  plannedFeatSlotsForLevel,
} from "../featSlots";

type Level = CharacterBuild["levels"][number];

export function levelAfterClassChange(
  previous: CharacterBuild,
  levelIndex: number,
  className: string,
): Level | undefined {
  const level = previous.levels[levelIndex];
  if (!level) return undefined;
  const classDefinition = RUNTIME_CLASSES[className.toLowerCase()];
  const favoredClassEligible =
    !!previous.favoredClassName &&
    previous.favoredClassName.toLowerCase() === className.toLowerCase();
  const availableBonuses = new Set(
    buildFavoredClassBonusOptions(previous.race, className).map(
      (option) => option.value,
    ),
  );
  const changedLevel: Level = {
    ...level,
    className,
    hitPointRoll: classDefinition
      ? Math.min(level.hitPointRoll, classDefinition.hitDie)
      : level.hitPointRoll,
    favoredClass:
      favoredClassEligible &&
      level.favoredClass !== undefined &&
      availableBonuses.has(level.favoredClass)
        ? level.favoredClass
        : undefined,
  };
  const previewLevels = previous.levels.map((entry, previewIndex) =>
    previewIndex === levelIndex ? changedLevel : entry,
  );
  const slotCount = plannedFeatSlotsForLevel(
    { ...previous, levels: previewLevels },
    levelIndex,
  ).length;
  return {
    ...changedLevel,
    feats: normalizeFeatListLength(changedLevel.feats, slotCount),
  };
}

export function useLevelEditor(
  build: CharacterBuild,
  setBuild: Dispatch<SetStateAction<CharacterBuild>>,
) {
  function makeDefaultLevelEntry(className?: string): Level {
    const resolvedClassName =
      className ??
      build.levels[build.levels.length - 1]?.className ??
      RUNTIME_CLASS_OPTIONS[0]?.name ??
      "Fighter";
    const classDefinition = RUNTIME_CLASSES[resolvedClassName.toLowerCase()];
    const hitDie = classDefinition?.hitDie ?? 8;
    return {
      className: resolvedClassName,
      hitPointRoll: Math.max(1, Math.ceil(hitDie / 2)),
      skillRanks: {},
      modifiers: [],
    };
  }

  function buildWithLevelCount(previous: CharacterBuild, count: number) {
    const target = Math.max(1, Math.min(20, count));
    if (previous.levels.length === target) return previous;
    if (previous.levels.length > target) {
      return { ...previous, levels: previous.levels.slice(0, target) };
    }
    const nextLevels = [...previous.levels];
    while (nextLevels.length < target) {
      const lastClassName =
        nextLevels[nextLevels.length - 1]?.className ??
        previous.levels[previous.levels.length - 1]?.className;
      nextLevels.push(makeDefaultLevelEntry(lastClassName));
    }
    return { ...previous, levels: nextLevels };
  }

  function updateLevelField<K extends keyof Level>(
    levelIndex: number,
    key: K,
    value: Level[K],
  ) {
    setBuild((previous) => ({
      ...previous,
      levels: previous.levels.map((level, itemIndex) => {
        if (itemIndex !== levelIndex) return level;
        if (key === "className" && typeof value === "string") {
          return levelAfterClassChange(previous, levelIndex, value) ?? level;
        }
        if (key === "hitPointRoll" && typeof value === "number") {
          const classDefinition =
            RUNTIME_CLASSES[level.className.toLowerCase()];
          const normalizedValue = Number.isFinite(value)
            ? Math.floor(value)
            : 1;
          return {
            ...level,
            hitPointRoll: Math.max(
              1,
              Math.min(
                classDefinition?.hitDie ?? normalizedValue,
                normalizedValue,
              ),
            ),
          };
        }
        return { ...level, [key]: value };
      }),
    }));
  }

  function addStructureLevel() {
    setBuild((previous) => ({
      ...previous,
      levels: [...previous.levels, makeDefaultLevelEntry()],
    }));
  }

  function ensureLevelCount(count: number) {
    setBuild((previous) => buildWithLevelCount(previous, count));
  }

  function setLevelFeat(levelIndex: number, featIndex: number, value: string) {
    setBuild((previous) => ({
      ...previous,
      levels: previous.levels.map((level, itemIndex) => {
        if (itemIndex !== levelIndex) return level;
        const current = [...(level.feats ?? [])];
        current[featIndex] = value.trim();
        const cleaned = current.map((feat) => feat.trim());
        while (cleaned.length > 0 && cleaned[cleaned.length - 1] === "")
          cleaned.pop();
        return { ...level, feats: cleaned.length > 0 ? cleaned : undefined };
      }),
    }));
  }

  function updateLevelSkillRank(
    levelIndex: number,
    skillKey: SkillKey,
    value: number,
  ) {
    setBuild((previous) => ({
      ...previous,
      levels: previous.levels.map((level, itemIndex) => {
        if (itemIndex !== levelIndex) return level;
        const current = { ...(level.skillRanks ?? {}) };
        if (value <= 0) delete current[skillKey];
        else current[skillKey] = value;
        return { ...level, skillRanks: current };
      }),
    }));
  }

  return {
    addStructureLevel,
    buildWithLevelCount,
    ensureLevelCount,
    setLevelFeat,
    updateLevelField,
    updateLevelSkillRank,
  };
}
