import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import "./ingestion.css";

interface Job {
  id: string;
  url: string;
  phase: string;
  discovery_complete: number;
  limit_reason: string | null;
}
interface Entry {
  id: number;
  url: string;
  kind: string;
  state: string;
  attempts: number;
  error_code: string | null;
  held?: {
    status: string;
    payload: Record<string, unknown> | null;
    extracted?: Record<string, unknown> | null;
    warnings: Array<{ field: string; code: string }>;
    parserVersion: string;
    promotedId?: string;
    corrections?: Array<{
      approval_id: string;
      field: string;
      status: string;
      authority_reference: string;
    }>;
  };
  plan?: {
    outcome: string;
    changes: Record<string, { value: unknown }>;
    conflicts: string[];
    reasons: Record<string, string>;
  };
  planHash?: string;
}
async function api<T>(path: string, data?: unknown): Promise<T> {
  const base = import.meta.env.VITE_INGESTION_API_URL;
  if (!base)
    throw new Error(
      "The staging ingestion service has not been configured yet.",
    );
  if (!supabase) throw new Error("Sign in to staging to manage imports.");
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) throw new Error("Sign in to staging to manage imports.");
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${auth.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Import request failed");
  return result;
}

export function IngestionPage() {
  const [url, setUrl] = useState("https://www.d20pfsrd.com/magic/all-spells/");
  const [mode, setMode] = useState("directory");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<string>();
  const [job, setJob] = useState<Job>();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [promotionEnabled, setPromotionEnabled] = useState(false);
  const [filter, setFilter] = useState("all");
  const refresh = useCallback(async () => {
    const list = await api<{ jobs: Job[]; promotionEnabled: boolean }>("/jobs");
    setJobs(list.jobs);
    setPromotionEnabled(list.promotionEnabled);
    if (selected) {
      const detail = await api<{ job: Job; entries: Entry[] }>(
        `/jobs/${selected}`,
      );
      setJob(detail.job);
      setEntries(detail.entries);
    }
  }, [selected]);
  useEffect(() => {
    let active = true;
    const update = () => {
      void refresh().catch((e) => {
        if (active) setError(e.message);
      });
    };
    update();
    const timer = setInterval(update, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refresh]);
  async function action(path: string, data: unknown = {}) {
    setBusy(true);
    setError(undefined);
    try {
      const result = await api<{ id?: string; jobId?: string }>(path, data);
      if (path === "/jobs") setSelected(result.id);
      else if (result.jobId) setSelected(result.jobId);
      else await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  const details = entries.filter((e) => e.kind === "detail");
  const outcomes = [
    "addition",
    "enrichment",
    "correction",
    "unchanged",
    "conflict",
    "quarantine",
    "exclusion",
  ];
  return (
    <main className="ingestion-page">
      <header>
        <Link to="/">← Characters</Link>
        <p className="ingestion-eyebrow">STAGING · CATALOGUE ADMINISTRATION</p>
        <h1>Catalogue imports</h1>
        <p>
          Discover spell pages, inspect a sample, then import into the holding
          area for review.
        </p>
      </header>
      {error && (
        <p role="alert" className="ingestion-alert">
          {error}
        </p>
      )}
      <section className="ingestion-panel">
        <h2>Discover spells</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action("/jobs", { url, mode });
          }}
        >
          <label>
            Source
            <select disabled>
              <option>d20PFSRD · Pathfinder 1e spells</option>
            </select>
          </label>
          <label>
            Source URL
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label>
            Import mode
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="directory">Directory and detail pages</option>
              <option value="single">Single spell detail page</option>
            </select>
          </label>
          <button disabled={busy} type="submit">
            Discover and preview
          </button>
        </form>
        <p className="ingestion-muted">
          Supports spell detail pages and spell directories with linked tables
          or lists. Initial runs are limited to 100 pages. Other layouts are
          reported for review.
        </p>
      </section>
      <div className="ingestion-layout">
        <aside className="ingestion-panel">
          <h2>Import jobs</h2>
          {jobs.length === 0 && <p>No jobs to display.</p>}
          {jobs.map((j) => (
            <button
              className="ingestion-job"
              aria-pressed={selected === j.id}
              key={j.id}
              onClick={() => setSelected(j.id)}
            >
              <strong>{j.phase}</strong>
              <span>{new URL(j.url).pathname}</span>
            </button>
          ))}
        </aside>
        <section className="ingestion-panel">
          <h2>Holding area</h2>
          {!job ? (
            <p>Select a job to inspect its progress and proposed changes.</p>
          ) : (
            <>
              <p>
                <strong>{job.phase}</strong> · {details.length} candidate
                entries · {details.filter((e) => e.state === "held").length}{" "}
                extracted · {details.filter((e) => e.state === "failed").length}{" "}
                failed
              </p>
              <p>
                {job.discovery_complete
                  ? "Discovery completed within the supported scope."
                  : (job.limit_reason ??
                    "Discovery is incomplete; this is not the source’s total count.")}
              </p>
              <div className="ingestion-actions">
                {job.phase === "preview" && (
                  <button
                    disabled={busy}
                    onClick={() => void action(`/jobs/${job.id}/confirm`)}
                  >
                    Confirm import to holding area
                  </button>
                )}
                {["discover", "import", "preview"].includes(job.phase) && (
                  <button
                    disabled={busy}
                    onClick={() => void action(`/jobs/${job.id}/cancel`)}
                  >
                    Cancel job
                  </button>
                )}
                {details.some((e) => e.state === "failed") &&
                  job.phase !== "cancelled" && (
                    <button
                      disabled={busy}
                      onClick={() => void action(`/jobs/${job.id}/retry`)}
                    >
                      Retry failed entries
                    </button>
                  )}
                <button
                  disabled={busy}
                  onClick={() =>
                    void refresh().catch((e) => setError(e.message))
                  }
                >
                  Refresh
                </button>
              </div>
              {!promotionEnabled && (
                <p className="ingestion-alert">
                  Catalogue promotion is locked while the legacy transition and
                  required policy decisions await review.
                </p>
              )}
              <label>
                Review category
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All entries</option>
                  {outcomes.map((o) => (
                    <option key={o} value={o}>
                      {o} ({details.filter((e) => e.plan?.outcome === o).length}
                      )
                    </option>
                  ))}
                  <option value="failed">Failed pages</option>
                </select>
              </label>
              {details
                .filter(
                  (e) =>
                    filter === "all" ||
                    e.plan?.outcome === filter ||
                    (filter === "failed" && e.state === "failed"),
                )
                .map((entry) => (
                  <details key={entry.id} className="ingestion-entry">
                    <summary>
                      <strong>
                        {String(
                          entry.held?.payload?.name ??
                            new URL(entry.url).pathname,
                        )}
                      </strong>
                      <span>
                        {entry.held?.promotedId
                          ? "promoted"
                          : (entry.plan?.outcome ?? entry.state)}
                      </span>
                    </summary>
                    <a href={entry.url} target="_blank" rel="noreferrer">
                      View source page
                    </a>
                    {entry.error_code && (
                      <p role="status">
                        {entry.error_code} · attempts: {entry.attempts}
                      </p>
                    )}
                    {entry.held && (
                      <>
                        <p>
                          Eligibility: {entry.held.status} · Parser{" "}
                          {entry.held.parserVersion}
                        </p>
                        {entry.held.warnings.length > 0 && (
                          <ul>
                            {entry.held.warnings.map((w, i) => (
                              <li key={i}>
                                {w.field}: {w.code}
                              </li>
                            ))}
                          </ul>
                        )}
                        {entry.plan?.conflicts.length ? (
                          <p>
                            Review required: {entry.plan.conflicts.join(", ")}
                          </p>
                        ) : null}
                        <details>
                          <summary>Normalized fields</summary>
                          <pre>
                            {JSON.stringify(entry.held.payload, null, 2)}
                          </pre>
                        </details>
                        <details>
                          <summary>Extracted source fields</summary>
                          <pre>
                            {JSON.stringify(entry.held.extracted, null, 2)}
                          </pre>
                        </details>
                        <details>
                          <summary>Proposed field changes and reasons</summary>
                          <pre>{JSON.stringify(entry.plan, null, 2)}</pre>
                        </details>
                        <details>
                          <summary>Verified errata review</summary>
                          <p>
                            Approve a field only after verifying authoritative
                            correction evidence for this same entity,
                            publication, edition and variant. Protected edits
                            still require separate review.
                          </p>
                          {entry.held.corrections?.map((c) => (
                            <p key={c.approval_id}>
                              {c.field}: {c.status} · {c.authority_reference}
                              {c.status === "approved" && (
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    void action(
                                      `/entries/${entry.id}/withdraw-correction`,
                                      { approvalId: c.approval_id },
                                    )
                                  }
                                >
                                  Withdraw approval; require catalogue review
                                </button>
                              )}
                            </p>
                          ))}
                          {!entry.held.promotedId && (
                            <CorrectionReview
                              entryId={entry.id}
                              busy={busy}
                              onSave={action}
                            />
                          )}
                        </details>
                        <div className="ingestion-actions">
                          <button
                            disabled={busy || entry.held.status === "excluded"}
                            onClick={() =>
                              void action(`/entries/${entry.id}/reprocess`)
                            }
                          >
                            Reprocess saved source
                          </button>
                          <button
                            disabled={
                              busy ||
                              !promotionEnabled ||
                              job.phase !== "review" ||
                              !!entry.held.promotedId ||
                              ![
                                "addition",
                                "enrichment",
                                "correction",
                                "unchanged",
                              ].includes(entry.plan?.outcome ?? "")
                            }
                            onClick={() =>
                              void action(`/entries/${entry.id}/promote`, {
                                planHash: entry.planHash,
                              })
                            }
                          >
                            Approve reviewed changes
                          </button>
                        </div>
                        {!entry.held.promotedId && (
                          <IdentityReview
                            entryId={entry.id}
                            busy={busy}
                            onSave={action}
                          />
                        )}
                      </>
                    )}
                  </details>
                ))}
            </>
          )}
        </section>
      </div>
      <EligibilityReview busy={busy} onSave={action} />
    </main>
  );
}

