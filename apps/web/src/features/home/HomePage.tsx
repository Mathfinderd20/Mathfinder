import { accountStorage } from "../../lib/accountCache";
import { Link } from "react-router-dom";
import { listCharacters } from "../characters/characterRepository";
import { summarizeCharacter } from "../characters/characterSummary";
import {
  campaignsForCharacter,
  characterIdsForCampaign,
  listCampaigns,
} from "../campaigns/campaignRepository";
import "./home.css";
import "./home-responsive.css";

const QUICK_ACTIONS = [
  {
    to: "/characters/new",
    eyebrow: "Build",
    title: "Create Character",
    description:
      "Shape a new hero with guided ancestry, class, and feat choices.",
    icon: "+",
    primary: true,
  },
  {
    to: "/campaigns/new",
    eyebrow: "Game Master",
    title: "Start Campaign",
    description: "Create a table, invite players, and gather their characters.",
    icon: "◇",
    primary: false,
  },
  {
    to: "/campaigns/join",
    eyebrow: "Player",
    title: "Join Campaign",
    description:
      "Use an invitation from your GM to join an existing adventure.",
    icon: "→",
    primary: false,
  },
] as const;

export function HomePage() {
  const characters = listCharacters(accountStorage);
  const campaigns = listCampaigns(accountStorage);
  const characterCampaigns = new Map(
    characters.map((character) => [
      character.id,
      campaignsForCharacter(accountStorage, character.id),
    ]),
  );

  return (
    <div className="home-page">
      <header className="home-header">
        <Link className="home-brand" to="/" aria-label="Mathfinder home">
          <span className="home-brand-mark">M</span>
          <span>
            Mathfinder
            <small>Pathfinder 1e companion</small>
          </span>
        </Link>
        <div className="local-profile">
          <span className="status-dot" aria-hidden="true" />
          <span>
            Your account
            <small>Characters and campaigns</small>
          </span>
        </div>
      </header>

      <main className="home-main">
        <section className="welcome-section" aria-labelledby="welcome-heading">
          <div>
            <span className="eyebrow">Your adventure hub</span>
            <h1 id="welcome-heading">Ready for the next session?</h1>
            <p>
              Pick up an existing hero, gather your party, or start building
              something gloriously overcomplicated.
            </p>
          </div>
          <div className="edition-chip">Pathfinder First Edition</div>
        </section>

        <section className="quick-actions" aria-label="Quick actions">
          {QUICK_ACTIONS.map((action) => (
            <Link
              className={`quick-action${action.primary ? " primary" : ""}`}
              key={action.to}
              to={action.to}
            >
              <span className="quick-action-icon" aria-hidden="true">
                {action.icon}
              </span>
              <span className="quick-action-copy">
                <small>{action.eyebrow}</small>
                <strong>{action.title}</strong>
                <span>{action.description}</span>
              </span>
              <span className="quick-action-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </section>

        <section
          className="dashboard-section"
          aria-labelledby="campaign-heading"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">Your tables</span>
              <h2 id="campaign-heading">My Campaigns</h2>
            </div>
            <Link className="text-link" to="/campaigns/new">
              Start campaign
            </Link>
          </div>
          {campaigns.length ? (
            <div className="character-grid">
              {campaigns.map((campaign) => {
                const characterCount = characterIdsForCampaign(
                  accountStorage,
                  campaign.id,
                ).length;
                return (
                  <article className="character-card" key={campaign.id}>
                    <div className="character-card-top">
                      <span className="character-emblem" aria-hidden="true">
                        ◇
                      </span>
                      <div className="character-identity">
                        <h3>{campaign.name}</h3>
                        <p>{campaign.description || "Campaign"}</p>
                      </div>
                      <span className="level-chip">
                        {campaign.role === "gm" ? "Game Master" : "Player"}
                      </span>
                    </div>
                    <div className="character-meta">
                      <span>
                        {characterCount} character
                        {characterCount === 1 ? "" : "s"}
                      </span>
                      <span>
                        {campaign.role === "gm" ? "Your table" : "Joined table"}
                      </span>
                    </div>
                    <div className="character-actions">
                      <Link
                        className="button-link"
                        to={`/campaigns/${campaign.id}`}
                      >
                        Open campaign
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state campaign-empty">
              <span className="empty-emblem" aria-hidden="true">
                ◇
              </span>
              <div>
                <h3>No campaigns yet</h3>
                <p>
                  Start a campaign as GM or join one when shared invitations
                  come online.
                </p>
              </div>
              <div className="empty-actions">
                <Link className="button-link" to="/campaigns/new">
                  Start campaign
                </Link>
                <Link className="button-link secondary" to="/campaigns/join">
                  Join with invite
                </Link>
              </div>
            </div>
          )}
        </section>

        <section
          className="dashboard-section"
          aria-labelledby="character-heading"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">Your roster</span>
              <h2 id="character-heading">My Characters</h2>
            </div>
            <Link className="text-link" to="/characters/new">
              Create character
            </Link>
          </div>

          {characters.length ? (
            <div className="character-grid">
              {characters.map((character) => {
                const summary = summarizeCharacter(character);
                const campaignNames = (
                  characterCampaigns.get(character.id) ?? []
                ).map((campaign) => campaign.name);
                return (
                  <article className="character-card" key={character.id}>
                    <div className="character-card-top">
                      <span className="character-emblem" aria-hidden="true">
                        {character.name.slice(0, 1).toUpperCase() || "?"}
                      </span>
                      <div className="character-identity">
                        <h3>{character.name}</h3>
                        <p>
                          {summary.ancestry} · {summary.classes}
                        </p>
                      </div>
                      <span className="level-chip">{summary.levelLabel}</span>
                    </div>
                    <div className="character-meta">
                      <span title={campaignNames.join(", ")}>
                        {campaignNames.length
                          ? `${campaignNames.length} campaign${campaignNames.length === 1 ? "" : "s"}`
                          : "No campaigns"}
                      </span>
                      <span>{summary.updatedLabel}</span>
                    </div>
                    <div className="character-actions">
                      <Link
                        className="button-link"
                        to={`/characters/${character.id}/sheet`}
                      >
                        Open sheet
                      </Link>
                      <Link
                        className="button-link secondary"
                        to={`/characters/${character.id}/build`}
                      >
                        Edit build
                      </Link>
                      <Link
                        className="button-link secondary"
                        to={`/characters/${character.id}/manage`}
                      >
                        Manage
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state character-empty">
              <span className="empty-emblem" aria-hidden="true">
                +
              </span>
              <div>
                <h3>Your roster is waiting</h3>
                <p>
                  Create a character and Mathfinder will handle the arithmetic
                  while you handle the questionable decisions.
                </p>
              </div>
              <Link className="button-link" to="/characters/new">
                Create your first character
              </Link>
            </div>
          )}
        </section>
      </main>
      <footer className="home-footer">
        <span>Mathfinder</span>
        <span>Supabase connected</span>
      </footer>
    </div>
  );
}
