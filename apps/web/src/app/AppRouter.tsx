import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "../features/home/HomePage";
import { CharacterWorkspace } from "../features/characters/CharacterWorkspace";
import { NewCharacterPage } from "../features/characters/NewCharacterPage";
import { ManageCharacterPage } from "../features/characters/ManageCharacterPage";
import { CampaignPlaceholderPage } from "../features/campaigns/CampaignPlaceholderPage";
import { CreateCampaignPage } from "../features/campaigns/CreateCampaignPage";
import { CampaignPage } from "../features/campaigns/CampaignPage";
import { useCloudConnection } from "../lib/useCloudConnection";
import { ServerErrorPage } from "./ServerErrorPage";
import { SignInPage } from "../features/auth/SignInPage";
import { safeReturnPath } from "../features/auth/authNavigation";
import {
  reconnect,
  signOut,
  exportUnsyncedCopy,
  reloadServerCopy,
} from "../lib/cloudPersistence";
import { Link, useLocation } from "react-router-dom";

function ProtectedApplication() {
  const cloud = useCloudConnection();
  const location = useLocation();
  if (cloud.status === "signedOut") {
    if (
      location.pathname === "/sign-in" ||
      location.pathname === "/auth/callback"
    )
      return <SignInPage />;
    return (
      <Navigate
        replace
        to={`/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`}
      />
    );
  }
  if (cloud.status !== "connected" && cloud.status !== "offline") return null;
  if (
    location.pathname === "/sign-in" ||
    location.pathname === "/auth/callback"
  )
    return (
      <Navigate
        replace
        to={safeReturnPath(new URLSearchParams(location.search).get("next"))}
      />
    );
  const offline = cloud.status === "offline";
  const blocked = offline && /\/(new|manage|join)$/.test(location.pathname);
  return (
    <>
      <aside
        className="connection-banner"
        data-offline={offline}
        aria-live="polite"
      >
        <span>{cloud.name}</span>
        <span>
          {offline
            ? `Read-only saved copy · ${new Date(cloud.cachedAt).toLocaleString()}`
            : cloud.pending
              ? "Saving changes…"
              : "Synced"}
        </span>
        {cloud.message && <span>{cloud.message}</span>}
        {offline && (
          <button onClick={() => void reconnect()}>Retry connection</button>
        )}
        {cloud.pending && (
          <>
            <button onClick={exportUnsyncedCopy}>Export unsynced copy</button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Discard unsynced changes and load the server copy? Export them first if you want to keep them.",
                  )
                )
                  void reloadServerCopy();
              }}
            >
              Load server copy
            </button>
          </>
        )}
        <button
          onClick={() => {
            if (
              !cloud.pending ||
              window.confirm(
                "Signing out removes unsynced changes from this device. Export them first. Continue?",
              )
            )
              void signOut();
          }}
        >
          Sign out
        </button>
      </aside>
      {blocked ? (
        <main className="route-message">
          <h1>Available when connected</h1>
          <p>You can still view saved characters and campaigns.</p>
          <Link to="/">Back to characters</Link>
        </main>
      ) : (
        <fieldset
          className="application-fields"
          disabled={offline}
          key={`${cloud.userId}:${cloud.generation}`}
        >
          <ApplicationRoutes />
        </fieldset>
      )}
    </>
  );
}

function ApplicationRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/characters/new" element={<NewCharacterPage />} />
      <Route
        path="/characters/:characterId/manage"
        element={<ManageCharacterPage />}
      />
      <Route path="/characters/:characterId" element={<CharacterWorkspace />} />
      <Route
        path="/characters/:characterId/:tab"
        element={<CharacterWorkspace />}
      />
      <Route path="/campaigns/new" element={<CreateCampaignPage />} />
      <Route
        path="/campaigns/join"
        element={<CampaignPlaceholderPage mode="join" />}
      />
      <Route path="/campaigns/:campaignId" element={<CampaignPage />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}

export function AppRouter() {
  const cloud = useCloudConnection();
  if (cloud.status === "error") {
    return <ServerErrorPage message={cloud.message} />;
  }
  if (cloud.status === "disabled") {
    return (
      <ServerErrorPage message="Supabase server configuration is missing." />
    );
  }
  if (cloud.status === "connecting") {
    return <main className="route-message">Connecting to Supabase…</main>;
  }
  return (
    <BrowserRouter>
      <ProtectedApplication />
    </BrowserRouter>
  );
}
