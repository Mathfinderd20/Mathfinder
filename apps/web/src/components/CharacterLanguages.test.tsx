import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import { LanguageFields } from "./CharacterLanguages";

const build = {
  name: "Polyglot",
  race: { name: "Human", size: "medium" },
  baseAbilityScores: {
    str: 10,
    dex: 10,
    con: 10,
    int: 14,
    wis: 10,
    cha: 10,
  },
  levels: [{ className: "Fighter", hitPointRoll: 10, skillRanks: {} }],
} as CharacterBuild;

describe("LanguageFields", () => {
  it("uses canonical select choices instead of free-form text", () => {
    const markup = renderToStaticMarkup(
      <LanguageFields build={build} value={{}} onChange={() => undefined} />,
    );

    expect(markup).toContain('aria-label="Starting languages choice 1"');
    expect(markup).toContain('aria-label="Starting languages choice 2"');
    expect(markup).toContain(">Draconic</option>");
    expect(markup.match(/>Druidic<\/option>/g)).toHaveLength(1);
    expect(markup).not.toContain("<textarea");
  });

  it("keeps a non-canonical saved value visible for removal", () => {
    const markup = renderToStaticMarkup(
      <LanguageFields
        build={build}
        value={{ additional: ["Campaign Cant"] }}
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain("Campaign Cant (legacy value)");
  });
});
