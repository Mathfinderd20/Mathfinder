import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const outputDirectory = fileURLToPath(
  new URL("../../design-mocks/character-ui/", import.meta.url),
);

export default defineConfig({
  base: "./",
  build: {
    cssCodeSplit: false,
    emptyOutDir: true,
    outDir: outputDirectory,
    rollupOptions: {
      input: fileURLToPath(
        new URL("./character-ui-mock.html", import.meta.url),
      ),
      output: {
        assetFileNames: "assets/character-ui-mock[extname]",
        entryFileNames: "assets/character-ui-mock.js",
      },
    },
  },
  plugins: [
    react(),
    {
      name: "copy-character-mock-assets",
      async closeBundle() {
        const assetDirectory = new URL(
          "../../design-mocks/character-ui/mock-assets/",
          import.meta.url,
        );
        await mkdir(assetDirectory, { recursive: true });
        await copyFile(
          new URL("./public/mock-assets/seren-ashfall.png", import.meta.url),
          new URL("seren-ashfall.png", assetDirectory),
        );
      },
    },
  ],
  publicDir: false,
});
