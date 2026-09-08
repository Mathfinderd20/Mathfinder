import { useState } from "react";
import { Link } from "react-router-dom";
import {
  creationWarnings,
  DEFAULT_CREATION_RULES,
  type CharacterCreationRules,
} from "@mathfinder/rules-engine";
import { listCharacters } from "../characters/characterRepository";
import { accountStorage } from "../../lib/accountCache";
import { characterIdsForCampaign } from "./campaignRepository";
import type { CampaignRecord } from "./campaignRepository";
import { saveCampaignCreationRules } from "./campaignService";

export function CreationRulesSummary({
  rules,
}: {
  rules?: CharacterCreationRules;
}) {
  if (!rules) return <p>No campaign character-generation rules configured.</p>;
  return (
    <section aria-label="Character creation rules">
      <h3>Character creation rules</h3>
      <p>
        Starting level: {rules.startingLevel}. Ability method: {rules.method}.
      </p>
      {rules.method === "point-buy" && (
        <p>Budget: {rules.pointBuyBudget} points, before ancestry bonuses.</p>
      )}
      {rules.method === "array" && (
        <p>Assign these scores: {rules.abilityArray.join(", ")}.</p>
      )}
      <p style={{ whiteSpace: "pre-wrap" }}>{rules.buildGuide}</p>
      <p>
        Build mismatches are guidance, not automatic changes. Discuss exceptions
        with your GM.
      </p>
    </section>
  );
}

export function CampaignCreationRulesPanel({
  campaign,
}: {
  campaign: CampaignRecord;
}) {
  const [rules, setRules] = useState(
    campaign.creationRules ?? DEFAULT_CREATION_RULES,
  );
  const [arrayText, setArrayText] = useState(rules.abilityArray.join(", "));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const assigned = new Set(
    characterIdsForCampaign(accountStorage, campaign.id),
  );
  return (
    <section className="form-card">
      <CreationRulesSummary rules={campaign.creationRules} />
      {campaign.creationRules &&
        listCharacters(accountStorage)
          .filter((c) => assigned.has(c.id))
          .map((c) => {
            const warnings = creationWarnings(
              Object.values(c.build.baseAbilityScores),
              c.currentLevel,
              campaign.creationRules!,
            );
            return warnings.length ? (
              <div key={c.id}>
                <strong>{c.name}</strong>
                <ul>
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null;
          })}
      <Link to={`/characters/new?campaign=${encodeURIComponent(campaign.id)}`}>
        Build a character for this campaign
      </Link>
      {campaign.role === "gm" && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              await saveCampaignCreationRules(campaign.id, {
                ...rules,
                abilityArray: arrayText.split(",").map((s) => Number(s.trim())),
              });
              setMessage(
                "Campaign rules saved. Existing builds were not modified.",
              );
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Save failed.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <legend>GM character creation settings</legend>
            <label>
              Starting level
              <input
                type="number"
                min={1}
                max={20}
                required
                value={rules.startingLevel}
                onChange={(e) =>
                  setRules({ ...rules, startingLevel: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Ability method
              <select
                value={rules.method}
                onChange={(e) =>
                  setRules({
                    ...rules,
                    method: e.target.value as CharacterCreationRules["method"],
                  })
                }
              >
                <option value="manual">Manual / rolled</option>
                <option value="point-buy">Point buy</option>
                <option value="array">Fixed array</option>
              </select>
            </label>
            {rules.method === "point-buy" && (
              <label>
                Point-buy budget
                <input
                  type="number"
                  min={0}
                  max={102}
                  required
                  value={rules.pointBuyBudget}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      pointBuyBudget: Number(e.target.value),
                    })
                  }
                />
              </label>
            )}
            {rules.method === "array" && (
              <label>
                Six scores, comma-separated
                <input
                  value={arrayText}
                  onChange={(e) => setArrayText(e.target.value)}
                  required
                />
              </label>
            )}
            <label>
              Build guide
              <textarea
                maxLength={5000}
                rows={5}
                value={rules.buildGuide}
                onChange={(e) =>
                  setRules({ ...rules, buildGuide: e.target.value })
                }
              />
            </label>
            <button type="submit">
              {busy ? "Saving…" : "Save creation rules"}
            </button>
          </fieldset>
          <p role="status">{message}</p>
        </form>
      )}
    </section>
  );
}
