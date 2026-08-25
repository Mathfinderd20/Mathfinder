import { describe, expect, it } from "vitest";
import type {
  CharacterBuild,
  WeaponAttackHistory,
} from "@mathfinder/rules-engine";
import { restoreAttackHistoryAmmo } from "./useCombatEquipmentRuntime";

const history: WeaponAttackHistory = {
  "rifle#1": [
    {
      id: "attack-1",
      at: "2026-01-01T00:00:00Z",
      kind: "attack",
      ammoEntries: [
        { ammoType: "bullet", amount: 2 },
        { ammoType: "powder charge", amount: 1 },
      ],
    },
  ],
};

describe("restoreAttackHistoryAmmo", () => {
  it("restores physical ammo stacks represented by cleared attacks", () => {
    const equipment: CharacterBuild["equipment"] = [
      {
        name: "Bullets",
        ammoType: "bullet",
        quantity: 8,
        ownership: "owned",
      },
    ];
    const restored = restoreAttackHistoryAmmo(
      equipment,
      history,
      { bullet: 2, "powder charge": 1 },
      "rifle#1",
    );
    expect(restored.find((item) => item.ammoType === "bullet")?.quantity).toBe(
      10,
    );
    expect(
      restored.find((item) => item.ammoType === "powder charge")?.quantity,
    ).toBe(1);
  });

  it("does not restore more ammo than remains in the runtime ledger", () => {
    const restored = restoreAttackHistoryAmmo([], history, { bullet: 1 });
    expect(restored.find((item) => item.ammoType === "bullet")?.quantity).toBe(
      1,
    );
    expect(
      restored.find((item) => item.ammoType === "powder charge"),
    ).toBeUndefined();
  });
});
