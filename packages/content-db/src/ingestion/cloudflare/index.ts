import type {
  DurableObjectState,
  DurableObjectNamespace,
} from "@cloudflare/workers-types";
import { createSchema } from "../../schema";
import { IngestionStore } from "../store";
import { IngestionWorker } from "../worker";
import { createIngestionHandler } from "../api";
import {
  authorize,
  permittedOrigin,
  validateServerConfig,
  type ServerConfig,
} from "../auth";
import { DurableSqlite } from "./database";
import { cloudflareFetcher } from "./transport";
import migration from "../migration.sql";
import type { PageFetcher } from "../fetch";

export interface Environment {
  CATALOGUE: DurableObjectNamespace;
  INGESTION_SUPABASE_URL: string;
  INGESTION_SUPABASE_PUBLISHABLE_KEY: string;
  INGESTION_TARGET_VERIFICATION_ID: string;
  INGESTION_PERMISSION_REVIEW_ID: string;
}
function config(env: Environment): ServerConfig {
  const value = {
    supabaseUrl: env.INGESTION_SUPABASE_URL,
    publishableKey: env.INGESTION_SUPABASE_PUBLISHABLE_KEY,
    targetVerificationId: env.INGESTION_TARGET_VERIFICATION_ID,
    permissionReviewId: env.INGESTION_PERMISSION_REVIEW_ID,
    origin: "https://stage.diresheets.com",
  };
  validateServerConfig(value);
  return value;
}

export class Catalogue {
  private readonly store: IngestionStore;
  private readonly handler: (request: Request) => Promise<Response>;
  constructor(
    private readonly ctx: DurableObjectState,
    env: Environment,
    private readonly dependencies: {
      authenticate?: typeof authorize;
      fetchPage?: PageFetcher;
    } = {},
  ) {
    const settings = config(env);
    const db = new DurableSqlite(ctx.storage);
    createSchema(db);
    this.store = new IngestionStore(db, migration);
    // Promotion remains explicitly locked during hosted holding-area verification.
    this.handler = createIngestionHandler(
      this.store,
      settings,
      { user: "", astra: "", transition: "" },
      dependencies.authenticate,
    );
  }
  async fetch(request: Request): Promise<Response> {
    const response = await this.handler(request);
    // Persist an alarm before acknowledging any operation that could enqueue work.
    if (response.ok && request.method === "POST") await this.schedule();
    return response;
  }
  private active() {
    this.store.settleJobs();
    return this.store
      .jobs()
      .some((job) => ["discover", "import"].includes(job.phase));
  }
  private async schedule() {
    if (this.active() && (await this.ctx.storage.getAlarm()) === null)
      await this.ctx.storage.setAlarm(Date.now() + 1500);
  }
  async alarm() {
    // One detail/directory unit per invocation, using existing leases and plans.
    // Schedule recovery first: process loss must not strand a running entry.
    if (!this.active()) return;
    await this.ctx.storage.setAlarm(Date.now() + 60_000);
    const worker = new IngestionWorker(
      this.store,
      this.dependencies.fetchPage ?? cloudflareFetcher(),
    );
    await worker.tick();
    if (this.active()) await this.ctx.storage.setAlarm(Date.now() + 1500);
    else await this.ctx.storage.deleteAlarm();
  }
}

export default {
  async fetch(request: Request, env: Environment): Promise<Response> {
    const url = new URL(request.url);
    const headers: Record<string, string> = {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      Vary: "Origin",
    };
    const error = (message: string, status: number) =>
      new Response(JSON.stringify({ error: message }), { status, headers });
    if (
      url.hostname !== "stage.diresheets.com" ||
      !url.pathname.startsWith("/api/ingestion/")
    )
      return error("Not found", 404);
    const settings = config(env);
    if (!permittedOrigin(request, settings.origin))
      return error("Origin denied", 403);
    headers["Access-Control-Allow-Origin"] = settings.origin;
    if (!["GET", "POST", "OPTIONS"].includes(request.method))
      return error("Method not allowed", 405);
    if (request.method !== "OPTIONS") {
      try {
        await authorize(
          settings,
          request.headers.get("authorization") ?? undefined,
        );
      } catch {
        return error("Catalogue administrator access required", 403);
      }
    }
    const id = env.CATALOGUE.idFromName("staging-pkupqzdnefnjwndwzhdr-v1");
    // The DO repeats authorization; no caller-controlled 'admin' header is trusted.
    return env.CATALOGUE.get(id).fetch(
      request as never,
    ) as unknown as Promise<Response>;
  },
};
