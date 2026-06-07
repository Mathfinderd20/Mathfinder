import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Alias the engine to its TypeScript source so Vite transpiles it as app code
// (the rules engine ships source, not a build).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@path-builder/rules-engine": fileURLToPath(
        new URL("../../packages/rules-engine/src/index.ts", import.meta.url),
      ),
    },
  },
});
