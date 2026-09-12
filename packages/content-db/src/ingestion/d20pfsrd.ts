import { load } from "cheerio";
import {
  PARSER_VERSION,
  SCHEMA_VERSION,
  type ParsedPage,
  type SpellPayload,
  type Warning,
} from "./model";
import { normalizeSpellFields, validateSpell } from "./normalize";

export const SOURCE = "d20pfsrd-pf1-spells";
export const DETAIL_PATHS = [
  /^\/magic\/all-spells\/[a-z]\/[a-z0-9-]+\/$/,
  /^\/magic\/3rd-party-spells\/dreamscarred-press\/[a-z0-9-]+\/$/,
  /^\/magic\/3rd-party-spells\/rite-publishing-3rd-party-spells\/[a-z]\/[a-z0-9-]+\/$/,
];
export const DIRECTORY_PATHS = [
  /^\/magic\/all-spells\/(?:[a-z]\/|page\/[1-9]\d*\/)?$/,
  /^\/magic\/3rd-party-spells\/dreamscarred-press\/(?:page\/[1-9]\d*\/)?$/,
  /^\/magic\/3rd-party-spells\/rite-publishing-3rd-party-spells\/(?:[a-z]\/|page\/[1-9]\d*\/)?$/,
];
export function canonicalUrl(
  input: string,
  base = "https://www.d20pfsrd.com/",
): string {
  const url = new URL(input, base);
  if (
    url.protocol !== "https:" ||
    !["www.d20pfsrd.com", "d20pfsrd.com"].includes(url.hostname) ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new Error("Unsupported source URL");
  if (/%(?:2f|5c|2e)/i.test(url.pathname) || url.pathname.includes("\\"))
    throw new Error("Ambiguous URL path");
  url.hostname = "www.d20pfsrd.com";
  url.hash = "";
  // Query components are retained. The adapter only accepts known pagination queries.
  for (const key of url.searchParams.keys())
    if (key !== "paged") throw new Error("Unsupported query parameter");
  if (url.search && !/^[1-9]\d*$/.test(url.searchParams.get("paged") ?? ""))
    throw new Error("Invalid pagination");
  return url.toString();
}
export function pageKind(input: string): "detail" | "directory" {
  const url = new URL(canonicalUrl(input));
  if (DETAIL_PATHS.some((pattern) => pattern.test(url.pathname)) && !url.search)
    return "detail";
  if (DIRECTORY_PATHS.some((pattern) => pattern.test(url.pathname)))
    return "directory";
  throw new Error("Unsupported spell page layout or scope");
}
const labels: Record<string, string> = {
  school: "school",
  level: "levelText",
  "casting time": "castingTime",
  component: "components",
  components: "components",
  range: "range",
  target: "target",
  targets: "target",
  effect: "effect",
  area: "area",
  duration: "duration",
  "saving throw": "savingThrow",
  "spell resistance": "spellResistance",
  source: "source",
  bloodline: "exceptionalText",
  domain: "exceptionalText",
  patron: "exceptionalText",
  mystery: "exceptionalText",
};
const clean = (s: string) =>
  s
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Deliberately limited to d20PFSRD .article-content / .entry-content spell statblocks. */
export function parseD20Spell(html: string, inputUrl: string): ParsedPage {
  const sourceUrl = canonicalUrl(inputUrl);
  if (pageKind(sourceUrl) !== "detail") throw new Error("Detail page required");
  const $ = load(html);
  const container = $(".article-content").first().length
    ? $(".article-content").first()
    : $(".entry-content").first();
  if (!container.length)
    throw new Error("Unsupported layout: no article content");
  container
    .find(
      "script,style,iframe,form,nav,aside,img,svg,video,audio,.sharedaddy,.comments-area,#comments,.adsbygoogle,.advertisement,.widget,.breadcrumbs,.product-right,.shopify-buybutton",
    )
    .remove();
  const warnings: Warning[] = [];
  const title = clean(
    container.find("h1").first().text() ||
      $("h1.entry-title,h1.page-title").first().text(),
  );
  if (/\b3\.5\s*e?\b|\b(?:pathfinder\s*2|pf2|5e)\b/i.test(title))
    warnings.push({
      field: "identity",
      code: "unsupported-system-edition",
      severity: "error",
    });
  const raw = `<article class="article-content"><h1>${$("<span>").text(title).html()}</h1>${container.html() ?? ""}</article>`;
  const fields: Record<string, string> = {};
  let descriptionHtml = "";
  let descriptionStarted = false;
  let copyrightStarted = false;
  const notices: string[] = [];
  // Flatten only layout wrappers, retaining paragraph/list/table structure.
  container.find("div").each((_, el) => {
    if (
      !$(el)
        .attr("class")
        ?.match(/copyright|section.?15/i)
    )
      $(el).replaceWith($(el).contents());
  });
  for (const node of container.contents().toArray()) {
    const element = $(node);
    const text = clean(element.text());
    if (
      descriptionStarted &&
      element.is("h1,h2,h3,h4") &&
      /mythic|greater|lesser|faq|errata/i.test(text)
    ) {
      warnings.push({
        field: "description",
        code: "additional-variant-or-correction-section",
        severity: "error",
      });
      break;
    }
    if (/section\s*15|copyright notice/i.test(text)) copyrightStarted = true;
    if (copyrightStarted) {
      if (text) notices.push(text);
      continue;
    }
    if (/^(discuss!?|related spells|latest pathfinder)/i.test(text)) break;
    if (/^description$/i.test(text)) {
      descriptionStarted = true;
      continue;
    }
    if (descriptionStarted) {
      descriptionHtml += $.html(node);
      continue;
    }
    if (element.is("h1") || !text || /^(casting|effect)$/i.test(text)) continue;
    const inner = load(`<div>${$.html(node)}</div>`);
    const root = inner("div").first();
    // Labels must be explicitly marked. Unrecognized labels are preserved as exception text.
    root.find("b,strong").each((_, label) => {
      const name = clean(inner(label).text()).replace(/:$/, "").toLowerCase();
      if (labels[name])
        inner(label).replaceWith(
          `\n@@${labels[name]}@@${labels[name] === "exceptionalText" ? `${name}: ` : ""}`,
        );
    });
    root.find("br").replaceWith("\n");
    const body = root
      .text()
      .replace(
        /;\s*(Subdomain|Domain(?:\s*\[subdomain\])?|Elemental School)\b/gi,
        "\n@@exceptionalText@@$1 ",
      );
    const matches = [...body.matchAll(/@@(\w+)@@([\s\S]*?)(?=@@\w+@@|$)/g)];
    if (!matches.length) {
      if (!/^\s*$/.test(body))
        fields.exceptionalText = [fields.exceptionalText, clean(body)]
          .filter(Boolean)
          .join("\n");
      continue;
    }
    for (const m of matches) {
      const key = m[1]!;
      const value = clean(m[2]!)
        .replace(/^:\s*/, "")
        .replace(/[;\s]+$/, "");
      if (fields[key] && key !== "exceptionalText")
        warnings.push({
          field: key,
          code: "repeated-label",
          severity: "error",
        });
      fields[key] = [fields[key], value].filter(Boolean).join("\n");
    }
  }
  const desc = load(`<div>${descriptionHtml}</div>`);
  desc("*").each((_, el) => {
    const tag = "tagName" in el ? el.tagName : "";
    if (
      ![
        "html",
        "head",
        "body",
        "div",
        "p",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "ul",
        "ol",
        "li",
        "table",
        "thead",
        "tbody",
        "tr",
        "td",
        "th",
        "sup",
        "sub",
        "blockquote",
        "h2",
        "h3",
        "h4",
      ].includes(tag)
    )
      desc(el).replaceWith(desc(el).contents());
    else if ("attribs" in el)
      for (const attribute of Object.keys(el.attribs))
        if (!(
          ["td", "th"].includes(tag) &&
          ["colspan", "rowspan"].includes(attribute) &&
          /^(?:0|[1-9]\d{0,2}|1000)$/.test(el.attribs[attribute] ?? "") &&
          (attribute === "rowspan" || el.attribs[attribute] !== "0")
        ))
          desc(el).removeAttr(attribute);
  });
  const safeDescriptionHtml = desc("div").first().html() ?? "";
  desc("br").replaceWith("\n");
  const description = desc("div")
    .first()
    .contents()
    .toArray()
    .map((n) => clean(desc(n).text()))
    .filter(Boolean)
    .join("\n\n");
  const normalized = normalizeSpellFields(fields);
  warnings.push(...normalized.warnings);
  const payload: SpellPayload = {
    ...fields,
    name: title,
    classes: normalized.classes,
    description,
    sourceUrl,
    identity: {
      system: "pathfinder",
      edition: "1e",
      kind: "spell",
      name: title,
    },
    subschool: normalized.subschool,
    descriptors: normalized.descriptors,
    targetEffectArea:
      [
        fields.target && `Target: ${fields.target}`,
        fields.effect && `Effect: ${fields.effect}`,
        fields.area && `Area: ${fields.area}`,
      ]
        .filter(Boolean)
        .join("; ") || undefined,
    descriptionHtml: safeDescriptionHtml,
    copyrightNotice: notices.join("\n") || undefined,
  };
  warnings.push(...validateSpell(payload));
  if (!descriptionStarted)
    warnings.push({
      field: "description",
      code: "missing-description-heading",
      severity: "error",
    });
  return {
    extracted: { ...fields, name: title, descriptionHtml },
    payload,
    raw,
    warnings,
    parser: SOURCE,
    parserVersion: PARSER_VERSION,
    schemaVersion: SCHEMA_VERSION,
  };
}

export function discoverLinks(
  html: string,
  inputUrl: string,
): { entries: string[]; pagination: string[] } {
  const base = canonicalUrl(inputUrl);
  const $ = load(html);
  const root = $(".article-content,.entry-content").first();
  if (!root.length) throw new Error("Unsupported directory layout");
  root.find("nav,aside,.comments-area,.widget,.advertisement").remove();
  const entries = new Set<string>();
  const pagination = new Set<string>();
  root.find("a[href]").each((_, a) => {
    try {
      const url = canonicalUrl($(a).attr("href")!, base);
      const kind = pageKind(url);
      if (kind === "detail" && $(a).closest("table,ul,ol").length)
        entries.add(url);
      if (
        kind === "directory" &&
        ($(a).attr("rel")?.split(/\s+/).includes("next") ||
          $(a).closest(".pagination,.nav-links").length)
      )
        pagination.add(url);
    } catch {
      /* Unrelated navigation is outside this adapter's scope. */
    }
  });
  return { entries: [...entries], pagination: [...pagination] };
}
