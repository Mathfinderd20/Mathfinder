import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { verifyRuntimeRelease } from "../../../packages/content-db/src/ingestion/runtime-release-verification.ts";

export function reviewedCatalogue(
  environment: Record<string, string>,
  webRoot: string,
) {
  const releasePath = environment.INGESTION_RUNTIME_RELEASE;
  if (!releasePath) return undefined;
  if (
    environment.VITE_APP_ENV !== "staging" ||
    environment.VITE_SUPABASE_URL !== "https://pkupqzdnefnjwndwzhdr.supabase.co"
  )
    throw new Error("Reviewed catalogue activation is staging-only");
  const release = JSON.parse(readFileSync(path.resolve(releasePath), "utf8"));
  const contentHash = verifyRuntimeRelease(release);
  const publicRoot = path.join(webRoot, "public");
  const plugin: Plugin = {
    name: "reviewed-staging-catalogue",
    generateBundle() {
      // Vite publicDir is disabled for this build: unreviewed full/split exports
      // never enter the output, even transiently.
      const copy = (directory: string, prefix = "") => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const fileName = prefix + entry.name;
          if (entry.isSymbolicLink())
            throw new Error("Symlinked public assets require review");
          if (entry.isDirectory())
            copy(path.join(directory, entry.name), fileName + "/");
          else if (!/^usable-content(?:[.-]|$)/.test(fileName))
            this.emitFile({
              type: "asset",
              fileName,
              source: readFileSync(path.join(directory, entry.name)),
            });
        }
      };
      copy(publicRoot);
      this.emitFile({
        type: "asset",
        fileName: "usable-content.json",
        source: JSON.stringify(release),
      });
    },
  };
  return { contentHash, plugin };
}
