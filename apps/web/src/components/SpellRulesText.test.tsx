import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { SpellRulesText } from "./SpellRulesText";

describe("spell source formatting", () => {
  it("preserves lists, tables, emphasis, line breaks and exceptional text without active source content", () => {
    const html = renderToStaticMarkup(
      <SpellRulesText
        spell={{
          id: "fixture",
          name: "Test",
          pack: "fixture",
          classes: [],
          description: "Plain source",
          descriptionHtml:
            '<p onclick="bad()">First &amp; <em>second</em><br>third</p><ul><li>Exception</li></ul><table><tr><td colspan="2">Cell</td></tr></table><img src="https://example.invalid"><script>BAD_SCRIPT</script><a href="javascript:bad()">Reference</a>',
          exceptionalText: "Additional source condition",
          copyrightNotice: "Original test attribution",
        }}
      />,
    );
    expect(html).toContain("<em>second</em><br/>");
    expect(html).toContain('<td colSpan="2">Cell</td>');
    expect(html).toContain("Additional source condition");
    expect(html).toContain("Original test attribution");
    for (const forbidden of [
      "onclick",
      "BAD_SCRIPT",
      "javascript:",
      "<img",
      "<script",
      "href=",
    ])
      expect(html).not.toContain(forbidden);
  });
  it("shows a content-free unavailable record even if an old payload still contains text", () => {
    const html = renderToStaticMarkup(
      <SpellRulesText
        spell={{
          id: "stable",
          name: "Legacy",
          pack: "fixture",
          classes: [],
          description: "EXCLUDED_TEXT",
          descriptionHtml: "<p>EXCLUDED_TEXT</p>",
          unavailable: true,
        }}
      />,
    );
    expect(html).toContain("unavailable pending review");
    expect(html).not.toContain("EXCLUDED_TEXT");
  });
});
