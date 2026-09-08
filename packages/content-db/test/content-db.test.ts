import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AON_BASE_CLASSES,
  AON_SUPPORTED_ARCHETYPE_CLASSES,
  AON_ARMOR_CATEGORIES,
  AON_MISC_EQUIPMENT_CATEGORIES,
  AON_WEAPON_PROFICIENCIES,
  AON_WONDROUS_SLOTS,
  AON_ROD_CATEGORIES,
  buildScrapedFeatRulesDataSet,
  buildUsableContentExport,
  openDatabase,
  parseAonArchetypeDetail,
  parseAonArchetypeLinks,
  parseAonClassFeatureDetails,
  parseAonClassFeatureLevels,
  parseAonFeatCategories,
  parseAonFeatDetail,
  parseAonFeatLinks,
  parseFeatPrerequisites,
  parseAonMagicItemDetail,
  parseAonMagicItemList,
  parseAonArmorDetail,
  parseAonArmorList,
  parseAonGearCategories,
  parseAonGearDetail,
  parseAonGearList,
  parseAonRaceDetail,
  parseAonRaceLinks,
  parseAonSpellDetail,
  parseAonSpellLinks,
  parseAonWeaponDetail,
  parseAonWeaponList,
  seedLocalRulesData,
} from "../src";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});

