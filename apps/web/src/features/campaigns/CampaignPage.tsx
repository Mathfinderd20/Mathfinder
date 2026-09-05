import { accountStorage } from "../../lib/accountCache";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCloudConnection } from "../../lib/useCloudConnection";
import { listCharacters } from "../characters/characterRepository";
import { characterIdsForCampaign, getCampaign } from "./campaignRepository";
import {
  deactivateSharedCampaign,
  formatCampaignCode,
  setSharedCampaignCharacter,
} from "./campaignService";
import "../home/home.css";
import "../home/home-responsive.css";
import "./campaign.css";

export function CampaignPage() {
  const { campaignId = "" } = useParams();
  const navigate = useNavigate();
  const connection = useCloudConnection();
  const userId = "userId" in connection ? connection.userId : undefined;
  const campaign = getCampaign(accountStorage, campaignId);
  const characters = listCharacters(accountStorage);
  const assignedIds = new Set(
    characterIdsForCampaign(accountStorage, campaignId),
  );
  const assignedCharacters = characters.filter((character) =>
    assignedIds.has(character.id),
  );
  const ownedCharacters = characters.filter(
    (character) => !character.ownerId || character.ownerId === userId,
  );
  const availableOwnedCharacters = ownedCharacters.filter(
    (character) => !assignedIds.has(character.id),
  );
  const [workingId, setWorkingId] = useState<string>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  if (!campaign) {
    return (
      <main className="route-message">
        <span className="route-message-kicker">Campaign not found</span>
        <h1>This table has packed up.</h1>
        <p>The campaign may be inactive or you may no longer be a member.</p>
        <Link className="button-link" to="/">
          Return home
        </Link>
      </main>
    );
  }

  async function setAssignment(characterId: string, assigned: boolean) {
    setWorkingId(characterId);
    setError(undefined);
    try {
      await setSharedCampaignCharacter(campaignId, characterId, assigned);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Character update failed.",
      );
    } finally {
      setWorkingId(undefined);
    }
  }

  async function copyCode() {
    if (!campaign?.joinCode) return;
    try {
      await navigator.clipboard.writeText(
        formatCampaignCode(campaign.joinCode),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Copy failed. Select the campaign ID and copy it manually.");
    }
  }

  async function deactivate() {
    setWorkingId("campaign");
    setError(undefined);
    try {
      await deactivateSharedCampaign(campaignId);
      navigate("/", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Deactivation failed.");
      setWorkingId(undefined);
    }
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <Link className="home-brand" to="/">
          <span className="home-brand-mark">M</span>
          <span>Mathfinder</span>
        </Link>
        <span className="edition-chip">
          {campaign.role === "gm" ? "Game Master" : "Player"}
        </span>
      </header>
      <main className="home-main campaign-page-main">
        <Link className="text-link" to="/">
          ← Back to dashboard
        </Link>
        <section className="campaign-hero">
          <span className="eyebrow">Campaign</span>
          <h1>{campaign.name}</h1>
          <p>
            {campaign.description ||
              "No campaign description yet. Mystery is technically a feature."}
          </p>
        </section>

        {campaign.role === "gm" && campaign.joinCode ? (
          <section className="campaign-code-panel">
            <div>
              <span className="eyebrow">Reusable campaign ID</span>
              <h2>{formatCampaignCode(campaign.joinCode)}</h2>
              <p>
                Share this with players. It works until the campaign is
                deactivated.
              </p>
            </div>
            <button className="ghost" onClick={() => void copyCode()}>
              {copied ? "Copied" : "Copy ID"}
            </button>
          </section>
        ) : null}

        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Party roster</span>
              <h2>Linked characters</h2>
            </div>
            <span className="level-chip">
              {assignedCharacters.length} linked
            </span>
          </div>
          {assignedCharacters.length ? (
            <div className="assignment-list">
              {assignedCharacters.map((character) => {
                const owned =
                  !character.ownerId || character.ownerId === userId;
                const canRemove = campaign.role === "gm" || owned;
                return (
                  <div className="assignment-row" key={character.id}>
                    <span className="character-emblem" aria-hidden="true">
                      {character.name.slice(0, 1).toUpperCase() || "?"}
                    </span>
                    <div>
                      <strong>{character.name}</strong>
                      <small>
                        Level {character.currentLevel} ·{" "}
                        {owned ? "Your character" : "Player character"}
                      </small>
                    </div>
                    <div className="assignment-actions">
                      <Link
                        className="button-link secondary"
                        to={`/characters/${character.id}/sheet`}
                      >
                        View sheet
                      </Link>
                      {canRemove ? (
                        <button
                          className="ghost"
                          disabled={workingId === character.id}
                          onClick={() =>
                            void setAssignment(character.id, false)
                          }
                        >
                          {workingId === character.id ? "Removing…" : "Remove"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div>
                <h3>No characters linked</h3>
                <p>Players can link their characters when they join.</p>
              </div>
            </div>
          )}
          {error ? <p className="form-error">{error}</p> : null}
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Your roster</span>
              <h2>Add another character</h2>
            </div>
          </div>
          {availableOwnedCharacters.length ? (
            <div className="assignment-list">
              {availableOwnedCharacters.map((character) => (
                <div className="assignment-row" key={character.id}>
                  <span className="character-emblem" aria-hidden="true">
                    {character.name.slice(0, 1).toUpperCase() || "?"}
                  </span>
                  <div>
                    <strong>{character.name}</strong>
                    <small>Level {character.currentLevel}</small>
                  </div>
                  <button
                    disabled={workingId === character.id}
                    onClick={() => void setAssignment(character.id, true)}
                  >
                    {workingId === character.id ? "Adding…" : "Add to campaign"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="campaign-muted">
              All of your available characters are already linked.
            </p>
          )}
        </section>

        {campaign.role === "gm" ? (
          <section className="danger-zone campaign-danger-zone">
            <div>
              <span className="eyebrow">Campaign controls</span>
              <h2>Deactivate campaign</h2>
              <p>
                Removes the campaign from every member’s dashboard and disables
                its campaign ID. Existing character builds are not deleted.
              </p>
            </div>
            {confirmingDeactivate ? (
              <div className="danger-actions">
                <button
                  className="ghost"
                  onClick={() => setConfirmingDeactivate(false)}
                >
                  Keep active
                </button>
                <button
                  className="danger-button"
                  disabled={workingId === "campaign"}
                  onClick={() => void deactivate()}
                >
                  {workingId === "campaign"
                    ? "Deactivating…"
                    : "Yes, deactivate"}
                </button>
              </div>
            ) : (
              <button
                className="danger-button"
                onClick={() => setConfirmingDeactivate(true)}
              >
                Deactivate campaign
              </button>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
