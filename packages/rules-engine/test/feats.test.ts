import { describe, expect, it } from "vitest";
import {
  buildFeatRegistry,
  checkPrerequisites,
  featContextFromSheet,
  featEffects,
  featParameterOptions,
  featQualifiesForGrant,
  FEATS,
  getFeat,
  listFeats,
  type FeatContext,
} from "../src/content/feats";
import { CLASS_FEATURES } from "../src/content/class-features";
import {
  activatableModifiers,
  collectActivatableEffects,
} from "../src/content/activatables";
import { buildCharacter, type CharacterBuild } from "../src/build/character";
import { computeSheet } from "../src/compute";

const baseCtx: FeatContext = {
  baseAttackBonus: 0,
  abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  characterLevel: 1,
  featNames: [],
};

describe("feat prerequisites", () => {
  it("passes a feat with no prerequisites", () => {
    expect(checkPrerequisites(getFeat(FEATS, "Toughness")!, baseCtx).met).toBe(
      true,
    );
  });

  it("blocks Dodge without Dex 13 and reports the reason", () => {
    const result = checkPrerequisites(getFeat(FEATS, "Dodge")!, baseCtx);
    expect(result.met).toBe(false);
    expect(result.unmet[0]?.description).toBe("Dex 13");
  });

  it("allows Power Attack only with Str 13 and BAB +1", () => {
    expect(
      checkPrerequisites(getFeat(FEATS, "Power Attack")!, baseCtx).met,
    ).toBe(false);
    const ctx: FeatContext = {
      ...baseCtx,
      baseAttackBonus: 1,
      abilityScores: { ...baseCtx.abilityScores, str: 13 },
    };
    expect(checkPrerequisites(getFeat(FEATS, "Power Attack")!, ctx).met).toBe(
      true,
    );
  });

  it("requires Spell Focus in the same school before Greater Spell Focus", () => {
    const feat = getFeat(FEATS, "Greater Spell Focus")!;
    expect(feat.prerequisites.map((entry) => entry.description)).toEqual([
      "Spell Focus",
    ]);
    expect(checkPrerequisites(feat, baseCtx, "Evocation").met).toBe(false);
    expect(
      checkPrerequisites(
        feat,
        {
          ...baseCtx,
          featNames: ["Spell Focus (Conjuration)"],
        },
        "Evocation",
      ).met,
    ).toBe(false);
    expect(
      checkPrerequisites(
        feat,
        {
          ...baseCtx,
          featNames: ["Spell Focus (Evocation)"],
        },
        "Evocation",
      ).met,
    ).toBe(true);
  });

  it("offers every spell school and emits school-specific DC modifiers", () => {
    const spellFocus = getFeat(FEATS, "Spell Focus")!;
    expect(featParameterOptions(spellFocus)).toEqual([
      "Abjuration",
      "Conjuration",
      "Divination",
      "Enchantment",
      "Evocation",
      "Illusion",
      "Necromancy",
      "Transmutation",
    ]);
    expect(
      featEffects(
        ["Spell Focus (Evocation)", "Greater Spell Focus (Evocation)"],
        FEATS,
      ),
    ).toEqual([
      expect.objectContaining({
        target: "spell.dc.school.evocation",
        value: 1,
      }),
      expect.objectContaining({
        target: "spell.dc.school.evocation",
        value: 1,
      }),
    ]);
  });

  it("restores parameter semantics when scraped feats override core ids", () => {
    const registry = buildFeatRegistry([
      {
        id: "scrape-aon-weapon-focus",
        name: "Weapon Focus",
        pack: "scraped",
        description: "Choose one weapon.",
        prerequisites: [],
        effects: [],
      },
      {
        id: "scrape-aon-spell-focus",
        name: "Spell Focus",
        pack: "scraped",
        description: "Choose one school.",
        prerequisites: [],
        effects: [],
      },
    ]);
    expect(getFeat(registry, "Weapon Focus")?.parameter?.kind).toBe("weapon");
    expect(
      featQualifiesForGrant(
        getFeat(registry, "Weapon Focus")!,
        "fighter-bonus",
      ),
    ).toBe(true);
    expect(getFeat(registry, "Spell Focus")?.parameter?.kind).toBe(
      "spell-school",
    );
    expect(featEffects(["Weapon Focus (Longsword)"], registry)).toEqual([
      expect.objectContaining({
        target: "weapon.attack.longsword",
        value: 1,
      }),
    ]);
  });

  it("removes impossible self-prerequisites from imported feats", () => {
    const registry = buildFeatRegistry([
      {
        id: "point-blank-shot",
        name: "Point-Blank Shot",
        pack: "test",
        description: "Ranged attacks are more accurate within 30 feet.",
        prerequisites: [
          {
            type: "feat",
            featName: "Point-Blank Shot",
            description: "Point-Blank Shot",
          },
        ],
        effects: [],
      },
    ]);
    expect(getFeat(registry, "Point-Blank Shot")?.prerequisites).toEqual([]);
  });

  it("includes Selective Channeling and enforces its Charisma prerequisite", () => {
    const feat = getFeat(FEATS, "Selective Channeling");
    expect(feat?.id).toBe("selective-channeling");
    expect(checkPrerequisites(feat!, baseCtx).met).toBe(false);
    expect(
      checkPrerequisites(feat!, {
        ...baseCtx,
        abilityScores: { ...baseCtx.abilityScores, cha: 13 },
      }).met,
    ).toBe(true);
  });

  it("covers the conservative core character-creation feat checklist", () => {
    const expected = [
      "Acrobatic",
      "Alignment Channel",
      "Athletic",
      "Augment Summoning",
      "Combat Casting",
      "Deceitful",
      "Deft Hands",
      "Extra Channel",
      "Greater Spell Focus",
      "Greater Spell Penetration",
      "Improved Channel",
      "Improved Counterspell",
      "Improved Familiar",
      "Improved Iron Will",
      "Improved Lightning Reflexes",
      "Magical Aptitude",
      "Natural Spell",
      "Nimble Moves",
      "Run",
      "Selective Channeling",
      "Self-Sufficient",
      "Spell Mastery",
    ];
    const actual = new Set(listFeats(FEATS).map((feat) => feat.name));
    expect(expected.filter((name) => !actual.has(name))).toEqual([]);
  });

  it("has unique canonical feat ids and names", () => {
    const feats = listFeats(FEATS);
    expect(new Set(feats.map((feat) => feat.id)).size).toBe(feats.length);
    expect(new Set(feats.map((feat) => feat.name.toLowerCase())).size).toBe(
      feats.length,
    );
  });

  it("lists feats alphabetically", () => {
    const names = listFeats(FEATS).map((f) => f.name);
    expect(names).toEqual([...names].sort());
  });
});

