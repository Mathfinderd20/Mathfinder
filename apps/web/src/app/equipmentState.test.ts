import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import {
  applyTemplateEquipmentState,
  sanitizeEquippedEquipment,
  withAmmoAutofill,
} from "./equipmentState";

type Equipment = NonNullable<CharacterBuild["equipment"]>;

function item(name: string, patch: Partial<Equipment[number]> = {}) {
  return { name, ...patch } as Equipment[number];
}

describe("equipment state normalization", () => {
  it("keeps the priority item equipped when a slot exceeds its limit", () => {
    const equipment: Equipment = [
      item("Old belt", { name: "Old belt", slot: "belt", equipped: true }),
      item("New belt", { name: "New belt", slot: "belt", equipped: true }),
    ];
    const normalized = sanitizeEquippedEquipment(equipment, 1);
    expect(normalized[0]?.equipped).toBe(false);
    expect(normalized[1]?.equipped).toBe(true);
  });

  it("allows two rings but not a third", () => {
    const equipment: Equipment = ["One", "Two", "Three"].map((name) =>
      item(name, { name, slot: "ring", equipped: true }),
    );
    expect(
      sanitizeEquippedEquipment(equipment).map((entry) => entry.equipped),
    ).toEqual([true, true, false]);
  });

  it("applies template defaults only to generic placeholder rows", () => {
    const template = item("Chain shirt", {
      name: "Chain shirt",
      slot: "armor",
    });
    expect(applyTemplateEquipmentState(item("Custom"), template)).toMatchObject(
      {
        equipped: true,
        carryState: "carried",
      },
    );
    expect(
      applyTemplateEquipmentState(
        item("Existing", { name: "Existing", equipped: false, slot: "body" }),
        template,
      ).equipped,
    ).toBeUndefined();
  });

  it("adds missing ammo once using normalized ammo names", () => {
    const build = {
      name: "Archer",
      race: { name: "Human", size: "medium" as const },
      baseAbilityScores: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Fighter", hitPointRoll: 10 }],
    };
    const once = withAmmoAutofill(build, "Arrows");
    const twice = withAmmoAutofill(once, "arrow");
    expect(once.equipment).toHaveLength(1);
    expect(twice.equipment).toHaveLength(1);
  });
});
