// Local-runtime test entrypoint only. Never referenced by deployment configuration.
import type { DurableObjectState } from "@cloudflare/workers-types";
import {
  Catalogue,
  type Environment,
} from "../../src/ingestion/cloudflare/index";
import { DurableSqlite } from "../../src/ingestion/cloudflare/database";
import { cloudflareFetcher } from "../../src/ingestion/cloudflare/transport";
import html from "../fixtures/d20-spell.html";

export class TestCatalogue extends Catalogue {
  constructor(
    private readonly testState: DurableObjectState,
    env: Environment,
  ) {
    super(testState, env, {
      authenticate: async (_config, token) => {
        if (token !== "Bearer fixture-admin") throw new Error("Unauthorized");
        return "fixture-admin";
      },
      fetchPage: async (url, signal) => {
        const key = `fetch-count:${url}`;
        const count = (await testState.storage.get<number>(key)) ?? 0;
        await testState.storage.put(key, count + 1);
        if (url.includes("retry-fixture") && count === 0)
          throw new Error("HTTP 503");
        if (url.includes("slow-fixture"))
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, 5000);
            signal.addEventListener(
              "abort",
              () => {
                clearTimeout(timer);
                reject(new Error("Cancelled"));
              },
              { once: true },
            );
          });
        return { url, html, retrievedAt: "2026-09-11T00:00:00Z" };
      },
    });
  }
  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/transaction-test") {
      const db = new DurableSqlite(this.testState.storage);
      db.exec(
        "CREATE TABLE IF NOT EXISTS rollback_test(id INTEGER PRIMARY KEY, value TEXT UNIQUE)",
      );
      try {
        db.transaction(() => {
          db.prepare("INSERT INTO rollback_test(value) VALUES(?)").run(
            "duplicate",
          );
          db.prepare("INSERT INTO rollback_test(value) VALUES(?)").run(
            "duplicate",
          );
        }).immediate();
      } catch {
        /* Expected unique constraint rollback. */
      }
      return Response.json({
        rows: db.prepare("SELECT count(*) n FROM rollback_test").get(),
      });
    }
    if (new URL(request.url).pathname === "/storage-limit-test") {
      const db = new DurableSqlite(this.testState.storage);
      try {
        db.prepare("INSERT INTO rollback_test(value) VALUES(?)").run(
          "x".repeat(1_900_001),
        );
        return Response.json({ blocked: false });
      } catch (error) {
        return Response.json({
          blocked:
            error instanceof Error &&
            error.message.includes("Storage row limit"),
          rows: db.prepare("SELECT count(*) n FROM rollback_test").get(),
        });
      }
    }
    if (new URL(request.url).pathname === "/transport-test") {
      try {
        const page = await cloudflareFetcher()(
          "https://www.d20pfsrd.com/magic/all-spells/m/mage-armor/",
          AbortSignal.timeout(45_000),
        );
        return Response.json({
          ok: true,
          bytes: new TextEncoder().encode(page.html).length,
          url: page.url,
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error instanceof Error ? error.message : "transport failed",
          },
          { status: 502 },
        );
      }
    }
    return super.fetch(request);
  }
}
export default {
  fetch(request: Request, env: Environment) {
    return env.CATALOGUE.get(env.CATALOGUE.idFromName("fixture")).fetch(
      request as never,
    );
  },
};
