import { type Evidence } from "./model";
import {
  authorize,
  permittedOrigin,
  validateServerConfig,
  type ServerConfig,
} from "./auth";
import { IngestionStore } from "./store";
import { IngestionWorker } from "./worker";
import { buildApprovedExport } from "./export";

async function body(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Invalid body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 65536) {
        await reader.cancel();
        throw new Error("Request too large");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
    throw new Error("Invalid body");
  return parsed;
}

/** One API contract for Node and Cloudflare; fetching stays in the background worker. */
export function createIngestionHandler(
  store: IngestionStore,
  config: ServerConfig,
  policyApproval: { user: string; astra: string; transition: string },
  authenticate: typeof authorize = authorize,
) {
  validateServerConfig(config);
  const reprocessor = new IngestionWorker(store);
  return async (req: Request): Promise<Response> => {
    const headers: Record<string, string> = {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      Vary: "Origin",
    };
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), { status, headers });
    if (!permittedOrigin(req, config.origin))
      return json({ error: "Origin denied" }, 403);
    headers["Access-Control-Allow-Origin"] = config.origin;
    if (req.method === "OPTIONS") {
      headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
      headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
      return new Response(null, { status: 204, headers });
    }
    try {
      const actor = await authenticate(
        config,
        req.headers.get("authorization") ?? undefined,
      );
      const path = new URL(req.url ?? "/", "http://localhost").pathname.replace(
        /^\/api\/ingestion/,
        "",
      );
      let result: unknown;
      if (req.method === "GET" && path === "/export")
        result = buildApprovedExport(store);
      else if (req.method === "GET" && path === "/jobs")
        result = {
          jobs: store.jobs(),
          promotionEnabled: !!(
            policyApproval.user &&
            policyApproval.astra &&
            policyApproval.transition
          ),
        };
      else if (req.method === "GET" && /^\/jobs\/[\w-]+$/.test(path)) {
        const id = path.split("/")[2]!;
        result = {
          job: store.job(id),
          entries: store.entries(id).map((entry) => {
            const held = store.holding(entry.id);
            const plan = held ? store.plan(entry.id) : undefined;
            return {
              ...entry,
              held: held
                ? {
                    status: held.status,
                    payload: held.parsed_json
                      ? JSON.parse(held.parsed_json)
                      : null,
                    extracted: held.extracted_json
                      ? JSON.parse(held.extracted_json)
                      : null,
                    warnings: JSON.parse(held.warnings_json),
                    parserVersion: held.parser_version,
                    promotedId: held.promoted_id,
                    corrections: store.corrections(entry.id),
                  }
                : undefined,
              plan,
              planHash: plan ? store.reviewHash(entry.id) : undefined,
            };
          }),
        };
      } else if (req.method === "POST") {
        if (!req.headers.get("content-type")?.startsWith("application/json"))
          throw new Error("JSON body required");
        const input = await body(req);
        if (path === "/jobs") {
          if (
            typeof input.url !== "string" ||
            !["single", "directory"].includes(String(input.mode))
          )
            throw new Error("Invalid job");
          result = {
            id: store.createJob(
              actor,
              input.url,
              input.mode as "single" | "directory",
            ),
          };
        } else if (/^\/jobs\/[\w-]+\/(confirm|cancel|retry)$/.test(path)) {
          const [, , id, action] = path.split("/");
          store.job(id!);
          if (action === "confirm") store.confirm(id!);
          else if (action === "cancel") store.cancel(id!);
          else store.retry(id!);
          result = { job: store.job(id!) };
        } else if (
          /^\/entries\/\d+\/(identity|reprocess|promote|correction|withdraw-correction)$/.test(
            path,
          )
        ) {
          const [, , id, action] = path.split("/");
          const entry = Number(id);
          if (action === "correction") {
            if (
              typeof input.field !== "string" ||
              typeof input.authorityReference !== "string"
            )
              throw new Error(
                "Correction field and authority reference required",
              );
            result = {
              approvalId: store.approveCorrection(
                entry,
                input.field,
                input.authorityReference,
                actor,
              ),
            };
          } else if (action === "withdraw-correction") {
            if (
              typeof input.approvalId !== "string" ||
              !store
                .corrections(entry)
                .some((c) => c.approval_id === input.approvalId)
            )
              throw new Error("Correction approval not found");
            store.withdrawCorrection(input.approvalId, actor);
            result = { withdrawn: input.approvalId };
          } else if (action === "identity") {
            if (
              typeof input.publication !== "string" ||
              typeof input.variant !== "string"
            )
              throw new Error("Identity required");
            store.reviewIdentity(
              entry,
              actor,
              input.publication,
              input.variant,
            );
            result = { plan: store.plan(entry) };
          } else if (action === "reprocess")
            result = reprocessor.reprocess(entry, actor);
          else {
            if (typeof input.planHash !== "string")
              throw new Error("Reviewed plan hash required");
            result = {
              id: store.promote(entry, actor, input.planHash, policyApproval),
            };
          }
        } else if (path === "/registry") {
          const evidence = input as unknown as Evidence;
          if (
            !["eligible", "excluded", "unknown", "approved-exception"].includes(
              evidence.status,
            ) ||
            !evidence.references?.every((r) => typeof r === "string") ||
            evidence.references.length > 20
          )
            throw new Error("Invalid classification evidence");
          store.register({ ...evidence, reviewedBy: actor });
          result = { registered: evidence.id };
        } else throw new Error("Unsupported operation");
      } else throw new Error("Unsupported operation");
      return json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Operation failed";
      const denied = /Unauthorized|permission required/.test(message);

      // Do not leak SQL errors, credentials, stack traces or source bodies.
      return json(
        {
          error: denied
            ? "Catalogue administrator access required"
            : /review|Review|identity|Identity|Unsupported|Invalid|scope|layout|eligible|Publication|policy|promot|import|Job not found|holding/i.test(
                  message,
                )
              ? message.slice(0, 180)
              : "Operation rejected; inspect configuration or retry",
        },
        denied ? 403 : 409,
      );
    }
  };
}
