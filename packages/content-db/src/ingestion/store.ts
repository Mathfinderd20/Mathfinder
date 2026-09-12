import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { IngestionDatabase } from "./database";
import { canonicalUrl, pageKind, SOURCE } from "./d20pfsrd";
import { policySnapshot } from "./policy";
import {
  eligibility,
  hash,
  identityKey,
  mergeFields,
  type CanonicalState,
  type Contribution,
  type Evidence,
  type MergePlan,
  type ParsedPage,
  type SpellPayload,
} from "./model";

export interface Job {
  id: string;
  created_by: string;
  source: string;
  url: string;
  mode: "single" | "directory";
  phase: "discover" | "preview" | "import" | "review" | "cancelled";
  discovery_complete: number;
  limit_reason: string | null;
  max_entries: number;
  policy_json: string | null;
}
export interface Entry {
  id: number;
  job_id: string;
  url: string;
  kind: "detail" | "directory";
  depth: number;
  state: string;
  lease_token: string;
  attempts: number;
  error_code: string | null;
}
export interface Held {
  entry_id: number;
  source_url: string;
  retrieved_at: string;
  raw: string | null;
  extracted_json: string | null;
  parsed_json: string | null;
  warnings_json: string;
  status: string;
  plan_json: string | null;
  promoted_id: string | null;
  evidence_id: string | null;
  content_hash: string;
  parser_version: string;
  schema_version: string;
}
export interface CorrectionReview {
  approval_id: string;
  entry_id: number;
  field: string;
  identity_key: string;
  evidence_id: string;
  candidate_digest: string;
  authority_reference: string;
  status: "approved" | "withdrawn";
  reviewed_by: string;
  reviewed_at: string;
}

