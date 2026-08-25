import { describe, expect, it } from "vitest";
import { applyCampaignRulesToWeapon } from "../src/campaign-rules";
import { computeSheet } from "../src/compute";
import {
  equipmentWeaponTemplate,
  getWeaponByName,
} from "../src/content/weapons";
import type { CharacterInput } from "../src/types";

describe("campaign firearm pricing", () => {
  it("applies Guns Everywhere from canonical cost without compounding", () => {
    const firearm = {
      name: "Pistol",
      category: "ranged" as const,
      proficiencyGroup: "exotic" as const,
      damageDice: "1d8",
      firearmCategory: "one-handed" as const,
      costGp: 1_000,
    };
    const discounted = applyCampaignRulesToWeapon(firearm, {
      firearmRules: "guns-everywhere",
    });
    expect(discounted).toMatchObject({
      proficiencyGroup: "simple",
      costGp: 100,
    });
    expect(applyCampaignRulesToWeapon(firearm).costGp).toBe(1_000);
  });
});

function input(extra: Partial<CharacterInput> = {}): CharacterInput {
  return {
    name: "Tester",
    level: 1,
    size: "medium",
    abilityScores: { str: 18, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    baseAttackBonus: 1,
    baseSaves: { fort: 2, ref: 0, will: 0 },
    modifiers: [],
    weapons: [
      {
        name: "Greataxe",
        category: "melee",
        proficiencyGroup: "martial",
        damageDice: "1d12",
        handedness: "two",
        critMultiplier: 3,
      },
      {
        name: "Longbow",
        category: "ranged",
        proficiencyGroup: "martial",
        damageDice: "1d8",
        critMultiplier: 3,
      },
      {
        name: "Longsword",
        category: "melee",
        proficiencyGroup: "martial",
        damageDice: "1d8",
        handedness: "one",
        critRange: 19,
      },
    ],
    ...extra,
  };
}

describe("weapon compendium", () => {
  it("looks up sample weapons by name", () => {
    expect(getWeaponByName("Greataxe")?.proficiencyGroup).toBe("martial");
    expect(getWeaponByName("Rapier")?.critRange).toBe(18);
    expect(getWeaponByName("Longbow")?.rangeIncrementFeet).toBe(100);
    expect(getWeaponByName("Dagger")?.damageTypes).toEqual([
      "piercing",
      "slashing",
    ]);
    expect(getWeaponByName("Rapier")?.specialTags).toEqual(["finesse"]);
    expect(getWeaponByName("Pistol")?.firearmCategory).toBe("one-handed");
    expect(getWeaponByName("Musket")?.misfire).toBe(1);
    expect(
      getWeaponByName("Blunderbuss")?.targetsTouchAcWithinFirstRangeIncrement,
    ).toBe(true);
  });

  it("builds equipment weapon payloads from a shared template", () => {
    const template = getWeaponByName("Pistol");
    const equipment = template ? equipmentWeaponTemplate(template) : undefined;
    expect(equipment?.weight).toBe(4);
    expect(equipment?.costGp).toBe(1000);
    expect(equipment?.weapon.weaponTemplateId).toBe("pistol");
    expect(equipment?.weapon.rangeIncrementFeet).toBe(20);
    expect(equipment?.weapon.damageTypes).toEqual(["piercing"]);
    expect(equipment?.weapon.specialTags).toEqual(["firearm", "reload"]);
    expect(equipment?.weapon.firearmCategory).toBe("one-handed");
    expect(equipment?.weapon.misfire).toBe(1);
    expect(equipment?.weapon.targetsTouchAcWithinFirstRangeIncrement).toBe(
      true,
    );
  });

  it("preserves weapon template ids and metadata on runtime weapon lines", () => {
    const sheet = computeSheet(
      input({
        weapons: [
          {
            name: "Pistol",
            weaponTemplateId: "pistol",
            category: "ranged",
            proficiencyGroup: "exotic",
            damageDice: "1d8",
            critMultiplier: 4,
            rangeIncrementFeet: 20,
            damageTypes: ["piercing"],
            specialTags: ["firearm", "reload"],
            ammoType: "bullet",
            ammoPerAttack: 1,
            reloadType: "move",
            firearmCategory: "one-handed",
            misfire: 1,
            targetsTouchAcWithinFirstRangeIncrement: true,
          },
        ],
        inventoryItems: [
          {
            name: "Bullets",
            quantity: 20,
            weightEach: 0.1,
            totalWeight: 2,
            costEachGp: 1,
            totalCostGp: 20,
            equipped: false,
          },
        ],
      }),
    );
    expect(sheet.weapons[0]?.name).toBe("Pistol");
    expect(sheet.weapons[0]?.weaponTemplateId).toBe("pistol");
    expect(sheet.weapons[0]?.rangeIncrementFeet).toBe(20);
    expect(sheet.weapons[0]?.damageTypes).toEqual(["piercing"]);
    expect(sheet.weapons[0]?.specialTags).toEqual(["firearm", "reload"]);
    expect(sheet.weapons[0]?.ammoAvailable).toBe(20);
    expect(sheet.weapons[0]?.reloadType).toBe("move");
    expect(sheet.weapons[0]?.firearmCategory).toBe("one-handed");
    expect(sheet.weapons[0]?.misfire).toBe(1);
    expect(sheet.weapons[0]?.targetsTouchAcWithinFirstRangeIncrement).toBe(
      true,
    );
  });
});

describe("weapon damage derivation", () => {
  const sheet = computeSheet(input());
  const [greataxe, longbow, longsword] = sheet.weapons;

  it("applies 1.5x Strength to two-handed melee damage", () => {
    expect(greataxe!.damageDisplay).toBe("1d12+6"); // floor(4 * 1.5)
    expect(greataxe!.attack.total).toBe(5); // BAB 1 + Str 4
    expect(greataxe!.crit).toBe("20/x3");
  });

  it("applies 1x Strength to one-handed melee and shows crit range", () => {
    expect(longsword!.damageDisplay).toBe("1d8+4");
    expect(longsword!.crit).toBe("19-20/x2");
  });

  it("adds no Strength to ranged damage by default", () => {
    expect(longbow!.damageDisplay).toBe("1d8");
    expect(longbow!.attack.total).toBe(3); // BAB 1 + Dex 2
  });

  it("applies Strength penalties in full instead of multiplying them by handedness", () => {
    const sheet = computeSheet(
      input({
        abilityScores: {
          str: 6,
          dex: 14,
          con: 12,
          int: 10,
          wis: 10,
          cha: 10,
        },
        weapons: [
          {
            name: "Greataxe",
            category: "melee",
            damageDice: "1d12",
            handedness: "two",
          },
          {
            name: "Off-hand Axe",
            category: "melee",
            damageDice: "1d6",
            handedness: "off",
          },
        ],
      }),
    );
    expect(sheet.weapons[0]?.damageDisplay).toBe("1d12-2");
    expect(sheet.weapons[1]?.damageDisplay).toBe("1d6-2");
  });

  it("honors non-Strength damage ability overrides", () => {
    const sheet = computeSheet(
      input({
        abilityScores: {
          str: 10,
          dex: 10,
          con: 10,
          int: 18,
          wis: 10,
          cha: 10,
        },
        weapons: [
          {
            name: "Mind Blade",
            category: "melee",
            damageDice: "1d8",
            damageAbility: "int",
          },
        ],
      }),
    );
    expect(sheet.weapons[0]?.damageDisplay).toBe("1d8+4");
    expect(sheet.weapons[0]?.damageBreakdown).toContainEqual(
      expect.objectContaining({ source: "Intelligence", value: 4 }),
    );
  });

  it("honors explicit Dexterity-to-damage overrides for ranged weapons", () => {
    const sheet = computeSheet(
      input({
        weapons: [
          {
            name: "Pistol",
            weaponTemplateId: "pistol",
            category: "ranged",
            proficiencyGroup: "exotic",
            damageDice: "1d8",
            critMultiplier: 4,
            rangeIncrementFeet: 20,
            ammoType: "bullet",
            ammoPerAttack: 1,
            reloadType: "move",
            firearmCategory: "one-handed",
            misfire: 1,
            targetsTouchAcWithinFirstRangeIncrement: true,
          },
        ],
        weaponDamageAbilityOverrides: { pistol: "dex" },
      }),
    );
    expect(sheet.weapons[0]?.damageDisplay).toBe("1d8+2");
    expect(sheet.weapons[0]?.damageBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "Dexterity", value: 2 }),
      ]),
    );
  });
});

