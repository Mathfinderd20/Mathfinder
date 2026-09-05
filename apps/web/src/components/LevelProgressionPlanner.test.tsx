import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import { RUNTIME_CLASS_FEATURES } from "../content";
import { LevelProgressionPlanner } from "./LevelProgressionPlanner";

const EMPTY_SUGGESTIONS = {
  guideChoices: [],
  classChoices: [],
  featChoices: [],
  featChoicesBySlot: [],
  favoredClassChoices: [],
  abilityChoices: [],
  notes: [],
};

describe("LevelProgressionPlanner class abilities", () => {
  it("shows a compact Gun Training grant at its Guns Everywhere level", () => {
    const previous = RUNTIME_CLASS_FEATURES.infantryman;
    RUNTIME_CLASS_FEATURES.infantryman = [
      {
        id: "gunsmith-l1",
        name: "Gunsmith",
        className: "Infantryman",
        level: 1,
        pack: "test",
        description: "Gain Gunsmithing.",
        effects: [],
      },
      {
        id: "gun-training-l5",
        name: "Gun Training",
        className: "Infantryman",
        level: 5,
        pack: "test",
        description: "Choose a firearm.",
        effects: [],
      },
    ];
    const build: CharacterBuild = {
      name: "Planner",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 10,
        dex: 16,
        con: 12,
        int: 10,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Infantryman", hitPointRoll: 10 }],
      campaignRules: { firearmRules: "guns-everywhere" },
    };
    try {
      const html = renderToStaticMarkup(
        <LevelProgressionPlanner
          build={build}
          currentLevel={1}
          abilityOrder={["str", "dex", "con", "int", "wis", "cha"]}
          classOptions={[{ name: "Infantryman", hitDie: 10 }]}
          plannerSuggestions={[EMPTY_SUGGESTIONS]}
          onEnsureLevelCount={() => undefined}
          onSetCurrentLevel={() => undefined}
          onUpdateLevelField={() => undefined}
          onSetLevelFeat={() => undefined}
          onApplyPlannerSuggestions={() => undefined}
          onRequestPlannerSuggestions={() => undefined}
          onClearPlannedLevelChoices={() => undefined}
          onUpdateInfantrymanGunTraining={() => undefined}
        />,
      );

      expect(html).toContain("Class Abilities");
      expect(html).toContain("Gun Training");
      expect(html).toContain('aria-expanded="false"');
      expect(html).not.toContain("Gain Gunsmithing");
    } finally {
      if (previous) RUNTIME_CLASS_FEATURES.infantryman = previous;
      else delete RUNTIME_CLASS_FEATURES.infantryman;
    }
  });
});
