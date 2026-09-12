import { discoverLinks, parseD20Spell } from "./d20pfsrd";
import { createFetcher, type PageFetcher } from "./fetch";
import { IngestionStore } from "./store";
import { randomUUID } from "node:crypto";
import { ingestionErrorCode } from "./errors";

export class IngestionWorker {
  private readonly owner = randomUUID();
  private controllers = new Map<string, AbortController>();
  private fetchers = new Map<string, { phase: string; fetch: PageFetcher }>();
  constructor(
    readonly store: IngestionStore,
    readonly fetchPage?: PageFetcher,
  ) {}
  cancel(id: string) {
    this.store.cancel(id);
    this.controllers.get(id)?.abort();
  }
  async tick(): Promise<boolean> {
    if (!this.fetchPage && !this.store.acquireWorker(this.owner)) return false;
    this.store.settleJobs();
    const entry = this.store.claim();
    if (!entry) {
      if (!this.fetchPage) this.store.releaseWorker(this.owner);
      return false;
    }
    const controller = new AbortController();
    this.controllers.set(entry.job_id, controller);
    const heartbeat = setInterval(() => {
      this.store.exhaustBudgets();
      if (!this.fetchPage && !this.store.acquireWorker(this.owner))
        controller.abort();
      if (!this.store.owns(entry)) controller.abort();
      else this.store.heartbeat(entry);
    }, 1000);
    try {
      this.store.assertJobPolicy(entry.job_id);
      const phase = this.store.job(entry.job_id).phase;
      if (this.fetchers.get(entry.job_id)?.phase !== phase)
        this.fetchers.set(entry.job_id, {
          phase,
          fetch: this.fetchPage ?? createFetcher(),
        });
      const page = await this.fetchers
        .get(entry.job_id)!
        .fetch(entry.url, controller.signal);
      if (entry.kind === "detail" && page.url !== entry.url)
        throw new Error(
          "Redirect changes record identity; review destination URL",
        );
      if (!this.store.owns(entry)) return true;
      if (entry.kind === "directory") {
        const links = discoverLinks(page.html, page.url);
        this.store.discovered(entry, links.entries, links.pagination);
      } else {
        const parsed = parseD20Spell(page.html, page.url);
        this.store.hold(entry, parsed, page.retrievedAt);
      }
    } catch (error) {
      // Only curated error codes are retained; responses and credentials never enter logs.
      const code = ingestionErrorCode(error);
      if (this.store.owns(entry)) this.store.finish(entry, "failed", code);
    } finally {
      clearInterval(heartbeat);
      this.controllers.delete(entry.job_id);
      this.store.settleJobs();
      if (!this.fetchPage) this.store.releaseWorker(this.owner);
    }
    return true;
  }
  reprocess(entryId: number, actor = "operator") {
    const held = this.store.holding(entryId);
    if (!held?.raw || held.status === "excluded")
      throw new Error("No retained eligible/quarantined material");
    const parsed = parseD20Spell(held.raw, held.source_url);
    const previous = held.parsed_json
      ? JSON.parse(held.parsed_json)
      : undefined;
    if (previous?.identity?.name === parsed.payload.identity.name)
      parsed.payload.identity = previous.identity;
    if (held.promoted_id) {
      const jobId = this.store.db.transaction(() => {
        const id = this.store.createJob(actor, held.source_url, "single");
        const entry = this.store.entries(id)[0]!;
        const token = randomUUID();
        this.store.db
          .prepare(
            "UPDATE catalogue_entries SET state='running',lease_token=? WHERE id=?",
          )
          .run(token, entry.id);
        this.store.hold(
          { ...entry, lease_token: token },
          parsed,
          held.retrieved_at,
        );
        this.store.db
          .prepare(
            "UPDATE catalogue_jobs SET phase='review',discovery_complete=1,confirmed_at=? WHERE id=?",
          )
          .run(new Date().toISOString(), id);
        return id;
      })();
      return {
        jobId,
        entryId: this.store.entries(jobId)[0]!.id,
        warnings: parsed.warnings,
      };
    }
    this.store.db
      .prepare(
        "UPDATE catalogue_holding SET parsed_json=?,extracted_json=?,warnings_json=?,parser_version=?,schema_version=?,plan_json=NULL,reviewed_by=NULL,reviewed_at=NULL WHERE entry_id=?",
      )
      .run(
        JSON.stringify(parsed.payload),
        JSON.stringify(parsed.extracted),
        JSON.stringify(parsed.warnings),
        parsed.parserVersion,
        parsed.schemaVersion,
        entryId,
      );
    return { entryId, warnings: parsed.warnings };
  }
}
