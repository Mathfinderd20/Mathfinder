import {
  eligibility,
  hash,
  type CanonicalState,
  type Contribution,
  type Evidence,
} from "./model";
import type { IngestionStore } from "./store";

export interface CleanupImpact {
  evidenceId: string;
  excluded: boolean;
  canonical: Array<{
    entityKey: string;
    action: "reconstruct" | "unavailable" | "manual-review";
  }>;
  holdingCopies: number;
  pageCacheCopies: number;
  references: "not-inspected";
  externalCopies: string[];
}
export function cleanupImpact(
  store: IngestionStore,
  evidence: Evidence,
): CleanupImpact {
  const excluded = eligibility(evidence) === "excluded";
  const rows = store.db
    .prepare(
      "SELECT entity_key,origin FROM content_entities WHERE source_url=? UNION SELECT entity_key,'scrape' AS origin FROM catalogue_provenance WHERE EXISTS (SELECT 1 FROM json_tree(state_json) WHERE key='evidenceId' AND value=?)",
    )
    .all(evidence.url, evidence.id) as { entity_key: string; origin: string }[];
  return {
    evidenceId: evidence.id,
    excluded,
    canonical: rows.map((row) => {
      const stateRow = store.db
        .prepare(
          "SELECT state_json FROM catalogue_provenance WHERE entity_key=?",
        )
        .get(row.entity_key) as { state_json: string } | undefined;
      const state = stateRow
        ? (JSON.parse(stateRow.state_json) as CanonicalState)
        : undefined;
      const actual = store.db
        .prepare("SELECT payload_json FROM content_entities WHERE entity_key=?")
        .get(row.entity_key) as { payload_json: string };
      const externalEdit =
        state?.canonicalHash &&
        state.canonicalHash !== hash(actual.payload_json);
      return {
        entityKey: row.entity_key,
        action:
          row.origin !== "scrape" || externalEdit
            ? "manual-review"
            : state
              ? "reconstruct"
              : "unavailable",
      };
    }),
    holdingCopies: (
      store.db
        .prepare("SELECT count(*) n FROM catalogue_holding WHERE source_url=?")
        .get(evidence.url) as { n: number }
    ).n,
    pageCacheCopies: (
      store.db
        .prepare("SELECT count(*) n FROM page_cache WHERE url=?")
        .get(evidence.url) as { n: number }
    ).n,
    references: "not-inspected",
    externalCopies: [
      "committed and built full/split runtime JSON",
      "browser Cache Storage and account caches",
      "Git history",
      "Docker images and Cloudflare deployments",
      "database dumps and hosted backups",
      "exports on other hosts",
      "local quarantine fixtures and runtime-review comparison snapshots",
    ],
  };
}
export function purgeEvidence(
  store: IngestionStore,
  evidence: Evidence,
  authorization: {
    target: "isolated-test" | "verified-staging";
    inventoryReview: string;
  },
) {
  if (
    !authorization.inventoryReview ||
    !["isolated-test", "verified-staging"].includes(authorization.target)
  )
    throw new Error("Reviewed staging inventory required");
  if (eligibility(evidence) !== "excluded")
    throw new Error("Only confirmed excluded evidence can authorize purge");
  const registered = store.registry().get(evidence.id);
  if (
    !registered ||
    registered.url !== evidence.url ||
    registered.field !== evidence.field
  )
    throw new Error("Exact registered evidence scope required");
  const impact = cleanupImpact(store, evidence);
  if (impact.canonical.some((c) => c.action === "manual-review"))
    throw new Error("Origin ambiguous; manual review required");
  store.db
    .transaction(() => {
      const registry = store.registry();
      registry.set(evidence.id, evidence);
      store.db
        .prepare("UPDATE catalogue_registry SET evidence_json=? WHERE id=?")
        .run(JSON.stringify(evidence), evidence.id);
      const usable = (c: Contribution | undefined) =>
        c &&
        c.evidenceId !== evidence.id &&
        ["eligible", "approved-exception"].includes(
          eligibility(registry.get(c.evidenceId)),
        );
      for (const affected of impact.canonical) {
        const row = store.db
          .prepare(
            "SELECT state_json FROM catalogue_provenance WHERE entity_key=?",
          )
          .get(affected.entityKey) as { state_json: string } | undefined;
        const state = row
          ? (JSON.parse(row.state_json) as CanonicalState)
          : undefined;
        if (state) {
          for (const [field, c] of Object.entries(state.fields))
            if (c.evidenceId === evidence.id) {
              const baseline = state.baseline[field];
              if (usable(baseline)) state.fields[field] = baseline!;
              else delete state.fields[field];
            }
          for (const [field, c] of Object.entries(state.baseline))
            if (c.evidenceId === evidence.id) delete state.baseline[field];
          state.revision++;
          store.db
            .prepare(
              "UPDATE catalogue_provenance SET state_json=?,revision=? WHERE entity_key=?",
            )
            .run(JSON.stringify(state), state.revision, affected.entityKey);
        }
        const values = state
          ? Object.fromEntries(
              Object.entries(state.fields).map(([field, c]) => [
                field,
                c.value,
              ]),
            )
          : {};
        const id = affected.entityKey.slice(
          affected.entityKey.indexOf(":") + 1,
        );
        // Preserve the ID. No FK cascade and no write to player/campaign JSON.
        const payload =
          values.name && values.description
            ? { ...values, id, pack: "d20pfsrd-approved-spells" }
            : {
                id,
                name: "Unavailable catalogue record",
                unavailable: true,
                classes: [],
              };
        store.db
          .prepare(
            "UPDATE content_entities SET name=?,payload_json=?,updated_at=? WHERE entity_key=?",
          )
          .run(
            payload.name,
            JSON.stringify(payload),
            new Date().toISOString(),
            affected.entityKey,
          );
        if (state) {
          state.canonicalHash = hash(JSON.stringify(payload));
          store.db
            .prepare(
              "UPDATE catalogue_provenance SET state_json=? WHERE entity_key=?",
            )
            .run(JSON.stringify(state), affected.entityKey);
        }
        // Whole histories are removed when they contain excluded contributions, including before snapshots.
        store.db
          .prepare(
            "UPDATE catalogue_history SET detail_json=NULL WHERE entity_key=?",
          )
          .run(affected.entityKey);
        store.db
          .prepare(
            "INSERT INTO catalogue_purge_audit(evidence_id,entity_key,action,created_at) VALUES(?,?,?,?)",
          )
          .run(
            evidence.id,
            affected.entityKey,
            values.name && values.description ? "reconstructed" : "unavailable",
            new Date().toISOString(),
          );
      }
      store.db
        .prepare(
          "DELETE FROM catalogue_exceptions WHERE entry_id IN (SELECT entry_id FROM catalogue_holding WHERE source_url=?)",
        )
        .run(evidence.url);
      store.db
        .prepare(
          "UPDATE catalogue_holding SET raw=NULL,extracted_json=NULL,parsed_json=NULL,warnings_json='[]',plan_json=NULL,status='excluded' WHERE source_url=?",
        )
        .run(evidence.url);
      store.db.prepare("DELETE FROM page_cache WHERE url=?").run(evidence.url);
      // Legacy run metadata can contain unstructured response/error material; retain only run identity/status/times.
      store.db.prepare("UPDATE ingestion_runs SET meta_json=NULL").run();
    })
    .immediate();
  return { ...impact, databaseCopiesPurged: true, externalCopiesPurged: false };
}
