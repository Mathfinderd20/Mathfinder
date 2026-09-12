import {
  eligibility,
  identityKey,
  type CanonicalState,
  type Evidence,
} from "./model";

/** Review packet only. Execution requires an inspected reference manifest and explicit user decision. */
export function planConsolidation(
  survivor: CanonicalState,
  duplicate: CanonicalState,
  registry: Map<string, Evidence>,
  references: Array<{
    store: string;
    recordId: string;
    path: string;
    targetId: string;
  }>,
) {
  if (
    !identityKey(survivor.identity) ||
    identityKey(survivor.identity) !== identityKey(duplicate.identity)
  )
    throw new Error("Distinct or ambiguous identities cannot consolidate");
  if (survivor.id === duplicate.id) throw new Error("Already the same record");
  const conflicts = Object.keys(duplicate.fields).filter(
    (field) =>
      survivor.fields[field] &&
      JSON.stringify(survivor.fields[field]?.value) !==
        JSON.stringify(duplicate.fields[field]?.value),
  );
  const filter = (fields: CanonicalState["fields"]) =>
    Object.fromEntries(
      Object.entries(fields).filter(([, c]) =>
        ["eligible", "approved-exception"].includes(
          eligibility(registry.get(c.evidenceId)),
        ),
      ),
    );
  const eligibleSnapshot = (state: CanonicalState) => ({
    ...state,
    fields: filter(state.fields),
    baseline: filter(state.baseline),
  });
  return {
    status: "requires-explicit-review",
    survivorId: survivor.id,
    duplicateId: duplicate.id,
    revisions: [survivor.revision, duplicate.revision],
    conflicts,
    proposedAlias: { from: duplicate.id, to: survivor.id },
    referenceUpdates: references
      .filter((r) => r.targetId === duplicate.id)
      .map((r) => ({ ...r, proposedTargetId: survivor.id })),
    recovery: {
      survivor: eligibleSnapshot(survivor),
      duplicate: eligibleSnapshot(duplicate),
    },
    prerequisites: [
      "complete staging reference inventory",
      "resolve field conflicts and protected edits",
      "approved canonical/alias transaction",
      "verify every reference store and cache",
      "no excluded text in recovery snapshots",
    ],
  };
}
