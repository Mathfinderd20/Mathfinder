import { createHash } from "node:crypto";
import type { SpellDefinition } from "@mathfinder/rules-engine";

export const PARSER_VERSION = "1.2.0";
export const SCHEMA_VERSION = "1.0.0";
export const STAGING_PROJECT = "pkupqzdnefnjwndwzhdr";
export type EligibilityStatus =
  "eligible" | "excluded" | "unknown" | "approved-exception";
export interface Evidence {
  id: string;
  status: EligibilityStatus;
  publisher?: string;
  work?: string;
  license?: string;
  copyrightNotice?: string;
  attribution?: string;
  references: string[];
  // Exact record URL or exact field; never a domain or loose text match.
  url: string;
  field?: string;
  exception?: "savage-company";
  reviewedBy?: string;
}
export interface Identity {
  system: "pathfinder";
  edition: "1e";
  kind: "spell";
  name: string;
  publication?: string;
  variant?: string;
}
export interface SpellPayload extends Omit<SpellDefinition, "id" | "pack"> {
  identity: Identity;
  levelText?: string;
  subschool?: string;
  descriptors?: string[];
  target?: string;
  effect?: string;
  area?: string;
  descriptionHtml?: string;
  exceptionalText?: string;
  copyrightNotice?: string;
}
export interface Warning {
  field: string;
  code: string;
  severity: "error" | "warning";
}
export interface ParsedPage {
  extracted: Record<string, unknown>;
  payload: SpellPayload;
  raw: string;
  warnings: Warning[];
  parser: string;
  parserVersion: string;
  schemaVersion: string;
}
export interface Contribution {
  value: unknown;
  evidenceId: string;
  authority: "baseline" | "enrichment" | "correction";
  correction?: {
    approvalId: string;
    appliesToIdentity: string;
    field: string;
    references: string[];
  };
}
export interface CanonicalState {
  id: string;
  identity: Identity;
  revision: number;
  fields: Record<string, Contribution>;
  baseline: Record<string, Contribution>;
  protectedFields: string[];
  canonicalHash?: string;
}
export type ReviewOutcome =
  | "addition"
  | "enrichment"
  | "correction"
  | "unchanged"
  | "conflict"
  | "quarantine"
  | "exclusion";
export interface MergePlan {
  outcome: ReviewOutcome;
  expectedRevision: number;
  changes: Record<string, Contribution>;
  conflicts: string[];
  reasons: Record<string, string>;
}
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function identityKey(identity: Identity): string | undefined {
  // An explicit "base" variant must be established by review; absence is unknown.
  if (!identity.publication || !identity.variant || !identity.name.trim())
    return undefined;
  return JSON.stringify([
    identity.system,
    identity.edition,
    identity.kind,
    identity.name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " "),
    identity.publication.trim().toLowerCase(),
    identity.variant.trim().toLowerCase(),
  ]);
}
export function missing(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && !value.trim())
  );
}
export function needsReprocessing(
  previous: { hash: string; parserVersion: string; schemaVersion: string },
  next: typeof previous,
) {
  // Versions are opaque identities. A rollback and 1.9 -> 1.10 both need reprocessing.
  return (
    previous.hash !== next.hash ||
    previous.parserVersion !== next.parserVersion ||
    previous.schemaVersion !== next.schemaVersion
  );
}
export function eligibility(evidence: Evidence | undefined): EligibilityStatus {
  if (!evidence || !evidence.reviewedBy || !evidence.references.length)
    return "unknown";
  if (evidence.status === "approved-exception") {
    return evidence.exception === "savage-company" &&
      evidence.publisher === "SHM Publishing" &&
      evidence.work === "Savage Company"
      ? "approved-exception"
      : "unknown";
  }
  if (
    evidence.status === "eligible" &&
    (!evidence.license ||
      !evidence.work ||
      !evidence.publisher ||
      !evidence.attribution)
  )
    return "unknown";
  return evidence.status;
}
export function mergeFields(
  current: CanonicalState | undefined,
  identity: Identity,
  incoming: Record<string, Contribution>,
  evidence: Map<string, Evidence>,
  warnings: Warning[],
): MergePlan {
  const plan: MergePlan = {
    outcome: current ? "unchanged" : "addition",
    expectedRevision: current?.revision ?? 0,
    changes: {},
    conflicts: [],
    reasons: {},
  };
  const key = identityKey(identity);
  if (
    !key ||
    (current && identityKey(current.identity) !== key) ||
    (!current && warnings.some((w) => w.field === "classes")) ||
    warnings.some((w) => w.severity === "error")
  ) {
    return {
      ...plan,
      outcome: "quarantine",
      conflicts: ["identity-or-validation"],
    };
  }
  for (const [field, candidate] of Object.entries(incoming)) {
    const status = eligibility(evidence.get(candidate.evidenceId));
    if (status === "excluded" || status === "unknown") {
      plan.conflicts.push(field);
      plan.reasons[field] = status;
      continue;
    }
    if (warnings.some((w) => w.field === field) || missing(candidate.value))
      continue;
    const existing = current?.fields[field];
    if (
      existing &&
      JSON.stringify(existing.value) === JSON.stringify(candidate.value) &&
      !(
        candidate.authority === "correction" &&
        candidate.correction?.approvalId &&
        candidate.correction.approvalId !== existing.correction?.approvalId
      )
    )
      continue;
    if (current?.protectedFields.includes(field)) {
      plan.conflicts.push(field);
      plan.reasons[field] = "protected";
      continue;
    }
    const correction =
      candidate.authority === "correction" &&
      candidate.correction?.approvalId &&
      candidate.correction.appliesToIdentity === key &&
      candidate.correction.field === field &&
      candidate.correction.references.length > 0;
    if (existing && !missing(existing.value) && !correction) {
      // Baseline refresh never replaces an approved correction, even if the baseline changed.
      if (
        existing.authority === "correction" &&
        candidate.authority === "baseline"
      ) {
        plan.reasons[field] = "approved-correction-preserved";
        continue;
      }
      plan.conflicts.push(field);
      plan.reasons[field] = "nonempty-conflict";
      continue;
    }
    plan.changes[field] = candidate;
    plan.reasons[field] = correction
      ? "approved-applicable-correction"
      : "missing-value";
  }
  if (plan.conflicts.length)
    plan.outcome = Object.values(plan.reasons).includes("unknown")
      ? "quarantine"
      : Object.values(plan.reasons).includes("excluded")
        ? "exclusion"
        : "conflict";
  else if (current && Object.keys(plan.changes).length)
    plan.outcome = Object.values(plan.changes).some(
      (c) => c.authority === "correction",
    )
      ? "correction"
      : "enrichment";
  return plan;
}
