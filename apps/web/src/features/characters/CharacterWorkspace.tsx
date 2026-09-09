import { accountStorage } from "../../lib/accountCache";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getCharacter } from "./characterRepository";
import { useCloudConnection } from "../../lib/useCloudConnection";

type WorkspaceTab = "notes" | "character" | "inventory" | "magic" | "build";

function workspaceTab(value: string | undefined): WorkspaceTab {
  if (value === "sheet") return "character";
  if (value === "gear") return "inventory";
  return value === "notes" ||
    value === "inventory" ||
    value === "magic" ||
    value === "build"
    ? value
    : "character";
}

export function CharacterWorkspace() {
  const connection = useCloudConnection();
  const { characterId = "", tab } = useParams();
  const navigate = useNavigate();
  const [LoadedApp, setLoadedApp] = useState<
    typeof import("../../App").App | null
  >(null);
  const [loadError, setLoadError] = useState<string>();
  const character = getCharacter(accountStorage, characterId);

  useEffect(() => {
    if (!getCharacter(accountStorage, characterId)) return;
    let cancelled = false;
    setLoadedApp(null);
    setLoadError(undefined);
    async function loadWorkspace() {
      try {
        const { loadRuntimeContent } = await import("../../content");
        await loadRuntimeContent();
        const { App } = await import("../../App");
        if (!cancelled) setLoadedApp(() => App);
      } catch (cause) {
        if (!cancelled) {
          setLoadError(
            cause instanceof Error
              ? cause.message
              : "The character workspace failed to load.",
          );
        }
      }
    }
    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  if (!character) {
    return (
      <main className="route-message">
        <span className="route-message-kicker">Character not found</span>
        <h1>That hero wandered off the map.</h1>
        <p>
          The character may have been removed, or this link belongs to another
          browser.
        </p>
        <Link className="button-link" to="/">
          Return home
        </Link>
      </main>
    );
  }

  if (!LoadedApp) {
    return (
      <main className="route-message" aria-live="polite">
        <span className="route-message-kicker">
          {loadError ? "Workspace unavailable" : "Preparing character"}
        </span>
        <h1>
          {loadError
            ? `Couldn’t open ${character.name}.`
            : `Opening ${character.name}…`}
        </h1>
        <p>
          {loadError ??
            "Loading the rules compendium and sharpening several pencils."}
        </p>
        {loadError ? (
          <Link className="button-link" to="/">
            Return home
          </Link>
        ) : null}
      </main>
    );
  }

  return (
    <fieldset
      className="application-fields"
      disabled={
        !!character.ownerId &&
        "userId" in connection &&
        character.ownerId !== connection.userId
      }
    >
      <LoadedApp
        key={characterId}
        characterId={characterId}
        initialTab={workspaceTab(tab)}
        onHome={() => navigate("/")}
        onTabChange={(nextTab) =>
          navigate(`/characters/${characterId}/${nextTab}`)
        }
      />
    </fieldset>
  );
}
