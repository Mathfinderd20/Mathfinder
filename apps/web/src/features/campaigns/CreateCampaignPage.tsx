import { accountStorage } from "../../lib/accountCache";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listCharacters } from "../characters/characterRepository";
import { useCloudConnection } from "../../lib/useCloudConnection";
import { createSharedCampaign } from "./campaignService";
import "../home/home.css";
import "../home/home-responsive.css";
import "./campaign.css";

export function CreateCampaignPage() {
  const navigate = useNavigate();
  const connection = useCloudConnection();
  const userId = "userId" in connection ? connection.userId : undefined;
  const characters = listCharacters(accountStorage).filter(
    (character) => !character.ownerId || character.ownerId === userId,
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [characterIds, setCharacterIds] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);

  function toggleCharacter(characterId: string) {
    setCharacterIds((current) =>
      current.includes(characterId)
        ? current.filter((id) => id !== characterId)
        : [...current, characterId],
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setCreating(true);
    try {
      const campaign = await createSharedCampaign({
        name,
        description,
        characterIds,
      });
      navigate(`/campaigns/${campaign.id}`, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Creation failed.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <Link className="home-brand" to="/">
          <span className="home-brand-mark">M</span>
          <span>Mathfinder</span>
        </Link>
      </header>
      <main className="form-page">
        <section className="form-card campaign-form-card">
          <span className="eyebrow">Start campaign</span>
          <h1>Gather your table.</h1>
          <p>
            Campaigns can begin empty. Add any of your characters now, or wait
            until the rest of the party stops arguing about session zero.
          </p>
          <form onSubmit={submit}>
            <label htmlFor="campaign-name">Campaign name</label>
            <input
              autoFocus
              id="campaign-name"
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              placeholder="Saturday Night Adventure"
              required
              value={name}
            />
            <label htmlFor="campaign-description">Description (optional)</label>
            <textarea
              id="campaign-description"
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What kind of trouble is the party walking into?"
              rows={4}
              value={description}
            />
            {characters.length ? (
              <fieldset className="character-checklist">
                <legend>Assign characters (optional)</legend>
                {characters.map((character) => (
                  <label key={character.id}>
                    <input
                      checked={characterIds.includes(character.id)}
                      onChange={() => toggleCharacter(character.id)}
                      type="checkbox"
                    />
                    <span>{character.name}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            {error ? <p className="form-error">{error}</p> : null}
            <div className="form-actions">
              <Link className="text-link" to="/">
                Cancel
              </Link>
              <button disabled={creating} type="submit">
                {creating ? "Creating…" : "Create campaign"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
