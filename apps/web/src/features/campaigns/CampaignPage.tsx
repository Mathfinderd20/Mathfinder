import { CampaignCreationRulesPanel } from "./CampaignCreationRules";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { accountStorage } from "../../lib/accountCache";
import { supabase } from "../../lib/supabaseClient";
import { useCloudConnection } from "../../lib/useCloudConnection";
import { listCharacters } from "../characters/characterRepository";
import { characterIdsForCampaign, getCampaign } from "./campaignRepository";
import {
  deactivateSharedCampaign,
  formatCampaignCode,
} from "./campaignService";
import { GameMasterLayer } from "./gm/GameMasterLayer";
import { WorkspaceContext, type WorkspaceState } from "./gm/WorkspaceState";
import type { Actor } from "./gm/mockData";
import "./campaign.css";

export function CampaignPage() {
  const { campaignId = "" } = useParams();
  const connection = useCloudConnection();
  const userId = "userId" in connection ? connection.userId : undefined;
  const campaign = getCampaign(accountStorage, campaignId);
  if (connection.status !== "connected")
    return (
      <main className="route-message">
        <h1>Connect to open your campaign.</h1>
        <p>The private workspace requires a server connection.</p>
        <Link to="/">Return home</Link>
      </main>
    );
  if (!campaign || campaign.ownerId !== userId)
    return (
      <main className="route-message">
        <h1>Creator workspace</h1>
        <p>
          This workspace is currently available only to the campaign creator.
        </p>
        <Link to="/">Return home</Link>
      </main>
    );
  return (
    <LiveCampaign
      key={campaignId + userId}
      campaignId={campaignId}
      name={campaign.name}
      joinCode={campaign.joinCode}
    />
  );
}

