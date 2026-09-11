import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_CLASSES, type CharacterBuild } from "@mathfinder/rules-engine";
import { RUNTIME_CLASSES } from "../content";
import { EMPTY_PLANNER_SUGGESTIONS } from "../app/useBuildAnalysis";
import { LevelUpModal } from "./LevelUpModal";
import { CharacterGuide } from "./CharacterGuide";

const originalClasses = { ...RUNTIME_CLASSES };
afterEach(() => {
  for (const key of Object.keys(RUNTIME_CLASSES)) delete RUNTIME_CLASSES[key];
  Object.assign(RUNTIME_CLASSES, originalClasses);
});
describe("character guides", () => {
  it("reads class options after content loads, including classes added after module initialization", () => {
    Object.assign(RUNTIME_CLASSES, SAMPLE_CLASSES, {
      newclass: { ...SAMPLE_CLASSES.fighter!, name: "Newly loaded class" },
    });
    const build: CharacterBuild = {
      name: "Guide test",
      race: { name: "Human", size: "medium" },
      baseAbilityScores: {
        str: 14,
        dex: 14,
        con: 12,
        int: 10,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Fighter", hitPointRoll: 10 }],
    };
    const html = renderToStaticMarkup(
      <LevelUpModal
        build={build}
        plannerSuggestions={EMPTY_PLANNER_SUGGESTIONS}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain("Newly loaded class");
    expect(html).toContain('aria-label="Level-up guide steps"');
    expect(html).toContain("Continue to Hit points");
    expect(html).not.toContain('type="number"'); // HP choices belong to their next stage.
  });
  it("blocks review confirmation and links incomplete choices to their stage", () => {
    const html = renderToStaticMarkup(
      <CharacterGuide
        kind="creation"
        title="Creation Guide"
        subtitle=""
        steps={[
          {
            id: "skills",
            label: "Skills",
            title: "Skills",
            description: "",
            errors: ["Assign remaining ranks."],
          },
          { id: "review", label: "Review", title: "Review", description: "" },
        ]}
        step={1}
        onStep={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        confirmLabel="Create Character"
        summary={null}
      >
        {null}
      </CharacterGuide>,
    );
    expect(html).toContain("Skills: Assign remaining ranks.");
    expect(html).toContain('class="guide-primary" disabled=""');
    expect(html).toContain('aria-current="step"');
  });
});
