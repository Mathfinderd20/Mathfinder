import { describe, expect, it } from "vitest";
import { computeSheet } from "../src/compute";
import {
  buildCharacter,
  levelDown,
  levelUp,
  validateBuild,
  type CharacterBuild,
  type LevelEntry,
} from "../src/build/character";

/** A fresh level-1 Half-Orc Barbarian built from scratch. */
function grukkLevel1(): CharacterBuild {
  return {
    name: "Grukk",
    race: {
      name: "Half-Orc",
      size: "medium",
      speed: 30,
      abilityModifiers: [
        { target: "str", type: "racial", value: 2, source: "Half-Orc" },
      ],
    },
    baseAbilityScores: { str: 14, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
    levels: [
      {
        className: "Barbarian",
        hitPointRoll: 12,
        skillRanks: { climb: 1, perception: 1, intimidate: 1, survival: 1 },
        feats: ["Toughness"], // +3 HP auto-applied from the feat registry
      },
    ],
  };
}

function humanLevel1(): CharacterBuild {
  return {
    name: "Ada",
    race: {
      id: "human",
      name: "Human",
      size: "medium",
      speed: 30,
      abilityModifiers: [],
      choiceOptions: {
        flexibleAbilityBonus: { value: 2 },
        bonusFeat: { count: 1 },
        extraSkillRanksPerLevel: 1,
      },
      choiceSelection: {
        flexibleAbility: "int",
        bonusFeat: "Toughness",
      },
    },
    baseAbilityScores: { str: 10, dex: 12, con: 12, int: 14, wis: 10, cha: 8 },
    levels: [
      {
        className: "Barbarian",
        hitPointRoll: 12,
        skillRanks: {
          climb: 1,
          perception: 1,
          intimidate: 1,
          survival: 1,
          swim: 1,
        },
        feats: ["Dodge"],
      },
    ],
  };
}

describe("buildCharacter + computeSheet (level 1)", () => {
  const sheet = computeSheet(buildCharacter(grukkLevel1()));

  it("applies racial ability bonus into the derived score", () => {
    expect(sheet.abilities.str.score).toBe(16); // 14 base + 2 racial
    expect(sheet.abilities.str.mod).toBe(3);
  });

  it("derives BAB and saves from the class progression", () => {
    expect(sheet.baseAttackBonus).toBe(1); // full BAB
    expect(sheet.saves.fort.total).toBe(4); // good save base 2 + Con 2
    expect(sheet.saves.ref.total).toBe(1); // poor 0 + Dex 1
    expect(sheet.saves.will.total).toBe(1); // poor 0 + Wis 1
  });

  it("computes HP from the rolled hit die plus Toughness", () => {
    expect(sheet.hitPoints.total).toBe(17); // max(1, 12 + 2) + 3
  });

  it("treats class skills correctly with the +3 bonus", () => {
    expect(sheet.skills.climb.total).toBe(7); // 1 rank + STR 3 + class 3
    expect(sheet.skills.perception.total).toBe(5); // 1 + WIS 1 + class 3
    expect(sheet.skills.intimidate.total).toBe(3); // 1 + CHA -1 + class 3
  });

  it("reports no validation issues for a legal build", () => {
    expect(validateBuild(grukkLevel1())).toEqual([]);
  });

  it("surfaces race, class, and feats on the sheet descriptor", () => {
    expect(sheet.descriptor.race).toBe("Half-Orc");
    expect(sheet.descriptor.classes).toEqual([{ name: "Barbarian", level: 1 }]);
    expect(sheet.descriptor.feats).toEqual([{ name: "Toughness", level: 1 }]);
  });

  it("derives empty inventory totals by default", () => {
    expect(sheet.inventory).toEqual({
      itemCount: 0,
      equippedCount: 0,
      totalWeight: 0,
      totalCostGp: 0,
    });
  });
});

describe("levelUp to level 2", () => {
  const level2: LevelEntry = {
    className: "Barbarian",
    hitPointRoll: 7,
    skillRanks: { climb: 1, perception: 1, intimidate: 1, survival: 1 },
  };
  const build = levelUp(grukkLevel1(), level2);
  const sheet = computeSheet(buildCharacter(build));

  it("advances BAB and the good Fort save", () => {
    expect(sheet.baseAttackBonus).toBe(2);
    expect(sheet.saves.fort.total).toBe(5); // good base 3 + Con 2
  });

  it("accumulates hit points across both levels", () => {
    expect(sheet.hitPoints.total).toBe(26); // 14 + 9 + Toughness 3
  });

  it("stacks skill ranks toward the per-level cap", () => {
    expect(sheet.skills.climb.total).toBe(8); // 2 ranks + STR 3 + class 3
  });

  it("levelDown undoes the level cleanly", () => {
    const reverted = levelDown(build);
    expect(reverted.levels).toHaveLength(1);
    expect(computeSheet(buildCharacter(reverted)).baseAttackBonus).toBe(1);
  });
});

describe("repeatable parameterless feats", () => {
  it("preserves and validates multiple Extra Grit acquisitions", () => {
    const build = grukkLevel1();
    build.levels[0]!.feats = ["Extra Grit", "Extra Grit"];

    const descriptor = buildCharacter(build).descriptor;

    expect(descriptor).toBeDefined();
    expect(
      descriptor?.feats.filter((feat) => feat.name === "Extra Grit"),
    ).toEqual([
      { name: "Extra Grit", level: 1 },
      { name: "Extra Grit", level: 1 },
    ]);
    expect(validateBuild(build).map((issue) => issue.code)).not.toContain(
      "duplicate-feat",
    );
  });
});

describe("inventory math", () => {
  it("auto-sums carried weight and total cost from equipment quantities", () => {
    const build = grukkLevel1();
    build.equipment = [
      { name: "Backpack", weight: 2, costGp: 2, equipped: true },
      { name: "Torch", quantity: 3, weight: 1, costGp: 0.01 },
      { name: "Rope, hemp", weight: 10, costGp: 1 },
    ];
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.inventory).toEqual({
      itemCount: 5,
      equippedCount: 1,
      totalWeight: 15,
      totalCostGp: 3.03,
    });
    expect(sheet.encumbrance.carriedWeight).toBe(15);
  });

  it("lets manual carried weight override auto-summed gear weight", () => {
    const build = grukkLevel1();
    build.equipment = [{ name: "Anvil, tragically", weight: 10, costGp: 5 }];
    build.carriedWeight = 50;
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.inventory.totalWeight).toBe(10);
    expect(sheet.encumbrance.carriedWeight).toBe(50);
  });

  it("applies modifiers and armor rules only from equipped gear", () => {
    const build = grukkLevel1();
    build.equipment = [
      {
        name: "Chain Shirt",
        equipped: true,
        modifiers: [
          { target: "ac", type: "armor", value: 4, source: "Chain Shirt" },
        ],
        armor: {
          category: "light",
          maxDexBonus: 4,
          checkPenalty: 2,
          speedPenalty: 0,
        },
      },
      {
        name: "Spare Chainmail",
        equipped: false,
        modifiers: [
          { target: "ac", type: "armor", value: 6, source: "Spare Chainmail" },
        ],
        armor: {
          category: "medium",
          maxDexBonus: 2,
          checkPenalty: 5,
          speedPenalty: 10,
        },
      },
      {
        name: "Belt of Giant Strength",
        equipped: false,
        modifiers: [
          {
            target: "str",
            type: "enhancement",
            value: 4,
            source: "Belt of Giant Strength",
          },
        ],
      },
    ];
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.ac.normal.total).toBe(15);
    expect(sheet.speed.total).toBe(40);
    expect(sheet.abilities.str.score).toBe(16);
    expect(sheet.skills.climb.total).toBe(5);
  });

  it("derives unique AC profiles from equipped conditional-defense gear", () => {
    const build = grukkLevel1();
    build.equipment = [
      {
        name: "Bullet Ward",
        equipped: true,
        modifiers: [
          {
            target: "ac.vs.firearms",
            type: "dodge",
            value: 2,
            source: "Bullet Ward",
          },
        ],
      },
      {
        name: "Stowed Arrow Ward",
        equipped: false,
        modifiers: [
          {
            target: "ac.vs.ranged",
            type: "dodge",
            value: 4,
            source: "Stowed Arrow Ward",
          },
        ],
      },
    ];

    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.ac.normal.total).toBe(11);
    expect(sheet.ac.contextual).toHaveLength(1);
    expect(sheet.ac.contextual[0]).toMatchObject({
      context: "firearms",
      label: "vs Firearms",
      normal: { total: 13 },
      touch: { total: 13 },
      flatFooted: { total: 10 },
    });
  });

  it("uses armor speed profiles and surfaces conditional gear DR", () => {
    const build = grukkLevel1();
    build.equipment = [
      {
        name: "Shooters Plate",
        equipped: true,
        slot: "armor",
        damageReductions: [
          { value: 3, bypass: "—", appliesAgainst: "Firearms" },
        ],
        armor: {
          category: "light",
          acBonus: 3,
          maxDexBonus: 6,
          checkPenalty: 1,
          speed30: 30,
          speed20: 20,
        },
      },
    ];

    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.speed.total).toBe(40);
    expect(sheet.damageReductions).toEqual([
      expect.objectContaining({
        label: "DR vs Firearms",
        value: 3,
        bypass: "—",
        appliesAgainst: "Firearms",
      }),
    ]);
    expect(sheet.damageReductions[0]?.breakdown[0]?.source).toBe(
      "Shooters Plate",
    );

    build.equipment[0]!.equipped = false;
    const unequippedSheet = computeSheet(buildCharacter(build));
    expect(unequippedSheet.damageReductions).toEqual([]);
    expect(unequippedSheet.speed.total).toBe(40);
  });

  it("retains a configured fraction of armor against ranged touch attacks", () => {
    const build = grukkLevel1();
    build.equipment = [
      {
        name: "Savage Plate",
        equipped: true,
        slot: "armor",
        armor: {
          category: "heavy",
          acBonus: 6,
          maxDexBonus: 4,
          checkPenalty: -6,
          speedPenalty: 5,
          rangedTouchArmorFraction: 0.5,
        },
      },
    ];

    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.ac.normal.total).toBe(17);
    expect(sheet.ac.touch.total).toBe(11);
    expect(sheet.ac.contextual).toHaveLength(1);
    expect(sheet.ac.contextual[0]).toMatchObject({
      context: "ranged",
      normal: { total: 17 },
      touch: { total: 14 },
      flatFooted: { total: 16 },
    });
    expect(
      sheet.ac.contextual[0]?.touch.breakdown.map((entry) => entry.source),
    ).toContain("Savage Plate (ranged touch defense)");
  });

  it("applies equipped shield bonuses and penalties without acting like armor", () => {
    const build = grukkLevel1();
    build.equipment = [
      {
        name: "Heavy Wooden Shield",
        equipped: true,
        slot: "shield",
        shield: { acBonus: 2, checkPenalty: 2 },
      },
    ];
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.ac.normal.total).toBe(13);
    expect(sheet.ac.touch.total).toBe(11);
    expect(sheet.speed.total).toBe(40);
    expect(sheet.skills.climb.total).toBe(5);
  });

  it("ignores unequipped shield stats", () => {
    const build = grukkLevel1();
    build.equipment = [
      {
        name: "Heavy Wooden Shield",
        equipped: false,
        slot: "shield",
        shield: { acBonus: 2, checkPenalty: 2 },
      },
    ];
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.ac.normal.total).toBe(11);
    expect(sheet.skills.climb.total).toBe(7);
  });
});

