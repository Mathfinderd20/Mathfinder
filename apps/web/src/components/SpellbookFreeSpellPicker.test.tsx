import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SpellSeedGroup } from "../spellSeedPlans";
import { SpellbookFreeSpellPicker } from "./SpellbookFreeSpellPicker";

const groups: SpellSeedGroup[] = [
  {
    classKey: "wizard",
    className: "Wizard",
    mode: "prepared",
    level: 1,
    capacity: 2,
    suggestions: [
      { spellName: "Magic Missile", reason: "Reliable", score: 90 },
      { spellName: "Shield", reason: "Defensive", score: 80 },
    ],
  },
];

describe("SpellbookFreeSpellPicker", () => {
  it("renders two required, grouped spell choices", () => {
    const markup = renderToStaticMarkup(
      <SpellbookFreeSpellPicker
        groups={groups}
        selections={{}}
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Free spellbook spell 1"');
    expect(markup).toContain('aria-label="Free spellbook spell 2"');
    expect(markup).toContain('label="Spell level 1"');
    expect(markup).toContain("Magic Missile");
    expect(markup).toContain("Choose 2 more free spellbook spells.");
  });
});
