import { useState, type ComponentType, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import { createCharacter } from "./characterRepository";
import "../home/home.css";
import "../home/home-responsive.css";

export function NewCharacterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [creationName, setCreationName] = useState<string>();
  const [CreationModal, setCreationModal] = useState<
    ComponentType<{
      characterName: string;
      onConfirm: (build: CharacterBuild) => void;
      onClose: () => void;
    }>
  >();
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(undefined);
    try {
      const [{ loadRuntimeContent }, creationModule] = await Promise.all([
        import("../../content"),
        import("../../components/CharacterCreationModal"),
      ]);
      await loadRuntimeContent();
      setCreationModal(() => creationModule.CharacterCreationModal);
      setCreationName(name.trim() || "Unnamed Hero");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Character creation failed.",
      );
      setCreating(false);
    }
  }

  function finishCreation(build: CharacterBuild) {
    const character = createCharacter(window.localStorage, build);
    navigate(`/characters/${character.id}/build`, { replace: true });
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
      {creationName && CreationModal ? (
        <CreationModal
          characterName={creationName}
          onConfirm={finishCreation}
          onClose={() => {
            setCreationName(undefined);
            setCreating(false);
          }}
        />
      ) : null}
    </div>
  );
}
