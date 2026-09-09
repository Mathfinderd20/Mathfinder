import { describe, expect, it } from "vitest";
import { CharacterUiStore } from "./CharacterUiSession";

describe("account-scoped character UI session", () => {
  it("restores health and attack UI after the data subtree is remounted", () => {
    const session = new CharacterUiStore();
    session.write("hero", "health-manager-open", true);
    session.write("hero", "weapon-attack-dialog", "sword");
    session.write("hero", "weapon-attack-rolls", { sword: "17" });
    expect(session.read("hero", "health-manager-open", false)).toBe(true);
    expect(session.read("hero", "weapon-attack-dialog", null)).toBe("sword");
    expect(session.read("hero", "weapon-attack-rolls", {})).toEqual({
      sword: "17",
    });
    session.write("hero", "health-manager-open", false);
    expect(session.read("hero", "health-manager-open", true)).toBe(false);
    expect(session.read("other-hero", "health-manager-open", false)).toBe(
      false,
    );
    expect(
      new CharacterUiStore().read("hero", "weapon-attack-dialog", null),
    ).toBeNull();
  });
});
