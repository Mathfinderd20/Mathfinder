import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { validateWebBuildEnvironment } from "./src/lib/buildEnvironment.ts";
import { reviewedCatalogue } from "./build/reviewedCatalogue.ts";

// Alias the engine to its TypeScript source so Vite transpiles it as app code
// (the rules engine ships source, not a build).
export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(
    mode,
    fileURLToPath(new URL(".", import.meta.url)),
    "",
  );
  const reviewed = reviewedCatalogue(
    environment,
    fileURLToPath(new URL(".", import.meta.url)),
  );
  if (command === "build") {
    validateWebBuildEnvironment(environment);
  }
  return {
    publicDir: reviewed ? false : "public",
    define: {
      "import.meta.env.VITE_REVIEWED_CATALOGUE_HASH": JSON.stringify(
        reviewed?.contentHash ?? "",
      ),
    },
    build: {
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL("./index.html", import.meta.url)),
          gmPreview: fileURLToPath(
            new URL("./gm-preview.html", import.meta.url),
          ),
          characterUiMock: fileURLToPath(
            new URL("./character-ui-mock.html", import.meta.url),
          ),
        },
      },
    },
    plugins: [
      react(),
      ...(reviewed ? [reviewed.plugin] : []),
      {
        name: "mathfinder-offline-shell",
        generateBundle(_options, bundle) {
          const assets = Object.keys(bundle)
            .filter((name) => /\.(js|css)$/.test(name))
            .map((name) => `/${name}`);
          const version = assets.join("|") + (reviewed?.contentHash ?? "");
          this.emitFile({
            type: "asset",
            fileName: "sw.js",
            source: `
const CACHE = 'mathfinder-shell-' + ${JSON.stringify(version)};
const ASSETS = ${JSON.stringify([
              "/",
              "/usable-content.json",
              "/usable-content-normalized.json",
              "/usable-content-rules.json",
            ])}.concat(${JSON.stringify(assets)});
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mathfinder-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Authentication URLs and API responses are never placed in Cache Storage.
  if (url.pathname.startsWith('/auth/') || url.pathname === '/sign-in') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, {cache: 'no-store', signal: AbortSignal.timeout(5000)}).then(response => {
      if (!response.ok) throw new Error('Unavailable');
      return response;
    }).catch(() => caches.open(CACHE).then(cache => cache.match('/'))));
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(event.request)));
  }
});
`,
          });
        },
      },
    ],
    resolve: {
      alias: {
        "@mathfinder/rules-engine": fileURLToPath(
          new URL("../../packages/rules-engine/src/index.ts", import.meta.url),
        ),
      },
    },
  };
});