describe("nonproficient weapon penalties", () => {
  it("applies -4 to a weapon's attack line without changing damage", () => {
    const sheet = computeSheet(
      input({
        weapons: [
          {
            name: "Greataxe",
            category: "melee",
            proficient: false,
            proficiencyGroup: "martial",
            damageDice: "1d12",
            handedness: "two",
            critMultiplier: 3,
          },
        ],
      }),
    );
    const greataxe = sheet.weapons[0]!;
    expect(greataxe.attack.total).toBe(1);
    expect(
      greataxe.attack.breakdown.some(
        (entry) => entry.source === "Nonproficient" && entry.value === -4,
      ),
    ).toBe(true);
    expect(greataxe.damageDisplay).toBe("1d12+6");
  });
});

describe("ammo and reload modeling", () => {
  it("derives ammo counts for ranged weapons from inventory", () => {
    const sheet = computeSheet(
      input({
        weapons: [
          {
            name: "Heavy Crossbow",
            category: "ranged",
            proficiencyGroup: "simple",
            damageDice: "1d10",
            critRange: 19,
            ammoType: "bolt",
            ammoPerAttack: 1,
            reloadType: "move",
          },
          {
            name: "Pistol",
            category: "ranged",
            proficiencyGroup: "exotic",
            damageDice: "1d8",
            critMultiplier: 4,
            ammoType: "bullet",
            ammoPerAttack: 1,
            reloadType: "move",
            firearmCategory: "one-handed",
            misfire: 1,
            targetsTouchAcWithinFirstRangeIncrement: true,
          },
        ],
        inventoryItems: [
          {
            name: "Crossbow Ammunition",
            ammoType: "Bolts",
            quantity: 12,
            weightEach: 0.1,
            totalWeight: 1.2,
            costEachGp: 0.1,
            totalCostGp: 1.2,
            equipped: false,
          },
          {
            name: "Bullets",
            quantity: 15,
            weightEach: 0.1,
            totalWeight: 1.5,
            costEachGp: 1,
            totalCostGp: 15,
            equipped: false,
          },
        ],
      }),
    );
    expect(sheet.weapons[0]?.ammoAvailable).toBe(12);
    expect(sheet.weapons[0]?.reloadType).toBe("move");
    expect(sheet.weapons[1]?.ammoAvailable).toBe(15);
    expect(sheet.weapons[1]?.misfire).toBe(1);
    expect(sheet.rangedCombat.ammoByType.bolt).toBe(12);
    expect(sheet.rangedCombat.ammoByType.bullet).toBe(15);
  });
});

describe("Power Attack damage flows into weapons", () => {
  it("adds the +damage side to melee weapons", () => {
    const sheet = computeSheet(
      input({
        modifiers: [
          {
            target: "attack.melee",
            type: "untyped",
            value: -1,
            source: "Power Attack",
          },
          {
            target: "damage.melee",
            type: "untyped",
            value: 2,
            source: "Power Attack",
          },
        ],
      }),
    );
    const greataxe = sheet.weapons[0]!;
    expect(greataxe.damageDisplay).toBe("1d12+8"); // 6 Str + 2 Power Attack
    expect(greataxe.attack.total).toBe(4); // 5 - 1 Power Attack
    // Ranged weapon unaffected by melee damage modifier.
    expect(sheet.weapons[1]!.damageDisplay).toBe("1d8");
  });
});
