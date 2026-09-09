import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Tooltip, TooltipTriggerContext } from "./Tooltip";

describe("Tooltip", () => {
  it("makes click-triggered math keyboard-accessible and initially closed", () => {
    const markup = renderToStaticMarkup(
      <TooltipTriggerContext.Provider value="click">
        <Tooltip content="Strength +2">
          <span>14</span>
        </Tooltip>
      </TooltipTriggerContext.Provider>,
    );
    expect(markup).toContain('role="button"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("mf-tooltip-panel");
  });
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
