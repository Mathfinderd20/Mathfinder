import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../src/db";
import {
  canonicalUrl,
  pageKind,
  discoverLinks,
  parseD20Spell,
} from "../src/ingestion/d20pfsrd";
import { publicIpv4, robotsPolicy } from "../src/ingestion/fetch";
import {
  eligibility,
  PARSER_VERSION,
  hash,
  identityKey,
  mergeFields,
  missing,
  needsReprocessing,
  type CanonicalState,
  type Contribution,
  type Evidence,
  type Identity,
} from "../src/ingestion/model";
import { IngestionStore } from "../src/ingestion/store";
import { IngestionWorker } from "../src/ingestion/worker";
import { cleanupImpact, purgeEvidence } from "../src/ingestion/cleanup";
import { buildApprovedExport } from "../src/ingestion/export";
import { authorize, validateServerConfig } from "../src/ingestion/auth";

const fixture = readFileSync(
  new URL("./fixtures/d20-spell.html", import.meta.url),
  "utf8",
);
const url = "https://www.d20pfsrd.com/magic/all-spells/f/fixture-ward/";
const identity: Identity = {
  system: "pathfinder",
  edition: "1e",
  kind: "spell",
  name: "Fixture Ward",
  publication: "Test Work",
  variant: "base",
};
const evidence: Evidence = {
  id: "test-evidence",
  status: "eligible",
  publisher: "Test Publisher",
  work: "Test Work",
  license: "original-fixture",
  attribution: "Original test data",
  references: ["fixture:d20-spell"],
  url,
  reviewedBy: "test-reviewer",
};
const registry = new Map([[evidence.id, evidence]]);
const contribution = (value: unknown): Contribution => ({
  value,
  evidenceId: evidence.id,
  authority: "baseline",
});
const current = (fields: CanonicalState["fields"] = {}): CanonicalState => ({
  id: "stable-id",
  identity,
  revision: 1,
  fields,
  baseline: {},
  protectedFields: [],
});
const stores: IngestionStore[] = [];
function store() {
  const s = new IngestionStore(openDatabase(":memory:"));
  stores.push(s);
  return s;
}
afterEach(() => {
  for (const s of stores.splice(0)) s.db.close();
});

