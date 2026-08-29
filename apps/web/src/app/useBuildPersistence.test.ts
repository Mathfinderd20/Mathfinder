import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import type { StorageLike } from "../features/characters/characterRepository";
import {
  loadBuildSlots,
  loadCurrentBuild,
  loadCurrentLevel,
} from "./useBuildPersistence";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function build(name: string): CharacterBuild {
  return {
    name,
    race: { name: "Human", size: "medium" },
    baseAbilityScores: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    },
    levels: [{ className: "Fighter", hitPointRoll: 10 }],
  };
}

describe("build persistence loading", () => {
  it("loads and normalizes the legacy current build and level", () => {
    const storage = new MemoryStorage();
    storage.setItem("mathfinder:web-build:v1", JSON.stringify(build("Legacy")));
    storage.setItem("mathfinder:web-current-level:v1", "9");

    expect(loadCurrentBuild(undefined, storage).name).toBe("Legacy");
    expect(loadCurrentLevel(undefined, storage)).toBe(9);
  });

  it("keeps valid saved slots when another slot is malformed", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "mathfinder:web-build-slots:v1",
      JSON.stringify([
        {
          id: "valid",
          label: "Valid",
          savedAt: "2026-01-01T00:00:00.000Z",
          build: build("Saved"),
        },
        { id: "broken", label: "Broken" },
      ]),
    );

    expect(loadBuildSlots(storage).map((slot) => slot.id)).toEqual(["valid"]);
  });
});
