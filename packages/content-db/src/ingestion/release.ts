import { eligibility, hash, type Evidence } from "./model";
import type { UsableContentExport } from "../exporter";

export interface ReleaseDecision {
  /** Exact location, including pack identity when applicable. */
  scope: string;
  id: string;
  payloadHash: string;
  reviewedBy: string;
  reviewReference: string;
  origin: "seed" | "scrape";
  /** Every retained content field needs evidence; identity keys are audit metadata. */
  fields: Record<string, string>;
}
export interface ReleaseManifest {
  schema: "reviewed-runtime/1";
  target: "pkupqzdnefnjwndwzhdr";
  transitionReference: string;
  contentHash: string;
  approved: Array<{
    scope: string;
    id: string;
    payloadHash: string;
    decision: string;
  }>;
  unavailable: Array<{
    scope: string;
    id: string;
    reason: "unknown" | "excluded" | "review-stale";
  }>;
  evidence: Evidence[];
}
export type RuntimeRelease = UsableContentExport & {
  catalogueManifest: ReleaseManifest;
};

export function releaseRecordId(
  scope: string,
  record: Record<string, unknown>,
): string {
  if (typeof record.id === "string" && record.id) return record.id;
  if (scope.endsWith(":skills") && typeof record.key === "string")
    return record.key;
  if (scope.endsWith(":classes") && typeof record.name === "string")
    return (
      "legacy-name-sha256:" +
      hash(record.name.normalize("NFKC").trim().toLowerCase())
    );
  throw new Error(`Missing stable record identity: ${scope}`);
}

const normalizedKinds = {
  classes: "class",
  archetypes: "archetype",
  classFeatures: "class-feature",
  feats: "feat",
  races: "race",
  skills: "skill",
  spells: "spell",
  weapons: "weapon",
  armor: "armor",
  mundaneEquipment: "gear",
  magicItems: "magic-item",
  domains: "domain",
  schools: "school",
  spellEffects: "spell-effect",
} as const;

/**
 * Full-catalogue release, independent of fetching. All copies are reviewed separately,
 * including derived pack records. Missing evidence never inherits a pack/domain label.
 * This creates an artifact; activation and character-data cleanup remain separate.
 */
