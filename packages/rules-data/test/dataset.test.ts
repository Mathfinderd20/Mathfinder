import { describe, expect, it } from "vitest";
import {
  RULES_DATA_SET,
  buildRulesDataIndex,
  validateRulesDataSet,
} from "../src";

describe("rules-data dataset", () => {
  it("validates the canonical dataset with no issues", () => {
    expect(validateRulesDataSet(RULES_DATA_SET)).toEqual([]);
  });

  it("indexes the authored local content catalogs", () => {
    const index = buildRulesDataIndex(RULES_DATA_SET);
    expect(index.classes["fighter"]?.name).toBe("Fighter");
    expect(index.archetypes["bugler"]?.id).toBe("bugler");
    expect(Object.keys(index.archetypes)).toContain("battle-chaplain");
    expect(
      index.archetypesByClass["witch"]?.map((archetype) => archetype.name),
    ).toEqual(["Apocalypse Witch", "Hexslinger"]);
    expect(index.bloodlines["war orphan"]?.id).toBe("war-orphan");
    expect(index.kineticistElements["lodestone"]?.id).toBe("lodestone");
    expect(index.phantomEmotionalFocuses["resolute"]?.id).toBe("resolute");
    expect(index.eidolonSubtypes["warmachine"]?.id).toBe("warmachine");
    expect(index.hexes["friendly fire"]?.id).toBe("friendly-fire");
    expect(index.blessings["crusade"]?.id).toBe("crusade");
    expect(index.trapOptions["tripwire"]?.id).toBe("tripwire");
    expect(index.feats["power attack"]?.id).toBe("power-attack");
    expect(index.races["gnome"]?.id).toBe("gnome");
    expect(index.races["half-elf"]?.name).toBe("Half-Elf");
    expect(index.spells["mage armor"]?.name).toBe("Mage Armor");
    expect(index.weapons["longbow"]?.id).toBe("longbow");
    expect(index.magicItems["belt of giant strength +2"]?.id).toBe(
      "belt-of-giant-strength-2",
    );
    expect(index.domains["war"]?.id).toBe("war");
    expect(index.schools["conjuration"]?.id).toBe("conjuration");
    expect(index.spellEffects["spell-mage-armor"]?.spellName).toBe(
      "Mage Armor",
    );
  });

  it("includes the Savage Company authored race imports", () => {
    const savagePack = RULES_DATA_SET.packs.find(
      (pack) => pack.id === "savage-company",
    );
    const infantryman = savagePack?.classes.find(
      (cls) => cls.name === "Infantryman",
    );
    const savageArchetypes = savagePack?.archetypes ?? [];
    const infantrymanFeatures = savagePack?.classFeatures.filter(
      (feature) => feature.className === "infantryman",
    );
    const baade = savagePack?.races.find((race) => race.id === "baade");
    const kemano = savagePack?.races.find((race) => race.id === "kemano");
    const lobstross = savagePack?.races.find((race) => race.id === "lobstross");
    const savageBugbear = savagePack?.races.find(
      (race) => race.id === "savage-bugbear",
    );
    const savageHobgoblin = savagePack?.races.find(
      (race) => race.id === "savage-hobgoblin",
    );
    const savageKobold = savagePack?.races.find(
      (race) => race.id === "savage-kobold",
    );
    const savageOrc = savagePack?.races.find(
      (race) => race.id === "savage-orc",
    );
    const skeletal = savagePack?.races.find((race) => race.id === "skeletal");

    expect(savagePack?.enabledByDefault).toBe(true);
    expect(savagePack?.version).toBe("0.4.0-option-taxonomies");
    expect(savageArchetypes).toHaveLength(18);
    expect(savagePack?.bloodlines).toHaveLength(1);
    expect(savagePack?.kineticistElements).toHaveLength(1);
    expect(savagePack?.phantomEmotionalFocuses).toHaveLength(1);
    expect(savagePack?.eidolonSubtypes).toHaveLength(1);
    expect(savagePack?.hexes).toHaveLength(4);
    expect(savagePack?.blessings).toHaveLength(1);
    expect(savagePack?.trapOptions.length).toBeGreaterThan(20);
    expect(
      savageArchetypes.find((archetype) => archetype.id === "combat-medic"),
    ).toMatchObject({
      name: "Combat Medic",
      baseClassName: "Alchemist",
    });
    expect(
      savageArchetypes.find((archetype) => archetype.id === "bugler"),
    ).toMatchObject({
      baseClassName: "Bard",
      replaces: expect.arrayContaining(["distraction", "fascinate"]),
    });
    expect(
      savageArchetypes.find((archetype) => archetype.id === "roughneck-ranger")
        ?.features,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 5, name: "Traps" }),
        expect.objectContaining({ level: 10, name: "Demolition Bomb" }),
      ]),
    );
    expect(
      savageArchetypes.find((archetype) => archetype.id === "dominus"),
    ).toMatchObject({
      baseClassName: "Unchained Summoner",
    });
    expect(
      savageArchetypes.find((archetype) => archetype.id === "hexslinger"),
    ).toMatchObject({
      baseClassName: "Witch",
    });
    expect(
      savagePack?.bloodlines.find((entry) => entry.id === "war-orphan"),
    ).toMatchObject({
      baseClassName: "Sorcerer",
      classSkill: "survival",
    });
    expect(
      savagePack?.kineticistElements.find((entry) => entry.id === "lodestone"),
    ).toMatchObject({
      name: "Lodestone",
    });
    expect(
      savagePack?.phantomEmotionalFocuses.find(
        (entry) => entry.id === "resolute",
      ),
    ).toMatchObject({
      name: "Resolute",
    });
    expect(
      savagePack?.eidolonSubtypes.find((entry) => entry.id === "warmachine"),
    ).toMatchObject({
      baseForm: expect.stringContaining("Biped"),
    });
    expect(
      savagePack?.hexes.find((entry) => entry.id === "friendly-fire"),
    ).toMatchObject({
      category: "hex",
    });
    expect(
      savagePack?.blessings.find((entry) => entry.id === "crusade"),
    ).toMatchObject({
      baseClassName: "Warpriest",
    });
    expect(
      savagePack?.trapOptions.find((entry) => entry.id === "smoke-trap"),
    ).toMatchObject({
      category: "ranger-trap",
    });

    expect(infantryman).toMatchObject({
      name: "Infantryman",
      hitDie: 10,
      bab: "full",
      goodSaves: ["fort", "ref"],
      skillRanksPerLevel: 4,
      armorProficiencies: ["light", "medium"],
      weaponProficiencies: ["simple", "martial"],
    });
    expect(infantryman?.classSkills).toEqual(
      expect.arrayContaining([
        "acrobatics",
        "heal",
        "knowledge.engineering",
        "perception",
        "survival",
      ]),
    );
    expect(
      infantrymanFeatures?.find(
        (feature) => feature.id === "infantryman-grit-l1",
      ),
    ).toMatchObject({
      level: 1,
      name: "Grit",
      resourcePool: {
        id: "infantryman-grit",
        unit: "grit",
        maximum: { ability: "wis", minimum: 1 },
      },
    });
    expect(
      infantrymanFeatures?.find(
        (feature) => feature.id === "infantryman-dodge-step-l1",
      )?.activatable,
    ).toMatchObject({
      resourceCost: { poolId: "infantryman-grit", amount: 1 },
      requirements: {
        maximumArmorCategory: "medium",
        maximumLoadBand: "medium",
      },
    });
    expect(
      infantrymanFeatures?.find(
        (feature) => feature.id === "infantryman-rally-l17",
      ),
    ).toMatchObject({
      level: 17,
      name: "Rally +4",
    });
    expect(
      infantrymanFeatures?.find(
        (feature) => feature.id === "infantryman-one-man-army-l20",
      ),
    ).toMatchObject({
      level: 20,
      name: "One Man Army",
    });

    expect(baade).toMatchObject({
      name: "Baade",
      speed: 30,
      size: "medium",
      classSkills: ["survival", "diplomacy"],
      senses: { darkvisionFeet: 60, lowLightVision: true },
    });
    expect(baade?.abilityModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "str", value: 4 }),
        expect.objectContaining({ target: "con", value: 2 }),
        expect.objectContaining({ target: "cha", value: -2 }),
      ]),
    );
    expect(baade?.alternateTraits?.map((trait) => trait.name)).toEqual([
      "Gore",
      "Pass for Human",
      "Oversized Limbs",
      "Canny",
      "Silvertongued",
    ]);
    expect(
      baade?.alternateTraits?.find((trait) => trait.id === "baade-gore"),
    ).toMatchObject({
      replaces: ["Fearless"],
      grantedWeapons: [
        expect.objectContaining({ name: "Gore", damageDice: "1d6" }),
      ],
    });
    expect(
      baade?.alternateTraits?.find(
        (trait) => trait.id === "baade-silvertongued",
      ),
    ).toMatchObject({
      classSkills: ["bluff"],
      traits: expect.arrayContaining([
        expect.objectContaining({ target: "skill.diplomacy", value: -1 }),
        expect.objectContaining({ target: "skill.bluff", value: 1 }),
      ]),
    });

    expect(kemano).toMatchObject({
      name: "Kemano",
      size: "medium",
      speed: 30,
    });
    expect(kemano?.abilityModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "dex", value: 2 }),
        expect.objectContaining({ target: "wis", value: -2 }),
        expect.objectContaining({ target: "cha", value: 2 }),
      ]),
    );
    expect(kemano?.senses).toMatchObject({ lowLightVision: true });
    expect(kemano?.traits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "save.will",
          value: 2,
          source: "Stubborn Mind",
        }),
        expect.objectContaining({
          target: "skill.disguise",
          value: 10,
          source: "Pass for Human",
        }),
        expect.objectContaining({
          target: "init",
          value: 4,
          source: "Quick Reactions",
        }),
      ]),
    );
    expect(
      kemano?.alternateTraits?.find(
        (trait) => trait.id === "kemano-bovine-heritage",
      ),
    ).toMatchObject({
      replaces: ["Lagomorph Heritage"],
      grantedWeapons: [
        expect.objectContaining({ name: "Gore", damageDice: "1d6" }),
      ],
    });
    expect(
      kemano?.alternateTraits?.find(
        (trait) => trait.id === "kemano-feline-heritage",
      ),
    ).toMatchObject({
      replaces: ["Lagomorph Heritage"],
      senses: { darkvisionFeet: 60 },
      grantedWeapons: expect.arrayContaining([
        expect.objectContaining({ name: "Claw", damageDice: "1d4" }),
      ]),
    });
    expect(
      kemano?.alternateTraits?.find((trait) => trait.id === "kemano-fury-born"),
    ).toMatchObject({
      replaces: ["Pass for Human"],
    });

    expect(lobstross).toMatchObject({
      name: "Lobstross",
      size: "large",
      speed: 30,
      movementModes: { swim: 40 },
    });
    expect(lobstross?.abilityModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "str", value: 8 }),
        expect.objectContaining({ target: "dex", value: -2 }),
        expect.objectContaining({ target: "int", value: -2 }),
        expect.objectContaining({ target: "wis", value: -2 }),
        expect.objectContaining({ target: "cha", value: -2 }),
      ]),
    );
    expect(
      lobstross?.alternateTraits?.find(
        (trait) => trait.id === "lobstross-shallows-dweller",
      ),
    ).toMatchObject({
      replaces: ["Powerful Swimmer"],
      movementModes: { swim: 30 },
      senses: { darkvisionFeet: 60 },
    });
    expect(
      lobstross?.alternateTraits?.find(
        (trait) => trait.id === "lobstross-claw-king",
      ),
    ).toMatchObject({
      replaces: ["Grabbing Appendages"],
      grantedWeapons: expect.arrayContaining([
        expect.objectContaining({ name: "Claw", damageDice: "1d8" }),
      ]),
    });

    expect(savageBugbear).toMatchObject({
      name: "Savage Bugbear",
      size: "medium",
      speed: 30,
      classSkills: ["stealth", "perception"],
      senses: { darkvisionFeet: 60 },
    });
    expect(savageBugbear?.abilityModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "dex", value: 2 }),
        expect.objectContaining({ target: "str", value: 2 }),
        expect.objectContaining({ target: "cha", value: -2 }),
      ]),
    );
    expect(
      savageBugbear?.alternateTraits?.find(
        (trait) => trait.id === "savage-bugbear-tinker",
      ),
    ).toMatchObject({
      replaces: ["Skill Training"],
      classSkills: ["disable-device", "escape-artist"],
    });
    expect(
      savageBugbear?.alternateTraits?.find(
        (trait) => trait.id === "savage-bugbear-wikkawac",
      ),
    ).toMatchObject({
      replaces: ["Scent"],
      resistances: { cold: 5 },
    });

    expect(savageHobgoblin).toMatchObject({
      name: "Savage Hobgoblin",
      size: "medium",
      speed: 30,
      senses: { darkvisionFeet: 60 },
    });
    expect(savageHobgoblin?.abilityModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "dex", value: 2 }),
        expect.objectContaining({ target: "con", value: 2 }),
      ]),
    );
    expect(savageHobgoblin?.traits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "skill.stealth",
          value: 4,
          source: "Sneaky",
        }),
        expect.objectContaining({
          target: "init",
          value: 4,
          source: "Quick Reactions",
        }),
      ]),
    );

    expect(savageKobold).toMatchObject({
      name: "Savage Kobold",
      size: "small",
      speed: 30,
      classSkills: ["craft.trapmaking", "stealth"],
      senses: { darkvisionFeet: 60 },
    });
    expect(savageKobold?.abilityModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "dex", value: 2 }),
        expect.objectContaining({ target: "str", value: -2 }),
        expect.objectContaining({ target: "int", value: 2 }),
      ]),
    );
    expect(savageKobold?.traits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "ac",
          value: 1,
          source: "Natural Armor",
        }),
        expect.objectContaining({
          target: "skill.perception",
          value: 2,
          source: "Crafty",
        }),
      ]),
    );
    expect(
      savageKobold?.alternateTraits?.find(
        (trait) => trait.id === "savage-kobold-tough-hide",
      ),
    ).toMatchObject({
      replaces: ["Crafty"],
      traits: expect.arrayContaining([
        expect.objectContaining({
          target: "ac",
          value: 2,
          source: "Tough Hide",
        }),
      ]),
    });

    expect(savageOrc).toMatchObject({
      name: "Savage Orc",
      size: "medium",
      speed: 30,
      senses: { darkvisionFeet: 60 },
    });
    expect(savageOrc?.abilityModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "str", value: 4 }),
        expect.objectContaining({ target: "int", value: -2 }),
        expect.objectContaining({ target: "wis", value: -2 }),
        expect.objectContaining({ target: "cha", value: -2 }),
      ]),
    );
    expect(
      savageOrc?.alternateTraits?.find(
        (trait) => trait.id === "savage-orc-plains-runner",
      ),
    ).toMatchObject({
      replaces: ["Ferocity"],
    });

    expect(skeletal).toMatchObject({
      name: "Skeletal",
      size: "medium",
      speed: 30,
      senses: { darkvisionFeet: 60 },
    });
    expect(skeletal?.abilityModifiers).toEqual([]);
    expect(skeletal?.traits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "save.fort",
          value: 2,
          source: "Undead Resistance",
        }),
        expect.objectContaining({
          target: "save.will",
          value: 2,
          source: "Undead Resistance",
        }),
        expect.objectContaining({
          target: "skill.disguise",
          value: 20,
          source: "Feign Death",
        }),
      ]),
    );
    expect(
      skeletal?.alternateTraits?.find(
        (trait) => trait.id === "skeletal-lifebound-soul",
      ),
    ).toMatchObject({
      replaces: ["Resist Level Drain"],
    });
  });
});