describe("d20 spell adapter", () => {
  it("retains safe table spans and line breaks while stripping active attributes", () => {
    const result = parseD20Spell(
      fixture.replace(
        "<td>Zero</td>",
        '<td colspan="2" onclick="bad()">Zero<br>None</td>',
      ),
      url,
    );
    expect(result.payload.descriptionHtml).toContain('colspan="2"');
    expect(result.payload.descriptionHtml).toContain("<br>");
    expect(result.payload.descriptionHtml).not.toContain("onclick");
  });
  it("supports only explicitly scoped third-party spell directories and colon labels", () => {
    const third =
      "https://www.d20pfsrd.com/magic/3rd-party-spells/dreamscarred-press/house-of-hospitality/";
    expect(pageKind(third)).toBe("detail");
    expect(
      pageKind(
        "https://www.d20pfsrd.com/magic/3rd-party-spells/rite-publishing-3rd-party-spells/s/",
      ),
    ).toBe("directory");
    expect(() =>
      pageKind(
        "https://www.d20pfsrd.com/magic/3rd-party-spells/unreviewed-publisher/spell/",
      ),
    ).toThrow("scope");
    expect(
      parseD20Spell(fixture.replace("<b>School</b>", "<b>School:</b>"), third)
        .payload.school,
    ).toBe("abjuration [force]");
  });
  it("preserves distinct fields, zero levels, exceptions and safe formatting", () => {
    const p = parseD20Spell(fixture, url);
    expect(p.warnings).toEqual([]);
    expect(p.payload.classes).toContainEqual({ className: "wizard", level: 0 });
    expect(p.payload).toMatchObject({
      target: "one test subject",
      effect: "a test barrier",
      area: "one test square",
      savingThrow: "none",
      spellResistance: "no",
    });
    expect(p.payload.descriptionHtml).toContain("<table>");
    expect(p.payload.descriptionHtml).toContain("<em>synthetic</em>");
    expect(p.raw).not.toContain("stealCredentials");
    expect(p.raw).not.toContain("art.png");
    expect(p.payload.identity.publication).toBeUndefined();
  });
  it("can reparse retained article without refetching", () => {
    const first = parseD20Spell(fixture, url);
    const next = parseD20Spell(first.raw, url);
    expect(next.payload).toEqual(first.payload);
  });
  it("flags missing fields, duplicate labels and exceptional class levels", () => {
    const p = parseD20Spell(
      fixture
        .replace("sorcerer/wizard 0, cleric 1", "wizard 1 (variant)")
        .replace("<b>Range</b>", "<b>Range</b> extra; <b>Range</b>"),
      url,
    );
    expect(p.warnings.map((w) => w.code)).toContain("ambiguous-level");
    expect(p.warnings.map((w) => w.code)).toContain("repeated-label");
    expect(p.payload.levelText).toBe("wizard 1 (variant)");
  });
  it("rejects unsupported/rendered pages instead of guessing", () => {
    expect(() => parseD20Spell("<body>Access challenge</body>", url)).toThrow(
      "Unsupported layout",
    );
  });
  it("blocks explicitly different game editions", () => {
    expect(
      parseD20Spell(
        fixture.replace("Fixture Ward", "Fixture Ward [3.5E]"),
        url,
      ).warnings.some((w) => w.code === "unsupported-system-edition"),
    ).toBe(true);
  });
  it("does not combine mythic variants into a base spell", () => {
    const page = fixture.replace(
      "<p>Section 15:",
      "<h2>Mythic Fixture Ward</h2><p>Different rules.</p><p>Section 15:",
    );
    const p = parseD20Spell(page, url);
    expect(
      p.warnings.some(
        (w) =>
          w.code === "additional-variant-or-correction-section" &&
          w.severity === "error",
      ),
    ).toBe(true);
    expect(p.payload.description).not.toContain("Different rules");
  });
  it("separates domain labels from class levels and reads singular Component labels", () => {
    const p = parseD20Spell(
      fixture
        .replace("cleric 1", "cleric 1; Subdomain defense 1")
        .replace("<b>Components</b>", "<b>Component</b>:"),
      url,
    );
    expect(p.payload.components).toBe("none");
    expect(p.payload.classes).toHaveLength(3);
    expect(p.payload.exceptionalText).toContain("Subdomain");
  });
  it("limits discovery to directory list/table links and explicit pagination", () => {
    const d = discoverLinks(
      `<div class="article-content"><ul><li><a href="f/fixture-ward/#top">x</a><a href="${url}">duplicate</a></li></ul><p><a href="a/another/">description link</a></p><a rel="next" href="?paged=2">next</a><a href="http://127.0.0.1">bad</a></div>`,
      "https://www.d20pfsrd.com/magic/all-spells/",
    );
    expect(d.entries).toEqual([url]);
    expect(d.pagination).toEqual([
      "https://www.d20pfsrd.com/magic/all-spells/?paged=2",
    ]);
  });
});
describe("eligibility and field merge", () => {
  it("does not infer licensing from source metadata or prior import", () => {
    expect(eligibility(undefined)).toBe("unknown");
    expect(eligibility({ ...evidence, reviewedBy: undefined })).toBe("unknown");
  });
  it("restricts Savage Company to exact work/publisher and keeps OGL separate", () => {
    const exception: Evidence = {
      ...evidence,
      status: "approved-exception",
      exception: "savage-company",
      publisher: "SHM Publishing",
      work: "Savage Company",
      license: undefined,
    };
    expect(eligibility(exception)).toBe("approved-exception");
    expect(exception.license).toBeUndefined();
    expect(
      eligibility({ ...exception, work: "Other Savage Company-adjacent book" }),
    ).toBe("unknown");
    expect(eligibility({ ...exception, publisher: "Other" })).toBe("unknown");
  });
  it("requires full identity; different variants never merge", () => {
    expect(
      identityKey({ ...identity, publication: undefined }),
    ).toBeUndefined();
    expect(
      mergeFields(
        current(),
        { ...identity, variant: "mythic" },
        {},
        registry,
        [],
      ).outcome,
    ).toBe("quarantine");
  });
  it("keeps meaningful falsy values", () => {
    for (const v of [0, false, "none", "not applicable"])
      expect(missing(v)).toBe(false);
  });
  it("fills missing fields and routes protected fields and nonempty conflicts to review", () => {
    expect(
      mergeFields(
        current(),
        identity,
        { range: contribution("touch") },
        registry,
        [],
      ).outcome,
    ).toBe("enrichment");
    const c = current({ range: contribution("personal") });
    c.protectedFields = ["range"];
    expect(
      mergeFields(c, identity, { range: contribution("touch") }, registry, [])
        .reasons.range,
    ).toBe("protected");
    c.protectedFields = [];
    expect(
      mergeFields(c, identity, { range: contribution("touch") }, registry, [])
        .outcome,
    ).toBe("conflict");
  });
  it("preserves errata through baseline refresh and requires applicable correction evidence", () => {
    const correction: Contribution = {
      ...contribution("corrected"),
      authority: "correction",
      correction: {
        approvalId: "review-1",
        appliesToIdentity: identityKey(identity)!,
        field: "range",
        references: ["errata:page-1"],
      },
    };
    expect(
      mergeFields(
        current({ range: contribution("old") }),
        identity,
        { range: correction },
        registry,
        [],
      ).outcome,
    ).toBe("correction");
    expect(
      mergeFields(
        current({ range: correction }),
        identity,
        { range: contribution("old") },
        registry,
        [],
      ).changes,
    ).toEqual({});
    expect(
      mergeFields(
        current({ range: contribution("old") }),
        identity,
        { range: { ...correction, correction: undefined } },
        registry,
        [],
      ).outcome,
    ).toBe("conflict");
  });
  it("cannot use excluded errata or invalid incoming fields", () => {
    const excluded = new Map([
      [evidence.id, { ...evidence, status: "excluded" as const }],
    ]);
    expect(
      mergeFields(
        current(),
        identity,
        { range: contribution("bad") },
        excluded,
        [],
      ).outcome,
    ).toBe("exclusion");
    expect(
      mergeFields(
        current(),
        identity,
        { range: contribution("bad") },
        registry,
        [{ field: "range", code: "malformed", severity: "warning" }],
      ).changes,
    ).toEqual({});
  });
  it("reprocesses opaque version changes including numeric ordering traps and rollback", () => {
    const p = { hash: "same", parserVersion: "1.9.0", schemaVersion: "1.0.0" };
    expect(needsReprocessing(p, { ...p, parserVersion: "1.10.0" })).toBe(true);
    expect(needsReprocessing(p, { ...p, parserVersion: "1.8.0" })).toBe(true);
    expect(needsReprocessing(p, p)).toBe(false);
  });
});
describe("crawl boundaries", () => {
  it.each([
    "http://www.d20pfsrd.com/",
    "https://127.0.0.1/",
    "https://169.254.169.254/",
    "https://www.d20pfsrd.com.evil.test/",
    "https://user:password@www.d20pfsrd.com/",
    "https://www.d20pfsrd.com:4430/",
    "file:///tmp/a",
    "https://www.d20pfsrd.com/?url=http://localhost",
  ])("blocks %s", (input) => {
    expect(() => canonicalUrl(input)).toThrow();
  });
  it.each([
    "0.0.0.0",
    "127.0.0.1",
    "10.1.2.3",
    "100.64.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "192.0.0.1",
    "192.0.2.1",
    "192.88.99.2",
    "198.18.0.1",
    "::ffff:127.0.0.1",
    "::1",
  ])("blocks private/special IP %s", (ip) =>
    expect(publicIpv4(ip)).toBe(false),
  );
  it("allows public IPv4 outside the reserved 192.0.0/24 and documentation ranges", () => {
    expect(publicIpv4("192.0.78.24")).toBe(true);
    expect(publicIpv4("8.8.8.8")).toBe(true);
  });
  it("honors specific robots rules, longest allow path, wildcard and delay", () => {
    expect(
      robotsPolicy(
        "User-agent: *\nDisallow: /magic\nAllow: /magic/all-spells/\nCrawl-delay: 2",
        "/magic/all-spells/a/",
      ),
    ).toEqual({ allowed: true, delayMs: 2000 });
    expect(
      robotsPolicy(
        "User-agent: *\nAllow: /\nUser-agent: DireSheetsContentBot\nDisallow: /",
        "/magic",
      ).allowed,
    ).toBe(false);
    expect(
      robotsPolicy("User-agent: *\nDisallow: /*secret$", "/xsecret").allowed,
    ).toBe(false);
  });
});
describe("holding, worker, promotion and cleanup", () => {
  async function heldStore() {
    const s = store();
    s.register(evidence);
    const id = s.createJob("admin", url, "single");
    const worker = new IngestionWorker(s, async (input) => ({
      url: input,
      html: fixture,
      retrievedAt: "2026-09-11T00:00:00Z",
    }));
    await worker.tick();
    s.confirm(id);
    s.settleJobs();
    return { s, id, worker, entryId: s.entries(id)[0]!.id };
  }
  it("reprocesses promoted material into a new holding revision without refetching", async () => {
    const { s, worker, entryId } = await heldStore();
    s.reviewIdentity(entryId, "admin", "Test Work", "base");
    const id = s.promote(entryId, "admin", s.reviewHash(entryId), {
      user: "test",
      astra: "test",
      transition: "test",
    });
    const original = s.db
      .prepare("SELECT payload_json FROM content_entities WHERE entity_id=?")
      .get(id);
    const result = worker.reprocess(entryId, "admin");
    expect(result.entryId).not.toBe(entryId);
    expect(result.jobId).toBeTruthy();
    expect(s.holding(result.entryId)?.promoted_id).toBeNull();
    expect(s.holding(result.entryId)?.retrieved_at).toBe(
      s.holding(entryId)?.retrieved_at,
    );
    expect(
      s.db
        .prepare("SELECT payload_json FROM content_entities WHERE entity_id=?")
        .get(id),
    ).toEqual(original);
  });
  it("persists runtime budgets and serializes live workers with a lease", () => {
    const s = store();
    const id = s.createJob("admin", url, "single");
    expect(s.acquireWorker("a", 100)).toBe(true);
    expect(s.acquireWorker("b", 101)).toBe(false);
    expect(s.acquireWorker("b", 120101)).toBe(true);
    s.claim(100);
    s.exhaustBudgets(900101);
    expect(s.entries(id)[0]?.state).toBe("skipped");
    expect(s.job(id).limit_reason).toContain("partial");
  });
  it("retains crawl policy and refuses changed scope before making a request", async () => {
    const s = store();
    const job = s.createJob("admin", url, "single");
    expect(JSON.parse(s.job(job).policy_json!).domains).toEqual([
      "www.d20pfsrd.com",
      "d20pfsrd.com",
    ]);
    s.db
      .prepare("UPDATE catalogue_jobs SET policy_json='{}' WHERE id=?")
      .run(job);
    let requests = 0;
    await new IngestionWorker(s, async (input) => {
      requests++;
      return { url: input, html: fixture, retrievedAt: "now" };
    }).tick();
    expect(requests).toBe(0);
    expect(s.entries(job)[0]!.error_code).toBe("source-policy-changed-review");
  });
  it("upgrades early holding schemas without replacing retained source or canonical data", async () => {
    const { s, entryId } = await heldStore();
    const raw = s.holding(entryId)!.raw;
    s.db.exec("ALTER TABLE catalogue_holding DROP COLUMN extracted_json");
    const upgraded = new IngestionStore(s.db);
    expect(upgraded.holding(entryId)!.raw).toBe(raw);
    expect(upgraded.holding(entryId)!.extracted_json).toBeNull();
    new IngestionWorker(upgraded).reprocess(entryId);
    expect(
      JSON.parse(upgraded.holding(entryId)!.extracted_json!).castingTime,
    ).toBe("1 action");
    expect(
      s.db.prepare("SELECT count(*) n FROM content_entities").get(),
    ).toEqual({ n: 0 });
  });
  it("requires confirmation, eligibility, full identity and fresh review before canonical promotion", async () => {
    const { s, entryId } = await heldStore();
    expect(s.plan(entryId).outcome).toBe("quarantine");
    expect(
      s.db.prepare("SELECT count(*) n FROM content_entities").get(),
    ).toEqual({ n: 0 });
    s.reviewIdentity(entryId, "admin", "Test Work", "base");
    const plan = s.plan(entryId);
    expect(plan.outcome).toBe("addition");
    expect(() =>
      s.promote(entryId, "admin", s.reviewHash(entryId), {
        user: "",
        astra: "",
        transition: "",
      }),
    ).toThrow("unresolved");
    const id = s.promote(entryId, "admin", s.reviewHash(entryId), {
      user: "test",
      astra: "test",
      transition: "test",
    });
    expect(
      s.promote(entryId, "admin", s.reviewHash(entryId), {
        user: "test",
        astra: "test",
        transition: "test",
      }),
    ).toBe(id);
    expect(
      s.db.prepare("SELECT count(*) n FROM content_entities").get(),
    ).toEqual({ n: 1 });
    const exported = buildApprovedExport(s);
    expect(exported.normalized.spells[0]).toMatchObject({
      id,
      castingTime: "1 action",
      components: "none",
      target: "one test subject",
      area: "one test square",
    });
    expect(exported.rulesDataSet.packs[0]?.spells[0]?.id).toBe(id);
  });
  it("reviews applicable field errata, preserves baseline on refresh, and withdraws approval safely", async () => {
    const { s, entryId } = await heldStore();
    const policy = { user: "fixture", astra: "fixture", transition: "fixture" };
    s.reviewIdentity(entryId, "admin", "Test Work", "base");
    const canonicalId = s.promote(
      entryId,
      "admin",
      s.reviewHash(entryId),
      policy,
    );
    const candidate = async (html: string) => {
      const job = s.createJob("admin", url, "single");
      await new IngestionWorker(s, async (input) => ({
        url: input,
        html,
        retrievedAt: "now",
      })).tick();
      s.confirm(job);
      s.settleJobs();
      const id = s.entries(job)[0]!.id;
      s.reviewIdentity(id, "admin", "Test Work", "base");
      return id;
    };
    const corrected = await candidate(fixture.replace("1 action", "2 actions"));
    expect(s.plan(corrected).outcome).toBe("conflict");
    const before = s.reviewHash(corrected);
    const approval = s.approveCorrection(
      corrected,
      "castingTime",
      "https://example.com/fixture-errata",
      "admin",
    );
    expect(s.plan(corrected).outcome).toBe("correction");
    expect(() => s.promote(corrected, "admin", before, policy)).toThrow(
      "stale",
    );
    expect(s.promote(corrected, "admin", s.reviewHash(corrected), policy)).toBe(
      canonicalId,
    );
    const row = s.db
      .prepare("SELECT state_json FROM catalogue_provenance")
      .get() as { state_json: string };
    const state = JSON.parse(row.state_json);
    expect(state.baseline.castingTime.value).toBe("1 action");
    expect(state.fields.castingTime.value).toBe("2 actions");
    const refreshed = await candidate(fixture);
    expect(s.plan(refreshed).reasons.castingTime).toBe(
      "approved-correction-preserved",
    );
    expect(buildApprovedExport(s).normalized.spells[0]!.castingTime).toBe(
      "2 actions",
    );
    s.withdrawCorrection(approval, "admin");
    expect(s.plan(refreshed).outcome).toBe("quarantine");
    expect(buildApprovedExport(s).normalized.spells[0]!.unavailable).toBe(true);
    const replacement = await candidate(
      fixture.replace("1 action", "2 actions"),
    );
    s.approveCorrection(
      replacement,
      "castingTime",
      "https://example.com/reviewed-errata",
      "admin",
    );
    expect(s.plan(replacement).outcome).toBe("correction");
    s.promote(replacement, "admin", s.reviewHash(replacement), policy);
    expect(buildApprovedExport(s).normalized.spells[0]!.castingTime).toBe(
      "2 actions",
    );
    expect(
      s.db.prepare("SELECT count(*) n FROM content_entities").get(),
    ).toEqual({ n: 1 });
  });
  it("invalidates field correction approval after reprocessing and never overrides protected fields", async () => {
    const { s, entryId } = await heldStore();
    s.reviewIdentity(entryId, "admin", "Test Work", "base");
    s.promote(entryId, "admin", s.reviewHash(entryId), {
      user: "fixture",
      astra: "fixture",
      transition: "fixture",
    });
    const job = s.createJob("admin", url, "single");
    await new IngestionWorker(s, async (input) => ({
      url: input,
      html: fixture.replace("1 action", "2 actions"),
      retrievedAt: "now",
    })).tick();
    s.confirm(job);
    s.settleJobs();
    const id = s.entries(job)[0]!.id;
    s.reviewIdentity(id, "admin", "Test Work", "base");
    s.approveCorrection(
      id,
      "castingTime",
      "https://example.com/fixture-errata",
      "admin",
    );
    s.db
      .prepare(
        "UPDATE catalogue_holding SET parser_version='9.0.0' WHERE entry_id=?",
      )
      .run(id);
    expect(s.plan(id).outcome).toBe("conflict");
    s.db
      .prepare("UPDATE catalogue_holding SET parser_version=? WHERE entry_id=?")
      .run(PARSER_VERSION, id);
    const row = s.db
      .prepare("SELECT state_json FROM catalogue_provenance")
      .get() as { state_json: string };
    const state = JSON.parse(row.state_json);
    state.protectedFields = ["castingTime"];
    s.db
      .prepare("UPDATE catalogue_provenance SET state_json=?")
      .run(JSON.stringify(state));
    expect(s.plan(id).reasons.castingTime).toBe("protected");
    expect(() =>
      s.approveCorrection(
        id,
        "name",
        "https://example.com/fixture-errata",
        "admin",
      ),
    ).toThrow("rule field");
  });
  it("binds approvals to candidate and registry revisions and preserves manual edits", async () => {
    const { s, id, worker, entryId } = await heldStore();
    s.reviewIdentity(entryId, "admin", "Test Work", "base");
    const token = s.reviewHash(entryId);
    s.db
      .prepare(
        "UPDATE catalogue_holding SET parser_version='2.0.0' WHERE entry_id=?",
      )
      .run(entryId);
    expect(() =>
      s.promote(entryId, "admin", token, {
        user: "test",
        astra: "test",
        transition: "test",
      }),
    ).toThrow("stale");
    const canonicalId = s.promote(entryId, "admin", s.reviewHash(entryId), {
      user: "test",
      astra: "test",
      transition: "test",
    });
    s.db
      .prepare("UPDATE content_entities SET payload_json=? WHERE entity_id=?")
      .run(
        JSON.stringify({ id: canonicalId, name: "Manual edit" }),
        canonicalId,
      );
    const second = s.createJob("admin", url, "single");
    await worker.tick();
    s.confirm(second);
    s.settleJobs();
    const e = s.entries(second)[0]!;
    s.reviewIdentity(e.id, "admin", "Test Work", "base");
    expect(s.plan(e.id).conflicts).toContain(
      "external-or-manual-edit-needs-review",
    );
    expect(s.job(id).phase).toBe("review");
  });
  it("prevents concurrent reviewed jobs from creating the same identity twice", async () => {
    const { s, worker, entryId } = await heldStore();
    s.reviewIdentity(entryId, "admin", "Test Work", "base");
    const second = s.createJob("admin", url, "single");
    await worker.tick();
    s.confirm(second);
    s.settleJobs();
    const e = s.entries(second)[0]!;
    s.reviewIdentity(e.id, "admin", "Test Work", "base");
    const stale = s.reviewHash(e.id);
    s.promote(entryId, "admin", s.reviewHash(entryId), {
      user: "test",
      astra: "test",
      transition: "test",
    });
    expect(() =>
      s.promote(e.id, "admin", stale, {
        user: "test",
        astra: "test",
        transition: "test",
      }),
    ).toThrow("stale");
    s.promote(e.id, "admin", s.reviewHash(e.id), {
      user: "test",
      astra: "test",
      transition: "test",
    });
    expect(
      s.db.prepare("SELECT count(*) n FROM content_entities").get(),
    ).toEqual({ n: 1 });
  });
  it("isolates unknown content and never retains excluded raw/payload", async () => {
    const s = store();
    const job = s.createJob("admin", url, "single");
    const worker = new IngestionWorker(s, async (input) => ({
      url: input,
      html: fixture,
      retrievedAt: "now",
    }));
    await worker.tick();
    expect(s.plan(s.entries(job)[0]!.id).outcome).toBe("quarantine");
    expect(() => s.register({ ...evidence, status: "excluded" })).toThrow(
      "reviewed cleanup",
    );
    s.register({ ...evidence, status: "unknown" });
    purgeEvidence(
      s,
      { ...evidence, status: "excluded" },
      {
        target: "isolated-test",
        inventoryReview: "fixture",
      },
    );
    expect(s.holding(s.entries(job)[0]!.id)).toMatchObject({
      raw: null,
      parsed_json: null,
      extracted_json: null,
    });
    const job2 = s.createJob("admin", url, "single");
    await worker.tick();
    expect(s.holding(s.entries(job2)[0]!.id)).toMatchObject({
      raw: null,
      parsed_json: null,
      extracted_json: null,
      status: "excluded",
    });
  });
  it("fences stale claims after recovery and keeps cancellation from persisting late results", () => {
    const s = store();
    const id = s.createJob("admin", url, "single");
    const first = s.claim(1)!;
    const second = s.claim(120002)!;
    expect(s.owns(first)).toBe(false);
    expect(s.owns(second)).toBe(true);
    s.hold(first, parseD20Spell(fixture, url), "now");
    expect(s.holding(first.id)).toBeUndefined();
    s.cancel(id);
    s.hold(second, parseD20Spell(fixture, url), "now");
    expect(s.holding(second.id)).toBeUndefined();
  });
  it("does not discard successes when another detail fails; retries only failed entries", async () => {
    const s = store();
    const directory = "https://www.d20pfsrd.com/magic/all-spells/";
    const id = s.createJob("admin", directory, "directory", 10);
    let fail = true;
    const worker = new IngestionWorker(s, async (input) => {
      if (input.endsWith("bad/") && fail) throw new Error("HTTP 503");
      return {
        url: input,
        retrievedAt: "now",
        html:
          input === directory
            ? `<div class="article-content"><ul><li><a href="${url}">ok</a><a href="b/bad/">bad</a></li></ul><a rel="next" href="${directory}">loop</a></div>`
            : fixture,
      };
    });
    while (await worker.tick()) {
      /* bounded fixture queue */
    }
    expect(s.entries(id).filter((e) => e.state === "failed")).toHaveLength(1);
    expect(s.entries(id).filter((e) => e.state === "held")).toHaveLength(2);
    fail = false;
    s.retry(id);
    while (await worker.tick()) {
      /* retry */
    }
    expect(s.entries(id).filter((e) => e.state === "failed")).toHaveLength(0);
    expect(s.entries(id).find((e) => e.url === url)?.attempts).toBe(1);
  });
  it("marks discovery counts partial at limits", async () => {
    const s = store();
    const id = s.createJob(
      "admin",
      "https://www.d20pfsrd.com/magic/all-spells/",
      "directory",
      1,
    );
    const e = s.claim()!;
    s.discovered(e, [url, url.replace("fixture-ward", "other")], []);
    s.settleJobs();
    expect(s.job(id).discovery_complete).toBe(0);
    expect(s.job(id).limit_reason).toContain("partial");
  });
  it("does not fetch more than three preview entries even when they fail", async () => {
    const s = store();
    const id = s.createJob(
      "admin",
      "https://www.d20pfsrd.com/magic/all-spells/",
      "directory",
      10,
    );
    s.discovered(
      s.claim()!,
      Array.from({ length: 8 }, (_, i) =>
        url.replace("fixture-ward", `fixture-${i}`),
      ),
      [],
    );
    const worker = new IngestionWorker(s, async () => {
      throw new Error("HTTP 503");
    });
    while (await worker.tick()) {
      /* preview */
    }
    expect(
      s.entries(id).filter((e) => e.kind === "detail" && e.attempts > 0),
    ).toHaveLength(3);
    expect(s.job(id).phase).toBe("preview");
  });
  it("purges content from canonical, raw, plans, history and cache without deleting IDs", async () => {
    const { s, entryId } = await heldStore();
    s.reviewIdentity(entryId, "admin", "Test Work", "base");
    const id = s.promote(entryId, "admin", s.reviewHash(entryId), {
      user: "test",
      astra: "test",
      transition: "test",
    });
    s.db
      .prepare(
        "INSERT INTO page_cache(url,source,status_code,fetched_at,html) VALUES(?,?,200,'now','sensitive excluded content')",
      )
      .run(url, "test");
    const excluded: Evidence = { ...evidence, status: "excluded" };
    expect(cleanupImpact(s, excluded).canonical).toHaveLength(1);
    purgeEvidence(s, excluded, {
      target: "isolated-test",
      inventoryReview: "test",
    });
    const row = s.db
      .prepare("SELECT entity_id,payload_json FROM content_entities")
      .get() as { entity_id: string; payload_json: string };
    expect(row.entity_id).toBe(id);
    expect(JSON.parse(row.payload_json).unavailable).toBe(true);
    expect(s.holding(entryId)).toMatchObject({
      raw: null,
      parsed_json: null,
      plan_json: null,
    });
    expect(s.db.prepare("SELECT count(*) n FROM page_cache").get()).toEqual({
      n: 0,
    });
    expect(
      s.db.prepare("SELECT detail_json FROM catalogue_history").get(),
    ).toEqual({ detail_json: null });
    expect(() =>
      purgeEvidence(s, evidence, {
        target: "isolated-test",
        inventoryReview: "test",
      }),
    ).toThrow("confirmed excluded");
  });
  it("reconstructs mixed records from eligible baseline and preserves unrelated user tables", async () => {
    const { s, entryId } = await heldStore();
    s.reviewIdentity(entryId, "admin", "Test Work", "base");
    const id = s.promote(entryId, "admin", s.reviewHash(entryId), {
      user: "test",
      astra: "test",
      transition: "test",
    });
    const correctionEvidence: Evidence = {
      ...evidence,
      id: "correction-evidence",
      url: "https://example.invalid/reviewed-errata",
    };
    s.register(correctionEvidence);
    const row = s.db
      .prepare("SELECT state_json FROM catalogue_provenance")
      .get() as { state_json: string };
    const state = JSON.parse(row.state_json) as CanonicalState;
    state.fields.range = {
      value: "excluded correction",
      evidenceId: correctionEvidence.id,
      authority: "correction",
    };
    const payload = {
      ...Object.fromEntries(
        Object.entries(state.fields).map(([f, c]) => [f, c.value]),
      ),
      id,
      pack: "d20pfsrd-approved-spells",
    };
    state.canonicalHash = hash(JSON.stringify(payload));
    s.db
      .prepare("UPDATE content_entities SET payload_json=? WHERE entity_id=?")
      .run(JSON.stringify(payload), id);
    s.db
      .prepare("UPDATE catalogue_provenance SET state_json=?")
      .run(JSON.stringify(state));
    s.db.exec(
      "CREATE TABLE fixture_player_notes(id TEXT, note TEXT); INSERT INTO fixture_player_notes VALUES('character-1','user-authored note')",
    );
    purgeEvidence(
      s,
      { ...correctionEvidence, status: "excluded" },
      { target: "isolated-test", inventoryReview: "fixture" },
    );
    const exported = buildApprovedExport(s);
    expect(exported.normalized.spells[0]?.range).toBe("touch");
    expect(JSON.stringify(exported)).not.toContain("excluded correction");
    expect(s.db.prepare("SELECT note FROM fixture_player_notes").get()).toEqual(
      { note: "user-authored note" },
    );
  });
});