export function buildRuntimeRelease(
  input: UsableContentExport,
  decisions: ReleaseDecision[],
  registry: Map<string, Evidence>,
  transitionReference: string,
): RuntimeRelease {
  if (!transitionReference)
    throw new Error("Reviewed staging transition required");
  const decisionMap = new Map<string, ReleaseDecision>();
  for (const decision of decisions) {
    const key = JSON.stringify([decision.scope, decision.id]);
    if (decisionMap.has(key)) throw new Error("Duplicate release decision");
    decisionMap.set(key, decision);
  }
  const manifest: ReleaseManifest = {
    schema: "reviewed-runtime/1",
    target: "pkupqzdnefnjwndwzhdr",
    transitionReference,
    contentHash: "",
    approved: [],
    unavailable: [],
    evidence: [],
  };
  const usedEvidence = new Set<string>();
  const byOrigin = { seed: 0, scrape: 0 };
  const filter = (scope: string, records: unknown[]) => {
    const seen = new Set<string>();
    return records.flatMap((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error(`Unsupported release record layout: ${scope}`);
      const record = value as Record<string, unknown>;
      const id = releaseRecordId(scope, record);
      if (seen.has(id))
        throw new Error(`Duplicate record ID requires review: ${scope}`);
      seen.add(id);
      const decision = decisionMap.get(JSON.stringify([scope, id]));
      const contentFields = Object.keys(record).filter(
        (k) => !["id", "pack"].includes(k) && record[k] !== undefined,
      );
      const evidence = contentFields.map((k) =>
        registry.get(decision?.fields[k] ?? ""),
      );
      const scopeExcluded =
        typeof record.sourceUrl === "string" &&
        [...registry.values()].some(
          (e) =>
            e.url === record.sourceUrl &&
            eligibility(e) === "excluded" &&
            (!e.field || e.field in record),
        );
      const reason =
        scopeExcluded || evidence.some((e) => eligibility(e) === "excluded")
          ? "excluded"
          : decision && decision.payloadHash !== hash(JSON.stringify(value))
            ? "review-stale"
            : "unknown";
      const approved =
        decision &&
        decision.reviewedBy &&
        decision.reviewReference &&
        decision.payloadHash === hash(JSON.stringify(value)) &&
        !scopeExcluded &&
        !record.unavailable &&
        contentFields.length > 0 &&
        evidence.every(
          (e, i) =>
            e &&
            ["eligible", "approved-exception"].includes(eligibility(e)) &&
            (!e.field || e.field === contentFields[i]) &&
            (typeof record.sourceUrl !== "string" ||
              e.url === record.sourceUrl),
        );
      if (!approved) {
        manifest.unavailable.push({ scope, id, reason });
        return [];
      }
      evidence.forEach((e) => usedEvidence.add(e!.id));
      manifest.approved.push({
        scope,
        id,
        payloadHash: decision.payloadHash,
        decision: decision.reviewReference,
      });
      if (scope.startsWith("normalized:")) byOrigin[decision.origin]++;
      return [structuredClone(value)];
    });
  };
  const normalized = Object.fromEntries(
    Object.entries(input.normalized).map(([kind, rows]) => {
      if (!(kind in normalizedKinds) || !Array.isArray(rows))
        throw new Error("Unsupported normalized collection");
      return [kind, filter(`normalized:${kind}`, rows)];
    }),
  ) as unknown as UsableContentExport["normalized"];
  const packs = input.rulesDataSet.packs.map((pack) => {
    const result: Record<string, unknown> = {
      id: pack.id,
      name: "Reviewed catalogue",
      sourceId: "reviewed-catalogue",
      enabledByDefault: true,
      version: "reviewed-runtime/1",
    };
    for (const [key, value] of Object.entries(pack))
      if (Array.isArray(value))
        result[key] = filter(`pack:${pack.id}:${key}`, value);
    return result;
  }) as unknown as UsableContentExport["rulesDataSet"]["packs"];
  // Current consumers index several kinds by display name. Never silently lose a
  // distinct edition/variant through that legacy interface during activation.
  const collections = new Set(
    packs.flatMap((pack) =>
      Object.entries(pack)
        .filter(([, value]) => Array.isArray(value))
        .map(([key]) => key),
    ),
  );
  for (const collection of collections) {
    const rows = packs.flatMap(
      (pack) =>
        (pack as unknown as Record<string, unknown[]>)[collection] ?? [],
    ) as Record<string, unknown>[];
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const row of rows) {
      if (
        collection === "classes" &&
        row.spellcasting &&
        ["sorcerer", "cleric", "druid", "paladin", "ranger"].includes(
          String(row.name).toLowerCase(),
        )
      )
        throw new Error(
          "R17 verified class progression policy is required before runtime activation",
        );
      const id = releaseRecordId(`normalized:${collection}`, row);
      const name = String(row.name ?? "")
        .normalize("NFKC")
        .trim()
        .toLowerCase();
      if (ids.has(id) || (name && names.has(name)))
        throw new Error(
          `Ambiguous runtime lookup requires review: ${collection}`,
        );
      ids.add(id);
      names.add(name);
      const normalizedRow = (
        normalized as unknown as Record<string, Record<string, unknown>[]>
      )[collection]?.find(
        (r) => releaseRecordId(`normalized:${collection}`, r) === id,
      );
      if (normalizedRow)
        for (const [field, value] of Object.entries(row)) {
          if (
            field !== "pack" &&
            field in normalizedRow &&
            JSON.stringify(normalizedRow[field]) !== JSON.stringify(value)
          )
            throw new Error(
              `Conflicting retained copies require review: ${collection}.${field}`,
            );
        }
    }
  }
  const byKind = Object.fromEntries(
    Object.entries(normalizedKinds).map(([collection, kind]) => [
      kind,
      normalized[collection as keyof typeof normalized].length,
    ]),
  ) as UsableContentExport["summary"]["byKind"];
  const generatedAt = new Date().toISOString();
  const artifact: UsableContentExport = {
    schemaVersion: input.schemaVersion,
    generatedAt,
    summary: {
      total: Object.values(byKind).reduce((n, v) => n + v, 0),
      byKind,
      byOrigin,
    },
    normalized,
    rulesDataSet: {
      schemaVersion: input.rulesDataSet.schemaVersion,
      generatedAt,
      packs,
      sources: [
        {
          id: "reviewed-catalogue",
          name: "Reviewed catalogue",
          publisher: "See record evidence",
          type: "first-party",
          license: "unknown",
        },
      ],
    },
    notes: [
      "Staging reviewed catalogue. Unavailable identifiers preserve reference inventory without retained source content.",
    ],
  };
  manifest.evidence = [...usedEvidence].sort().map((id) => registry.get(id)!);
  manifest.contentHash = hash(JSON.stringify(artifact));
  return { ...artifact, catalogueManifest: manifest };
}

export { verifyRuntimeRelease } from "./runtime-release-verification";
