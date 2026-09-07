import { useState } from "react";

const defaults = {
  advancement: "XP leveling",
  hp: "Roll hit dice",
  recovery: "Core recovery",
  core: true,
  apg: true,
  savage: true,
  grouped: false,
};
export function CampaignRules() {
  const [rules, setRules] = useState({
    ...defaults,
    advancement: "Milestone leveling",
    hp: "Average rounded up",
    grouped: true,
  });
  const [applied, setApplied] = useState(false);
  const update = (patch: Partial<typeof rules>) => {
    setRules({ ...rules, ...patch });
    setApplied(false);
  };
  const overrides = Object.keys(defaults).filter(
    (key) =>
      rules[key as keyof typeof rules] !==
      defaults[key as keyof typeof defaults],
  ).length;
  return (
    <div className="gm-workspace">
      <section className="gm-sheet">
        <div className="gm-sheet-top">
          <span className="gm-kicker">Campaign rules</span>
          <span className="gm-tag">{overrides} overrides</span>
        </div>
        <h2>The rules of this world</h2>
        <p className="gm-prose">
          Core Pathfinder rules are the foundation. Campaign exceptions are
          explicit, visible, and reversible.
        </p>
        <div className="gm-section-title">
          <h3>Advancement & recovery</h3>
          <span>All campaign characters</span>
        </div>
        <div className="gm-field-grid">
          <label>
            Level advancement
            <select
              value={rules.advancement}
              onChange={(e) => update({ advancement: e.target.value })}
            >
              <option>XP leveling</option>
              <option>Milestone leveling</option>
            </select>
            <small>Core default: XP leveling</small>
          </label>
          <label>
            Hit points on level-up
            <select
              value={rules.hp}
              onChange={(e) => update({ hp: e.target.value })}
            >
              <option>Roll hit dice</option>
              <option>Average rounded up</option>
              <option>Maximum hit points</option>
            </select>
            <small>Core default: Roll hit dice</small>
          </label>
          <label>
            Health recovery
            <select
              value={rules.recovery}
              onChange={(e) => update({ recovery: e.target.value })}
            >
              <option>Core recovery</option>
              <option>Full recovery on rest</option>
            </select>
            <small>Core default: Core recovery</small>
          </label>
        </div>
        <div className="gm-section-title">
          <h3>Content sources</h3>
          <span>Character options</span>
        </div>
        {(
          [
            ["core", "Core Rulebook"],
            ["apg", "Advanced Player’s Guide"],
            ["savage", "Savage Company"],
          ] as const
        ).map(([key, title]) => (
          <label className="gm-rule-row" key={key}>
            <span>
              <strong>{title}</strong>
              <small>Core preview default: Enabled</small>
            </span>
            <input
              type="checkbox"
              checked={rules[key]}
              onChange={(e) => update({ [key]: e.target.checked })}
            />
          </label>
        ))}
        {(!rules.core || !rules.apg || !rules.savage) && (
          <p className="gm-warning" role="alert">
            Source disabled. Real implementation must check existing character
            dependencies before enforcement; no builds will be changed in this
            mock.
          </p>
        )}
        <div className="gm-section-title">
          <h3>Combat preferences</h3>
          <span>GM controls</span>
        </div>
        <label className="gm-check">
          <input
            type="checkbox"
            checked={rules.grouped}
            onChange={(e) => update({ grouped: e.target.checked })}
          />{" "}
          Prefer grouped monster initiative
        </label>
        <div className="gm-actions">
          <button className="gm-primary" onClick={() => setApplied(true)}>
            Apply preview rules
          </button>
          <button
            onClick={() => {
              setRules({ ...defaults });
              setApplied(false);
            }}
          >
            Reset to defaults
          </button>
        </div>
        <p role="status" className="gm-save">
          {applied
            ? "Preview settings applied in memory. No rules engine or player sheets changed."
            : "Draft configuration · not enforced"}
        </p>
      </section>
      <aside className="gm-rail">
        <div className="gm-rail-head">
          <span className="gm-kicker">Explicit, not mysterious</span>
          <h3>Rule precedence</h3>
        </div>
        <div className="gm-rail-copy">
          <span className="gm-step">01</span>
          <h4>Core rules</h4>
          <p>The baseline calculation and validation engine.</p>
          <span className="gm-step">02</span>
          <h4>Campaign exceptions</h4>
          <p>Typed settings override only the rule they describe.</p>
          <span className="gm-step">03</span>
          <h4>Runtime modifiers</h4>
          <p>
            Temporary effects apply during play. Future player sheets show only
            modifiers the GM allows them to know.
          </p>
        </div>
        <p className="gm-rail-foot">
          No arbitrary scripting. No silent rebuilds. No player-facing tabletop.
        </p>
      </aside>
    </div>
  );
}
