import { expect, it } from "vitest";
import { dnsAddresses } from "../src/ingestion/cloudflare/dns";

const host = "www.d20pfsrd.com";
const address = "69.164.217.55";
const a = (name = host, data = address) => ({ name, type: 1, data });
const cname = (name: string, data: string) => ({ name, type: 5, data });
const packet = (Answer: unknown[]) => ({
  Status: 0,
  TC: false,
  Question: [{ name: host + ".", type: 1 }],
  Answer,
});

it("uses typed A records through an explicit CNAME chain", () => {
  expect(
    dnsAddresses(
      host,
      packet([
        cname(host + ".", "srdserver.opengamingnetwork.com."),
        a("srdserver.opengamingnetwork.com."),
      ]),
    ),
  ).toEqual([{ address }]);
  expect(dnsAddresses(host, packet([a(), a()]))).toEqual([{ address }]);
});

it.each([
  "127.0.0.1",
  "169.254.169.254",
  "10.0.0.1",
  "192.168.0.1",
  "192.0.2.1",
  "::1",
  "host.invalid",
])("rejects mixed public and blocked DNS answers: %s", (value) => {
  expect(() => dnsAddresses(host, packet([a(), a(host, value)]))).toThrow();
});

it("rejects truncated, wrong-question, failed, unrelated and cyclic answers", () => {
  const cases = [
    null,
    {},
    { ...packet([a()]), Status: 3 },
    { ...packet([a()]), TC: true },
    { ...packet([a()]), Question: [{ name: "other.invalid", type: 1 }] },
    packet([]),
    packet([a("other.invalid")]),
    packet([a(), cname("unrelated.invalid", "elsewhere.invalid")]),
    packet([cname(host, "alias.invalid"), cname("alias.invalid", host), a()]),
    packet([cname(host, "alias.invalid"), a()]),
    packet([{ name: host, type: 28, data: "2001:db8::1" }]),
    packet([
      cname(host, "alias.invalid"),
      cname(host, "other.invalid"),
      a("alias.invalid"),
    ]),
  ];
  for (const payload of cases)
    expect(() => dnsAddresses(host, payload)).toThrow();
});
