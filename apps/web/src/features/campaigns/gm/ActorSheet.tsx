import type { Actor } from "./mockData";

export function ActorSheet({
  actor,
  live = false,
  update,
  tabletop,
  remove,
}: {
  live?: boolean;
  actor: Actor;
  update: (patch: Partial<Actor>) => void;
  tabletop: boolean;
  remove: () => void;
}) {
  return (
    <article className="gm-sheet">
      <div className="gm-sheet-top">
        <span className="gm-kicker">
          {actor.kind === "Player" ? "Character sheet" : "Campaign stat block"}{" "}
          / {live ? "Campaign copy" : "Preview"}
        </span>
        <span className="gm-save">
          {live ? "● Campaign state" : "● In-memory draft"}
        </span>
      </div>
      <header className="gm-actor-heading">
        <div
          className={`gm-portrait tone-${actor.kind.toLowerCase()}`}
          aria-hidden="true"
        >
          {actor.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div>
          <span className="gm-kicker">
            {actor.kind} · {actor.level}
          </span>
          <h2>{actor.name}</h2>
          <p>
            {actor.ancestry} · {actor.role}
          </p>
        </div>
      </header>
      <div className="gm-actions">
        <button
          className={actor.onTable ? "gm-secondary" : "gm-primary"}
          onClick={() => update({ onTable: !actor.onTable })}
        >
          {actor.onTable ? "↗ Remove from Tabletop" : "+ Add to Tabletop"}
        </button>
        {!actor.saved && (
          <button onClick={() => update({ saved: true })}>
            Save to Roster
          </button>
        )}
        <span className="gm-tag">
          {actor.onTable ? "● On the tabletop" : "Off the tabletop"}
        </span>
      </div>
      <div className="gm-stats">
        <div>
          <span>Hit points</span>
          <strong>
            {actor.hp}
            <small> / {actor.maxHp}</small>
          </strong>
          <progress
            value={Math.max(0, actor.hp)}
            max={actor.maxHp}
            aria-label="Hit points"
          />
        </div>
        <div>
          <span>Armor class</span>
          <strong>{actor.ac}</strong>
          <small>Armor defense</small>
        </div>
        <div>
          <span>Initiative</span>
          <strong>
            {actor.initiative >= 0 ? "+" : ""}
            {actor.initiative}
          </strong>
          <small>Encounter result</small>
        </div>
        <div>
          <span>Turn economy</span>
          <strong>{actor.dual ? "2" : "1"}</strong>
          <small>{actor.dual ? "Dual initiative" : "Turn per round"}</small>
        </div>
      </div>
      <div className="gm-section-title">
        <h3>{tabletop ? "Encounter controls" : "Character overview"}</h3>
        <span>GM workspace</span>
      </div>
      <div className="gm-field-grid">
        <label>
          Display name
          <input
            value={actor.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>
        <label>
          Current hit points
          <input
            type="number"
            value={actor.hp}
            onChange={(e) =>
              update({ hp: Math.min(actor.maxHp, Number(e.target.value)) })
            }
          />
        </label>
        <label>
          Initiative result
          <input
            type="number"
            value={actor.initiative}
            onChange={(e) => update({ initiative: Number(e.target.value) })}
          />
        </label>
        <label>
          Active conditions
          <input
            placeholder="e.g. Bless, frightened"
            value={actor.conditions}
            onChange={(e) => update({ conditions: e.target.value })}
          />
        </label>
      </div>
      {live && (
        <div className="gm-field-grid">
          {(["ancestry", "role", "level"] as const).map((key) => (
            <label key={key}>
              {key}
              <input
                value={actor[key]}
                onChange={(e) => update({ [key]: e.target.value })}
              />
            </label>
          ))}
          <label>
            Maximum hit points
            <input
              type="number"
              min={1}
              value={actor.maxHp}
              onChange={(e) => {
                const maxHp = Math.max(1, Number(e.target.value));
                update({ maxHp, hp: Math.min(actor.hp, maxHp) });
              }}
            />
          </label>
          <label>
            Armor class
            <input
              type="number"
              value={actor.ac}
              onChange={(e) => update({ ac: Number(e.target.value) })}
            />
          </label>
          <label>
            Initiative modifier
            <input
              type="number"
              value={actor.initiativeBonus ?? 0}
              onChange={(e) =>
                update({ initiativeBonus: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Character type
            <select
              value={actor.kind}
              onChange={(e) =>
                update({ kind: e.target.value as Actor["kind"] })
              }
            >
              {["Player", "Ally", "NPC", "Monster", "Villain"].map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {tabletop && (
        <div className="gm-field-grid gm-inset">
          <label>
            Initiative group
            <input
              placeholder="Independent"
              value={actor.group}
              onChange={(e) => update({ group: e.target.value })}
            />
          </label>
          <label>
            Turn state
            <select
              value={actor.stance}
              onChange={(e) =>
                update({ stance: e.target.value as Actor["stance"] })
              }
            >
              <option>Normal</option>
              <option>Delayed</option>
              <option>Readied</option>
            </select>
          </label>
          <label className="gm-check">
            <input
              type="checkbox"
              checked={actor.dual}
              onChange={(e) => update({ dual: e.target.checked })}
            />{" "}
            Dual initiative
          </label>
          <label className="gm-check">
            <input
              type="checkbox"
              checked={actor.aware}
              onChange={(e) => update({ aware: e.target.checked })}
            />{" "}
            Acts in surprise round
          </label>
          <p className="gm-muted">
            Second turn at initiative −20. Delay/ready are markers; select a
            turn in the tracker to resolve it. Groups share the d20 roll before
            individual modifiers.
          </p>
        </div>
      )}
      <div className="gm-section-title">
        <h3>Behind the screen</h3>
        <span>◈ GM only</span>
      </div>
      <label>
        Private character notes
        <textarea
          rows={4}
          value={actor.notes}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </label>
      <div className="gm-callout">
        <strong>
          {tabletop ? "An active participant" : "The campaign’s lasting cast"}
        </strong>
        <p>
          {live
            ? "Hit points, conditions, and notes belong to this campaign copy. Player character builds are unchanged."
            : tabletop
              ? "Damage and conditions here change this preview participant only. Interaction math and player modifier visibility are not wired up."
              : "Roster edits stay in this sandbox when you switch characters. Full sheets, account imports, and real autosave are future integrations."}
        </p>
      </div>
      {(actor.saved || live) && (
        <button className="gm-danger" onClick={remove}>
          Remove from Roster and Tabletop
        </button>
      )}
    </article>
  );
}
