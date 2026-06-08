import { describe, expect, it } from "vitest";
import { computeSheet } from "../src/compute";
import type { CharacterInput } from "../src/types";

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
      { name: "Greataxe", category: "melee", damageDice: "1d12", handedness: "two", critMultiplier: 3 },
      { name: "Longbow", category: "ranged", damageDice: "1d8", critMultiplier: 3 },
      { name: "Longsword", category: "melee", damageDice: "1d8", handedness: "one", critRange: 19 },
    ],
    ...extra,
  };
}

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
});

describe("Power Attack damage flows into weapons", () => {
  it("adds the +damage side to melee weapons", () => {
    const sheet = computeSheet(
      input({
        modifiers: [
          { target: "attack.melee", type: "untyped", value: -1, source: "Power Attack" },
          { target: "damage.melee", type: "untyped", value: 2, source: "Power Attack" },
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
