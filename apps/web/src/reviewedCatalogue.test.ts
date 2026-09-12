import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCharacter, type CharacterBuild } from "@mathfinder/rules-engine";

const collections = [
  "classes",
  "archetypes",
  "bloodlines",
  "kineticistElements",
  "phantomEmotionalFocuses",
  "eidolonSubtypes",
  "hexes",
  "blessings",
  "trapOptions",
  "buildGuides",
  "classFeatures",
  "feats",
  "races",
  "skills",
  "spells",
  "weapons",
  "magicItems",
  "domains",
  "schools",
  "spellEffects",
];
function content() {
  return {
    catalogueManifest: {
      schema: "reviewed-runtime/1",
      contentHash: "fixture-release",
      unavailable: [
        {
          scope: "normalized:spells",
          id: "saved-reference",
          reason: "unknown",
        },
      ],
    },
    normalized: { spells: [], armor: [], mundaneEquipment: [] },
    rulesDataSet: {
      schemaVersion: "0.1.0",
      sources: [],
      packs: [
        {
          id: "fixture",
          sourceId: "fixture",
          name: "Original test",
          version: "1",
          enabledByDefault: true,
          ...Object.fromEntries(collections.map((k) => [k, []])),
        },
      ],
    },
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe("reviewed runtime consumption", () => {
  it("rejects an old cached catalogue, retries, and does not reintroduce supplemental data", async () => {
    vi.stubEnv("VITE_REVIEWED_CATALOGUE_HASH", "fixture-release");
    vi.stubGlobal("window", {
      location: { origin: "https://stage.diresheets.com" },
    });
    let data: unknown = { rulesDataSet: { sources: [], packs: [] } };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    const runtime = await import("./content");
    await expect(runtime.loadRuntimeContent()).rejects.toThrow(
      "does not match",
    );
    data = content();
    await runtime.loadRuntimeContent();
    expect(runtime.RUNTIME_SPELL_OPTIONS).toEqual([]);
    expect(runtime.RUNTIME_ARMOR).toEqual([]);
    expect(runtime.RUNTIME_CLASS_OPTIONS).toEqual([]);
    expect(
      (
        await import("./features/ingestion/catalogueStatus")
      ).catalogueSnapshot(),
    ).toBe(1);
  });
  it("does not enrich by name from another normalized identity or offer unavailable placeholders", async () => {
    vi.stubEnv("VITE_REVIEWED_CATALOGUE_HASH", "fixture-release");
    vi.stubGlobal("window", {
      location: { origin: "https://stage.diresheets.com" },
    });
    const data = content();
    Object.assign(data.normalized, {
      spells: [
        {
          id: "different-variant",
          name: "Test ward",
          description: "Wrong entity prose",
          classes: [],
        },
      ],
    });
    Object.assign(data.rulesDataSet.packs[0]!, {
      spells: [
        {
          id: "correct-entity",
          name: "Test ward",
          pack: "fixture",
          classes: [],
        },
        {
          id: "saved-reference",
          name: "Unavailable catalogue record",
          pack: "fixture",
          classes: [],
          unavailable: true,
        },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    const runtime = await import("./content");
    await runtime.loadRuntimeContent();
    expect(runtime.getRuntimeSpell("Test ward")?.description).toBeUndefined();
    expect(runtime.RUNTIME_SPELL_OPTIONS.map((s) => s.id)).toEqual([
      "correct-entity",
    ]);
  });
  it("keeps saved references and user notes intact when definitions are unavailable", () => {
    const build: CharacterBuild = {
      name: "Original test hero",
      race: { name: "User race", size: "medium" },
      baseAbilityScores: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
      levels: [
        {
          className: "Unavailable class",
          hitPointRoll: 4,
          feats: ["Saved feat reference"],
        },
      ],
      spellLibrary: { wizard: { 1: ["Saved spell reference"] } },
    };
    const document = {
      id: "stable-character",
      notes: "Original private note",
      build,
    };
    const before = JSON.stringify(document);
    expect(() => buildCharacter(build, {}, {}, {}, {})).not.toThrow();
    expect(JSON.stringify(document)).toBe(before);
  });
});
