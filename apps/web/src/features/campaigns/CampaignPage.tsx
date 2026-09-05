import { accountStorage } from "../../lib/accountCache";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { listCharacters } from "../characters/characterRepository";
import {
  characterIdsForCampaign,
  getCampaign,
  setCampaignCharacterAssignment,
} from "./campaignRepository";
import "../home/home.css";
import "../home/home-responsive.css";
import "./campaign.css";

export function CampaignPage() {
  const { campaignId = "" } = useParams();
  const campaign = getCampaign(accountStorage, campaignId);
  const characters = listCharacters(accountStorage);
  const [assignedIds, setAssignedIds] = useState(() =>
    characterIdsForCampaign(accountStorage, campaignId),
  );

  if (!campaign) {
    return (
      <main className="route-message">
        <span className="route-message-kicker">Campaign not found</span>
        <h1>This table has packed up.</h1>
        <p>The campaign may have been removed or belongs to another device.</p>
        <Link className="button-link" to="/">
          Return home
        </Link>
      </main>
    );
  }

  function toggleAssignment(characterId: string) {
    const assigned = !assignedIds.includes(characterId);
    setCampaignCharacterAssignment(
      accountStorage,
      campaignId,
      characterId,
      assigned,
    );
    setAssignedIds((current) =>
      assigned
        ? [characterId, ...current]
        : current.filter((id) => id !== characterId),
    );
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

        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Party roster</span>
              <h2>Characters</h2>
            </div>
            <span className="level-chip">{assignedIds.length} assigned</span>
          </div>
          {characters.length ? (
            <div className="assignment-list">
              {characters.map((character) => {
                const assigned = assignedIds.includes(character.id);
                return (
                  <div className="assignment-row" key={character.id}>
                    <span className="character-emblem" aria-hidden="true">
                      {character.name.slice(0, 1).toUpperCase() || "?"}
                    </span>
                    <div>
                      <strong>{character.name}</strong>
                      <small>Level {character.currentLevel}</small>
                    </div>
                    <button
                      className={assigned ? "ghost" : undefined}
                      onClick={() => toggleAssignment(character.id)}
                    >
                      {assigned ? "Remove" : "Add to campaign"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div>
                <h3>No characters available</h3>
                <p>Create a character, then return here to assign them.</p>
              </div>
              <Link className="button-link" to="/characters/new">
                Create character
              </Link>
            </div>
          )}
        </section>

        <section className="dashboard-section backend-notice">
          <span className="eyebrow">Shared play</span>
          <h2>Invitations come next</h2>
          <p>
            This campaign is local to this browser. Supabase Auth and secure
            invitations will turn it into a shared table in the backend phase.
          </p>
        </section>
      </main>
    </div>
  );
}
