import { describe, it, expect } from "vitest";
import { openDatabase } from "../src/db";
import { IngestionStore } from "../src/ingestion/store";
import { buildApprovedExport } from "../src/ingestion/export";
import {
  buildRuntimeRelease,
  verifyRuntimeRelease,
  type ReleaseDecision,
} from "../src/ingestion/release";
import { hash, type Evidence } from "../src/ingestion/model";

const evidence: Evidence = {
  id: "fixture",
  url: "fixture:original",
  status: "eligible",
  publisher: "Test",
  work: "Original test",
  license: "original-fixture",
  attribution: "Test",
  references: ["fixture:original"],
  reviewedBy: "reviewer",
};
const registry = new Map([[evidence.id, evidence]]);
function input() {
  const db = openDatabase(":memory:");
  try {
    return buildApprovedExport(new IngestionStore(db));
  } finally {
    db.close();
  }
}
function decision(scope: string, record: object): ReleaseDecision {
  return {
    scope,
    id: (record as { id: string }).id,
    payloadHash: hash(JSON.stringify(record)),
    reviewedBy: "admin",
    reviewReference: "fixture-review",
    origin: "scrape",
    fields: Object.fromEntries(Object.keys(record).map((k) => [k, "fixture"])),
  };
}
const spell = {
  id: "stable-spell",
  name: "Original test spell",
  pack: "d20pfsrd-approved-spells",
  classes: [{ className: "wizard", level: 0 }],
  description: "Original test prose",
};

describe("reviewed full runtime release", () => {
  it("blocks classes affected by unresolved runtime progression rules", () => {
    const data = input();
    const cleric = {
      id: "fixture-cleric",
      name: "Cleric",
      pack: "d20pfsrd-approved-spells",
      hitDie: 8,
      skillRanksPerLevel: 2,
      classSkills: [],
      bab: "medium" as const,
      saves: {
        fort: "good" as const,
        ref: "poor" as const,
        will: "good" as const,
      },
      spellcasting: { type: "prepared" as const, ability: "wis" as const },
    };
    Object.assign(data.rulesDataSet.packs[0]!, { classes: [cleric] });
    expect(() =>
      buildRuntimeRelease(
        data,
        [decision("pack:d20pfsrd-approved-spells:classes", cleric)],
        registry,
        "transition",
      ),
    ).toThrow("R17 verified class progression policy");
  });
  it("keeps approved IDs and removes every unreviewed copy without retaining content in audit", () => {
    const data = input();
    data.normalized.spells = [spell];
    data.rulesDataSet.packs[0]!.spells = [spell];
    data.normalized.mundaneEquipment = [
      {
        id: "unknown-item",
        pack: "unknown",
        engineCompatible: false,
        name: "UNREVIEWED PROSE",
        description: "UNREVIEWED PROSE",
      },
    ];
    data.notes = ["UNREVIEWED PROSE"];
    const release = buildRuntimeRelease(
      data,
      [
        decision("normalized:spells", spell),
        decision("pack:d20pfsrd-approved-spells:spells", spell),
      ],
      registry,
      "transition",
    );
    expect(release.normalized.spells[0]!.id).toBe("stable-spell");
    expect(release.catalogueManifest.unavailable).toEqual([
      {
        scope: "normalized:mundaneEquipment",
        id: "unknown-item",
        reason: "unknown",
      },
    ]);
    expect(JSON.stringify(release)).not.toContain("UNREVIEWED PROSE");
    expect(verifyRuntimeRelease(release)).toBe(
      release.catalogueManifest.contentHash,
    );
    release.normalized.spells[0]!.description = "Changed after approval";
    expect(() => verifyRuntimeRelease(release)).toThrow("changed");
  });
  it("quarantines incomplete field evidence and stale payload decisions", () => {
    const data = input();
    data.normalized.spells = [spell];
    const d = decision("normalized:spells", spell);
    delete d.fields.description;
    expect(
      buildRuntimeRelease(data, [d], registry, "transition").normalized.spells,
    ).toHaveLength(0);
    d.fields.description = "fixture";
    d.payloadHash = "stale";
    expect(
      buildRuntimeRelease(data, [d], registry, "transition").catalogueManifest
        .unavailable[0]!.reason,
    ).toBe("review-stale");
  });
  it("removes mixed excluded contributions rather than retaining an approved outer record", () => {
    const data = input();
    data.normalized.spells = [spell];
    const d = decision("normalized:spells", spell);
    d.fields.description = "excluded";
    const mixed = new Map(registry);
    mixed.set("excluded", {
      ...evidence,
      id: "excluded",
      field: "description",
      status: "excluded",
    });
    const release = buildRuntimeRelease(data, [d], mixed, "transition");
    expect(release.normalized.spells).toHaveLength(0);
    expect(release.catalogueManifest.unavailable[0]!.reason).toBe("excluded");
    expect(JSON.stringify(release)).not.toContain("Original test prose");
  });
  it("blocks approved distinct variants that the existing name lookup would collapse", () => {
    const data = input();
    const variant = { ...spell, id: "distinct-variant" };
    data.rulesDataSet.packs[0]!.spells = [spell, variant];
    expect(() =>
      buildRuntimeRelease(
        data,
        [spell, variant].map((s) =>
          decision("pack:d20pfsrd-approved-spells:spells", s),
        ),
        registry,
        "transition",
      ),
    ).toThrow("Ambiguous runtime lookup");
  });
  it("blocks conflicts between approved normalized and pack copies", () => {
    const data = input();
    const changed = { ...spell, description: "Different supported version" };
    data.normalized.spells = [spell];
    data.rulesDataSet.packs[0]!.spells = [changed];
    expect(() =>
      buildRuntimeRelease(
        data,
        [
          decision("normalized:spells", spell),
          decision("pack:d20pfsrd-approved-spells:spells", changed),
        ],
        registry,
        "transition",
      ),
    ).toThrow("Conflicting retained copies");
  });
});
