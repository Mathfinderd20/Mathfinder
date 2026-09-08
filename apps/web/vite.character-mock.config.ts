import { readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const outputUrl = new URL("../../design-mocks/character-ui/", import.meta.url);
const outputDirectory = fileURLToPath(outputUrl);

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
      name: "inline-character-mock-assets",
      async closeBundle() {
        const htmlUrl = new URL("character-ui-mock.html", outputUrl);
        const cssUrl = new URL("assets/character-ui-mock.css", outputUrl);
        const scriptUrl = new URL("assets/character-ui-mock.js", outputUrl);
        const portraitUrl = new URL(
          "./public/mock-assets/seren-ashfall.png",
          import.meta.url,
        );

        const [html, css, script, portrait] = await Promise.all([
          readFile(htmlUrl, "utf8"),
          readFile(cssUrl, "utf8"),
          readFile(scriptUrl, "utf8"),
          readFile(portraitUrl),
        ]);
        const portraitDataUrl = `data:image/png;base64,${portrait.toString("base64")}`;
        const selfContainedScript = script
          .replaceAll("./mock-assets/seren-ashfall.png", portraitDataUrl)
          .replaceAll("</script", "<\\/script");
        const selfContainedCss = css.replaceAll("</style", "<\\/style");
        const selfContainedHtml = html
          .replace(
            /<script type="module" crossorigin src="\.\/assets\/character-ui-mock\.js"><\/script>/,
            () =>
              `<script type="module">\n${selfContainedScript}\n    </script>`,
          )
          .replace(
            /<link rel="stylesheet" crossorigin href="\.\/assets\/character-ui-mock\.css">/,
            () => `<style>\n${selfContainedCss}\n    </style>`,
          );

        if (
          !selfContainedHtml.includes('<script type="module">') ||
          !selfContainedHtml.includes("<style>") ||
          selfContainedHtml.includes("./mock-assets/seren-ashfall.png")
        ) {
          throw new Error(
            "Character mock export still references external assets",
          );
        }

        await writeFile(htmlUrl, selfContainedHtml);
        await rm(new URL("assets/", outputUrl), {
          force: true,
          recursive: true,
        });
      },
    },
  ],
  publicDir: false,
});
