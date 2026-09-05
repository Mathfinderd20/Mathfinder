import { accountStorage } from "../../lib/accountCache";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCloudConnection } from "../../lib/useCloudConnection";
import { removeCharacterFromCampaigns } from "../campaigns/campaignRepository";
import {
  deleteCharacter,
  getCharacter,
  renameCharacter,
  runtimeStorageKey,
} from "./characterRepository";
import "../home/home.css";
import "../home/home-responsive.css";
import "./character-management.css";

export function ManageCharacterPage() {
  const connection = useCloudConnection();
  const { characterId = "" } = useParams();
  const navigate = useNavigate();
  const character = getCharacter(accountStorage, characterId);
  const [name, setName] = useState(character?.name ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string>();

  if (
    !character ||
    (character.ownerId &&
      "userId" in connection &&
      character.ownerId !== connection.userId)
  ) {
    return (
      <main className="route-message">
        <span className="route-message-kicker">Character not found</span>
        <h1>There’s nobody here to manage.</h1>
        <Link className="button-link" to="/">
          Return home
        </Link>
      </main>
    );
  }

  function submitRename(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    try {
      renameCharacter(accountStorage, characterId, name);
      navigate("/", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rename failed.");
    }
  }

  function confirmDelete() {
    removeCharacterFromCampaigns(accountStorage, characterId);
    deleteCharacter(accountStorage, characterId);
    accountStorage.removeItem(runtimeStorageKey(characterId));
    navigate("/", { replace: true });
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <Link className="home-brand" to="/">
          <span className="home-brand-mark">M</span>
          <span>Mathfinder</span>
        </Link>
      </header>
      <main className="form-page character-management-page">
        <div className="management-stack">
          <section className="form-card">
            <span className="eyebrow">Character settings</span>
            <h1>Manage {character.name}</h1>
            <p>
              Rename the character here. Build-editor name changes remain
              synchronized with this dashboard record.
            </p>
            <form onSubmit={submitRename}>
              <label htmlFor="managed-character-name">Character name</label>
              <input
                autoFocus
                id="managed-character-name"
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
              {error ? <p className="form-error">{error}</p> : null}
              <div className="form-actions">
                <Link className="text-link" to="/">
                  Cancel
                </Link>
                <button type="submit">Save name</button>
              </div>
            </form>
          </section>

          <section className="danger-zone">
            <div>
              <span className="eyebrow">Danger zone</span>
              <h2>Delete character</h2>
              <p>
                Removes this character, campaign assignments, and local runtime
                state from this browser. This cannot be undone.
              </p>
            </div>
            {confirmingDelete ? (
              <div className="danger-actions">
                <button
                  className="ghost"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep character
                </button>
                <button className="danger-button" onClick={confirmDelete}>
                  Yes, delete {character.name}
                </button>
              </div>
            ) : (
              <button
                className="danger-button"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete character
              </button>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