describe("staging authorization boundary", () => {
  const config = {
    supabaseUrl: "https://pkupqzdnefnjwndwzhdr.supabase.co",
    publishableKey: "test",
    origin: "http://127.0.0.1:5173",
    permissionReviewId: "test",
    targetVerificationId: "test",
  };
  it("rejects production even when environment labels claim staging", () => {
    expect(() =>
      validateServerConfig({
        ...config,
        supabaseUrl: "https://guronltdufvmnwnjqggd.supabase.co",
      }),
    ).toThrow("staging");
    expect(() =>
      validateServerConfig({ ...config, targetVerificationId: "" }),
    ).toThrow("verification");
  });
  it("requires verified server-controlled admin metadata; GM/user metadata is insufficient", async () => {
    const mock = (user: unknown) =>
      (async () =>
        new Response(JSON.stringify(user), { status: 200 })) as typeof fetch;
    await expect(
      authorize(
        config,
        "Bearer token",
        mock({
          id: "player",
          is_anonymous: false,
          user_metadata: { catalogue_role: "admin" },
          app_metadata: { role: "gm" },
        }),
      ),
    ).rejects.toThrow("permission");
    await expect(
      authorize(
        config,
        "Bearer token",
        mock({
          id: "admin",
          is_anonymous: true,
          app_metadata: { catalogue_role: "admin" },
        }),
      ),
    ).rejects.toThrow("permission");
    expect(
      await authorize(
        config,
        "Bearer token",
        mock({
          id: "admin",
          is_anonymous: false,
          app_metadata: { catalogue_role: "admin" },
        }),
      ),
    ).toBe("admin");
  });
});
