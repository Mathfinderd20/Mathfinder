-- Additive ingestion holding tables. Applied only to an explicitly isolated local/staging SQLite volume.
CREATE TABLE IF NOT EXISTS catalogue_registry (
  id TEXT PRIMARY KEY, url TEXT NOT NULL, field TEXT, evidence_json TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS registry_scope ON catalogue_registry(url, COALESCE(field, ''));
CREATE TABLE IF NOT EXISTS catalogue_jobs (
  id TEXT PRIMARY KEY, created_by TEXT NOT NULL, source TEXT NOT NULL,
  url TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('single','directory')),
  phase TEXT NOT NULL CHECK(phase IN ('discover','preview','import','review','cancelled')),
  discovery_complete INTEGER NOT NULL DEFAULT 0, limit_reason TEXT,
  max_entries INTEGER NOT NULL CHECK(max_entries BETWEEN 1 AND 100),
  policy_json TEXT,
  created_at TEXT NOT NULL, confirmed_at TEXT, cancelled_at TEXT,
  active_ms INTEGER NOT NULL DEFAULT 0, phase_started_ms INTEGER
);
CREATE TABLE IF NOT EXISTS catalogue_worker_lock (
  id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT, expires_ms INTEGER NOT NULL
);
INSERT OR IGNORE INTO catalogue_worker_lock VALUES(1,NULL,0);
CREATE TABLE IF NOT EXISTS catalogue_registry_history (
  id INTEGER PRIMARY KEY, evidence_id TEXT NOT NULL, evidence_json TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalogue_entries (
  id INTEGER PRIMARY KEY, job_id TEXT NOT NULL REFERENCES catalogue_jobs(id),
  url TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('detail','directory')), depth INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','running','held','failed','skipped')),
  lease_token TEXT, lease_until INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
  error_code TEXT, UNIQUE(job_id,url)
);
CREATE TABLE IF NOT EXISTS catalogue_holding (
  entry_id INTEGER PRIMARY KEY REFERENCES catalogue_entries(id),
  source_url TEXT NOT NULL, retrieved_at TEXT NOT NULL, content_hash TEXT NOT NULL,
  parser TEXT NOT NULL, parser_version TEXT NOT NULL, schema_version TEXT NOT NULL,
  raw TEXT, extracted_json TEXT, parsed_json TEXT, warnings_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('eligible','excluded','unknown','approved-exception')),
  evidence_id TEXT REFERENCES catalogue_registry(id), plan_json TEXT,
  reviewed_by TEXT, reviewed_at TEXT, promoted_id TEXT
);
-- Provenance overlay for the EXISTING content_entities IDs, not a second canonical payload table.
CREATE TABLE IF NOT EXISTS catalogue_provenance (
  entity_key TEXT PRIMARY KEY REFERENCES content_entities(entity_key),
  identity_key TEXT NOT NULL UNIQUE, state_json TEXT NOT NULL, revision INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS catalogue_source_links (
  url TEXT PRIMARY KEY, entity_key TEXT NOT NULL REFERENCES content_entities(entity_key)
);
CREATE TABLE IF NOT EXISTS catalogue_history (
  id INTEGER PRIMARY KEY, entity_key TEXT NOT NULL, entry_id INTEGER,
  actor TEXT NOT NULL, action TEXT NOT NULL, evidence_ids_json TEXT NOT NULL,
  detail_json TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalogue_exceptions (
  id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES catalogue_entries(id),
  model TEXT, prompt_version TEXT, input_references_json TEXT NOT NULL,
  proposal_json TEXT, usage_json TEXT, validation_json TEXT,
  reviewed_by TEXT, outcome TEXT NOT NULL DEFAULT 'pending'
);
CREATE TABLE IF NOT EXISTS catalogue_purge_audit (
  id INTEGER PRIMARY KEY, evidence_id TEXT NOT NULL, entity_key TEXT,
  action TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalogue_corrections (
  approval_id TEXT PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES catalogue_entries(id),
  field TEXT NOT NULL, identity_key TEXT NOT NULL, evidence_id TEXT NOT NULL REFERENCES catalogue_registry(id),
  candidate_digest TEXT NOT NULL, authority_reference TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('approved','withdrawn')),
  reviewed_by TEXT NOT NULL, reviewed_at TEXT NOT NULL, withdrawn_by TEXT, withdrawn_at TEXT
);
