import { HeaderProfile } from "../../components/ProfileMenu";
import { accountStorage } from "../../lib/accountCache";
import { useState, type ComponentType, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type {
  CharacterBuild,
  CharacterCreationRules,
} from "@mathfinder/rules-engine";
import {
  getCampaign,
  setCampaignCharacterAssignment,
} from "../campaigns/campaignRepository";
import { CreationRulesSummary } from "../campaigns/CampaignCreationRules";
import { createCharacter } from "./characterRepository";
import "../home/home.css";
import "../home/home-responsive.css";

export function NewCharacterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const campaign = getCampaign(accountStorage, params.get("campaign") ?? "");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [creationName, setCreationName] = useState<string>();
  const [CreationModal, setCreationModal] = useState<
    ComponentType<{
      characterName: string;
      creationRules?: CharacterCreationRules;
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
    const character = createCharacter(accountStorage, build);
    if (campaign) {
      setCampaignCharacterAssignment(
        accountStorage,
        campaign.id,
        character.id,
        true,
      );
    }
    navigate(`/characters/${character.id}/build`, { replace: true });
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <Link className="home-brand" to="/">
          <span className="home-brand-mark">M</span>
          <span>Mathfinder</span>
        </Link>
        <span className="home-header-label">Character forge</span>
        <HeaderProfile />
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
            {campaign && (
              <CreationRulesSummary rules={campaign.creationRules} />
            )}
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
          creationRules={campaign?.creationRules}
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