describe("content-db", () => {
  it("creates and seeds the sqlite database from canonical rules-data", () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mathfinder-content-db-"),
    );
    tempDirs.push(dir);
    const db = openDatabase(path.join(dir, "content.sqlite"));
    seedLocalRulesData(db);
    const counts = db
      .prepare(
        "SELECT kind, COUNT(*) as count FROM content_entities GROUP BY kind ORDER BY kind",
      )
      .all() as Array<{ kind: string; count: number }>;
    expect(counts.length).toBeGreaterThan(5);
    expect(
      db
        .prepare("SELECT name FROM content_entities WHERE entity_key = ?")
        .get("weapon:longbow"),
    ).toEqual({ name: "Longbow" });
    db.close();
  });

  it("parses AoN spell list/detail fixtures", () => {
    const listHtml = `<a href="SpellDisplay.aspx?ItemName=Mage%20Armor">Mage Armor</a><a href="SpellDisplay.aspx?ItemName=Shield">Shield</a>`;
    const links = parseAonSpellLinks(listHtml);
    expect(links.map((item) => item.name)).toEqual(["Mage Armor", "Shield"]);

    const detailHtml = `<table id="MainContent_DataListTypes"><tr><td><h1 class="title">Mage Armor</h1><b>Source</b> Core Rulebook pg. 251<br/><b>School</b> conjuration; <b>Level</b> sorcerer/wizard 1 Casting<br/><b>Casting Time</b> 1 standard action<br/><b>Components</b> V, S, F<br/><b>Range</b> touch<br/><b>Target</b> creature touched<br/><b>Duration</b> 1 hour/level<br/><b>Saving Throw</b> Will negates (harmless); <b>Spell Resistance</b> no<br/>An invisible but tangible field of force surrounds the subject.</td></tr></table>`;
    const parsed = parseAonSpellDetail(
      detailHtml,
      "https://www.aonprd.com/SpellDisplay.aspx?ItemName=Mage%20Armor",
    );
    expect(parsed.name).toBe("Mage Armor");
    expect(parsed.school).toContain("conjuration");
    expect(parsed.levelText).toBe("sorcerer/wizard 1");
    expect(parsed.description).toBe(
      "An invisible but tangible field of force surrounds the subject.",
    );

    const messyDetailHtml = `<table id="MainContent_DataListTypes"><tr><td><b>School</b> necromancy [ disease<br/><b>Level</b> cleric 1, druid 1 Casting<br/>Weird page with missing title.</td></tr></table>`;
    const messyParsed = parseAonSpellDetail(
      messyDetailHtml,
      "https://www.aonprd.com/SpellDisplay.aspx?ItemName=Advanced%20Scurvy",
    );
    expect(messyParsed.name).toBe("Advanced Scurvy");
    expect(messyParsed.school).toBe("necromancy [disease]");
    expect(messyParsed.levelText).toBe("cleric 1, druid 1");
    expect(messyParsed.description).toBe("Weird page with missing title.");

    const multiSpellDetailHtml = `<table id="MainContent_DataListTypes"><tr><td><span><h1 class="title">Angelic Aspect, Lesser</h1><b>Source</b> Champions of Purity pg. 28<br/><b>School</b> transmutation [good]; <b>Level</b> cleric 2<br/><b>Duration</b> 1 minute/level<br/><b>Spell Resistance</b> no<h3 class="framing">Description</h3>Lesser version.<h1 class="title">Angelic Aspect</h1><b>Source</b> Champions of Purity pg. 28<br/><b>School</b> transmutation [good]; <b>Level</b> cleric 5<br/><b>Duration</b> 1 minute/level<br/><b>Spell Resistance</b> no<h3 class="framing">Description</h3>Base version.<h1 class="title">Angelic Aspect, Greater</h1><b>Source</b> Champions of Purity pg. 28<br/><b>School</b> transmutation [good]; <b>Level</b> cleric 8<br/><b>Duration</b> 1 minute/level<br/><b>Spell Resistance</b> no<h3 class="framing">Description</h3>Greater version.</span></td></tr></table>`;
    const multiParsed = parseAonSpellDetail(
      multiSpellDetailHtml,
      "https://www.aonprd.com/SpellDisplay.aspx?ItemName=Angelic%20Aspect,%20Greater",
    );
    expect(multiParsed.name).toBe("Angelic Aspect, Greater");
    expect(multiParsed.school).toBe("transmutation [good]");
    expect(multiParsed.levelText).toBe("cleric 8");
    expect(multiParsed.description).toBe("Greater version.");
  });

  it("parses AoN race list/detail fixtures", () => {
    const listHtml = `
      <a href="RacesDisplay.aspx?ItemName=Aasimar">Aasimar</a>
      <a href="RacesDisplay.aspx?ItemName=Catfolk">Catfolk</a>
    `;
    const links = parseAonRaceLinks(listHtml);
    expect(links.map((item) => item.name)).toEqual(["Aasimar", "Catfolk"]);

    const detailHtml = `<table id="MainContent_DataListTypes"><tr><td><span id="MainContent_DataListTypes_LabelName_0"><h1 class="title">Aasimars</h1><b>Source</b> Advanced Race Guide pg. 84<br/><b>Monster Entry</b> Link Aasimars are humans with celestial blood.<br/><b>+2 Wisdom, +2 Charisma</b>: Aasimars are insightful and personable.<br/><b>Native Outsider</b>: Aasimars are outsiders with the native subtype.<br/><b>Medium</b>: Aasimars are Medium creatures.<br/><b>Normal Speed</b>: Aasimars have a base speed of 30 feet.<br/><b>Darkvision</b>: Aasimars can see in the dark.<br/><b>Skilled</b>: Aasimars have a +2 racial bonus on Diplomacy and Perception checks.<br/><b>Languages</b>: Aasimars begin play speaking Common and Celestial.<br/><b>Source</b> Blood of Angels pg. 21</span></td></tr></table>`;
    const parsed = parseAonRaceDetail(
      detailHtml,
      "https://www.aonprd.com/RacesDisplay.aspx?ItemName=Aasimar",
      "NonCore",
    );
    expect(parsed.name).toBe("Aasimar");

    const singularTitleHtml = `<table id="MainContent_DataListTypes"><tr><td><h1 class="title">Elve</h1><b>Source</b> PRPG Core Rulebook pg. 21<br/><b>+2 Dexterity, +2 Intelligence, –2 Constitution</b><br/><b>Medium</b><br/><b>Normal Speed</b> 30 feet<br/><b>Languages</b> Common, Elven<br/>Monster Entry Link Elves are magical people.</td></tr></table>`;
    expect(parsed.category).toBe("NonCore");
    const singularParsed = parseAonRaceDetail(
      singularTitleHtml,
      "https://www.aonprd.com/RacesDisplay.aspx?ItemName=Elf",
      "Core",
    );
    expect(singularParsed.name).toBe("Elf");
    expect(parsed.abilityScoreText).toBe("+2 Wisdom, +2 Charisma");
    expect(parsed.size).toBe("Medium");
    expect(parsed.speedText).toBe(
      "Normal Speed: Aasimars have a base speed of 30 feet.",
    );
    expect(parsed.languages).toContain("Common and Celestial");
    expect(
      parsed.traitEntries?.find((entry) => entry.name === "Skilled")?.text,
    ).toContain("Diplomacy and Perception checks");

    const favoredClassHtml = `<table id="MainContent_DataListTypes"><tr><td><h1 class="title">Goblin</h1><b>Source</b> Advanced Race Guide pg. 115<br/><b>Small</b><br/><b>Fast Speed</b> 30 feet<br/><h1 class="title">Goblin Favored Class Options</h1>Instead of the universal bonus.<br/><br/>The following options are available.<br/><br/><b>Alchemist</b> (<a>Advanced Race Guide pg. 115</a>): The alchemist gains fire resistance 1.<br/><b>Barbarian</b> (<a>Advanced Race Guide pg. 115</a>): Add +1/2 on critical hit confirmation rolls.</td></tr></table>`;
    const favored = parseAonRaceDetail(
      favoredClassHtml,
      "https://www.aonprd.com/RacesDisplay.aspx?ItemName=Goblin",
      "NonCore",
    );
    expect(favored.favoredClassBonuses).toEqual([
      {
        className: "Alchemist",
        description: "The alchemist gains fire resistance 1.",
        sources: ["Advanced Race Guide pg. 115"],
      },
      {
        className: "Barbarian",
        description: "Add +1/2 on critical hit confirmation rolls.",
        sources: ["Advanced Race Guide pg. 115"],
      },
    ]);
  });

  it("normalizes scraped race traits into engine modifiers and class skills", () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mathfinder-content-db-"),
    );
    tempDirs.push(dir);
    const db = openDatabase(path.join(dir, "content.sqlite"));
    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, 'race', ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "race:test-catfolk",
      "test-catfolk",
      "Catfolk",
      "https://www.aonprd.com/RacesDisplay.aspx?ItemName=Catfolk",
      JSON.stringify({
        name: "Catfolk",
        size: "Medium",
        speedText: "Normal Speed: Catfolk have a base speed of 30 feet.",
        abilityScoreText: "+2 Dexterity, +2 Charisma, –2 Wisdom",
        traitEntries: [
          {
            name: "Natural Hunter",
            text: "Catfolk receive a +2 racial bonus on Perception, Stealth, and Survival checks.",
          },
          {
            name: "Sprinter",
            text: "Catfolk gain a 10-foot racial bonus to their speed when using the charge, run, or withdraw actions.",
          },
          {
            name: "Swim",
            text: "Catfolk have a swim speed of 20 feet and always treat Swim as a class skill.",
          },
          {
            name: "Low-Light Vision",
            text: "Catfolk can see twice as far as humans in conditions of dim light.",
          },
          { name: "Ember Fur", text: "Catfolk have fire resistance 5." },
          {
            name: "Bonus Feat",
            text: "Catfolk gain Skill Focus as a bonus feat at 1st level.",
          },
        ],
        sourceUrl: "https://www.aonprd.com/RacesDisplay.aspx?ItemName=Catfolk",
        description: "cats, but with paperwork",
      }),
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    );
    const output = buildUsableContentExport(db);
    const race = output.rulesDataSet.packs
      .find((pack) => pack.id === "aon-scraped-races")
      ?.races.find((entry) => entry.name === "Catfolk");
    db.close();
    expect(race).toMatchObject({
      name: "Catfolk",
      size: "medium",
      speed: 30,
      classSkills: ["swim"],
      movementModes: { swim: 20 },
      senses: { lowLightVision: true },
      resistances: { fire: 5 },
    });
    expect(race?.abilityModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "dex", value: 2 }),
        expect.objectContaining({ target: "cha", value: 2 }),
        expect.objectContaining({ target: "wis", value: -2 }),
      ]),
    );
    expect(race?.traits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "skill.perception", value: 2 }),
        expect.objectContaining({ target: "skill.stealth", value: 2 }),
        expect.objectContaining({ target: "skill.survival", value: 2 }),
      ]),
    );
    expect(race?.notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Sprinter"),
        expect.stringContaining("Bonus Feat"),
        expect.stringContaining("Ember Fur"),
      ]),
    );
  });

  it("parses AoN feat list/detail fixtures", () => {
    const listHtml = `
      <a href="Feats.aspx?Category=Combat">Combat</a>
      <a href="Feats.aspx?Category=General">General</a>
      <table id="MainContent_GridView6">
        <tr><td><a href="FeatDisplay.aspx?ItemName=Power%20Attack">Power Attack</a></td><td>Str 13</td></tr>
        <tr><td><a href="FeatDisplay.aspx?ItemName=Cleave">Cleave</a></td><td><a href="FeatDisplay.aspx?ItemName=Power%20Attack">Power Attack</a></td></tr>
      </table>
    `;
    const categories = parseAonFeatCategories(listHtml);
    expect(categories).toEqual(["Combat", "General"]);
    const links = parseAonFeatLinks(listHtml);
    expect(links.map((item) => item.name)).toEqual(["Power Attack", "Cleave"]);

    const detailHtml = `<table id="MainContent_DataListTypes"><tr><td><h1 class="title">Power Attack (Combat)</h1><b>Source</b> PRPG Core Rulebook pg. 131<br/><b>Prerequisites</b> Str 13, base attack bonus +1.<br/><b>Benefit</b> You can choose to take a –1 penalty on all melee attack rolls and combat maneuver checks to gain a +2 bonus on all melee damage rolls.<br/><b>Special</b> This feat cannot be used with a light weapon.<br/>You can make exceptionally deadly melee attacks by sacrificing accuracy for strength.</td></tr></table>`;
    const parsed = parseAonFeatDetail(
      detailHtml,
      "https://www.aonprd.com/FeatDisplay.aspx?ItemName=Power%20Attack",
    );
    expect(parsed.name).toBe("Power Attack");
    expect(parsed.category).toBe("Combat");
    expect(parsed.prerequisites).toContain("Str 13");
    expect(parsed.benefit).toContain("+2 bonus");
  });

  it("parses feat prerequisites into runtime-friendly shapes", () => {
    expect(
      parseFeatPrerequisites("Str 13, base attack bonus +1, Power Attack", [
        "Power Attack",
        "Cleave",
      ]),
    ).toEqual([
      { type: "ability", ability: "str", min: 13, description: "Str 13" },
      { type: "bab", min: 1, description: "BAB +1" },
      { type: "feat", featName: "Power Attack", description: "Power Attack" },
    ]);
  });

  it("refreshes cached AoN spell rows with the improved parser", async () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mathfinder-content-db-"),
    );
    tempDirs.push(dir);
    const db = openDatabase(path.join(dir, "content.sqlite"));
    const sourceUrl =
      "https://www.aonprd.com/SpellDisplay.aspx?ItemName=Advanced%20Scurvy";
    db.prepare(
      "INSERT INTO page_cache (url, source, status_code, fetched_at, html) VALUES (?, 'aonprd', 200, ?, ?)",
    ).run(
      sourceUrl,
      "2026-01-01T00:00:00Z",
      `<table id="MainContent_DataListTypes"><tr><td><b>School</b> necromancy [ disease, evil<br/><b>Level</b> cleric 1, druid 1 Casting<br/><b>Casting Time</b> 1 standard action<br/><b>Components</b> V, S<br/><b>Range</b> touch<br/><b>Target</b> living creature touched<br/><b>Duration</b> instantaneous<br/><b>Saving Throw</b> Fortitude negates<br/><b>Spell Resistance</b> yes<br/><b>Description</b> Weird page with missing title.</td></tr></table>`,
    );
    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, 'spell', ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "spell:scrape-aon-advanced-scurvy",
      "scrape-aon-advanced-scurvy",
      "Advanced Scurvy",
      sourceUrl,
      JSON.stringify({
        name: "Advanced Scurvy",
        school: "necromancy [ disease",
        sourceUrl,
      }),
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    );
    const { refreshCachedAonSpells } = await import("../src");
    const result = await refreshCachedAonSpells(db);
    expect(result).toEqual({ refreshed: 1, skipped: 0, scanned: 1 });
    const refreshed = db
      .prepare("SELECT payload_json FROM content_entities WHERE entity_key = ?")
      .get("spell:scrape-aon-advanced-scurvy") as { payload_json: string };
    const refreshedPayload = JSON.parse(refreshed.payload_json);
    db.close();
    expect(refreshedPayload).toMatchObject({
      name: "Advanced Scurvy",
      school: "necromancy [disease, evil]",
      levelText: "cleric 1, druid 1",
      castingTime: "1 standard action",
      components: "V, S",
      range: "touch",
      targetEffectArea: "living creature touched",
      duration: "instantaneous",
      savingThrow: "Fortitude negates",
      spellResistance: "yes",
    });
  });

  it("refreshes cached AoN feat rows with the improved parser", async () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mathfinder-content-db-"),
    );
    tempDirs.push(dir);
    const db = openDatabase(path.join(dir, "content.sqlite"));
    const sourceUrl =
      "https://www.aonprd.com/FeatDisplay.aspx?ItemName=Power%20Attack";
    db.prepare(
      "INSERT INTO page_cache (url, source, status_code, fetched_at, html) VALUES (?, 'aonprd', 200, ?, ?)",
    ).run(
      sourceUrl,
      "2026-01-01T00:00:00Z",
      `<table id="MainContent_DataListTypes"><tr><td><h1 class="title">Power Attack (Combat)</h1><b>Source</b> PRPG Core Rulebook pg. 131<br/><b>Prerequisites</b> Str 13, base attack bonus +1.<br/><b>Benefit</b> Trade accuracy for damage.<br/><b>Special</b> This feat cannot be used with a light weapon.<br/>Exceptionally deadly melee attacks.</td></tr></table>`,
    );
    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, 'feat', ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "feat:test-power-attack",
      "test-power-attack",
      "Power Attack",
      sourceUrl,
      JSON.stringify({ name: "Power Attack", category: "General", sourceUrl }),
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    );
    const { refreshCachedAonFeats } = await import("../src");
    const result = await refreshCachedAonFeats(db);
    expect(result).toEqual({ refreshed: 1, skipped: 0, scanned: 1 });
    const refreshed = db
      .prepare("SELECT payload_json FROM content_entities WHERE entity_key = ?")
      .get("feat:test-power-attack") as { payload_json: string };
    const refreshedPayload = JSON.parse(refreshed.payload_json);
    db.close();
    expect(refreshedPayload).toMatchObject({
      name: "Power Attack",
      category: "Combat",
      prerequisites: "Str 13, base attack bonus +1.",
      benefit: "Trade accuracy for damage.",
      special: "This feat cannot be used with a light weapon.",
    });
  });

  it("refreshes cached AoN magic item rows with the improved parser", async () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mathfinder-content-db-"),
    );
    tempDirs.push(dir);
    const db = openDatabase(path.join(dir, "content.sqlite"));
    const sourceUrl =
      "https://www.aonprd.com/MagicWondrousDisplay.aspx?FinalName=Belt%20of%20Giant%20Strength2";
    db.prepare(
      "INSERT INTO page_cache (url, source, status_code, fetched_at, html) VALUES (?, 'aonprd', 200, ?, ?)",
    ).run(
      sourceUrl,
      "2026-01-01T00:00:00Z",
      `<table id="MainContent_DataListTypes"><tr><td><h1 class="title">Belt of Giant Strength</h1><b>Source</b> Ultimate Equipment pg. 208<br/><b>Aura</b> moderate transmutation; <b>CL</b> 8th<br/><b>Slot</b> belt; <b>Price</b> 4,000 gp; <b>Weight</b> 1 lb.<h3 class="framing">Description</h3>This belt is a thick leather affair.<h3 class="framing">Construction</h3><b>Requirements</b> stuff; <b>Cost</b> 2,000 gp</td></tr></table>`,
    );
    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, 'magic-item', ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "magic-item:test-belt-of-giant-strength",
      "test-belt-of-giant-strength",
      "Belt of Giant Strength",
      sourceUrl,
      JSON.stringify({
        name: "Belt of Giant Strength",
        price: "1 gp",
        sourceUrl,
      }),
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    );
    const { refreshCachedAonMagicItems } = await import("../src");
    const result = await refreshCachedAonMagicItems(db);
    expect(result).toEqual({ refreshed: 1, skipped: 0, scanned: 1 });
    const refreshed = db
      .prepare("SELECT payload_json FROM content_entities WHERE entity_key = ?")
      .get("magic-item:test-belt-of-giant-strength") as {
      payload_json: string;
    };
    const refreshedPayload = JSON.parse(refreshed.payload_json);
    db.close();
    expect(refreshedPayload).toMatchObject({
      name: "Belt of Giant Strength",
      aura: "moderate transmutation",
      cl: "8th",
      slot: "belt",
      price: "4,000 gp",
      weight: "1 lb.",
      description: "This belt is a thick leather affair.",
    });
  });

  it("builds a scraped feat rules-data set", () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mathfinder-content-db-"),
    );
    tempDirs.push(dir);
    const db = openDatabase(path.join(dir, "content.sqlite"));
    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, 'feat', ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "feat:test-power-attack",
      "test-power-attack",
      "Power Attack",
      "https://example.test/power-attack",
      JSON.stringify({
        name: "Power Attack",
        category: "Combat",
        prerequisites: "Str 13, base attack bonus +1",
        benefit: "Trade accuracy for damage.",
        description: "Trade accuracy for damage.",
        sourceUrl: "https://example.test/power-attack",
      }),
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    );
    const dataSet = buildScrapedFeatRulesDataSet(db);
    expect(dataSet.packs).toHaveLength(1);
    expect(dataSet.packs[0]?.feats).toEqual([
      {
        id: "test-power-attack",
        name: "Power Attack",
        pack: "aon-scraped-feats",
        description: "Trade accuracy for damage.",
        tags: ["combat"],
        prerequisites: [
          { type: "ability", ability: "str", min: 13, description: "Str 13" },
          { type: "bab", min: 1, description: "BAB +1" },
        ],
        effects: [],
      },
    ]);
    db.close();
  });

  it("parses AoN magic item list/detail fixtures", () => {
    const listHtml = `
      <table id="MainContent_GridViewMagicWondrous">
        <tr><th>Name</th><th>Cost</th></tr>
        <tr>
          <td><a href="MagicWondrousDisplay.aspx?FinalName=Belt of Giant Strength2">Belt of Giant Strength</a></td>
          <td>4,000 gp</td>
        </tr>
      </table>
    `;
    const entries = parseAonMagicItemList(listHtml, "Belts");
    expect(entries).toEqual([
      {
        name: "Belt of Giant Strength",
        url: "https://www.aonprd.com/MagicWondrousDisplay.aspx?FinalName=Belt%20of%20Giant%20Strength2",
        cost: "4,000 gp",
        slotPage: "Belts",
      },
    ]);

    const ringListHtml = `
      <table id="MainContent_GridViewMagicRings">
        <tr><th>Name</th><th>Cost</th></tr>
        <tr>
          <td><a href="MagicRingsDisplay.aspx?FinalName=Ring of Inurement">Ring of Inurement</a></td>
          <td>1,000 gp</td>
        </tr>
      </table>
    `;
    const ringEntries = parseAonMagicItemList(ringListHtml, "Rings", {
      gridSelector: "#MainContent_GridViewMagicRings",
      hrefPrefix: "MagicRingsDisplay.aspx?FinalName=",
    });
    expect(ringEntries).toEqual([
      {
        name: "Ring of Inurement",
        url: "https://www.aonprd.com/MagicRingsDisplay.aspx?FinalName=Ring%20of%20Inurement",
        cost: "1,000 gp",
        slotPage: "Rings",
      },
    ]);

    const detailHtml = `<table id="MainContent_DataListTypes"><tr><td><h1 class="title">Belt of Giant Strength</h1><b>Source</b> Ultimate Equipment pg. 208<br/><b>Aura</b> moderate transmutation; <b>CL</b> 8th<br/><b>Slot</b> belt; <b>Price</b> 4,000 gp (+2), 16,000 gp (+4), 36,000 gp (+6); <b>Weight</b> 1 lb.<h3 class="framing">Description</h3>This belt is a thick leather affair, often decorated with large metal buckles and studded with iron.<h3 class="framing">Construction</h3><b>Requirements</b> stuff; <b>Cost</b> 2,000 gp</td></tr></table>`;
    const parsed = parseAonMagicItemDetail(
      detailHtml,
      "https://www.aonprd.com/MagicWondrousDisplay.aspx?FinalName=Belt%20of%20Giant%20Strength2",
    );
    expect(parsed.name).toBe("Belt of Giant Strength");
    expect(parsed.aura).toContain("moderate transmutation");
    expect(parsed.cl).toContain("8th");
    expect(parsed.slot).toContain("belt");
    expect(parsed.price).toContain("4,000 gp");
    expect(parsed.weight).toBe("1 lb.");
    expect(parsed.description).toContain("thick leather affair");
  });

  it("defines the expected AoN base class batch list", () => {
    expect(AON_BASE_CLASSES).toEqual([
      "Alchemist",
      "Antipaladin",
      "Arcanist",
      "Barbarian",
      "Barbarian (Unchained)",
      "Bard",
      "Bloodrager",
      "Brawler",
      "Cavalier",
      "Cleric",
      "Druid",
      "Fighter",
      "Gunslinger",
      "Hunter",
      "Inquisitor",
      "Investigator",
      "Kineticist",
      "Magus",
      "Medium",
      "Mesmerist",
      "Monk",
      "Monk (Unchained)",
      "Ninja",
      "Occultist",
      "Oracle",
      "Paladin",
      "Psychic",
      "Ranger",
      "Rogue",
      "Rogue (Unchained)",
      "Samurai",
      "Shaman",
      "Shifter",
      "Skald",
      "Slayer",
      "Sorcerer",
      "Spiritualist",
      "Summoner",
      "Summoner (Unchained)",
      "Swashbuckler",
      "Vigilante",
      "Warpriest",
      "Witch",
      "Wizard",
    ]);
    expect(AON_ARMOR_CATEGORIES).toEqual([
      "Light",
      "Medium",
      "Heavy",
      "Shield",
    ]);
    expect(AON_MISC_EQUIPMENT_CATEGORIES).toContain("AdventuringGear");
    expect(AON_WEAPON_PROFICIENCIES).toEqual([
      "Simple",
      "Martial",
      "Exotic",
      "Ammo",
      "Firearm",
      "Mod",
      "Siege",
      "Special",
    ]);
    expect(AON_WONDROUS_SLOTS).toEqual([
      "Belts",
      "Body",
      "Chest",
      "Eyes",
      "Feet",
      "Hands",
      "Head",
      "Headband",
      "Neck",
      "Shoulders",
      "Wrist",
      "Other",
      "Ioun",
    ]);
    expect(AON_ROD_CATEGORIES).toEqual(["Metamagic", "Other"]);
  });

  it("parses AoN armor list/detail fixtures", () => {
    const listHtml = `
      <table>
        <tr><td>Name</td><td>Cost</td><td>Armor/Shield Bonus</td><td>Maximum Dex Bonus</td><td>Armor Check Penalty</td><td>Arcane Spell Failure Chance</td><td>Speed 30 ft.</td><td>Speed 20 ft.</td><td>Weight</td></tr>
        <tr>
          <td><a href="EquipmentArmorDisplay.aspx?ItemName=Chainmail">Chainmail</a></td>
          <td>150 gp</td><td>+6</td><td>+2</td><td>-5</td><td>30%</td><td>20 ft.</td><td>15 ft.</td><td>40 lbs.</td>
        </tr>
      </table>
    `;
    const entries = parseAonArmorList(listHtml, "Medium");
    expect(entries).toEqual([
      {
        name: "Chainmail",
        url: "https://www.aonprd.com/EquipmentArmorDisplay.aspx?ItemName=Chainmail",
        cost: "150 gp",
        armorBonus: "+6",
        maxDexBonus: "+2",
        armorCheckPenalty: "-5",
        arcaneSpellFailure: "30%",
        speed30: "20 ft.",
        speed20: "15 ft.",
        weight: "40 lbs.",
        categoryPage: "Medium",
      },
    ]);

    const detailHtml = `<table id="MainContent_DataListTypes"><tr><td><h1 class="title">Chainmail</h1><b>Source</b> PRPG Core Rulebook pg. 153<br/>Statistics<br/><b>Cost</b> 150 gp; <b>Armor/Shield Bonus</b> +6; <b>Maximum Dex Bonus</b> +2; <b>Armor Check Penalty</b> -5; <b>Arcane Spell Failure Chance</b> 30%; <b>Speed 30 ft.</b> 20 ft.; <b>Speed 20 ft.</b> 15 ft.; <b>Weight</b> 40 lbs.<br/><b>Category</b> Medium<br/>Description Chainmail is made of interlocking metal rings.</td></tr></table>`;
    const parsed = parseAonArmorDetail(
      detailHtml,
      "https://www.aonprd.com/EquipmentArmorDisplay.aspx?ItemName=Chainmail",
    );
    expect(parsed.name).toBe("Chainmail");
    expect(parsed.cost).toBe("150 gp");
    expect(parsed.armorBonus).toBe("+6");
    expect(parsed.maxDexBonus).toBe("+2");
    expect(parsed.arcaneSpellFailure).toBe("30%");
    expect(parsed.category).toBe("Medium");
    expect(parsed.description).toContain("interlocking metal rings");
  });

  it("parses AoN gear category/list/detail fixtures", () => {
    const categoryHtml = `
      <a href="EquipmentMisc.aspx?Category=AdventuringGear">Adventuring Gear</a>
      <a href="EquipmentMisc.aspx?Category=Tools">Tools</a>
    `;
    expect(parseAonGearCategories(categoryHtml)).toEqual([
      "AdventuringGear",
      "Tools",
    ]);

    const listHtml = `
      <table>
        <tr><td>Name</td><td>Cost</td><td>Weight</td></tr>
        <tr>
          <td><a href="EquipmentMiscDisplay.aspx?ItemName=Backpack">Backpack</a></td>
          <td>2 gp</td><td>2 lbs.</td>
        </tr>
      </table>
    `;
    expect(parseAonGearList(listHtml, "AdventuringGear")).toEqual([
      {
        name: "Backpack",
        url: "https://www.aonprd.com/EquipmentMiscDisplay.aspx?ItemName=Backpack",
        cost: "2 gp",
        weight: "2 lbs.",
        categoryPage: "AdventuringGear",
      },
    ]);

    const detailHtml = `<table id="MainContent_DataListTypes"><tr><td><h1 class="title">Backpack</h1><b>Source</b> PRPG Core Rulebook pg. 158<br/><b>Price</b> 2 gp; <b>Weight</b> 2 lbs.<br/><b>Category</b> Adventuring Gear<br/>Description A backpack holds adventuring supplies.</td></tr></table>`;
    const parsed = parseAonGearDetail(
      detailHtml,
      "https://www.aonprd.com/EquipmentMiscDisplay.aspx?ItemName=Backpack",
    );
    expect(parsed).toMatchObject({
      name: "Backpack",
      source: "PRPG Core Rulebook pg. 158",
      cost: "2 gp",
      weight: "2 lbs.",
      category: "Adventuring Gear",
    });
    expect(parsed.description).toContain("adventuring supplies");
  });

  it("normalizes scraped armor into equipment-ready records", () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mathfinder-content-db-"),
    );
    tempDirs.push(dir);
    const db = openDatabase(path.join(dir, "content.sqlite"));
    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, 'armor', ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "armor:test-chainmail",
      "test-chainmail",
      "Chainmail",
      "https://www.aonprd.com/EquipmentArmorDisplay.aspx?ItemName=Chainmail",
      JSON.stringify({
        name: "Chainmail",
        source: "PRPG Core Rulebook pg. 153",
        cost: "150 gp",
        armorBonus: "+6",
        maxDexBonus: "+2",
        armorCheckPenalty: "-5",
        arcaneSpellFailure: "30%",
        speed30: "20 ft.",
        speed20: "15 ft.",
        weight: "40 lbs.",
        category: "Medium",
        description: "Chainmail is made of interlocking metal rings.",
        sourceUrl:
          "https://www.aonprd.com/EquipmentArmorDisplay.aspx?ItemName=Chainmail",
        categoryPage: "Medium",
      }),
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    );
    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, 'armor', ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "armor:test-heavy-steel-shield",
      "test-heavy-steel-shield",
      "Heavy Steel Shield",
      "https://www.aonprd.com/EquipmentArmorDisplay.aspx?ItemName=Heavy%20Steel%20Shield",
      JSON.stringify({
        name: "Heavy Steel Shield",
        cost: "20 gp",
        armorBonus: "+2",
        armorCheckPenalty: "-2",
        weight: "15 lbs.",
        category: "Shield",
        description: "A heavy steel shield is solid and reliable.",
        sourceUrl:
          "https://www.aonprd.com/EquipmentArmorDisplay.aspx?ItemName=Heavy%20Steel%20Shield",
        categoryPage: "Shield",
      }),
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    );
    const output = buildUsableContentExport(db);
    db.close();
    const chainmail = output.normalized.armor.find(
      (entry) => entry.name === "Chainmail",
    );
    const shield = output.normalized.armor.find(
      (entry) => entry.name === "Heavy Steel Shield",
    );
    expect(chainmail).toMatchObject({
      categoryNormalized: "medium",
      armorBonus: 6,
      maxDexBonus: 2,
      armorCheckPenalty: -5,
      arcaneSpellFailure: 30,
      speed30: 20,
      speed20: 15,
      engineCompatible: true,
      equipmentEntry: {
        slot: "armor",
        armor: {
          category: "medium",
          acBonus: 6,
          maxDexBonus: 2,
          checkPenalty: -5,
          speedPenalty: 5,
        },
      },
    });
    expect(shield).toMatchObject({
      categoryNormalized: "shield",
      armorBonus: 2,
      engineCompatible: true,
      equipmentEntry: {
        slot: "shield",
        shield: {
          acBonus: 2,
          checkPenalty: -2,
        },
      },
    });
  });

  it("normalizes scraped gear into equipment-ready records", () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mathfinder-content-db-"),
    );
    tempDirs.push(dir);
    const db = openDatabase(path.join(dir, "content.sqlite"));
    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, 'gear', ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "gear:test-backpack",
      "test-backpack",
      "Backpack",
      "https://www.aonprd.com/EquipmentMiscDisplay.aspx?ItemName=Backpack",
      JSON.stringify({
        name: "Backpack",
        source: "PRPG Core Rulebook pg. 158",
        cost: "2 gp",
        weight: "2 lbs.",
        category: "Adventuring Gear",
        description: "A backpack holds adventuring supplies.",
        sourceUrl:
          "https://www.aonprd.com/EquipmentMiscDisplay.aspx?ItemName=Backpack",
        categoryPage: "AdventuringGear",
      }),
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    );
    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, 'gear', ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "gear:test-torch",
      "test-torch",
      "Torch",
      "https://www.aonprd.com/EquipmentMiscDisplay.aspx?ItemName=Torch",
      JSON.stringify({
        name: "Torch",
        cost: "1 cp",
        weight: "1 lb.",
        category: "Adventuring Gear",
        description: "A torch burns for 1 hour.",
        sourceUrl:
          "https://www.aonprd.com/EquipmentMiscDisplay.aspx?ItemName=Torch",
        categoryPage: "AdventuringGear",
      }),
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    );
    const output = buildUsableContentExport(db);
    db.close();
    const backpack = output.normalized.mundaneEquipment.find(
      (entry) => entry.name === "Backpack",
    );
    const torch = output.normalized.mundaneEquipment.find(
      (entry) => entry.name === "Torch",
    );
    expect(backpack).toMatchObject({
      categoryRaw: "Adventuring Gear",
      costRaw: "2 gp",
      costGp: 2,
      weightRaw: "2 lbs.",
      weightLb: 2,
      engineCompatible: true,
      equipmentEntry: {
        kind: "mundane",
        name: "Backpack",
        costGp: 2,
        weight: 2,
        equipped: false,
      },
    });
    expect(torch).toMatchObject({
      costGp: 0.01,
      weightLb: 1,
    });
  });

  it("parses AoN weapon list/detail fixtures", () => {
    const listHtml = `
      <table>
        <tr><td>Name</td><td>Cost</td><td>Dmg (S)</td><td>Dmg (M)</td><td>Critical</td><td>Range</td><td>Weight</td><td>Type</td><td>Special</td></tr>
        <tr>
          <td><a href="EquipmentWeaponsDisplay.aspx?ItemName=Longbow">Longbow</a></td>
          <td>75 gp</td><td>1d6</td><td>1d8</td><td>x3</td><td>100 ft.</td><td>3 lbs.</td><td>P</td><td>—</td>
        </tr>
      </table>
    `;
    const entries = parseAonWeaponList(listHtml, "Martial");
    expect(entries).toEqual([
      {
        name: "Longbow",
        url: "https://www.aonprd.com/EquipmentWeaponsDisplay.aspx?ItemName=Longbow",
        cost: "75 gp",
        damageSmall: "1d6",
        damageMedium: "1d8",
        critical: "x3",
        range: "100 ft.",
        weight: "3 lbs.",
        type: "P",
        special: "—",
        proficiencyPage: "Martial",
      },
    ]);

    const detailHtml = `<table id="MainContent_DataListTypes"><tr><td><h1 class="title">Longbow</h1><b>Source</b> PRPG Core Rulebook pg. 143<br/><b>Cost</b> 75 gp <b>Weight</b> 3 lbs.<br/><b>Damage</b> 1d6 (small), 1d8 (medium); <b>Critical</b> x3; <b>Range</b> 100 ft.; <b>Type</b> P; <b>Special</b> —<br/><b>Category</b> Ranged; <b>Proficiency</b> Martial<br/><b>Weapon Groups</b> Bows<br/>You need at least two hands to use a bow.</td></tr></table>`;
    const parsed = parseAonWeaponDetail(
      detailHtml,
      "https://www.aonprd.com/EquipmentWeaponsDisplay.aspx?ItemName=Longbow",
    );
    expect(parsed.name).toBe("Longbow");
    expect(parsed.cost).toBe("75 gp");
    expect(parsed.damageSmall).toBe("1d6");
    expect(parsed.damageMedium).toBe("1d8");
    expect(parsed.category).toContain("Ranged");
    expect(parsed.proficiency).toContain("Martial");
    expect(parsed.weaponGroups).toContain("Bows");
  });

  it("maps common scraped modifiers across feats, spells, class features, and magic items", () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mathfinder-content-db-"),
    );
    tempDirs.push(dir);
    const db = openDatabase(path.join(dir, "content.sqlite"));
    const now = "2026-01-01T00:00:00Z";

    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "feat:test-improved-initiative",
      "feat",
      "test-improved-initiative",
      "Improved Initiative",
      "https://example.test/improved-initiative",
      JSON.stringify({
        name: "Improved Initiative",
        category: "Combat",
        benefit: "You get a +4 bonus on initiative checks.",
        description: "You get a +4 bonus on initiative checks.",
        sourceUrl: "https://example.test/improved-initiative",
      }),
      now,
      now,
    );

    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "spell:test-mage-armor",
      "spell",
      "test-mage-armor",
      "Mage Armor",
      "https://example.test/mage-armor",
      JSON.stringify({
        name: "Mage Armor",
        school: "conjuration",
        levelText: "wizard 1",
        description:
          "An invisible but tangible field of force surrounds the subject.",
        sourceUrl: "https://example.test/mage-armor",
      }),
      now,
      now,
    );

    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "class-feature:test-bravery",
      "class-feature",
      "test-bravery",
      "Bravery",
      "https://example.test/bravery",
      JSON.stringify({
        className: "Fighter",
        name: "Bravery",
        levels: [2],
        description:
          "Starting at 2nd level, a fighter gains a +1 bonus on Will saves against fear.",
        sourceUrl: "https://example.test/bravery",
      }),
      now,
      now,
    );

    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "magic-item:test-cloak-of-resistance-2",
      "magic-item",
      "test-cloak-of-resistance-2",
      "Cloak of Resistance +2",
      "https://www.aonprd.com/MagicWondrousDisplay.aspx?FinalName=Cloak%20of%20Resistance2",
      JSON.stringify({
        name: "Cloak of Resistance +2",
        slot: "shoulders",
        price: "4,000 gp",
        weight: "1 lb.",
        description: "This garment offers protection against danger.",
        sourceUrl:
          "https://www.aonprd.com/MagicWondrousDisplay.aspx?FinalName=Cloak%20of%20Resistance2",
      }),
      now,
      now,
    );

    const output = buildUsableContentExport(db);
    db.close();

    const feat = output.rulesDataSet.packs
      .find((pack) => pack.id === "aon-scraped-feats")
      ?.feats.find((entry) => entry.name === "Improved Initiative");
    const spell = output.rulesDataSet.packs
      .find((pack) => pack.id === "aon-scraped-spells")
      ?.spells.find((entry) => entry.name === "Mage Armor");
    const feature = output.rulesDataSet.packs
      .find((pack) => pack.id === "aon-scraped-class-features")
      ?.classFeatures.find((entry) => entry.name === "Bravery");
    const item = output.rulesDataSet.packs
      .find((pack) => pack.id === "aon-scraped-magic-items")
      ?.magicItems.find((entry) => entry.name === "Cloak of Resistance +2");

    expect(feat?.tags).toEqual(["combat"]);
    expect(feat?.effects).toEqual([
      {
        target: "init",
        type: "untyped",
        value: 4,
        source: "Improved Initiative",
        pack: "aon-scraped-feats",
      },
    ]);
    expect(spell?.description).toBe(
      "An invisible but tangible field of force surrounds the subject.",
    );
    expect(feature?.effects).toEqual([
      {
        target: "save.will",
        type: "untyped",
        value: 1,
        source: "Fighter: Bravery",
        pack: "aon-scraped-class-features",
        condition: "against fear",
        enabled: false,
      },
    ]);
    expect(item).toMatchObject({
      automation: {
        status: "automated",
      },
      upgradeGroup: "cloak-of-resistance",
      upgradeTier: 2,
      modifiers: [
        {
          target: "save.all",
          type: "resistance",
          value: 2,
          source: "Cloak of Resistance +2",
          pack: "aon-scraped-magic-items",
        },
      ],
    });
  });

  it("captures richer conditional modifiers for scraped feats and class features", () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mathfinder-content-db-"),
    );
    tempDirs.push(dir);
    const db = openDatabase(path.join(dir, "content.sqlite"));
    const now = "2026-01-01T00:00:00Z";

    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "feat:test-mobility",
      "feat",
      "test-mobility",
      "Mobility",
      "https://example.test/mobility",
      JSON.stringify({
        name: "Mobility",
        benefit:
          "You get a +4 dodge bonus to AC against attacks of opportunity caused when you move out of or within a threatened area.",
        description:
          "You get a +4 dodge bonus to AC against attacks of opportunity caused when you move out of or within a threatened area.",
        sourceUrl: "https://example.test/mobility",
      }),
      now,
      now,
    );

    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "feat:test-critical-focus",
      "feat",
      "test-critical-focus",
      "Critical Focus",
      "https://example.test/critical-focus",
      JSON.stringify({
        name: "Critical Focus",
        benefit:
          "You receive a +4 bonus on attack rolls made to confirm critical hits.",
        description:
          "You receive a +4 bonus on attack rolls made to confirm critical hits.",
        sourceUrl: "https://example.test/critical-focus",
      }),
      now,
      now,
    );

    db.prepare(
      `
      INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, 'scrape', 'aonprd', ?, NULL, ?, ?, ?)
    `,
    ).run(
      "class-feature:test-shield-awareness",
      "class-feature",
      "test-shield-awareness",
      "Shield Awareness",
      "https://example.test/shield-awareness",
      JSON.stringify({
        className: "Guardian",
        name: "Shield Awareness",
        levels: [3],
        description:
          "While wearing light or no armor and wielding a shield, the guardian gains a +1 bonus to AC and a +1 bonus on Reflex saves.",
        sourceUrl: "https://example.test/shield-awareness",
      }),
      now,
      now,
    );

    const output = buildUsableContentExport(db);
    db.close();

    const mobility = output.rulesDataSet.packs
      .find((pack) => pack.id === "aon-scraped-feats")
      ?.feats.find((entry) => entry.name === "Mobility");
    const criticalFocus = output.rulesDataSet.packs
      .find((pack) => pack.id === "aon-scraped-feats")
      ?.feats.find((entry) => entry.name === "Critical Focus");
    const shieldAwareness = output.rulesDataSet.packs
      .find((pack) => pack.id === "aon-scraped-class-features")
      ?.classFeatures.find((entry) => entry.name === "Shield Awareness");

    expect(mobility?.effects).toEqual([
      {
        target: "ac",
        type: "dodge",
        value: 4,
        source: "Mobility",
        pack: "aon-scraped-feats",
        condition:
          "against attacks of opportunity caused when you move out of or within a threatened area",
        enabled: false,
      },
    ]);
    expect(criticalFocus?.effects).toEqual([
      {
        target: "attack",
        type: "untyped",
        value: 4,
        source: "Critical Focus",
        pack: "aon-scraped-feats",
        condition: "made to confirm critical hits",
        enabled: false,
      },
    ]);
    expect(shieldAwareness?.effects).toEqual(
      expect.arrayContaining([
        {
          target: "ac",
          type: "untyped",
          value: 1,
          source: "Guardian: Shield Awareness",
          pack: "aon-scraped-class-features",
          condition: "While wearing light or no armor and wielding a shield",
          enabled: false,
        },
        {
          target: "save.ref",
          type: "untyped",
          value: 1,
          source: "Guardian: Shield Awareness",
          pack: "aon-scraped-class-features",
          condition: "While wearing light or no armor and wielding a shield",
          enabled: false,
        },
      ]),
    );
  });

  it("parses AoN archetype indexes and detail fixtures", () => {
    expect(AON_SUPPORTED_ARCHETYPE_CLASSES).toContain("Fighter");
    const indexHtml = `
      <table><tr>
        <td><a href="ArchetypeDisplay.aspx?FixedName=Fighter Archer">Archer</a></td>
        <td>Bravery; Armor Training 1-4</td>
        <td>A master of bows.</td>
      </tr></table>`;
    const links = parseAonArchetypeLinks(indexHtml);
    expect(links).toEqual([
      {
        name: "Archer",
        url: "https://www.aonprd.com/ArchetypeDisplay.aspx?FixedName=Fighter%20Archer",
        replacementText: "Bravery; Armor Training 1-4",
        description: "A master of bows.",
      },
    ]);

    const detailHtml = `
      <table id="MainContent_DataListTypes"><tr><td><span>
        <h1 class="title">Archer</h1><b>Source</b>
        <a href="https://paizo.com">Advanced Player's Guide pg. 104</a><br/>
        The archer is dedicated to mastery of the bow.<br/><br/>
        <b>Hawkeye (Ex)</b>: At 2nd level, an archer gains a bonus. This ability replaces bravery.<br/><br/>
        <b>Trick Shot (Ex)</b>: At 3rd level, an archer gains trick shots. This ability alters armor training.<br/>
      </span></td></tr></table>`;
    const parsed = parseAonArchetypeDetail(
      detailHtml,
      links[0]!.url,
      "Fighter",
      links[0]!.description,
      links[0]!.replacementText,
    );
    expect(parsed.name).toBe("Archer");
    expect(parsed.baseClassName).toBe("Fighter");
    expect(parsed.source).toBe("Advanced Player's Guide pg. 104");
    expect(parsed.description).toBe(
      "The archer is dedicated to mastery of the bow.",
    );
    expect(parsed.replaces).toEqual(["Bravery", "Armor Training 1-4"]);
    expect(parsed.alters).toEqual(["armor training"]);
    expect(parsed.features).toMatchObject([
      { name: "Hawkeye", featureType: "Ex", level: 2 },
      { name: "Trick Shot", featureType: "Ex", level: 3 },
    ]);
  });

  it("parses AoN class feature levels and details fixtures", () => {
    const classHtml = `
      <table id="MainContent_DataListTypes"><tr><td><span>
        <h1 class="title">Fighter</h1>
        <b>Source</b> PRPG Core Rulebook pg. 55
        <h2>Class Features</h2>
        <table>
          <tr><td><b>Level</b></td><td><b>Base Attack Bonus</b></td><td><b>Fort Save</b></td><td><b>Ref Save</b></td><td><b>Will Save</b></td><td><b>Special</b></td></tr>
          <tr><td>1st</td><td>+1</td><td>+2</td><td>+0</td><td>+0</td><td>Bonus feat</td></tr>
          <tr><td>2nd</td><td>+2</td><td>+3</td><td>+0</td><td>+0</td><td>Bonus feat, bravery +1</td></tr>
          <tr><td>3rd</td><td>+3</td><td>+3</td><td>+1</td><td>+1</td><td>Armor training 1</td></tr>
          <tr><td>5th</td><td>+5</td><td>+4</td><td>+1</td><td>+1</td><td>Weapon training 1</td></tr>
        </table>
        <b>Weapon and Armor Proficiency</b>: A fighter is proficient with all simple and martial weapons.<br/>
        <b>Bonus Feats</b>: At 1st level and every even level thereafter, a fighter gains a bonus feat.<br/>
        <b>Bravery (Ex)</b>: Starting at 2nd level, a fighter gains a +1 bonus on Will saves against fear.<br/>
        <b>Armor Training (Ex)</b>: Starting at 3rd level, a fighter learns to be more maneuverable while wearing armor.<br/>
        <b>Weapon Training (Ex)</b>: Starting at 5th level, a fighter selects a weapon group and gains bonuses.<br/>
        <h2>Alternate Capstones</h2>
        <h3>Ignore Me</h3>
      </span></td></tr></table>
    `;

    const levels = parseAonClassFeatureLevels(classHtml);
    expect(levels.get("bonus feat")).toEqual([1, 2]);
    expect(levels.get("bravery")).toEqual([2]);
    expect(levels.get("armor training")).toEqual([3]);
    expect(levels.get("weapon training")).toEqual([5]);

    const features = parseAonClassFeatureDetails(
      classHtml,
      "https://www.aonprd.com/ClassDisplay.aspx?ItemName=Fighter",
    );
    expect(features.map((feature) => feature.name)).toEqual([
      "Weapon and Armor Proficiency",
      "Bonus Feats",
      "Bravery",
      "Armor Training",
      "Weapon Training",
    ]);
    expect(
      features.find((feature) => feature.name === "Bravery")?.levels,
    ).toEqual([2]);
    expect(
      features.find((feature) => feature.name === "Bravery")?.featureType,
    ).toBe("Ex");
    expect(
      features.find((feature) => feature.name === "Bonus Feats")?.description,
    ).toContain("bonus feat");
  });
});
