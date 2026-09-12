import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "packages/content-db/.env.ingestion.local");
const config = parseEnv(readFileSync(configPath, "utf8"));
if (
  config.INGESTION_SUPABASE_URL !==
    "https://pkupqzdnefnjwndwzhdr.supabase.co" ||
  !config.INGESTION_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_") ||
  !config.INGESTION_TARGET_VERIFICATION_ID ||
  !config.INGESTION_PERMISSION_REVIEW_ID
)
  throw new Error(
    "Verified staging configuration and publishable key required",
  );

// Verification is intentionally isolated from the legacy database and deployed assets.
const dbPath = path.join(
  root,
  "packages/content-db/data/local-staging/ingestion.sqlite",
);
const releasePath = path.join(
  root,
  "packages/content-db/data/releases/e1897852fa107894f0bf992b74dc299057a1e13106ca37264b82bbc78df6ba94/usable-content.json",
);
if (!existsSync(releasePath))
  throw new Error(
    "Prepare the reviewed quarantine-only verification release first; see OPERATIONS.md",
  );
const env = {
  ...process.env,
  INGESTION_SUPABASE_URL: config.INGESTION_SUPABASE_URL,
  INGESTION_SUPABASE_PUBLISHABLE_KEY: config.INGESTION_SUPABASE_PUBLISHABLE_KEY,
  INGESTION_TARGET_VERIFICATION_ID: config.INGESTION_TARGET_VERIFICATION_ID,
  INGESTION_PERMISSION_REVIEW_ID: config.INGESTION_PERMISSION_REVIEW_ID,
  INGESTION_DB_PATH: dbPath,
  INGESTION_BIND: "127.0.0.1",
  INGESTION_PORT: "8788",
  INGESTION_ORIGIN: "http://127.0.0.1:5179",
  INGESTION_POLICY_APPROVAL_FILE: "",
  INGESTION_RUNTIME_RELEASE: releasePath,
  VITE_APP_ENV: "staging",
  VITE_SUPABASE_URL: config.INGESTION_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: config.INGESTION_SUPABASE_PUBLISHABLE_KEY,
  VITE_INGESTION_API_URL: "http://127.0.0.1:8788/api/ingestion",
};
if (process.argv.includes("--check")) {
  console.log(
    "Local configuration valid: staging Supabase, loopback ports 5179/8788, isolated DB, promotion locked.",
  );
} else {
  const children = new Set();
  let stopping = false;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    for (const child of children) child.kill("SIGTERM");
  }
  process.on("SIGINT", () => stop());
  process.on("SIGTERM", () => stop());
  function launch(args, cwd = root, longRunning = false) {
    const child = spawn(process.execPath, args, {
      cwd,
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    children.add(child);
    child.on("error", (error) => {
      console.error(error.message);
      stop(1);
    });
    child.on("exit", (code) => {
      children.delete(child);
      if (longRunning && !stopping) {
        console.error(
          `Local service exited (${code ?? "signal"}); stopping its companions.`,
        );
        stop(1);
      }
    });
    return child;
  }
  const vite = path.join(root, "node_modules/vite/bin/vite.js");
  const webRoot = path.join(root, "apps/web");
  const build = launch(
    [vite, "build", "--outDir", "dist-ingestion-local"],
    webRoot,
  );
  const buildCode = await new Promise((resolve) => {
    build.once("exit", resolve);
    build.once("error", () => resolve(1));
  });
  if (buildCode !== 0 || stopping) stop(1);
  else {
    launch(
      ["--import", "tsx", "packages/content-db/src/ingestion/cli.ts", "serve"],
      root,
      true,
    );
    launch(
      ["--import", "tsx", "packages/content-db/src/ingestion/cli.ts", "work"],
      root,
      true,
    );
    launch(
      [
        vite,
        "preview",
        "--outDir",
        "dist-ingestion-local",
        "--host",
        "127.0.0.1",
        "--port",
        "5179",
        "--strictPort",
      ],
      webRoot,
      true,
    );
    console.log(
      "Local staging verification: http://127.0.0.1:5179/admin/ingestion",
    );
    console.log(
      "Promotion locked. Ctrl+C stops these services; the isolated database persists.",
    );
  }
}
