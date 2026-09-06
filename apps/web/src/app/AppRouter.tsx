import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "../features/home/HomePage";
import { CharacterWorkspace } from "../features/characters/CharacterWorkspace";
import { NewCharacterPage } from "../features/characters/NewCharacterPage";
import { ManageCharacterPage } from "../features/characters/ManageCharacterPage";
import { CreateCampaignPage } from "../features/campaigns/CreateCampaignPage";
import { CampaignPage } from "../features/campaigns/CampaignPage";
import { JoinCampaignPage } from "../features/campaigns/JoinCampaignPage";
import { useCloudConnection } from "../lib/useCloudConnection";
import { ServerErrorPage } from "./ServerErrorPage";
import { SignInPage } from "../features/auth/SignInPage";
import { safeReturnPath } from "../features/auth/authNavigation";
import { ProfileMenu } from "../components/ProfileMenu";
import { reconnect } from "../lib/cloudPersistence";
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
  const blocked = offline && /\/campaigns\/(new|join)$/.test(location.pathname);
  return (
    <>
      {offline && (
        <aside
          className="connection-banner"
          data-offline="true"
          aria-live="polite"
        >
          <span>
            You’re offline. Changes are stored in this browser and will sync to
            your account when the connection is reestablished.
          </span>
          <button onClick={() => void reconnect()}>Retry connection</button>
        </aside>
      )}
      {blocked ? (
        <main className="route-message">
          <ProfileMenu cloud={cloud} />
          <h1>Available when connected</h1>
          <p>You can still view saved characters and campaigns.</p>
          <Link to="/">Back to characters</Link>
        </main>
      ) : (
        <fieldset
          className="application-fields"
          disabled={cloud.syncing}
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
      <Route path="/campaigns/join" element={<JoinCampaignPage />} />
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
