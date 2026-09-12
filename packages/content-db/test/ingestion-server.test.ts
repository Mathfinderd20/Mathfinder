import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { expect, it } from "vitest";
import { openDatabase } from "../src/db";
import { IngestionStore } from "../src/ingestion/store";
import { IngestionWorker } from "../src/ingestion/worker";
import { createIngestionServer } from "../src/ingestion/server";

it("authorizes HTTP jobs, keeps fetching outside requests and exposes review separately", async () => {
  const store = new IngestionStore(openDatabase(":memory:"));
  const config = {
    supabaseUrl: "https://pkupqzdnefnjwndwzhdr.supabase.co",
    publishableKey: "fixture",
    origin: "http://127.0.0.1:5173",
    permissionReviewId: "fixture",
    targetVerificationId: "fixture",
  };
  const server = createIngestionServer(
    store,
    config,
    { user: "", astra: "", transition: "" },
    async (_config, token) => {
      if (token !== "Bearer fixture-admin") throw new Error("Unauthorized");
      return "fixture-admin";
    },
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const request = (
    path: string,
    body?: unknown,
    token = "fixture-admin",
    origin = config.origin,
  ) =>
    fetch(`http://127.0.0.1:${address.port}/api/ingestion${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: origin,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    expect((await request("/jobs", undefined, "player")).status).toBe(403);
    expect(
      (
        await request(
          "/jobs",
          undefined,
          "fixture-admin",
          "https://evil.invalid",
        )
      ).status,
    ).toBe(403);
    const response = await request("/jobs", {
      url: "https://www.d20pfsrd.com/magic/all-spells/f/fixture-ward/",
      mode: "single",
    });
    expect(response.status).toBe(200);
    const { id } = (await response.json()) as { id: string };
    expect(store.entries(id)[0]?.state).toBe("pending");
    const worker = new IngestionWorker(store, async (url) => ({
      url,
      html: readFileSync(
        new URL("./fixtures/d20-spell.html", import.meta.url),
        "utf8",
      ),
      retrievedAt: "fixture",
    }));
    await worker.tick();
    const preview = (await (await request(`/jobs/${id}`)).json()) as {
      job: { phase: string };
      entries: Array<{ plan: { outcome: string }; held: { raw?: string } }>;
    };
    expect(preview.job.phase).toBe("preview");
    expect(preview.entries[0]?.plan.outcome).toBe("quarantine");
    expect(preview.entries[0]?.held.raw).toBeUndefined();
    expect((await request(`/jobs/${id}/confirm`, {})).status).toBe(200);
    store.settleJobs();
    expect(store.job(id).phase).toBe("review");
    expect(
      (
        await request(`/entries/${store.entries(id)[0]!.id}/promote`, {
          planHash: "stale",
        })
      ).status,
    ).toBe(409);
    expect(
      store.db.prepare("SELECT count(*) n FROM content_entities").get(),
    ).toEqual({ n: 0 });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    store.db.close();
  }
});