describe("race-granted build choices", () => {
  it("applies flexible ability bonuses and racial bonus feats", () => {
    const sheet = computeSheet(buildCharacter(humanLevel1()));
    expect(sheet.abilities.int.score).toBe(16);
    expect(sheet.descriptor.feats).toEqual([
      { name: "Dodge", level: 1 },
      { name: "Toughness", level: 1 },
    ]);
    expect(sheet.hitPoints.total).toBe(16);
  });

  it("warns when required race choices are left unselected", () => {
    const build = humanLevel1();
    build.race.choiceSelection = {};
    const issues = validateBuild(build);
    expect(
      issues.some((i) => i.code === "race-flexible-ability-unselected"),
    ).toBe(true);
    expect(issues.some((i) => i.code === "race-bonus-feat-unselected")).toBe(
      true,
    );
  });

  it("validates conflicting alternate racial traits and applies passive ones", () => {
    const build = grukkLevel1();
    build.race.alternateTraits = [
      {
        id: "sacred-tattoo",
        name: "Sacred Tattoo",
        description: "+1 luck on all saves",
        replaces: ["Orc Ferocity"],
        traits: [
          {
            target: "save.all",
            type: "luck",
            value: 1,
            source: "Sacred Tattoo",
          },
        ],
      },
      {
        id: "shaman-apprentice",
        name: "Shaman Apprentice",
        description: "Fake test trait",
        replaces: ["Orc Ferocity"],
      },
    ];
    build.race.choiceSelection = {
      flexibleAbility: "str",
      alternateTraits: ["sacred-tattoo", "shaman-apprentice"],
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "race-alternate-trait-conflict")).toBe(
      true,
    );
    const singleTraitBuild: CharacterBuild = {
      ...build,
      race: {
        ...build.race,
        choiceSelection: {
          flexibleAbility: "str",
          alternateTraits: ["sacred-tattoo"],
        },
      },
    };
    const sheet = computeSheet(buildCharacter(singleTraitBuild));
    expect(sheet.saves.fort.total).toBe(5);
    expect(
      sheet.raceMetadata?.notes?.some((note) => note.includes("Sacred Tattoo")),
    ).toBe(true);
  });

  it("supports race-granted natural attacks and weapon familiarity proficiencies", () => {
    const build = grukkLevel1();
    build.levels[0]!.className = "Wizard";
    build.weapons = [
      {
        name: "Longsword",
        category: "melee",
        proficiencyGroup: "martial",
        damageDice: "1d8",
        handedness: "one",
        damageTypes: ["slashing"],
      },
    ];
    build.race.specificWeaponProficiencies = ["Longsword"];
    build.race.alternateTraits = [
      {
        id: "toothy",
        name: "Toothy",
        description: "Gain a bite attack.",
        grantedWeapons: [
          {
            name: "Bite",
            category: "melee",
            damageDice: "1d4",
            handedness: "light",
            damageTypes: ["piercing"],
            specialTags: ["natural"],
          },
        ],
      },
    ];
    build.race.choiceSelection = {
      flexibleAbility: "str",
      alternateTraits: ["toothy"],
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(
      sheet.weapons.some(
        (weapon) =>
          weapon.name === "Bite" && weapon.damageDisplay.startsWith("1d4"),
      ),
    ).toBe(true);
    expect(
      sheet.weapons
        .find((weapon) => weapon.name === "Longsword")
        ?.attack.breakdown.some((entry) => entry.source === "Nonproficient"),
    ).toBe(false);
  });

  it("automates Half-Orc Intimidating and weapon familiarity", () => {
    const build = grukkLevel1();
    build.baseAbilityScores.cha = 10;
    build.levels[0]!.className = "Wizard";
    build.levels[0]!.skillRanks = {};
    build.race.traits = [
      {
        target: "skill.intimidate",
        type: "racial",
        value: 2,
        source: "Intimidating",
      },
    ];
    build.race.weaponFamiliarity = {
      source: "Weapon Familiarity",
      specificWeapons: ["Greataxe", "Falchion"],
      martialWeaponNameIncludes: ["orc"],
    };
    build.weapons = [
      {
        name: "Greataxe",
        category: "melee",
        proficiencyGroup: "martial",
        damageDice: "1d12",
      },
      {
        name: "Orc double axe",
        category: "melee",
        proficiencyGroup: "exotic",
        damageDice: "1d8",
      },
    ];

    const wizardSheet = computeSheet(buildCharacter(build));
    expect(wizardSheet.skills.intimidate.total).toBe(2);
    expect(
      wizardSheet.weapons[0]?.attack.breakdown.some(
        (entry) => entry.source === "Nonproficient",
      ),
    ).toBe(false);
    expect(
      wizardSheet.weapons[1]?.attack.breakdown.some(
        (entry) => entry.source === "Nonproficient",
      ),
    ).toBe(true);

    build.levels[0]!.className = "Fighter";
    const fighterSheet = computeSheet(buildCharacter(build));
    expect(
      fighterSheet.weapons[1]?.attack.breakdown.some(
        (entry) => entry.source === "Nonproficient",
      ),
    ).toBe(false);
  });

  it("removes Intimidating when an alternate racial trait replaces it", () => {
    const build = grukkLevel1();
    build.baseAbilityScores.cha = 10;
    build.levels[0]!.skillRanks = {};
    build.race.traits = [
      {
        target: "skill.intimidate",
        type: "racial",
        value: 2,
        source: "Intimidating",
      },
    ];
    build.race.alternateTraits = [
      {
        id: "toothy",
        name: "Toothy",
        description: "Gain a bite attack.",
        replaces: ["Intimidating"],
      },
    ];
    build.race.choiceSelection = { alternateTraits: ["toothy"] };

    expect(computeSheet(buildCharacter(build)).skills.intimidate.total).toBe(0);
  });
});