export class IngestionStore {
  constructor(
    readonly db: IngestionDatabase,
    migrationSql = readFileSync(
      new URL("./migration.sql", import.meta.url),
      "utf8",
    ),
  ) {
    db.pragma("foreign_keys = ON");
    db.pragma("secure_delete = ON");
    db.transaction(() => {
      db.exec(migrationSql);
      // Upgrade early holding-area volumes without touching canonical payloads.
      const additions = {
        catalogue_holding: { extracted_json: "TEXT" },
        catalogue_jobs: {
          policy_json: "TEXT",
          active_ms: "INTEGER NOT NULL DEFAULT 0",
          phase_started_ms: "INTEGER",
        },
      };
      for (const [table, columns] of Object.entries(additions)) {
        const present = new Set(
          (
            db.prepare(`PRAGMA table_info(${table})`).all() as {
              name: string;
            }[]
          ).map((c) => c.name),
        );
        for (const [column, type] of Object.entries(columns))
          if (!present.has(column))
            db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      }
    }).immediate();
  }
  registry(): Map<string, Evidence> {
    return new Map(
      (
        this.db
          .prepare("SELECT evidence_json FROM catalogue_registry ORDER BY id")
          .all() as { evidence_json: string }[]
      ).map((r) => {
        const e = JSON.parse(r.evidence_json) as Evidence;
        return [e.id, e];
      }),
    );
  }
  evidenceFor(url: string): Evidence | undefined {
    return [...this.registry().values()].find((e) => e.url === url && !e.field);
  }
  register(evidence: Evidence) {
    if (!evidence.id || !evidence.url || !Array.isArray(evidence.references))
      throw new Error("Invalid evidence");
    const previous = this.registry().get(evidence.id);
    if (
      previous &&
      (previous.url !== evidence.url || previous.field !== evidence.field)
    )
      throw new Error("Evidence identity cannot change scope");
    if (previous && eligibility(evidence) === "excluded")
      throw new Error(
        "Run the reviewed cleanup workflow before excluding retained evidence",
      );
    if (
      eligibility(evidence) === "excluded" &&
      (this.db
        .prepare(
          "SELECT 1 FROM catalogue_holding WHERE source_url=? AND (raw IS NOT NULL OR parsed_json IS NOT NULL)",
        )
        .get(evidence.url) ||
        this.db
          .prepare("SELECT 1 FROM content_entities WHERE source_url=?")
          .get(evidence.url) ||
        this.db
          .prepare("SELECT 1 FROM page_cache WHERE url=?")
          .get(evidence.url))
    )
      throw new Error(
        "Retained copies require reviewed cleanup before exclusion registration",
      );
    this.db.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO catalogue_registry(id,url,field,evidence_json) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET evidence_json=excluded.evidence_json",
        )
        .run(
          evidence.id,
          evidence.url,
          evidence.field ?? null,
          JSON.stringify(evidence),
        );
      this.db
        .prepare(
          "INSERT INTO catalogue_registry_history(evidence_id,evidence_json,recorded_at) VALUES(?,?,?)",
        )
        .run(evidence.id, JSON.stringify(evidence), new Date().toISOString());
    })();
  }
  acquireWorker(owner: string, now = Date.now()): boolean {
    return (
      this.db
        .prepare(
          "UPDATE catalogue_worker_lock SET owner=?,expires_ms=? WHERE id=1 AND (expires_ms<? OR owner=?)",
        )
        .run(owner, now + 120_000, now, owner).changes === 1
    );
  }
  releaseWorker(owner: string) {
    this.db
      .prepare(
        "UPDATE catalogue_worker_lock SET owner=NULL,expires_ms=? WHERE id=1 AND owner=?",
      )
      .run(Date.now() + 1500, owner);
  }
  exhaustBudgets(now = Date.now()) {
    this.db
      .prepare(
        `UPDATE catalogue_entries SET state='skipped',error_code='job-runtime-limit',lease_token=NULL
      WHERE job_id IN (SELECT id FROM catalogue_jobs WHERE phase IN ('discover','import') AND active_ms + CASE WHEN phase_started_ms IS NULL THEN 0 ELSE ?-phase_started_ms END >= 900000)
      AND state IN ('pending','running')`,
      )
      .run(now);
    this.db
      .prepare(
        `UPDATE catalogue_jobs SET limit_reason='Crawl runtime limit reached; count is partial' WHERE phase IN ('discover','import') AND active_ms + CASE WHEN phase_started_ms IS NULL THEN 0 ELSE ?-phase_started_ms END >= 900000`,
      )
      .run(now);
  }
  createJob(
    actor: string,
    input: string,
    mode: "single" | "directory",
    limit = 100,
  ): string {
    const url = canonicalUrl(input);
    const kind = pageKind(url);
    if (
      !actor ||
      !["single", "directory"].includes(mode) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new Error("Invalid scoped job");
    if (mode === "single" && kind !== "detail")
      throw new Error(
        "Single mode currently supports a spell detail page only",
      );
    if (mode === "directory" && kind !== "directory")
      throw new Error("Directory page required");
    const id = randomUUID();
    this.db.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO catalogue_jobs(id,created_by,source,url,mode,phase,max_entries,created_at,policy_json) VALUES(?,?,?,?,?,'discover',?,?,?)",
        )
        .run(
          id,
          actor,
          SOURCE,
          url,
          mode,
          limit,
          new Date().toISOString(),
          policySnapshot(limit),
        );
      this.db
        .prepare(
          "INSERT INTO catalogue_entries(job_id,url,kind,depth) VALUES(?,?,?,0)",
        )
        .run(id, url, kind);
    })();
    return id;
  }
  job(id: string): Job {
    const row = this.db
      .prepare("SELECT * FROM catalogue_jobs WHERE id=?")
      .get(id) as Job | undefined;
    if (!row) throw new Error("Job not found");
    return row;
  }
  assertJobPolicy(id: string) {
    const job = this.job(id);
    if (job.policy_json !== policySnapshot(job.max_entries))
      throw new Error(
        "Saved source policy changed; start a reviewed discovery",
      );
  }
  entries(id: string): Entry[] {
    return this.db
      .prepare("SELECT * FROM catalogue_entries WHERE job_id=? ORDER BY id")
      .all(id) as Entry[];
  }
  holding(id: number): Held | undefined {
    return this.db
      .prepare("SELECT * FROM catalogue_holding WHERE entry_id=?")
      .get(id) as Held | undefined;
  }
  jobs(): Job[] {
    return this.db
      .prepare(
        "SELECT * FROM catalogue_jobs ORDER BY created_at DESC LIMIT 100",
      )
      .all() as Job[];
  }
  confirm(id: string) {
    this.db
      .prepare(
        "UPDATE catalogue_jobs SET phase='import',confirmed_at=? WHERE id=? AND phase='preview'",
      )
      .run(new Date().toISOString(), id);
  }
  cancel(id: string) {
    this.db
      .prepare(
        "UPDATE catalogue_jobs SET phase='cancelled',cancelled_at=? WHERE id=?",
      )
      .run(new Date().toISOString(), id);
  }
  retry(id: string) {
    this.db.transaction(() => {
      const job = this.job(id);
      if (job.phase === "cancelled")
        throw new Error("Create a new job after cancellation");
      this.db
        .prepare(
          "UPDATE catalogue_entries SET state='pending',error_code=NULL WHERE job_id=? AND state='failed' AND attempts < 9",
        )
        .run(id);
      const directoryPending = this.entries(id).some(
        (e) => e.kind === "directory" && e.state === "pending",
      );
      this.db
        .prepare(
          "UPDATE catalogue_jobs SET phase=?,discovery_complete=CASE WHEN ? THEN 0 ELSE discovery_complete END WHERE id=?",
        )
        .run(
          directoryPending ? "discover" : "import",
          Number(directoryPending),
          id,
        );
    })();
  }
  claim(now = Date.now()): Entry | undefined {
    return this.db
      .transaction(() => {
        // SQL serializes claims across processes. Lease token fences late/stale workers.
        this.exhaustBudgets(now);
        const row = this.db
          .prepare(
            `SELECT e.* FROM catalogue_entries e JOIN catalogue_jobs j ON j.id=e.job_id
        WHERE j.phase IN ('discover','import') AND (e.state='pending' OR (e.state='running' AND e.lease_until<?))
        AND (j.phase='import' OR e.kind='directory' OR e.attempts>0 OR (SELECT COUNT(*) FROM catalogue_entries p WHERE p.job_id=j.id AND p.kind='detail' AND p.attempts>0)<3)
        ORDER BY CASE e.kind WHEN 'directory' THEN 0 ELSE 1 END,e.id LIMIT 1`,
          )
          .get(now) as Entry | undefined;
        if (!row) return undefined;
        const token = randomUUID();
        this.db
          .prepare(
            "UPDATE catalogue_jobs SET phase_started_ms=COALESCE(phase_started_ms,?) WHERE id=?",
          )
          .run(now, row.job_id);
        this.db
          .prepare(
            "UPDATE catalogue_entries SET state='running',lease_token=?,lease_until=?,attempts=attempts+1 WHERE id=?",
          )
          .run(token, now + 120_000, row.id);
        return { ...row, lease_token: token, attempts: row.attempts + 1 };
      })
      .immediate();
  }
  owns(entry: Entry): boolean {
    return !!this.db
      .prepare(
        "SELECT 1 FROM catalogue_entries e JOIN catalogue_jobs j ON j.id=e.job_id WHERE e.id=? AND e.lease_token=? AND e.state='running' AND j.phase!='cancelled'",
      )
      .get(entry.id, entry.lease_token);
  }
  heartbeat(entry: Entry) {
    this.db
      .prepare(
        "UPDATE catalogue_entries SET lease_until=? WHERE id=? AND lease_token=? AND state='running'",
      )
      .run(Date.now() + 120_000, entry.id, entry.lease_token);
  }
  finish(
    entry: Entry,
    state: "held" | "failed" | "skipped",
    error: string | null = null,
  ) {
    this.db
      .prepare(
        "UPDATE catalogue_entries SET state=?,error_code=?,lease_until=NULL WHERE id=? AND lease_token=? AND state='running'",
      )
      .run(state, error, entry.id, entry.lease_token);
  }
  discovered(entry: Entry, entries: string[], pagination: string[]) {
    this.db
      .transaction(() => {
        if (!this.owns(entry)) return;
        const job = this.job(entry.job_id);
        const seen = new Set(this.entries(job.id).map((e) => e.url));
        let total = this.entries(job.id).filter(
          (e) => e.kind === "detail",
        ).length;
        let pages = seen.size;
        let reason: string | undefined;
        for (const [kind, urls] of [
          ["detail", entries],
          ["directory", pagination],
        ] as const)
          for (const url of urls) {
            if (seen.has(url)) continue;
            if (total >= job.max_entries || pages >= 100 || entry.depth >= 3) {
              reason = "Discovery limit reached; count is partial";
              continue;
            }
            if (pageKind(url) !== kind) continue;
            this.db
              .prepare(
                "INSERT OR IGNORE INTO catalogue_entries(job_id,url,kind,depth) VALUES(?,?,?,?)",
              )
              .run(job.id, url, kind, entry.depth + 1);
            seen.add(url);
            pages++;
            if (kind === "detail") total++;
          }
        if (reason)
          this.db
            .prepare("UPDATE catalogue_jobs SET limit_reason=? WHERE id=?")
            .run(reason, job.id);
        this.finish(entry, "held");
      })
      .immediate();
  }
  settleJobs() {
    for (const job of this.jobs().filter((j) =>
      ["discover", "import"].includes(j.phase),
    )) {
      const entries = this.entries(job.id);
      const pending = (e: Entry) => ["pending", "running"].includes(e.state);
      const directories = entries.filter((e) => e.kind === "directory");
      if (directories.some(pending)) continue;
      const complete =
        !job.limit_reason && directories.every((e) => e.state === "held");
      this.db
        .prepare("UPDATE catalogue_jobs SET discovery_complete=? WHERE id=?")
        .run(Number(complete), job.id);
      const details = entries.filter((e) => e.kind === "detail");
      if (
        job.phase === "discover" &&
        details.filter((e) => !pending(e)).length >= Math.min(3, details.length)
      )
        this.db
          .prepare(
            "UPDATE catalogue_jobs SET phase='preview',active_ms=active_ms+COALESCE(?-phase_started_ms,0),phase_started_ms=NULL WHERE id=?",
          )
          .run(Date.now(), job.id);
      if (job.phase === "import" && !details.some(pending))
        this.db
          .prepare(
            "UPDATE catalogue_jobs SET phase='review',active_ms=active_ms+COALESCE(?-phase_started_ms,0),phase_started_ms=NULL WHERE id=?",
          )
          .run(Date.now(), job.id);
    }
  }
  hold(entry: Entry, parsed: ParsedPage, retrievedAt: string) {
    this.db
      .transaction(() => {
        if (!this.owns(entry)) return;
        const evidence = this.evidenceFor(entry.url);
        const excludedField = [...this.registry().values()].some(
          (e) =>
            e.url === entry.url && e.field && eligibility(e) === "excluded",
        );
        // A mixed raw page cannot be retained until field-level source fragments are isolated.
        const status = excludedField ? "excluded" : eligibility(evidence);
        // Excluded pages are never copied into retained raw/payload/audit columns.
        this.db
          .prepare(
            `INSERT INTO catalogue_holding(entry_id,source_url,retrieved_at,content_hash,parser,parser_version,schema_version,raw,parsed_json,warnings_json,status,evidence_id)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(entry_id) DO UPDATE SET retrieved_at=excluded.retrieved_at,content_hash=excluded.content_hash,
        parser=excluded.parser,parser_version=excluded.parser_version,schema_version=excluded.schema_version,raw=excluded.raw,parsed_json=excluded.parsed_json,
        warnings_json=excluded.warnings_json,status=excluded.status,evidence_id=excluded.evidence_id,plan_json=NULL,reviewed_by=NULL,reviewed_at=NULL`,
          )
          .run(
            entry.id,
            entry.url,
            retrievedAt,
            hash(parsed.raw),
            parsed.parser,
            parsed.parserVersion,
            parsed.schemaVersion,
            status === "excluded" ? null : parsed.raw,
            status === "excluded" ? null : JSON.stringify(parsed.payload),
            JSON.stringify(parsed.warnings),
            status,
            evidence?.id ?? null,
          );
        this.db
          .prepare(
            "UPDATE catalogue_holding SET extracted_json=? WHERE entry_id=?",
          )
          .run(
            status === "excluded" ? null : JSON.stringify(parsed.extracted),
            entry.id,
          );
        this.finish(entry, "held");
      })
      .immediate();
  }
  plan(entryId: number): MergePlan {
    const held = this.holding(entryId);
    if (!held) throw new Error("Holding record not found");
    const blocked = (
      outcome: "exclusion" | "quarantine",
      reason: string,
    ): MergePlan => ({
      outcome,
      expectedRevision: 0,
      changes: {},
      conflicts: [reason],
      reasons: {},
    });
    if (!held.parsed_json) return blocked("exclusion", "excluded-content");
    const payload = JSON.parse(held.parsed_json) as SpellPayload;
    const ev = this.evidenceFor(held.source_url);
    const status = eligibility(ev);
    if (status === "excluded" || status === "unknown")
      return blocked(
        status === "excluded" ? "exclusion" : "quarantine",
        "eligibility",
      );
    const key = identityKey(payload.identity);
    const linked = this.db
      .prepare("SELECT entity_key FROM catalogue_source_links WHERE url=?")
      .get(held.source_url) as { entity_key: string } | undefined;
    const known = this.db
      .prepare(
        "SELECT state_json FROM catalogue_provenance WHERE entity_key=? OR identity_key=?",
      )
      .all(linked?.entity_key ?? "", key ?? "") as { state_json: string }[];
    if (known.length > 1)
      return blocked("quarantine", "ambiguous-source-identity");
    // Legacy candidates are review-only: a name is enough to block a new duplicate, not enough to merge.
    const normalizeName = (name: string) =>
      name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
    const legacyNames = this.db
      .prepare(
        "SELECT e.name FROM content_entities e LEFT JOIN catalogue_provenance p ON p.entity_key=e.entity_key WHERE e.kind='spell' AND p.entity_key IS NULL",
      )
      .all() as { name: string }[];
    if (
      !known.length &&
      legacyNames.some(
        (row) => normalizeName(row.name) === normalizeName(payload.name),
      )
    )
      return blocked("quarantine", "legacy-match-needs-review");
    const current = known[0]
      ? (JSON.parse(known[0].state_json) as CanonicalState)
      : undefined;
    if (current?.canonicalHash) {
      const actual = this.db
        .prepare(
          "SELECT payload_json FROM content_entities WHERE entity_id=? AND kind='spell'",
        )
        .get(current.id) as { payload_json: string } | undefined;
      if (!actual || hash(actual.payload_json) !== current.canonicalHash)
        return blocked("quarantine", "external-or-manual-edit-needs-review");
    }
    const incoming: Record<string, Contribution> = Object.fromEntries(
      Object.entries(payload)
        .filter(([field]) => field !== "identity")
        .map(([field, value]) => {
          const fieldEvidence =
            [...this.registry().values()].find(
              (e) => e.url === held.source_url && e.field === field,
            ) ?? ev!;
          return [
            field,
            {
              value,
              evidenceId: fieldEvidence.id,
              authority: "baseline",
            } satisfies Contribution,
          ];
        }),
    );
    for (const correction of this.corrections(entryId)) {
      if (
        correction.status !== "approved" ||
        correction.candidate_digest !== this.candidateDigest(entryId)
      )
        continue;
      const candidate = incoming[correction.field];
      if (!candidate || candidate.evidenceId !== correction.evidence_id)
        continue;
      incoming[correction.field] = {
        ...candidate,
        authority: "correction",
        correction: {
          approvalId: correction.approval_id,
          appliesToIdentity: correction.identity_key,
          field: correction.field,
          references: [held.source_url, correction.authority_reference],
        },
      } as Contribution;
    }
    if (
      current &&
      Object.entries(current.fields).some(
        ([field, contribution]) =>
          contribution.authority === "correction" &&
          !this.correctionActive(contribution.correction?.approvalId) &&
          incoming[field]?.authority !== "correction",
      )
    )
      return blocked(
        "quarantine",
        "withdrawn-correction-needs-replacement-review",
      );
    return mergeFields(
      current,
      payload.identity,
      incoming,
      this.registry(),
      JSON.parse(held.warnings_json),
    );
  }
  reviewHash(entryId: number) {
    const held = this.holding(entryId);
    return hash(
      JSON.stringify({
        candidate: held?.parsed_json,
        sourceHash: held?.content_hash,
        parser: held?.parser_version,
        schema: held?.schema_version,
        validation: held?.warnings_json,
        policy: [...this.registry().values()],
        corrections: this.corrections(entryId),
        plan: this.plan(entryId),
      }),
    );
  }
  candidateDigest(entryId: number) {
    const h = this.holding(entryId);
    return hash(
      JSON.stringify([
        h?.content_hash,
        h?.parsed_json,
        h?.parser_version,
        h?.schema_version,
      ]),
    );
  }
  corrections(entryId: number) {
    return this.db
      .prepare(
        "SELECT * FROM catalogue_corrections WHERE entry_id=? ORDER BY reviewed_at,approval_id",
      )
      .all(entryId) as CorrectionReview[];
  }
  correctionActive(approvalId: string | undefined) {
    if (!approvalId) return false;
    return Boolean(
      this.db
        .prepare(
          "SELECT 1 FROM catalogue_corrections WHERE approval_id=? AND status='approved'",
        )
        .get(approvalId),
    );
  }
  approveCorrection(
    entryId: number,
    field: string,
    authorityReference: string,
    actor: string,
  ) {
    const held = this.holding(entryId);
    if (!held?.parsed_json || held.promoted_id || !actor)
      throw new Error("Editable reviewed candidate required");
    const reference = new URL(authorityReference);
    if (
      reference.protocol !== "https:" ||
      reference.username ||
      reference.password
    )
      throw new Error("HTTPS authority evidence reference required");
    const payload = JSON.parse(held.parsed_json) as SpellPayload;
    const key = identityKey(payload.identity);
    if (
      !key ||
      !this.db
        .prepare("SELECT 1 FROM catalogue_provenance WHERE identity_key=?")
        .get(key)
    )
      throw new Error(
        "Correction must match an existing reviewed entity and version",
      );
    if (
      [
        "identity",
        "id",
        "name",
        "pack",
        "source",
        "sourceUrl",
        "copyrightNotice",
      ].includes(field) ||
      !Object.prototype.hasOwnProperty.call(payload, field) ||
      JSON.parse(held.warnings_json).some(
        (w: { field: string; severity: string }) =>
          w.field === field || w.severity === "error",
      )
    )
      throw new Error("Validated source-supported rule field required");
    const evidence =
      [...this.registry().values()].find(
        (e) => e.url === held.source_url && e.field === field,
      ) ?? this.evidenceFor(held.source_url);
    if (
      !evidence ||
      !["eligible", "approved-exception"].includes(eligibility(evidence))
    )
      throw new Error("Eligible correction evidence required");
    if (
      this.corrections(entryId).some(
        (c) => c.field === field && c.status === "approved",
      )
    )
      throw new Error(
        "Withdraw the previous field approval before replacement",
      );
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO catalogue_corrections(approval_id,entry_id,field,identity_key,evidence_id,candidate_digest,authority_reference,status,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?,?,'approved',?,?)",
      )
      .run(
        id,
        entryId,
        field,
        key,
        evidence.id,
        this.candidateDigest(entryId),
        reference.href,
        actor,
        new Date().toISOString(),
      );
    return id;
  }
  withdrawCorrection(approvalId: string, actor: string) {
    if (!actor) throw new Error("Reviewer required");
    this.db
      .prepare(
        "UPDATE catalogue_corrections SET status='withdrawn',withdrawn_by=?,withdrawn_at=? WHERE approval_id=?",
      )
      .run(actor, new Date().toISOString(), approvalId);
  }
  reviewIdentity(
    entryId: number,
    actor: string,
    publication: string,
    variant: string,
  ) {
    if (!actor || !publication.trim() || !variant.trim())
      throw new Error(
        "Evidence-supported publication and variant are required",
      );
    const held = this.holding(entryId);
    if (!held?.parsed_json || held.promoted_id)
      throw new Error("Not an editable holding record");
    const ev = this.evidenceFor(held.source_url);
    if (
      ev?.work !== publication ||
      !["eligible", "approved-exception"].includes(eligibility(ev))
    )
      throw new Error("Publication must match reviewed eligibility evidence");
    const payload = JSON.parse(held.parsed_json) as SpellPayload;
    payload.identity.publication = publication;
    payload.identity.variant = variant;
    this.db
      .prepare(
        "UPDATE catalogue_holding SET parsed_json=?,reviewed_by=?,reviewed_at=?,plan_json=NULL WHERE entry_id=?",
      )
      .run(JSON.stringify(payload), actor, new Date().toISOString(), entryId);
  }
  promote(
    entryId: number,
    actor: string,
    reviewedPlanHash: string,
    policyApproval: { user: string; astra: string; transition: string },
  ) {
    if (
      !policyApproval.user ||
      !policyApproval.astra ||
      !policyApproval.transition
    )
      throw new Error("Required policy review unresolved");
    return this.db
      .transaction(() => {
        const held = this.holding(entryId);
        if (!held?.parsed_json) throw new Error("No promotable content");
        if (held.promoted_id) return held.promoted_id;
        const entry = this.db
          .prepare("SELECT * FROM catalogue_entries WHERE id=?")
          .get(entryId) as Entry;
        if (this.job(entry.job_id).phase !== "review")
          throw new Error("Confirm import and complete review first");
        const plan = this.plan(entryId);
        if (this.reviewHash(entryId) !== reviewedPlanHash)
          throw new Error("Review is stale; refresh the plan");
        if (["conflict", "quarantine", "exclusion"].includes(plan.outcome))
          throw new Error("Unresolved review");
        const payload = JSON.parse(held.parsed_json) as SpellPayload;
        const key = identityKey(payload.identity)!;
        const row = this.db
          .prepare(
            "SELECT entity_key,state_json FROM catalogue_provenance WHERE identity_key=?",
          )
          .get(key) as { entity_key: string; state_json: string } | undefined;
        const current: CanonicalState = row
          ? JSON.parse(row.state_json)
          : {
              id: `ingest-${randomUUID()}`,
              identity: payload.identity,
              revision: 0,
              fields: {},
              baseline: {},
              protectedFields: [],
            };
        if (current.revision !== plan.expectedRevision)
          throw new Error("Concurrent modification; review again");
        const before = JSON.stringify(current);
        current.fields = { ...current.fields, ...plan.changes };
        for (const [field, contribution] of Object.entries(plan.changes))
          if (contribution.authority === "baseline")
            current.baseline[field] = contribution;
        current.revision++;
        const entityKey = row?.entity_key ?? `spell:${current.id}`;
        const canonical = {
          ...Object.fromEntries(
            Object.entries(current.fields).map(([f, c]) => [f, c.value]),
          ),
          id: current.id,
          pack: "d20pfsrd-approved-spells",
        };
        current.canonicalHash = hash(JSON.stringify(canonical));
        const now = new Date().toISOString();
        this.db
          .prepare(
            `INSERT INTO content_entities(entity_key,kind,entity_id,name,origin,external_source,source_url,payload_json,imported_at,updated_at)
        VALUES(?,'spell',?,?,'scrape',?,?,?, ?,?) ON CONFLICT(entity_key) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at`,
          )
          .run(
            entityKey,
            current.id,
            payload.name,
            SOURCE,
            held.source_url,
            JSON.stringify(canonical),
            now,
            now,
          );
        this.db
          .prepare(
            "INSERT INTO catalogue_provenance(entity_key,identity_key,state_json,revision) VALUES(?,?,?,?) ON CONFLICT(entity_key) DO UPDATE SET state_json=excluded.state_json,revision=excluded.revision",
          )
          .run(entityKey, key, JSON.stringify(current), current.revision);
        this.db
          .prepare(
            "INSERT INTO catalogue_source_links(url,entity_key) VALUES(?,?) ON CONFLICT(url) DO NOTHING",
          )
          .run(held.source_url, entityKey);
        this.db
          .prepare(
            "INSERT INTO catalogue_history(entity_key,entry_id,actor,action,evidence_ids_json,detail_json,created_at) VALUES(?,?,?,?,?,?,?)",
          )
          .run(
            entityKey,
            entryId,
            actor,
            plan.outcome,
            JSON.stringify([
              ...new Set(Object.values(plan.changes).map((c) => c.evidenceId)),
            ]),
            JSON.stringify({
              before: JSON.parse(before),
              after: current,
              reasons: plan.reasons,
            }),
            now,
          );
        this.db
          .prepare(
            "UPDATE catalogue_holding SET plan_json=?,reviewed_by=?,reviewed_at=?,promoted_id=? WHERE entry_id=?",
          )
          .run(JSON.stringify(plan), actor, now, current.id, entryId);
        return current.id;
      })
      .immediate();
  }
}