function IdentityReview({
  entryId,
  busy,
  onSave,
}: {
  entryId: number;
  busy: boolean;
  onSave: (path: string, data: unknown) => Promise<void>;
}) {
  const [publication, setPublication] = useState("");
  const [variant, setVariant] = useState("");
  return (
    <details>
      <summary>Resolve publication and variant</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(`/entries/${entryId}/identity`, { publication, variant });
        }}
      >
        <label>
          Evidence-supported publication
          <input
            required
            value={publication}
            onChange={(e) => setPublication(e.target.value)}
          />
        </label>
        <label>
          Verified variant (use “base” only when established)
          <input
            required
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
          />
        </label>
        <button disabled={busy}>Save identity review</button>
      </form>
    </details>
  );
}
function CorrectionReview({
  entryId,
  busy,
  onSave,
}: {
  entryId: number;
  busy: boolean;
  onSave: (path: string, data: unknown) => Promise<void>;
}) {
  const [field, setField] = useState("castingTime");
  const [authorityReference, setAuthorityReference] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(`/entries/${entryId}/correction`, {
          field,
          authorityReference,
        });
      }}
    >
      <label>
        Corrected field
        <select value={field} onChange={(e) => setField(e.target.value)}>
          {[
            ["castingTime", "Casting time"],
            ["components", "Components"],
            ["range", "Range"],
            ["target", "Target"],
            ["effect", "Effect"],
            ["area", "Area"],
            ["duration", "Duration"],
            ["savingThrow", "Saving throw"],
            ["spellResistance", "Spell resistance"],
            ["classes", "Class levels"],
            ["levelText", "Class-level text"],
            ["school", "School"],
            ["description", "Description"],
            ["descriptionHtml", "Formatted description"],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Authority and applicability evidence URL
        <input
          type="url"
          required
          value={authorityReference}
          onChange={(e) => setAuthorityReference(e.target.value)}
        />
      </label>
      <label>
        <input type="checkbox" required />I verified that this is an applicable
        correction supported by eligible evidence.
      </label>
      <button disabled={busy}>Record field correction approval</button>
    </form>
  );
}
function EligibilityReview({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (path: string, data: unknown) => Promise<void>;
}) {
  const [data, setData] = useState({
    id: "",
    url: "",
    status: "unknown",
    publisher: "",
    work: "",
    license: "",
    attribution: "",
    copyrightNotice: "",
    reference: "",
    exception: "",
    field: "",
  });
  return (
    <details className="ingestion-panel">
      <summary>Source eligibility registry</summary>
      <p>
        Record reviewed evidence for an exact record URL. Public access and a
        successful parse do not establish eligibility. Savage Company retention
        is a separate exception.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const { reference, exception, field, ...values } = data;
          void onSave("/registry", {
            ...values,
            references: reference.split("\n").filter(Boolean),
            exception: exception || undefined,
            field: field || undefined,
          });
        }}
      >
        <label>
          Field scope (leave empty for the whole record)
          <input
            value={data.field}
            onChange={(e) => setData({ ...data, field: e.target.value })}
          />
        </label>
        {(
          [
            "id",
            "url",
            "publisher",
            "work",
            "license",
            "attribution",
            "copyrightNotice",
          ] as const
        ).map((key) => (
          <label key={key}>
            {key}
            <input
              required={["id", "url"].includes(key)}
              value={data[key]}
              onChange={(e) => setData({ ...data, [key]: e.target.value })}
            />
          </label>
        ))}
        <label>
          Classification
          <select
            value={data.status}
            onChange={(e) => setData({ ...data, status: e.target.value })}
          >
            {["unknown", "eligible", "excluded", "approved-exception"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Exception
          <select
            value={data.exception}
            onChange={(e) => setData({ ...data, exception: e.target.value })}
          >
            <option value="">No exception</option>
            <option value="savage-company">
              Savage Company · SHM Publishing
            </option>
          </select>
        </label>
        <label>
          Evidence references (one per line)
          <textarea
            required
            value={data.reference}
            onChange={(e) => setData({ ...data, reference: e.target.value })}
          />
        </label>
        <button disabled={busy}>Record eligibility review</button>
      </form>
    </details>
  );
}
