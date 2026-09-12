import { readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(root, "apps", "web");
const outputDirectory = path.resolve(root, process.argv[2] ?? "apps/web/dist");
if (
  path.dirname(outputDirectory) !== webRoot ||
  !/^dist(?:-[a-z0-9-]+)?$/.test(path.basename(outputDirectory))
)
  throw new Error(
    "Output must be an explicit apps/web/dist or dist-* build directory",
  );
const sourcePath = path.join(outputDirectory, "usable-content.json");
const content = JSON.parse(await readFile(sourcePath, "utf8"));

const normalizedFile = "usable-content-normalized.json";
const rulesFile = "usable-content-rules.json";
const { rulesDataSet, ...normalizedContent } = content;
const maxCloudflareAssetSize = 25 * 1024 * 1024;

async function writeChunk(fileName, value) {
  const serialized = JSON.stringify(value);
  const size = Buffer.byteLength(serialized);
  if (size > maxCloudflareAssetSize) {
    throw new Error(
      `${fileName} is ${(size / 1024 / 1024).toFixed(2)} MiB; Cloudflare static assets must not exceed 25 MiB`,
    );
  }
  await writeFile(path.join(outputDirectory, fileName), serialized);
}

await Promise.all([
  writeChunk(normalizedFile, normalizedContent),
  writeChunk(rulesFile, { rulesDataSet }),
]);

await rm(sourcePath);
await writeFile(
  sourcePath,
  JSON.stringify({
    chunks: [`/${normalizedFile}`, `/${rulesFile}`],
  }),
);

console.log("Split runtime content into Cloudflare-compatible static assets.");
