import { describe, expect, it } from "vitest";
import { computeSheet } from "../src/compute";
import { explainStat, renderSheet } from "../src/format";
import { savageBerserkerL1 } from "./fixtures/savage-berserker-l1";

describe("renderSheet", () => {
  const sheet = computeSheet(savageBerserkerL1);

  it("renders the headline numbers", () => {
    const out = renderSheet(sheet);
    expect(out).toContain("Brakka, Savage Company Berserker");
    expect(out).toContain("HP 17");
    expect(out).toContain("Speed 20 ft");
    expect(out).toContain("AC 20");
    expect(out).toContain("Touch 13");
    expect(out).toContain("Flat-Footed 17");
  });

  it("lists ranked and class skills", () => {
    const out = renderSheet(sheet);
    expect(out).toContain("Climb");
    expect(out).toContain("Perception");
  });
});

describe("explainStat", () => {
  const sheet = computeSheet(savageBerserkerL1);

  it("produces a readable breakdown string", () => {
    // e.g. "+10 base +5 Scale mail +2 Heavy steel shield +2 Dexterity +1 Dodge = 20"
    const out = explainStat(sheet.ac.normal);
    expect(out).toContain("= 20");
    expect(out).toContain("Scale mail");
    expect(out).toContain("Dodge");
  });
});
