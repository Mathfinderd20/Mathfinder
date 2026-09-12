import type { RulesDataSet } from "@mathfinder/rules-data";
import { describe, expect, it } from "vitest";
import {
  raceOptionsFromDataSet,
  runtimeContentAssetUrl,
  SAVAGE_COMPANY_ARMOR,
} from "./content";

describe("runtimeContentAssetUrl", () => {
  it("loads content from the app root regardless of the current route", () => {
    expect(runtimeContentAssetUrl("http://127.0.0.1:5173")).toBe(
      "http://127.0.0.1:5173/usable-content.json",
    );
  });
});

describe("Savage Company armor", () => {
  it("includes the manuscript armor table with projectile-defense metadata", () => {
    expect(SAVAGE_COMPANY_ARMOR).toHaveLength(7);
    expect(
      SAVAGE_COMPANY_ARMOR.find((armor) => armor.id === "sc-shooters-plate"),
    ).toMatchObject({
      name: "Shooters Plate",
      armorBonus: 3,
      costGp: 400,
      weightLb: 12,
      speed30: 30,
      speed20: 20,
      damageReductions: [
        expect.objectContaining({ value: 3, appliesAgainst: "Firearms" }),
      ],
    });
    expect(
      SAVAGE_COMPANY_ARMOR.find((armor) => armor.id === "sc-savage-plate"),
    ).toMatchObject({
      name: "Savage Plate",
      armorBonus: 6,
      rangedTouchArmorFraction: 0.5,
    });
    expect(
      SAVAGE_COMPANY_ARMOR.find((armor) => armor.id === "sc-ballistic-shield"),
    ).toMatchObject({
      name: "Ballistic Shield",
      rangedTouchShieldFraction: 1,
    });
  });
});

describe("raceOptionsFromDataSet", () => {
  it("preserves stable race ids when multiple packs use the same display name", () => {
    const race = (id: string, withFavoredBonus = false) => ({
      id,
      name: "Human",
      size: "medium" as const,
      speed: 30,
      abilityModifiers: [],
      weaponFamiliarity: {
        source: "Weapon Familiarity",
        specificWeapons: ["Greataxe"],
        martialWeaponNameIncludes: ["orc"],
      },
      favoredClassBonuses: withFavoredBonus
        ? [
            {
              id: "human-fighter",
              className: "Fighter",
              label: "Training",
              description: "Training bonus",
            },
          ]
        : undefined,
    });
    const data = {
      packs: [
        { races: [race("human")] },
        { races: [race("scrape-aon-human", true)] },
      ],
    } as unknown as RulesDataSet;

    const races = raceOptionsFromDataSet(data);

    expect(races.human?.name).toBe("Human");
    expect(races["scrape-aon-human"]?.name).toBe("Human");
    expect(races.human?.favoredClassBonuses?.[0]?.id).toBe("human-fighter");
    expect(races.human?.weaponFamiliarity).toEqual({
      source: "Weapon Familiarity",
      specificWeapons: ["Greataxe"],
      martialWeaponNameIncludes: ["orc"],
    });
    const reviewed = raceOptionsFromDataSet(data, { identityOnly: true });
    expect(reviewed.human?.favoredClassBonuses).toBeUndefined();
    expect(reviewed["scrape-aon-human"]?.favoredClassBonuses?.[0]?.id).toBe(
      "human-fighter",
    );
  });
});