describe("validateBuild catches illegal builds", () => {
  it("flags skill ranks above the per-level cap", () => {
    const build = grukkLevel1();
    build.levels[0]!.skillRanks = { climb: 2 }; // 2 ranks at level 1
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "skill-ranks-over-cap")).toBe(true);
  });

  it("flags an ability increase outside levels 4/8/12", () => {
    const build = grukkLevel1();
    build.levels[0]!.abilityIncrease = "str";
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "illegal-ability-increase")).toBe(
      true,
    );
  });

  it("flags an unknown class", () => {
    const build = grukkLevel1();
    build.levels[0]!.className = "Warblade";
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "unknown-class")).toBe(true);
  });

  it("flags equipped magic item slot conflicts", () => {
    const build = grukkLevel1();
    build.equipment = [
      {
        name: "Belt of Giant Strength",
        quantity: 1,
        equipped: true,
        slot: "belt",
      },
      {
        name: "Belt of Incredible Dexterity",
        quantity: 1,
        equipped: true,
        slot: "belt",
      },
      { name: "Ring of Protection", quantity: 1, equipped: true, slot: "ring" },
      { name: "Ring of Sustenance", quantity: 1, equipped: true, slot: "ring" },
    ];
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "equipment-slot-conflict")).toBe(true);
    expect(
      issues.some(
        (i) =>
          i.code === "equipment-slot-conflict" && i.message.includes("belt"),
      ),
    ).toBe(true);
    expect(
      issues.some(
        (i) =>
          i.code === "equipment-slot-conflict" && i.message.includes("ring"),
      ),
    ).toBe(false);
  });

  it("flags impossible equipped armor states", () => {
    const build = grukkLevel1();
    build.equipment = [
      {
        name: "Chain Shirt",
        quantity: 1,
        equipped: true,
        armor: { category: "light", maxDexBonus: 4, checkPenalty: 2 },
      },
      {
        name: "Full Plate",
        quantity: 1,
        equipped: true,
        armor: {
          category: "heavy",
          maxDexBonus: 1,
          checkPenalty: 6,
          speedPenalty: 10,
        },
      },
      {
        name: "Spare Breastplate Stack",
        quantity: 2,
        equipped: true,
        armor: {
          category: "medium",
          maxDexBonus: 3,
          checkPenalty: 4,
          speedPenalty: 10,
        },
      },
    ];
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "multiple-equipped-armor")).toBe(true);
    expect(
      issues.some((i) => i.code === "equipped-armor-quantity-over-one"),
    ).toBe(true);
  });

  it("flags invalid equipped slotted quantities and negative values", () => {
    const build = grukkLevel1();
    build.equipment = [
      {
        name: "Broken Stack",
        quantity: 0,
        weight: -1,
        costGp: -5,
        equipped: true,
        slot: "hands",
      },
    ];
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "invalid-equipment-quantity")).toBe(
      true,
    );
    expect(issues.some((i) => i.code === "invalid-equipment-weight")).toBe(
      true,
    );
    expect(issues.some((i) => i.code === "invalid-equipment-cost")).toBe(true);
    expect(
      issues.some((i) => i.code === "equipped-slotted-item-quantity-over-one"),
    ).toBe(false);
  });

  it("flags equipped slotted stack quantities over one", () => {
    const build = grukkLevel1();
    build.equipment = [
      {
        name: "Gloves of Ogre Power",
        quantity: 2,
        equipped: true,
        slot: "hands",
      },
    ];
    const issues = validateBuild(build);
    expect(
      issues.some((i) => i.code === "equipped-slotted-item-quantity-over-one"),
    ).toBe(true);
  });

  it("applies nonproficient weapon penalties on the built sheet", () => {
    const build: CharacterBuild = {
      name: "Wizard With Greataxe Problems",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 10,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      weapons: [
        {
          name: "Greataxe",
          category: "melee",
          proficiencyGroup: "martial",
          damageDice: "1d12",
          handedness: "two",
        },
      ],
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.weapons[0]?.attack.total).toBe(-4);
    expect(
      sheet.weapons[0]?.attack.breakdown.some(
        (entry) => entry.source === "Nonproficient" && entry.value === -4,
      ),
    ).toBe(true);
  });

  it("warns for nonproficient weapons", () => {
    const build: CharacterBuild = {
      name: "Wizard With Greataxe Problems",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 10,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      weapons: [
        {
          name: "Greataxe",
          category: "melee",
          proficiencyGroup: "martial",
          damageDice: "1d12",
          handedness: "two",
        },
      ],
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "nonproficient-weapon")).toBe(true);
  });

  it("derives weapon lines from equipped inventory weapons", () => {
    const build: CharacterBuild = {
      name: "Fighter With Real Gear",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 18,
        dex: 12,
        con: 14,
        int: 10,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Fighter", hitPointRoll: 10, feats: [] }],
      equipment: [
        {
          name: "Greataxe",
          equipped: true,
          weapon: {
            weaponTemplateId: "greataxe",
            category: "melee",
            proficiencyGroup: "martial",
            damageDice: "1d12",
            handedness: "two",
            critMultiplier: 3,
          },
        },
      ],
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.weapons[0]?.name).toBe("Greataxe");
    expect(sheet.weapons[0]?.weaponTemplateId).toBe("greataxe");
    expect(
      sheet.weapons[0]?.attack.breakdown.some(
        (entry) => entry.source === "Nonproficient",
      ),
    ).toBe(false);
  });

  it("warns for nonproficient equipped inventory weapons", () => {
    const build: CharacterBuild = {
      name: "Wizard With Greataxe Item Problems",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 10,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      equipment: [
        {
          name: "Greataxe",
          equipped: true,
          weapon: {
            weaponTemplateId: "greataxe",
            category: "melee",
            proficiencyGroup: "martial",
            damageDice: "1d12",
            handedness: "two",
            critMultiplier: 3,
          },
        },
      ],
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "nonproficient-weapon")).toBe(true);
    const sheet = computeSheet(buildCharacter(build));
    expect(
      sheet.weapons[0]?.attack.breakdown.some(
        (entry) => entry.source === "Nonproficient" && entry.value === -4,
      ),
    ).toBe(true);
  });

  it("derives ammo availability for equipped inventory ranged weapons", () => {
    const build: CharacterBuild = {
      name: "Archer With Actual Arrows",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 12,
        dex: 18,
        con: 12,
        int: 10,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Fighter", hitPointRoll: 10, feats: [] }],
      equipment: [
        {
          name: "Longbow",
          equipped: true,
          weapon: {
            weaponTemplateId: "longbow",
            category: "ranged",
            proficiencyGroup: "martial",
            damageDice: "1d8",
            critMultiplier: 3,
            rangeIncrementFeet: 100,
            damageTypes: ["piercing"],
            specialTags: ["two-handed"],
            ammoType: "arrow",
            ammoPerAttack: 1,
            reloadType: "free",
          },
        },
        { name: "Arrows", quantity: 20, weight: 3, costGp: 1, equipped: false },
      ],
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.weapons[0]?.ammoAvailable).toBe(20);
    expect(sheet.weapons[0]?.reloadType).toBe("free");
    expect(sheet.rangedCombat.ammoByType.arrow).toBe(20);
  });

  it("does not warn for proficient weapons", () => {
    const build = grukkLevel1();
    build.weapons = [
      {
        name: "Greataxe",
        category: "melee",
        proficiencyGroup: "martial",
        damageDice: "1d12",
        handedness: "two",
      },
      {
        name: "Javelin",
        category: "ranged",
        proficiencyGroup: "simple",
        damageDice: "1d6",
      },
    ];
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "nonproficient-weapon")).toBe(false);
  });

  it("honors specific named weapon proficiency exceptions", () => {
    const bardBuild: CharacterBuild = {
      name: "Sword Bard",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 10,
        dex: 14,
        con: 12,
        int: 10,
        wis: 10,
        cha: 18,
      },
      levels: [{ className: "Bard", hitPointRoll: 8, feats: [] }],
      weapons: [
        {
          name: "Longsword",
          category: "melee",
          proficiencyGroup: "martial",
          damageDice: "1d8",
          handedness: "one",
        },
      ],
    };
    const rogueBuild: CharacterBuild = {
      name: "Stabby Rogue",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 10,
        dex: 18,
        con: 12,
        int: 12,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Rogue", hitPointRoll: 8, feats: [] }],
      weapons: [
        {
          name: "Rapier",
          category: "melee",
          proficiencyGroup: "martial",
          damageDice: "1d6",
          handedness: "one",
          critRange: 18,
        },
      ],
    };
    expect(
      validateBuild(bardBuild).some((i) => i.code === "nonproficient-weapon"),
    ).toBe(false);
    expect(
      validateBuild(rogueBuild).some((i) => i.code === "nonproficient-weapon"),
    ).toBe(false);
    expect(
      computeSheet(buildCharacter(bardBuild)).weapons[0]?.attack.breakdown.some(
        (entry) => entry.source === "Nonproficient",
      ),
    ).toBe(false);
    expect(
      computeSheet(
        buildCharacter(rogueBuild),
      ).weapons[0]?.attack.breakdown.some(
        (entry) => entry.source === "Nonproficient",
      ),
    ).toBe(false);
  });

  it("warns for nonproficient armor and shields", () => {
    const build: CharacterBuild = {
      name: "Overdressed Wizard",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 10,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      equipment: [
        {
          name: "Chain Shirt",
          equipped: true,
          armor: { category: "light", maxDexBonus: 4, checkPenalty: 2 },
        },
        {
          name: "Heavy Wooden Shield",
          equipped: true,
          slot: "shield",
          shield: { acBonus: 2, checkPenalty: 2 },
        },
      ],
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "nonproficient-armor")).toBe(true);
    expect(issues.some((i) => i.code === "nonproficient-shield")).toBe(true);
  });

  it("does not warn when any class in the build grants the needed proficiency", () => {
    const build: CharacterBuild = {
      name: "Wizard With Fighter Dip",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 10,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
      levels: [
        { className: "Fighter", hitPointRoll: 10, feats: [] },
        { className: "Wizard", hitPointRoll: 6, feats: [] },
      ],
      equipment: [
        {
          name: "Chain Shirt",
          equipped: true,
          armor: { category: "light", maxDexBonus: 4, checkPenalty: 2 },
        },
        {
          name: "Heavy Wooden Shield",
          equipped: true,
          slot: "shield",
          shield: { acBonus: 2, checkPenalty: 2 },
        },
      ],
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "nonproficient-armor")).toBe(false);
    expect(issues.some((i) => i.code === "nonproficient-shield")).toBe(false);
  });

  it("flags prepared spell picks above prep capacity", () => {
    const build: CharacterBuild = {
      name: "Prep Goblin",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      spellSelections: {
        wizard: {
          prepared: {
            1: ["mage armor", "magic missile", "shield"],
          },
        },
      },
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "prepared-spells-over-capacity")).toBe(
      true,
    );
  });

  it("flags spontaneous known picks above known count", () => {
    const build: CharacterBuild = {
      name: "Known Goblin",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 12,
        int: 10,
        wis: 10,
        cha: 18,
      },
      levels: [{ className: "Sorcerer", hitPointRoll: 6, feats: [] }],
      spellSelections: {
        sorcerer: {
          known: {
            1: ["magic missile", "shield", "grease"],
          },
        },
      },
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "spells-known-over-cap")).toBe(true);
  });

  it("flags unknown spell names in selections", () => {
    const build: CharacterBuild = {
      name: "Mystery Goblin",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      spellSelections: {
        wizard: { prepared: { 1: ["Orb of Taxes"] } },
      },
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "unknown-spell")).toBe(true);
  });

  it("flags spells not on the class list", () => {
    const build: CharacterBuild = {
      name: "Heretical Goblin",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      spellSelections: {
        wizard: { prepared: { 1: ["Cure Light Wounds"] } },
      },
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "spell-not-on-class-list")).toBe(true);
  });

  it("flags spell level mismatches", () => {
    const build: CharacterBuild = {
      name: "Bucket Goblin",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      spellSelections: {
        wizard: { prepared: { 0: ["Magic Missile"] } },
      },
    };
    const issues = validateBuild(build);
    expect(issues.some((i) => i.code === "spell-level-mismatch")).toBe(true);
  });
});
