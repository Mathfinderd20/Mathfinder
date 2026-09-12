import type { RulesDataSet, RulesPack } from "@mathfinder/rules-data";
import type { SpellDefinition } from "@mathfinder/rules-engine";
import type { UsableContentExport } from "../exporter";
import { eligibility, hash, type CanonicalState } from "./model";
import type { IngestionStore } from "./store";

/** Explicit export, never called by scrape/refresh. Uses the application's existing JSON contract. */
export function buildApprovedExport(
  store: IngestionStore,
): UsableContentExport & { manifest: unknown } {
  const registry = store.registry();
  const spells: SpellDefinition[] = [];
  const unavailable: string[] = [];
  const rows = store.db
    .prepare(
      "SELECT entity_key,entity_id,kind,payload_json FROM content_entities",
    )
    .all() as {
    entity_key: string;
    entity_id: string;
    kind: string;
    payload_json: string;
  }[];
  // Until non-spell adapters have an equivalent provenance contract, they cannot be exported through this path.
  if (rows.some((row) => row.kind !== "spell"))
    throw new Error(
      "Non-spell export transition requires reviewed migration; do not discard existing entity types",
    );
  for (const row of rows) {
    const provenance = store.db
      .prepare("SELECT state_json FROM catalogue_provenance WHERE entity_key=?")
      .get(row.entity_key) as { state_json: string } | undefined;
    const state = provenance
      ? (JSON.parse(provenance.state_json) as CanonicalState)
      : undefined;
    const payload = JSON.parse(row.payload_json) as SpellDefinition;
    const approved =
      !payload.unavailable &&
      state &&
      state.canonicalHash === hash(row.payload_json) &&
      Object.values(state.fields).every(
        (c) =>
          ["eligible", "approved-exception"].includes(
            eligibility(registry.get(c.evidenceId)),
          ) &&
          (c.authority !== "correction" ||
            store.correctionActive(c.correction?.approvalId)),
      );
    if (!approved) {
      unavailable.push(row.entity_id);
      spells.push({
        id: row.entity_id,
        name: "Unavailable catalogue record",
        pack: "d20pfsrd-approved-spells",
        classes: [],
        unavailable: true,
      });
    } else spells.push(payload);
  }
  const pack: RulesPack = {
    id: "d20pfsrd-approved-spells",
    name: "Reviewed Pathfinder spells",
    sourceId: "reviewed-catalogue",
    enabledByDefault: true,
    version: "1.0.0",
    classes: [],
    archetypes: [],
    bloodlines: [],
    kineticistElements: [],
    phantomEmotionalFocuses: [],
    eidolonSubtypes: [],
    hexes: [],
    blessings: [],
    trapOptions: [],
    buildGuides: [],
    classFeatures: [],
    feats: [],
    races: [],
    skills: [],
    spells,
    weapons: [],
    magicItems: [],
    domains: [],
    schools: [],
    spellEffects: [],
  };
  const rulesDataSet: RulesDataSet = {
    schemaVersion: "0.1.0",
    generatedAt: new Date().toISOString(),
    sources: [
      {
        id: "reviewed-catalogue",
        name: "Reviewed catalogue",
        publisher: "See record evidence",
        type: "first-party",
        license: "unknown",
        notes:
          "Licensing is per-record/field. Savage Company exceptions do not imply OGL status.",
      },
    ],
    packs: [pack],
  };
  const byKind = {
    class: 0,
    archetype: 0,
    "class-feature": 0,
    feat: 0,
    race: 0,
    skill: 0,
    spell: spells.length,
    weapon: 0,
    armor: 0,
    gear: 0,
    "magic-item": 0,
    domain: 0,
    school: 0,
    "spell-effect": 0,
  };
  return {
    schemaVersion: "0.1.0",
    generatedAt: rulesDataSet.generatedAt!,
    summary: {
      total: spells.length,
      byKind,
      byOrigin: { seed: 0, scrape: spells.length },
    },
    normalized: {
      classes: [],
      archetypes: [],
      classFeatures: [],
      feats: [],
      races: [],
      skills: [],
      spells,
      weapons: [],
      armor: [],
      mundaneEquipment: [],
      magicItems: [],
      domains: [],
      schools: [],
      spellEffects: [],
    },
    rulesDataSet,
    notes: [
      "Staging spell-only export. Not a replacement for the full legacy app catalogue until the all-entity transition is reviewed.",
    ],
    manifest: {
      schema: "ingestion-export/1",
      unavailable,
      evidence: [...registry.values()].filter((e) =>
        ["eligible", "approved-exception"].includes(eligibility(e)),
      ),
      recordIds: spells.map((s) => s.id),
      contentHash: hash(JSON.stringify(spells)),
    },
  };
}
