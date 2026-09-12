import { createElement, type ReactNode } from "react";
import type { SpellDefinition } from "@mathfinder/rules-engine";
import "./spell-rules-text.css";

const tags = new Set([
  "p",
  "br",
  "em",
  "strong",
  "b",
  "i",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "blockquote",
  "sup",
  "sub",
  "h2",
  "h3",
  "h4",
]);
const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
};
function decode(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, key: string) => {
    if (key.startsWith("#")) {
      const n =
        key[1]?.toLowerCase() === "x"
          ? parseInt(key.slice(2), 16)
          : Number(key.slice(1));
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)
        ? String.fromCodePoint(n)
        : whole;
    }
    return entities[key] ?? whole;
  });
}
/** Limited formatting renderer: constructs React nodes, never executes or inserts source HTML. */
export function formattedSpellText(html: string, fallback: string): ReactNode {
  const stack: Array<{
    tag: string;
    children: ReactNode[];
    spans?: { colSpan?: number; rowSpan?: number };
  }> = [{ tag: "root", children: [] }];
  const tokens = html.match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+|</g) ?? [];
  if (tokens.length > 20000) return fallback;
  let blocked: string | undefined;
  let key = 0;
  const finish = () => {
    const frame = stack.pop()!;
    stack[stack.length - 1]!.children.push(
      createElement(
        frame.tag,
        { key: key++, ...frame.spans },
        ...frame.children,
      ),
    );
  };
  for (const token of tokens) {
    const match = token.match(/^<(\/?)\s*([a-z][\w-]*)\b[^>]*>$/i);
    if (match) {
      const tag = match[2]!.toLowerCase();
      if (blocked) {
        if (match[1] && tag === blocked) blocked = undefined;
        continue;
      }
      if (
        [
          "script",
          "style",
          "iframe",
          "object",
          "svg",
          "math",
          "template",
        ].includes(tag)
      ) {
        if (!match[1]) blocked = tag;
        continue;
      }
      if (!tags.has(tag)) continue;
      if (match[1]) {
        const index = stack.map((f) => f.tag).lastIndexOf(tag);
        if (index > 0) while (stack.length > index) finish();
      } else if (tag === "br")
        stack[stack.length - 1]!.children.push(
          createElement("br", { key: key++ }),
        );
      else {
        if (stack.length >= 40) return fallback;
        const spans: { colSpan?: number; rowSpan?: number } = {};
        if (tag === "td" || tag === "th")
          for (const attribute of token.matchAll(
            /\b(colspan|rowspan)\s*=\s*["']?(\d+)/gi,
          )) {
            const n = Number(attribute[2]);
            const row = attribute[1]!.toLowerCase() === "rowspan";
            if (n <= 1000 && (n > 0 || row))
              spans[row ? "rowSpan" : "colSpan"] = n;
          }
        stack.push({ tag, children: [], spans });
      }
    } else if (!blocked && !token.startsWith("<!--"))
      stack[stack.length - 1]!.children.push(decode(token));
  }
  while (stack.length > 1) finish();
  return stack[0]!.children;
}
export function SpellRulesText({
  spell,
  fallback = "",
}: {
  spell?: SpellDefinition;
  fallback?: string;
}) {
  if (spell?.unavailable)
    return (
      <p role="status">This catalogue record is unavailable pending review.</p>
    );
  const text = spell?.description ?? fallback;
  return (
    <div className="spell-rule-prose">
      {spell?.descriptionHtml ? (
        formattedSpellText(spell.descriptionHtml, text)
      ) : (
        <p>{text}</p>
      )}
      {spell?.exceptionalText && (
        <section>
          <h4>Additional rules</h4>
          <p>{spell.exceptionalText}</p>
        </section>
      )}
      {spell?.copyrightNotice && (
        <details>
          <summary>Source attribution</summary>
          <p>{spell.copyrightNotice}</p>
        </details>
      )}
    </div>
  );
}
