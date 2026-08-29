import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("keeps its trigger available when rendered without a browser portal", () => {
    const markup = renderToStaticMarkup(
      <Tooltip content="Useful details">
        <button type="button">Inspect</button>
      </Tooltip>,
    );
    expect(markup).toContain("Inspect");
    expect(markup).not.toContain("mf-tooltip-panel");
  });
});
