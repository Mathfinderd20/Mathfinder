import {
  accountStorage,
  cacheGeneration,
  cacheWritable,
} from "../lib/accountCache";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSectionDraft } from "../features/characters/useSectionDraft";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import { initialBuild } from "../data";
import {
  getCharacter,
  saveCharacter,
  LOCAL_DATA_CHANGED_EVENT,
  type StorageLike,
} from "../features/characters/characterRepository";
import {
  normalizeBuild,
  syncTemplatedWeaponsToCampaignRules,
} from "./buildNormalization";

const CURRENT_BUILD_STORAGE_KEY = "mathfinder:web-build:v1";
const CURRENT_LEVEL_STORAGE_KEY = "mathfinder:web-current-level:v1";
const BUILD_SLOTS_STORAGE_KEY = "mathfinder:web-build-slots:v1";

export interface SavedBuildSlot {
  id: string;
  label: string;
  savedAt: string;
  build: CharacterBuild;
}

function browserStorage(storage?: StorageLike) {
  if (storage) return storage;
  return typeof window === "undefined" ? undefined : accountStorage;
}

export function loadCurrentBuild(
  characterId?: string,
  providedStorage?: StorageLike,
): CharacterBuild {
  const storage = browserStorage(providedStorage);
  if (!storage) return initialBuild;
  try {
    const character = characterId
      ? getCharacter(storage, characterId)
      : undefined;
    if (character) {
      return syncTemplatedWeaponsToCampaignRules(
        normalizeBuild(character.build),
      );
    }
    const raw = storage.getItem(CURRENT_BUILD_STORAGE_KEY);
    if (!raw) return initialBuild;
    return syncTemplatedWeaponsToCampaignRules(
      normalizeBuild(JSON.parse(raw) as CharacterBuild),
    );
  } catch {
    return initialBuild;
  }
}

export function loadCurrentLevel(
  characterId?: string,
  providedStorage?: StorageLike,
) {
  const storage = browserStorage(providedStorage);
  if (!storage) return initialBuild.levels.length;
  try {
    const character = characterId
      ? getCharacter(storage, characterId)
      : undefined;
    if (character) return character.currentLevel;
    const parsed = Number(storage.getItem(CURRENT_LEVEL_STORAGE_KEY));
    return Number.isFinite(parsed) && parsed >= 1
      ? Math.floor(parsed)
      : initialBuild.levels.length;
  } catch {
    return initialBuild.levels.length;
  }
}

function normalizeSavedSlot(value: unknown): SavedBuildSlot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const slot = value as Partial<SavedBuildSlot>;
  if (
    typeof slot.id !== "string" ||
    typeof slot.label !== "string" ||
    typeof slot.savedAt !== "string" ||
    !slot.build
  )
    return undefined;
  try {
    return {
      id: slot.id,
      label: slot.label,
      savedAt: slot.savedAt,
      build: syncTemplatedWeaponsToCampaignRules(normalizeBuild(slot.build)),
    };
  } catch {
    return undefined;
  }
}

export function loadBuildSlots(
  providedStorage?: StorageLike,
): SavedBuildSlot[] {
  const storage = browserStorage(providedStorage);
  if (!storage) return [];
  try {
    const raw = storage.getItem(BUILD_SLOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeSavedSlot)
          .filter((slot): slot is SavedBuildSlot => !!slot)
      : [];
  } catch {
    return [];
  }
}

export function useBuildPersistence(characterId?: string, autosave = true) {
  const mountedGeneration = useRef(cacheGeneration());
  const [pending, setPending, flushBuildPersistence] = useSectionDraft(
    characterId ?? "local",
    "build-section-draft",
    () => ({
      build: loadCurrentBuild(characterId),
      currentLevel: loadCurrentLevel(characterId),
    }),
    (next) => {
      if (!cacheWritable() || mountedGeneration.current !== cacheGeneration())
        return false;
      if (characterId) {
        if (!getCharacter(accountStorage, characterId)) return false;
        saveCharacter(
          accountStorage,
          characterId,
          next.build,
          next.currentLevel,
        );
      } else {
        accountStorage.setItem(
          CURRENT_BUILD_STORAGE_KEY,
          JSON.stringify(next.build),
        );
        accountStorage.setItem(
          CURRENT_LEVEL_STORAGE_KEY,
          `${next.currentLevel}`,
        );
      }
      return true;
    },
    autosave,
  );
  const { build, currentLevel } = pending;
  const setBuild: React.Dispatch<React.SetStateAction<CharacterBuild>> =
    useCallback(
      (next) =>
        setPending((previous) => ({
          ...previous,
          build: typeof next === "function" ? next(previous.build) : next,
        })),
      [setPending],
    );
  const setCurrentLevel: React.Dispatch<React.SetStateAction<number>> =
    useCallback(
      (next) =>
        setPending((previous) => ({
          ...previous,
          currentLevel:
            typeof next === "function" ? next(previous.currentLevel) : next,
        })),
      [setPending],
    );
  const [savedBuildSlots, setSavedBuildSlots] = useState<SavedBuildSlot[]>(() =>
    loadBuildSlots(),
  );
  useEffect(() => {
    setCurrentLevel((previous) =>
      Math.max(1, Math.min(build.levels.length, previous)),
    );
  }, [build.levels.length, setCurrentLevel]);

  useEffect(() => {
    accountStorage.setItem(
      BUILD_SLOTS_STORAGE_KEY,
      JSON.stringify(savedBuildSlots),
    );
    window.dispatchEvent(new CustomEvent(LOCAL_DATA_CHANGED_EVENT));
  }, [savedBuildSlots]);

  function buildSlotLabel() {
    return currentLevel === build.levels.length
      ? `${build.name} (L${currentLevel})`
      : `${build.name} (L${currentLevel}/${build.levels.length})`;
  }

  function saveNewBuildSlot() {
    const now = new Date().toISOString();
    const slot: SavedBuildSlot = {
      id: `${Date.now()}`,
      label: buildSlotLabel(),
      savedAt: now,
      build,
    };
    setSavedBuildSlots((previous) => [slot, ...previous]);
  }

  function overwriteBuildSlot(slotId: string) {
    const now = new Date().toISOString();
    setSavedBuildSlots((previous) =>
      previous.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              label: buildSlotLabel(),
              savedAt: now,
              build,
            }
          : slot,
      ),
    );
  }

  function restoreBuildSlot(slotId: string) {
    const slot = savedBuildSlots.find((entry) => entry.id === slotId);
    if (!slot) return false;
    const normalized = normalizeBuild(slot.build);
    setBuild(normalized);
    setCurrentLevel(normalized.levels.length);
    return true;
  }

  function deleteBuildSlot(slotId: string) {
    setSavedBuildSlots((previous) =>
      previous.filter((slot) => slot.id !== slotId),
    );
  }

  function resetPersistedBuild() {
    setBuild(initialBuild);
    setCurrentLevel(initialBuild.levels.length);
  }

  return {
    flushBuildPersistence,
    build,
    setBuild,
    currentLevel,
    setCurrentLevel,
    savedBuildSlots,
    deleteBuildSlot,
    overwriteBuildSlot,
    resetPersistedBuild,
    restoreBuildSlot,
    saveNewBuildSlot,
  };
}
