import { HeaderProfile } from "../../components/ProfileMenu";
import { CreationRulesSummary } from "./CampaignCreationRules";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { accountStorage } from "../../lib/accountCache";
import { useCloudConnection } from "../../lib/useCloudConnection";
import { listCharacters } from "../characters/characterRepository";
import {
  formatCampaignCode,
  joinCampaignByCode,
  previewCampaignByCode,
  type CampaignPreview,
} from "./campaignService";
import "../home/home.css";
import "../home/home-responsive.css";
import "./campaign.css";

export function JoinCampaignPage() {
  const navigate = useNavigate();
  const connection = useCloudConnection();
  const userId = "userId" in connection ? connection.userId : undefined;
  const characters = listCharacters(accountStorage).filter(
    (character) => !character.ownerId || character.ownerId === userId,
  );
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<CampaignPreview>();
  const [characterIds, setCharacterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  function changeCode(value: string) {
    setCode(formatCampaignCode(value));
    setPreview(undefined);
    setError(undefined);
  }

  function toggleCharacter(characterId: string) {
    setCharacterIds((current) =>
      current.includes(characterId)
        ? current.filter((id) => id !== characterId)
        : [...current, characterId],
    );
  }

  async function findCampaign(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      setPreview(await previewCampaignByCode(code));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Campaign lookup failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function join(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const campaignId = await joinCampaignByCode(code, characterIds);
      navigate(`/campaigns/${campaignId}`, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Joining failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <Link className="home-brand" to="/">
          <span className="home-brand-mark">M</span>
          <span>Mathfinder</span>
        </Link>
        <span className="home-header-label">Campaigns</span>
        <HeaderProfile />
      </header>
      <main className="form-page">
        <section className="form-card campaign-form-card">
          <span className="eyebrow">Join campaign</span>
          <h1>{preview ? `Join ${preview.name}` : "Find your table."}</h1>
          <p>
            {preview?.description ??
              "Enter the reusable campaign ID from your Game Master, then choose which of your characters to bring."}
          </p>

          {preview && <CreationRulesSummary rules={preview.creationRules} />}
          {!preview ? (
            <form onSubmit={findCampaign}>
              <label htmlFor="campaign-code">Campaign ID</label>
              <input
                autoComplete="off"
                autoFocus
                id="campaign-code"
                inputMode="text"
                onChange={(event) => changeCode(event.target.value)}
                placeholder="ABCD-1234-EF56-7890-ABCD"
                required
                spellCheck={false}
                value={code}
              />
              {error ? <p className="form-error">{error}</p> : null}
              <div className="form-actions">
                <Link className="text-link" to="/">
                  Cancel
                </Link>
                <button disabled={loading} type="submit">
                  {loading ? "Looking…" : "Continue"}
                </button>
              </div>
            </form>
          ) : characters.length ? (
            <form onSubmit={join}>
              <fieldset className="character-checklist">
                <legend>Select at least one character</legend>
                {characters.map((character) => (
                  <label key={character.id}>
                    <input
                      checked={characterIds.includes(character.id)}
                      onChange={() => toggleCharacter(character.id)}
                      type="checkbox"
                    />
                    <span>
                      {character.name} · Level {character.currentLevel}
                    </span>
                  </label>
                ))}
              </fieldset>
              {error ? <p className="form-error">{error}</p> : null}
              <div className="form-actions">
                <button
                  className="ghost"
                  onClick={() => setPreview(undefined)}
                  type="button"
                >
                  Change ID
                </button>
                <button
                  disabled={loading || characterIds.length === 0}
                  type="submit"
                >
                  {loading ? "Joining…" : "Join campaign"}
                </button>
              </div>
            </form>
          ) : (
            <div className="empty-state">
              <div>
                <h3>Create a character first</h3>
                <p>You need at least one character to join this campaign.</p>
              </div>
              <Link className="button-link" to="/characters/new">
                Create character
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
