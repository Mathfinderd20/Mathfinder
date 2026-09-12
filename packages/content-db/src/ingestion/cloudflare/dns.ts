import { publicIpv4 } from "../fetch";

function dnsName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid DNS name");
  const name = value.toLowerCase().replace(/\.$/, "");
  if (
    name.length > 253 ||
    !name
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    throw new Error("Invalid DNS name");
  return name;
}

/** Accept A records only for the requested name or its explicit, bounded CNAME chain. */
export function dnsAddresses(
  hostname: string,
  payload: unknown,
): Array<{ address: string }> {
  const result = payload as {
    Status?: unknown;
    TC?: unknown;
    Question?: Array<{ name: unknown; type: unknown }>;
    Answer?: Array<{ name: unknown; type: unknown; data: unknown }>;
  } | null;
  const requested = dnsName(hostname);
  if (
    !result ||
    result.Status !== 0 ||
    result.TC !== false ||
    !Array.isArray(result.Question) ||
    result.Question.length !== 1 ||
    result.Question[0]?.type !== 1 ||
    dnsName(result.Question[0]?.name) !== requested ||
    !Array.isArray(result.Answer) ||
    result.Answer.length > 32
  )
    throw new Error("DNS resolution failed");
  const aliases = new Map<string, string>();
  const records: Array<{ name: string; address: string }> = [];
  for (const answer of result.Answer) {
    const name = dnsName(answer.name);
    if (answer.type === 5) {
      if (aliases.has(name)) throw new Error("Ambiguous DNS alias");
      aliases.set(name, dnsName(answer.data));
    } else if (
      answer.type === 1 &&
      typeof answer.data === "string" &&
      publicIpv4(answer.data)
    ) {
      records.push({ name, address: answer.data });
    } else throw new Error("Blocked or unsupported DNS answer");
  }
  let current = requested;
  const visited = new Set<string>();
  while (aliases.has(current)) {
    if (
      visited.has(current) ||
      visited.size >= 8 ||
      records.some((record) => record.name === current)
    )
      throw new Error("Invalid DNS alias chain");
    visited.add(current);
    current = aliases.get(current)!;
  }
  if (
    aliases.size !== visited.size ||
    !records.length ||
    records.some((record) => record.name !== current)
  )
    throw new Error("Unrelated DNS answer");
  return [...new Set(records.map((record) => record.address))].map(
    (address) => ({ address }),
  );
}

export async function resolvePublicAddresses(
  hostname: string,
): Promise<Array<{ address: string }>> {
  // Workers resolve4 currently includes bare CNAME strings; typed DoH avoids treating them as IPs.
  const name = dnsName(hostname);
  const response = await globalThis.fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=A`,
    {
      headers: { accept: "application/dns-json" },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error("DNS resolver unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty DNS response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) throw new Error("DNS response too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return dnsAddresses(name, JSON.parse(Buffer.concat(chunks).toString("utf8")));
}
