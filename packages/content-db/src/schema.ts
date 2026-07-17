import type Database from "better-sqlite3";

export function createSchema(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      publisher TEXT NOT NULL,
      product TEXT,
      type TEXT NOT NULL,
      license TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS rules_packs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled_by_default INTEGER NOT NULL,
      source_id TEXT NOT NULL,
      version TEXT NOT NULL,
      FOREIGN KEY (source_id) REFERENCES content_sources(id)
    );

    CREATE TABLE IF NOT EXISTS content_entities (
      entity_key TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      name TEXT NOT NULL,
      pack_id TEXT,
      origin TEXT NOT NULL,
      external_source TEXT,
      source_url TEXT,
      source_page INTEGER,
      payload_json TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (pack_id) REFERENCES rules_packs(id)
    );
    CREATE INDEX IF NOT EXISTS idx_content_entities_kind ON content_entities(kind);
    CREATE INDEX IF NOT EXISTS idx_content_entities_name ON content_entities(name);
    CREATE INDEX IF NOT EXISTS idx_content_entities_pack ON content_entities(pack_id);

    CREATE TABLE IF NOT EXISTS page_cache (
      url TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      fetched_at TEXT NOT NULL,
      html TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingestion_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      meta_json TEXT
    );
  `);
}
