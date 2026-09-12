import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { mkdir, mkdtemp } from "node:fs/promises";
import { strict as assert } from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(
  root,
  "packages/content-db/data/cloudflare-contract-test/index.mjs",
);
await mkdir(path.dirname(output), { recursive: true });
await build({
  absWorkingDir: root,
  entryPoints: ["packages/content-db/test/cloudflare/harness.ts"],
  outfile: output,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  loader: { ".sql": "text", ".html": "text" },
  external: ["cloudflare:*"],
  plugins: [
    {
      name: "node-builtin-commonjs",
      setup(builder) {
        const builtins = new Set(
          builtinModules.map((name) => name.replace(/^node:/, "")),
        );
        builder.onResolve({ filter: /.*/ }, (args) => {
          const name = args.path.replace(/^node:/, "");
          if (args.kind === "require-call" && builtins.has(name))
            return { path: name, namespace: "node-builtin-commonjs" };
        });
        builder.onLoad(
          { filter: /.*/, namespace: "node-builtin-commonjs" },
          (args) => ({
            contents: `import value from "node:${args.path}"; module.exports = value;`,
            loader: "js",
          }),
        );
      },
    },
  ],
});
const persistence = await mkdtemp(path.join(path.dirname(output), "state-"));
const options = convertV4MiniflareOptions({
  resourcePersistencePath: persistence,
  workers: [
    {
      modules: true,
      scriptPath: output,
      compatibilityDate: "2026-09-01",
      compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
      durableObjects: {
        CATALOGUE: { className: "TestCatalogue", useSQLite: true },
      },
      bindings: {
        INGESTION_SUPABASE_URL: "https://pkupqzdnefnjwndwzhdr.supabase.co",
        INGESTION_SUPABASE_PUBLISHABLE_KEY: "fixture",
        INGESTION_TARGET_VERIFICATION_ID: "isolated-test",
        INGESTION_PERMISSION_REVIEW_ID: "isolated-test",
      },
    },
  ],
});
let mf = new Miniflare(options);
const request = (
  url,
  data,
  token = "fixture-admin",
  origin = "https://stage.diresheets.com",
) =>
  mf.dispatchFetch(`https://stage.diresheets.com${url}`, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      origin,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
try {
  assert.equal(
    (await request("/api/ingestion/jobs", undefined, "player")).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/ingestion/jobs",
        undefined,
        "fixture-admin",
        "https://evil.invalid",
      )
    ).status,
    403,
  );
  const rollback = await (await request("/transaction-test")).json();
  assert.equal(rollback.rows.n, 0);
  const oversized = await (await request("/storage-limit-test")).json();
  assert.equal(oversized.blocked, true);
  assert.equal(oversized.rows.n, 0);
  const response = await request("/api/ingestion/jobs", {
    url: "https://www.d20pfsrd.com/magic/all-spells/f/fixture-ward/",
    mode: "single",
  });
  assert.equal(response.status, 200, await response.clone().text());
  const { id } = await response.json();
  let result;
  for (let attempt = 0; attempt < 20; attempt++) {
    result = await (await request(`/api/ingestion/jobs/${id}`)).json();
    if (result.entries?.[0]?.state === "held") break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(result.entries[0].state, "held", JSON.stringify(result));
  assert.equal(result.entries[0].plan.outcome, "quarantine");
  assert.equal(result.entries[0].held.raw, undefined);
  const state = await (await request("/api/ingestion/jobs")).json();
  assert.equal(state.promotionEnabled, false);
  const sameOrigin = await mf.dispatchFetch(
    "https://stage.diresheets.com/api/ingestion/jobs",
    {
      headers: {
        authorization: "Bearer fixture-admin",
        "sec-fetch-site": "same-origin",
      },
    },
  );
  assert.equal(sameOrigin.status, 200);
  await mf.dispose();
  mf = new Miniflare(options);
  const restarted = await (await request(`/api/ingestion/jobs/${id}`)).json();
  assert.ok(restarted.entries, JSON.stringify(restarted));
  assert.equal(restarted.entries[0].state, "held");
  assert.equal(restarted.entries[0].id, result.entries[0].id);
  assert.equal(
    (
      await request(
        `/api/ingestion/entries/${result.entries[0].id}/reprocess`,
        {},
      )
    ).status,
    200,
  );
  const reprocessed = await (await request(`/api/ingestion/jobs/${id}`)).json();
  assert.equal(reprocessed.entries.length, 1);
  assert.equal(reprocessed.entries[0].plan.outcome, "quarantine");

  const waitEntry = async (jobId, wanted) => {
    let detail;
    for (let attempt = 0; attempt < 50; attempt++) {
      detail = await (await request(`/api/ingestion/jobs/${jobId}`)).json();
      if (detail.entries[0]?.state === wanted) return detail;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.fail(JSON.stringify({ wanted, detail }));
  };
  const retryJob = await (
    await request("/api/ingestion/jobs", {
      url: "https://www.d20pfsrd.com/magic/all-spells/r/retry-fixture/",
      mode: "single",
    })
  ).json();
  await waitEntry(retryJob.id, "failed");
  assert.equal(
    (await request(`/api/ingestion/jobs/${retryJob.id}/retry`, {})).status,
    200,
  );
  const retried = await waitEntry(retryJob.id, "held");
  assert.equal(retried.entries[0].attempts, 2);
  const slow = await (
    await request("/api/ingestion/jobs", {
      url: "https://www.d20pfsrd.com/magic/all-spells/s/slow-fixture/",
      mode: "single",
    })
  ).json();
  await waitEntry(slow.id, "running");
  assert.equal(
    (await request(`/api/ingestion/jobs/${slow.id}/cancel`, {})).status,
    200,
  );
  await new Promise((resolve) => setTimeout(resolve, 1750));
  const cancelled = await (
    await request(`/api/ingestion/jobs/${slow.id}`)
  ).json();
  assert.equal(cancelled.job.phase, "cancelled");
  assert.equal(cancelled.entries[0].held, undefined);
  console.log(
    "PASS: Cloudflare SQL rollback, admin/origin checks, alarm -> quarantine, restart persistence, reprocess without duplicate, retry and cancellation, promotion locked.",
  );
  if (process.argv.includes("--live-transport")) {
    const transport = await request("/transport-test");
    const report = await transport.json();
    console.log(JSON.stringify({ transport: report }));
    assert.equal(
      report.ok,
      true,
      "Pinned Cloudflare transport did not pass live verification",
    );
  }
} finally {
  await mf.dispose();
}