describe("feat effects auto-apply through buildCharacter", () => {
  const build: CharacterBuild = {
    name: "Test",
    race: { name: "Human", size: "medium" },
    baseAbilityScores: { str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    levels: [
      {
        className: "Fighter",
        hitPointRoll: 10,
        feats: ["Toughness", "Iron Will"],
      },
    ],
  };
  const sheet = computeSheet(buildCharacter(build));

  it("applies Toughness HP from the registry (no hand-written modifier)", () => {
    // max(1, 10 + Con 1) = 11, + Toughness 3 = 14
    expect(sheet.hitPoints.total).toBe(14);
  });

  it("applies Iron Will to the Will save", () => {
    // base 2 (Fighter good Fort only -> Will poor 0) + Wis 0 + Iron Will 2 = 2
    expect(sheet.saves.will.total).toBe(2);
  });

  it("builds a feat context from the sheet", () => {
    const ctx = featContextFromSheet(sheet);
    expect(ctx.baseAttackBonus).toBe(1);
    expect(ctx.featNames).toContain("Toughness");
  });

  it("Power Attack activatable scales its melee penalty by BAB", () => {
    const pa = getFeat(FEATS, "Power Attack")!.activatable!;
    expect(
      activatableModifiers(pa, { baseAttackBonus: 1, characterLevel: 1 })[0]!
        .value,
    ).toBe(-1);
    expect(
      activatableModifiers(pa, { baseAttackBonus: 8, characterLevel: 8 })[0]!
        .value,
    ).toBe(-3);
  });

  it("can expose activatable feats through the general collector", () => {
    const descriptor = {
      race: "Human",
      classes: [{ name: "Fighter", level: 1 }],
      archetypes: [],
      feats: [{ name: "Combat Expertise", level: 1 }],
      features: [],
      suppressedFeatures: [],
    };
    expect(
      collectActivatableEffects({
        descriptor,
        classFeatureRegistry: CLASS_FEATURES,
        featRegistry: FEATS,
      }).map((a) => a.name),
    ).toEqual(["Combat Expertise"]);
  });
});
