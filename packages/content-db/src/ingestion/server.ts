import { createServer } from "node:http";
import { createIngestionHandler } from "./api";

export function createIngestionServer(
  ...args: Parameters<typeof createIngestionHandler>
) {
  const handler = createIngestionHandler(...args);
  return createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 65536) {
          res.writeHead(413, { "Cache-Control": "no-store" });
          res.end();
          return;
        }
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers))
        if (value !== undefined)
          headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      const response = await handler(
        new Request(new URL(req.url ?? "/", "http://localhost"), {
          method: req.method,
          headers,
          ...(!["GET", "HEAD"].includes(req.method ?? "GET")
            ? { body: Buffer.concat(chunks).toString("utf8") }
            : {}),
        }),
      );
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.writeHead(response.status);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500, { "Cache-Control": "no-store" });
      res.end('{"error":"Operation failed"}');
    }
  });
}
