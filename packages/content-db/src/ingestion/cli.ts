import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openDatabase } from "../db";
import { IngestionStore } from "./store";
import { IngestionWorker } from "./worker";
import { createIngestionServer } from "./server";
import { validateServerConfig, type ServerConfig } from "./auth";
import { createFetcher } from "./fetch";
import { parseD20Spell } from "./d20pfsrd";
import { hash } from "./model";

const command = process.argv[2];
if (command === "sample" || command === "sample-third-party") {
  // Fixed, bounded fixture acquisition; no database or catalogue writes.
  const names = [
    "m/mage-armor",
    "s/shield",
    "m/magic-missile",
    "f/fireball",
    "d/detect-magic",
    "p/prestidigitation",
    "w/wish",
    "p/polymorph",
    "s/summon-monster-i",
    "a/antimagic-field",
    "p/permanency",
    "r/resurrection",
  ];
  const urls =
    command === "sample-third-party"
      ? [
          "https://www.d20pfsrd.com/magic/3rd-party-spells/dreamscarred-press/house-of-hospitality/",
          "https://www.d20pfsrd.com/magic/3rd-party-spells/rite-publishing-3rd-party-spells/s/scapegoat-greater/",
        ]
      : names.map(
          (name) => `https://www.d20pfsrd.com/magic/all-spells/${name}/`,
        );
  const fetchPage = createFetcher();
  const directory = path.resolve(
    "packages/content-db/data/quarantine-fixtures",
  );
  mkdirSync(directory, { recursive: true });
  const report = [];
  for (const url of urls) {
    try {
      const page = await fetchPage(url, new AbortController().signal);
      const parsed = parseD20Spell(page.html, page.url);
      const id = hash(url).slice(0, 16);
      writeFileSync(path.join(directory, `${id}.html`), parsed.raw);
      writeFileSync(
        path.join(directory, `${id}.json`),
        JSON.stringify(
          {
            ...parsed,
            raw: undefined,
            url: page.url,
            retrievedAt: page.retrievedAt,
            hash: hash(parsed.raw),
            eligibility: "unknown",
            retainedAs:
              "private quarantine fixture pending work/record evidence review",
          },
          null,
          2,
        ),
      );
      report.push({
        url,
        id,
        success: true,
        warnings: parsed.warnings,
        fields: Object.keys(parsed.payload).filter(
          (k) => parsed.payload[k as keyof typeof parsed.payload] !== undefined,
        ),
        descriptionCharacters: parsed.payload.description?.length,
      });
    } catch (e) {
      report.push({
        url,
        success: false,
        error: e instanceof Error ? e.message : "failed",
      });
    }
  }
  let previous: Array<{ url: string }> = [];
  try {
    previous = JSON.parse(
      readFileSync(path.join(directory, "report.json"), "utf8"),
    );
  } catch {
    /* first fixture acquisition */
  }
  writeFileSync(
    path.join(directory, "report.json"),
    JSON.stringify(
      [...previous.filter((r) => !urls.includes(r.url)), ...report],
      null,
      2,
    ),
  );
  console.log(JSON.stringify(report, null, 2));
} else {
  const dbPath = process.env.INGESTION_DB_PATH;
  if (!dbPath || /mathfinder\.sqlite$/i.test(dbPath))
    throw new Error(
      "Use an explicit isolated ingestion DB path, never the legacy default DB",
    );
  const config: ServerConfig = {
    supabaseUrl: process.env.INGESTION_SUPABASE_URL ?? "",
    publishableKey: process.env.INGESTION_SUPABASE_PUBLISHABLE_KEY ?? "",
    origin: process.env.INGESTION_ORIGIN ?? "",
    permissionReviewId: process.env.INGESTION_PERMISSION_REVIEW_ID ?? "",
    targetVerificationId: process.env.INGESTION_TARGET_VERIFICATION_ID ?? "",
  };
  validateServerConfig(config);
  const store = new IngestionStore(openDatabase(dbPath));
  if (command === "serve") {
    const approvalPath = process.env.INGESTION_POLICY_APPROVAL_FILE;
    const approvals = approvalPath
      ? JSON.parse(readFileSync(approvalPath, "utf8"))
      : { user: "", astra: "", transition: "" };
    const server = createIngestionServer(store, config, approvals);
    server.listen(
      Number(process.env.INGESTION_PORT ?? 8788),
      process.env.INGESTION_BIND ?? "127.0.0.1",
    );
    console.log(
      "Staging ingestion API listening; no scraper runs in HTTP requests",
    );
  } else if (command === "work") {
    const worker = new IngestionWorker(store);
    let stopping = false;
    process.on("SIGTERM", () => {
      stopping = true;
    });
    process.on("SIGINT", () => {
      stopping = true;
    });
    while (!stopping) {
      if (!(await worker.tick()))
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    store.db.close();
  } else throw new Error("Use serve, work, or sample");
}
