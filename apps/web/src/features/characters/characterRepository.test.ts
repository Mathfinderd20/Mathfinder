import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import {
  CHARACTER_STORE_KEY,
  LEGACY_BUILD_KEY,
  LEGACY_LEVEL_KEY,
  LEGACY_RUNTIME_KEY,
  LEGACY_SLOTS_KEY,
  createCharacter,
  getCharacter,
  initializeCharacterStore,
  listCharacters,
  runtimeStorageKey,
  saveCharacter,
  type StorageLike,
} from "./characterRepository";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function build(name: string, levels = 1): CharacterBuild {
  return {
    name,
    race: { name: "Human", size: "medium", speed: 30 },
    baseAbilityScores: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    },
    levels: Array.from({ length: levels }, () => ({
      className: "Fighter",
      hitPointRoll: 10,
      skillRanks: {},
      feats: [],
      modifiers: [],
    })),
  };
}

function sequentialIds() {
  let index = 0;
  return () => `character-${++index}`;
}

const NOW = "2026-08-03T12:00:00.000Z";

describe("character repository", () => {
  it("initializes an empty versioned store once", () => {
    const storage = new MemoryStorage();
    const createId = sequentialIds();

    expect(
      initializeCharacterStore(storage, { now: () => NOW, createId })
        .characters,
    ).toEqual([]);
    expect(storage.getItem(CHARACTER_STORE_KEY)).not.toBeNull();

    storage.setItem(LEGACY_BUILD_KEY, JSON.stringify(build("Too Late")));
    expect(
      initializeCharacterStore(storage, { now: () => NOW, createId })
        .characters,
    ).toEqual([]);
  });

  it("migrates the current build, level, and runtime state", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_BUILD_KEY, JSON.stringify(build("Valeros", 4)));
    storage.setItem(LEGACY_LEVEL_KEY, "3");
    storage.setItem(LEGACY_RUNTIME_KEY, '{"resources":{"hp":2}}');

    const [record] = initializeCharacterStore(storage, {
      now: () => NOW,
      createId: sequentialIds(),
    }).characters;

    expect(record).toMatchObject({
      id: "character-1",
      name: "Valeros",
      currentLevel: 3,
    });
    expect(storage.getItem(runtimeStorageKey("character-1"))).toBe(
      '{"resources":{"hp":2}}',
    );
    expect(storage.getItem(LEGACY_BUILD_KEY)).not.toBeNull();
  });

  it("migrates valid slots while ignoring malformed entries", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LEGACY_SLOTS_KEY,
      JSON.stringify([
        { savedAt: "2026-01-01T00:00:00.000Z", build: build("Kyra", 2) },
        { savedAt: "never", build: null },
        { nonsense: true },
      ]),
    );

    const records = initializeCharacterStore(storage, {
      now: () => NOW,
      createId: sequentialIds(),
    }).characters;

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ name: "Kyra", currentLevel: 2 });
  });

  it("keeps the newest copy when legacy snapshots are identical", () => {
    const storage = new MemoryStorage();
    const duplicate = build("Ezren", 3);
    storage.setItem(LEGACY_BUILD_KEY, JSON.stringify(duplicate));
    storage.setItem(
      LEGACY_SLOTS_KEY,
      JSON.stringify([
        {
          savedAt: "2020-01-01T00:00:00.000Z",
          build: duplicate,
        },
      ]),
    );

    const records = initializeCharacterStore(storage, {
      now: () => NOW,
      createId: sequentialIds(),
    }).characters;

    expect(records).toHaveLength(1);
    expect(records[0]?.updatedAt).toBe(NOW);
  });

  it("creates, reads, and saves distinct records", () => {
    const storage = new MemoryStorage();
    const createId = sequentialIds();
    const first = createCharacter(storage, build("Amiri"), {
      now: () => NOW,
      createId,
    });
    const second = createCharacter(storage, build("Lini", 2), {
      now: () => NOW,
      createId,
    });

    expect(listCharacters(storage).map((record) => record.name)).toEqual([
      "Lini",
      "Amiri",
    ]);
    expect(getCharacter(storage, first.id)?.name).toBe("Amiri");

    saveCharacter(storage, second.id, build("Lini Updated", 3), 2, {
      now: () => "2026-08-04T00:00:00.000Z",
    });
    expect(getCharacter(storage, second.id)).toMatchObject({
      name: "Lini Updated",
      currentLevel: 2,
      updatedAt: "2026-08-04T00:00:00.000Z",
    });
  });
});
