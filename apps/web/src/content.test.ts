import type { RulesDataSet } from "@mathfinder/rules-data";
import { describe, expect, it } from "vitest";
import { raceOptionsFromDataSet, runtimeContentAssetUrl } from "./content";

describe("runtimeContentAssetUrl", () => {
  it("loads content from the app root regardless of the current route", () => {
    expect(runtimeContentAssetUrl("http://127.0.0.1:5173")).toBe(
      "http://127.0.0.1:5173/usable-content.json",
    );
  });
});

describe("raceOptionsFromDataSet", () => {
  it("preserves stable race ids when multiple packs use the same display name", () => {
    const race = (id: string) => ({
      id,
      name: "Human",
      size: "medium" as const,
      speed: 30,
      abilityModifiers: [],
    });
    const data = {
      packs: [
        { races: [race("human")] },
        { races: [race("scrape-aon-human")] },
      ],
    } as unknown as RulesDataSet;

    const races = raceOptionsFromDataSet(data);

    expect(races.human?.name).toBe("Human");
    expect(races["scrape-aon-human"]?.name).toBe("Human");
  });
});
