import type Database from "better-sqlite3";
import { RULES_DATA_SET, type RulesPack } from "@mathfinder/rules-data";
import type { ContentEntityKind } from "./types";

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function entityIdFor(kind: ContentEntityKind, item: unknown) {
  const candidate = item as {
    id?: string;
    key?: string;
    name?: string;
    className?: string;
    level?: number;
  };
  if (candidate.id) return candidate.id;
  if (candidate.key) return candidate.key;
  if (kind === "class-feature")
    return `${slug(candidate.className ?? "unknown")}-${candidate.level ?? 0}-${slug(candidate.name ?? "unnamed")}`;
  return slug(candidate.name ?? "unnamed");
}

function entityNameFor(kind: ContentEntityKind, item: unknown) {
  const candidate = item as { name?: string; key?: string; spellName?: string };
  if (candidate.name) return candidate.name;
  if (kind === "skill" && candidate.key) return candidate.key;
  if (kind === "spell-effect" && candidate.spellName)
    return candidate.spellName;
  return entityIdFor(kind, item);
}

function packEntities(
  pack: RulesPack,
): Array<{ kind: ContentEntityKind; item: unknown }> {
  return [
    ...pack.classes.map((item) => ({ kind: "class" as const, item })),
    ...pack.classFeatures.map((item) => ({
      kind: "class-feature" as const,
      item,
    })),
    ...pack.feats.map((item) => ({ kind: "feat" as const, item })),
    ...pack.races.map((item) => ({ kind: "race" as const, item })),
    ...pack.skills.map((item) => ({ kind: "skill" as const, item })),
    ...pack.spells.map((item) => ({ kind: "spell" as const, item })),
    ...pack.weapons.map((item) => ({ kind: "weapon" as const, item })),
    ...pack.magicItems.map((item) => ({ kind: "magic-item" as const, item })),
    ...pack.domains.map((item) => ({ kind: "domain" as const, item })),
    ...pack.schools.map((item) => ({ kind: "school" as const, item })),
    ...pack.spellEffects.map((item) => ({
      kind: "spell-effect" as const,
      item,
    })),
  ];
}

export function seedLocalRulesData(db: Database.Database) {
  const now = new Date().toISOString();
  const insertSource = db.prepare(`
    INSERT INTO content_sources (id, name, publisher, product, type, license, notes)
    VALUES (@id, @name, @publisher, @product, @type, @license, @notes)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      publisher=excluded.publisher,
      product=excluded.product,
      type=excluded.type,
      license=excluded.license,
      notes=excluded.notes
  `);
  const insertPack = db.prepare(`
    INSERT INTO rules_packs (id, name, enabled_by_default, source_id, version)
    VALUES (@id, @name, @enabled_by_default, @source_id, @version)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      enabled_by_default=excluded.enabled_by_default,
      source_id=excluded.source_id,
      version=excluded.version
  `);
  const insertEntity = db.prepare(`
    INSERT INTO content_entities (entity_key, kind, entity_id, name, pack_id, origin, external_source, source_url, source_page, payload_json, imported_at, updated_at)
    VALUES (@entity_key, @kind, @entity_id, @name, @pack_id, @origin, @external_source, @source_url, @source_page, @payload_json, @imported_at, @updated_at)
    ON CONFLICT(entity_key) DO UPDATE SET
      name=excluded.name,
      pack_id=excluded.pack_id,
      payload_json=excluded.payload_json,
      updated_at=excluded.updated_at
  `);

  const tx = db.transaction(() => {
    for (const source of RULES_DATA_SET.sources) insertSource.run(source);
    for (const pack of RULES_DATA_SET.packs) {
      insertPack.run({
        id: pack.id,
        name: pack.name,
        enabled_by_default: pack.enabledByDefault ? 1 : 0,
        source_id: pack.sourceId,
        version: pack.version,
      });
      for (const { kind, item } of packEntities(pack)) {
        const entityId = entityIdFor(kind, item);
        insertEntity.run({
          entity_key: `${kind}:${entityId}`,
          kind,
          entity_id: entityId,
          name: entityNameFor(kind, item),
          pack_id: pack.id,
          origin: "seed",
          external_source: null,
          source_url: null,
          source_page: null,
          payload_json: JSON.stringify(item),
          imported_at: now,
          updated_at: now,
        });
      }
    }
  });

  tx();
}
