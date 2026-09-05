import { describe, expect, it } from "vitest";
import {
  appendRuntimeEvent,
  buildCompendiumIndex,
  createRuntimeStateSnapshot,
  getCachedCompendiumIndex,
  getCompendiumEntryById,
  getCompendiumEntryByName,
  getCompendiumEntriesByName,
  invalidateCompendiumIndex,
  searchCompendiumEntries,
} from "../src";

describe("compendium systems", () => {
  const entries = [
    {
      id: "ring-of-wizardry-i",
      name: "Ring of Wizardry I",
      pack: "core",
      source: "Core Rulebook",
      tags: ["arcane", "ring"],
    },
    {
      id: "cloak-of-resistance-1",
      name: "Cloak of Resistance +1",
      pack: "core",
      source: "Core Rulebook",
      tags: ["saves", "shoulders"],
    },
  ];

  it("builds reusable id and name indexes", () => {
    const index = buildCompendiumIndex(entries);
    expect(getCompendiumEntryById(index, "ring-of-wizardry-i")?.name).toBe(
      "Ring of Wizardry I",
    );
    expect(getCompendiumEntryByName(index, "cloak of resistance +1")?.id).toBe(
      "cloak-of-resistance-1",
    );
  });

  it("normalizes ids and preserves repeated names deterministically", () => {
    const index = buildCompendiumIndex([
      { id: "rage-l1", name: "Rage" },
      { id: "rage-later", name: " rage " },
    ]);

    expect(getCompendiumEntryById(index, " RAGE-L1 ")?.name).toBe("Rage");
    expect(getCompendiumEntryByName(index, "RAGE")?.id).toBe("rage-l1");
    expect(getCompendiumEntriesByName(index, "rage")).toHaveLength(2);
  });

  it("rejects duplicate normalized ids", () => {
    expect(() =>
      buildCompendiumIndex([
        { id: "spell-focus", name: "Spell Focus" },
        { id: " SPELL-FOCUS ", name: "Other Spell Focus" },
      ]),
    ).toThrow('Duplicate compendium id " SPELL-FOCUS ".');
  });

  it("caches by source identity and supports explicit invalidation", () => {
    const source = { first: entries[0]! };
    const first = getCachedCompendiumIndex(source, () => Object.values(source));
    const cached = getCachedCompendiumIndex(source, () => {
      throw new Error("cache miss");
    });
    expect(cached).toBe(first);

    source.first = entries[1]!;
    invalidateCompendiumIndex(source);
    const rebuilt = getCachedCompendiumIndex(source, () =>
      Object.values(source),
    );
    expect(rebuilt).not.toBe(first);
    expect(rebuilt.all[0]?.id).toBe("cloak-of-resistance-1");
  });

  it("searches across common metadata fields", () => {
    const index = buildCompendiumIndex(entries);
    expect(searchCompendiumEntries(index, "arcane")).toHaveLength(1);
    expect(searchCompendiumEntries(entries, "core rulebook")).toHaveLength(2);
    expect(searchCompendiumEntries(entries, "shoulders")[0]?.id).toBe(
      "cloak-of-resistance-1",
    );
  });
});

describe("runtime systems", () => {
  it("normalizes partial runtime snapshots", () => {
    expect(createRuntimeStateSnapshot({ flags: { fatigued: true } })).toEqual({
      toggles: {},
      flags: { fatigued: true },
      resources: {},
      slotUsage: {},
      collections: {},
      ledgers: {},
      histories: {},
      events: [],
    });
  });

  it("appends runtime events with a bounded history", () => {
    const result = appendRuntimeEvent(
      [
        { id: "1", at: "a", kind: "alpha" },
        { id: "2", at: "b", kind: "beta" },
      ],
      { id: "3", at: "c", kind: "gamma" },
      2,
    );
    expect(result.map((entry) => entry.id)).toEqual(["2", "3"]);
  });
});
