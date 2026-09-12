import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Export an immutable staging base; never package unrelated dirty working files.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const revision = execFileSync("git", ["rev-parse", "origin/stage"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (!/^[0-9a-f]{40}$/.test(revision))
  throw new Error("Invalid staging revision");
const output = path.join(
  root,
  ".cache",
  `ingestion-stage-ui-${revision.slice(0, 12)}-${Date.now()}`,
);
mkdirSync(output, { recursive: true });
const archive = path.join(output, "source.tar");
execFileSync(
  "git",
  ["archive", "--format=tar", `--output=${archive}`, revision],
  { cwd: root },
);
execFileSync("tar", ["-xf", archive, "-C", output]);
const edit = (relative, before, after) => {
  const filename = path.join(output, relative);
  const original = readFileSync(filename, "utf8");
  if (original.split(before).length !== 2)
    throw new Error(`Review staging integration: ${relative}`);
  writeFileSync(filename, original.replace(before, after));
};
edit(
  "apps/web/src/app/AppRouter.tsx",
  "function ApplicationRoutes() {",
  'import { IngestionPage } from "../features/ingestion/IngestionPage";\n\nfunction ApplicationRoutes() {',
);
edit(
  "apps/web/src/app/AppRouter.tsx",
  "    <Routes>",
  '    <Routes>\n      {import.meta.env.VITE_APP_ENV === "staging" && <Route path="/admin/ingestion" element={<IngestionPage />} />}',
);
edit(
  "apps/web/src/components/ProfileMenu.tsx",
  "<strong>Your account</strong>",
  '<strong>Your account</strong>\n          {import.meta.env.VITE_APP_ENV === "staging" && <a href="/admin/ingestion">Catalogue imports</a>}',
);
edit(
  "apps/web/src/vite-env.d.ts",
  "interface ImportMetaEnv {",
  "interface ImportMetaEnv {\n  readonly VITE_INGESTION_API_URL?: string;",
);
const feature = "apps/web/src/features/ingestion";
mkdirSync(path.join(output, feature), { recursive: true });
for (const file of ["IngestionPage.tsx", "ingestion.css"])
  copyFileSync(
    path.join(root, feature, file),
    path.join(output, feature, file),
  );
writeFileSync(
  path.join(output, "apps/web/.env.production"),
  [
    "VITE_APP_ENV=staging",
    "VITE_SUPABASE_URL=https://pkupqzdnefnjwndwzhdr.supabase.co",
    "VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_NV7mOvL2lBfvHrAXHDta3Q_7xdZUpmS",
    "VITE_INGESTION_API_URL=https://stage.diresheets.com/api/ingestion",
    "",
  ].join("\n"),
);
writeFileSync(
  path.join(output, "wrangler.ingestion-ui.jsonc"),
  JSON.stringify(
    {
      name: "mathfinder-stage",
      account_id: "bbd20759773ffe35ec98139df791b959",
      compatibility_date: "2025-09-08",
      workers_dev: false,
      preview_urls: false,
      assets: {
        directory: "./apps/web/dist",
        not_found_handling: "single-page-application",
      },
      routes: [{ pattern: "stage.diresheets.com", custom_domain: true }],
    },
    null,
    2,
  ),
);
writeFileSync(
  path.join(output, "ingestion-build-manifest.json"),
  JSON.stringify(
    {
      revision,
      modified: [
        "apps/web/src/app/AppRouter.tsx",
        "apps/web/src/components/ProfileMenu.tsx",
        "apps/web/src/vite-env.d.ts",
        `${feature}/IngestionPage.tsx`,
        `${feature}/ingestion.css`,
      ],
      catalogueTransition: false,
      production: false,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ output, revision }));
