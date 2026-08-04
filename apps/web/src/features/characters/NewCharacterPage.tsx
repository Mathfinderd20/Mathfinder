import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createCharacter } from "./characterRepository";
import { createFreshCharacterBuild } from "./newCharacterBuild";
import "../home/home.css";
import "../home/home-responsive.css";

export function NewCharacterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(undefined);
    try {
      const { loadRuntimeContent, RUNTIME_RACES } =
        await import("../../content");
      await loadRuntimeContent();
      const humanRace = RUNTIME_RACES.human;
      if (!humanRace) throw new Error("Human ancestry content is unavailable.");
      const character = createCharacter(
        window.localStorage,
        createFreshCharacterBuild(name, humanRace),
      );
      navigate(`/characters/${character.id}/build`, { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Character creation failed.",
      );
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
        <section className="form-card">
          <span className="eyebrow">Create character</span>
          <h1>Who is joining the adventure?</h1>
          <p>
            Give your character a name. We’ll open the guided build tools next,
            where ancestry, class, abilities, feats, and gear await.
          </p>
          <form onSubmit={submit}>
            <label htmlFor="character-name">Character name</label>
            <input
              autoFocus
              id="character-name"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="Unnamed Hero"
              value={name}
            />
            {error ? <p className="form-error">{error}</p> : null}
            <div className="form-actions">
              <Link className="text-link" to="/">
                Cancel
              </Link>
              <button disabled={creating} type="submit">
                {creating ? "Preparing…" : "Begin character build"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