function LiveCampaign({
  campaignId,
  name,
  joinCode,
}: {
  campaignId: string;
  name: string;
  joinCode?: string;
}) {
  const navigate = useNavigate();
  const campaign = getCampaign(accountStorage, campaignId);
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [catalog, setCatalog] = useState<Actor[]>([]);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedVersion, setSavedVersion] = useState(0);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const revision = useRef(0);
  const saved = useRef<WorkspaceState | null>(null);
  const busy = useRef(false);
  const pending = state !== null && state !== saved.current;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) throw new Error("Campaign server unavailable.");
      const { data, error: failure } = await supabase
        .from("campaign_workspaces")
        .select("state, revision")
        .eq("campaign_id", campaignId)
        .maybeSingle();
      if (failure) throw failure;
      const content = await import("../../content");
      await content.loadRuntimeContent();
      const { buildCharacter, computeSheet } =
        await import("@mathfinder/rules-engine");
      const templates: Actor[] = listCharacters(accountStorage).map(
        (character) => {
          const input = buildCharacter(
            {
              ...character.build,
              levels: character.build.levels.slice(0, character.currentLevel),
            },
            content.RUNTIME_CLASSES,
            content.RUNTIME_FEATS,
            content.RUNTIME_CLASS_FEATURES,
            content.RUNTIME_ARCHETYPES,
          );
          const sheet = computeSheet(input, {
            spellRegistry: content.RUNTIME_SPELLS,
          });
          return {
            id: character.id,
            name: character.name,
            kind: "Player",
            ancestry: character.build.race.name,
            role: sheet.descriptor.classes
              .map((entry) => entry.name)
              .join(" / "),
            level: `Level ${character.currentLevel}`,
            hp: sheet.hitPoints.total,
            maxHp: sheet.hitPoints.total,
            ac: sheet.ac.normal.total,
            initiative: 0,
            initiativeBonus: sheet.initiative.total,
            onTable: false,
            saved: true,
            dual: false,
            aware: true,
            group: "",
            stance: "Normal",
            conditions: "",
            notes: "",
          };
        },
      );
      if (cancelled) return;
      const assigned = new Set(
        characterIdsForCampaign(accountStorage, campaignId),
      );
      const initial = (data?.state as WorkspaceState | undefined) ?? {
        actors: templates.filter((actor) => assigned.has(actor.id)),
        notes: [],
        phase: "Exploration",
        round: 1,
        turnId: "",
        surprise: false,
      };
      revision.current = data?.revision ?? 0;
      saved.current = data ? initial : null;
      setCatalog(templates);
      setState(initial);
    }
    void load().catch((cause) => {
      if (!cancelled) setError(cause.message ?? "Unable to load campaign.");
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  useEffect(() => {
    if (!state || state === saved.current || error || busy.current) return;
    const timer = window.setTimeout(() => {
      busy.current = true;
      setSaving(true);
      const snapshot = state;
      void (async () => {
        try {
          if (!supabase) throw new Error("Campaign server unavailable.");
          const result = await supabase.rpc("save_campaign_workspace", {
            p_campaign_id: campaignId,
            p_revision: revision.current,
            p_state: snapshot,
          });
          if (result.error) throw result.error;
          revision.current = result.data as number;
          saved.current = snapshot;
          setSavedVersion((value) => value + 1);
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : String(
                  (cause as { message?: string }).message ?? "Save failed.",
                ),
          );
        } finally {
          busy.current = false;
          setSaving(false);
        }
      })();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [state, campaignId, error, savedVersion, saving]);

  useEffect(() => {
    function guard(event: BeforeUnloadEvent) {
      if (pending) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [pending]);

  async function copyCode() {
    setActionError("");
    try {
      await navigator.clipboard.writeText(formatCampaignCode(joinCode!));
      setCopied(true);
    } catch {
      setActionError(
        "Copy failed. Select the campaign ID and copy it manually.",
      );
    }
  }
  async function removeCampaign() {
    if (
      !window.confirm(
        "Delete this campaign? This ends member access and disables the campaign ID. Existing character builds are preserved.",
      )
    )
      return;
    setDeleting(true);
    setActionError("");
    try {
      await deactivateSharedCampaign(campaignId);
      navigate("/", { replace: true });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Delete failed.");
      setDeleting(false);
    }
  }
  const status = (
    <div
      className="gm-preview-banner"
      role={error || actionError ? "alert" : "status"}
    >
      {error ||
        actionError ||
        (!state
          ? "Connecting to campaign storage…"
          : saving
            ? "Saving…"
            : pending
              ? "Unsaved changes"
              : "All changes saved")}
      {actionError && (
        <button onClick={() => setActionError("")}>Dismiss</button>
      )}
      {error && (
        <div className="gm-actions">
          <button
            onClick={() => (state ? setError("") : window.location.reload())}
          >
            Retry
          </button>
          <button
            onClick={() => {
              if (
                !pending ||
                window.confirm("Reload and discard unsaved changes?")
              )
                window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      )}
    </div>
  );
  if (!state)
    return (
      <main className="route-message">
        <h1>{error ? "Campaign could not load" : "Loading campaign…"}</h1>
        {status}
        <Link to="/">Return home</Link>
      </main>
    );
  const actors = (state.actors ?? []) as Actor[];
  const library = [
    ...catalog,
    ...actors.filter(
      (actor) => actor.saved && !catalog.some((entry) => entry.id === actor.id),
    ),
  ].map((actor) => ({ ...actor, hp: actor.maxHp }));
  return (
    <WorkspaceContext.Provider
      value={{
        state,
        setState: (next) =>
          setState((previous) =>
            typeof next === "function" ? next(previous ?? {}) : next,
          ),
      }}
    >
      <GameMasterLayer
        live
        campaignName={name}
        backLabel="Back to dashboard"
        catalog={library}
        status={status}
        campaignCreationRules={
          campaign ? (
            <CampaignCreationRulesPanel key={campaign.id} campaign={campaign} />
          ) : null
        }
        invite={
          <section className="gm-sheet campaign-access-panel">
            <h2>Invite your party</h2>
            <p>
              Share this campaign ID with players. The workspace remains private
              to you.
            </p>
            {joinCode ? (
              <div className="campaign-code-row">
                <code>{formatCampaignCode(joinCode)}</code>
                <button className="gm-primary" onClick={() => void copyCode()}>
                  {copied ? "Copied" : "Copy campaign ID"}
                </button>
              </div>
            ) : (
              <p>No campaign ID is available.</p>
            )}
          </section>
        }
        management={
          <section className="campaign-danger-panel">
            <div>
              <h2>Delete campaign</h2>
              <p>
                Ends member access and disables the campaign ID. Existing
                character builds are preserved.
              </p>
            </div>
            <button
              className="gm-danger"
              disabled={deleting || pending || saving}
              onClick={() => void removeCampaign()}
            >
              {deleting ? "Deleting…" : "Delete campaign"}
            </button>
          </section>
        }
      />
    </WorkspaceContext.Provider>
  );
}
