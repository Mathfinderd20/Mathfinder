import { useState } from "react";
import { codexActors } from "./mockData";

export function Codex({
  add,
  catalog = codexActors,
  live = false,
}: {
  catalog?: typeof codexActors;
  live?: boolean;
  add: (index: number, quantity: number, table: boolean, save: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All creatures");
  const [selected, setSelected] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [save, setSave] = useState(false);
  const [message, setMessage] = useState("");
  const creature = catalog[selected] ?? catalog[0];
  function insert(table: boolean) {
    if (!creature) return;
    add(catalog.indexOf(creature), quantity, table, !table || save);
    setMessage(
      `Added ${quantity} × ${creature.name} to ${table ? "Tabletop" : "Roster"}.`,
    );
  }
  if (!creature)
    return (
      <section className="gm-sheet gm-empty">
        <h2>Your library is empty.</h2>
        <p>Create a character in Roster to build a reusable stat block.</p>
      </section>
    );
  return (
    <div className="gm-workspace">
      <section className="gm-sheet">
        <div className="gm-sheet-top">
          <span className="gm-kicker">
            {live ? "Codex / Campaign library" : "Codex / Sample library"}
          </span>
          <span className="gm-tag">
            {live ? "Independent templates" : "Illustrative stats"}
          </span>
        </div>
        <header className="gm-actor-heading">
          <div className="gm-portrait tone-monster" aria-hidden="true">
            ◈
          </div>
          <div>
            <span className="gm-kicker">{creature.level} · Reference</span>
            <h2>{creature.name}</h2>
            <p>
              {creature.ancestry} · {creature.role}
            </p>
          </div>
        </header>
        <div className="gm-stats">
          <div>
            <span>Hit points</span>
            <strong>{creature.hp}</strong>
          </div>
          <div>
            <span>Armor class</span>
            <strong>{creature.ac}</strong>
          </div>
          <div>
            <span>Challenge</span>
            <strong>{creature.level.replace("CR ", "")}</strong>
          </div>
          <div>
            <span>Source</span>
            <strong className="gm-stat-word">
              {live ? "Campaign" : "Sample"}
            </strong>
          </div>
        </div>
        <div className="gm-section-title">
          <h3>Bring the world to your table</h3>
          <span>Independent copies</span>
        </div>
        <p className="gm-prose">
          Preview an entry here before adding it to your campaign. Each copy
          gets its own hit points, conditions, and initiative. The original
          reference never changes.
        </p>
        <div className="gm-inset">
          <label>
            Quantity
            <input
              aria-label="Quantity"
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  Math.max(
                    1,
                    Math.min(20, Math.floor(Number(e.target.value)) || 1),
                  ),
                )
              }
            />
          </label>
          <label className="gm-check">
            <input
              type="checkbox"
              checked={save}
              onChange={(e) => setSave(e.target.checked)}
            />{" "}
            Also save tabletop additions to the Campaign Roster
          </label>
          <div className="gm-actions">
            <button className="gm-primary" onClick={() => insert(true)}>
              + Add to Tabletop
            </button>
            <button onClick={() => insert(false)}>+ Add to Roster</button>
          </div>
          <p role="status" className="gm-save">
            {message}
          </p>
        </div>
        {!live && (
          <div className="gm-callout">
            <strong>Library integration comes next</strong>
            <p>
              These five entries are synthetic presentation fixtures, not the
              full Pathfinder Bestiary or NPC Codex. Source, CR-range, and
              environment filtering will arrive with real content.
            </p>
          </div>
        )}
      </section>
      <aside className="gm-rail">
        <div className="gm-rail-head">
          <span className="gm-kicker">Creatures & characters</span>
          <h3>The Codex</h3>
          <input
            aria-label="Search Codex"
            placeholder="Search the Codex…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Creature category"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option>All creatures</option>
            <option>NPCs</option>
            <option>Summons</option>
          </select>
        </div>
        {catalog
          .map((entry, index) => ({ entry, index }))
          .filter(
            ({ entry }) =>
              `${entry.name} ${entry.ancestry}`
                .toLowerCase()
                .includes(search.toLowerCase()) &&
              (type === "All creatures" ||
                entry.role.includes(type === "NPCs" ? "NPC" : "Summon")),
          )
          .map(({ entry, index }) => (
            <button
              key={index}
              className={`gm-list-entry ${selected === index ? "is-selected" : ""}`}
              onClick={() => {
                setSelected(index);
                setMessage("");
              }}
            >
              <span className="gm-kicker">
                {entry.level} · {entry.ancestry}
              </span>
              <strong>{entry.name}</strong>
              <small>{entry.role}</small>
            </button>
          ))}
        <p className="gm-rail-foot">
          Quick additions from the Roster and Tabletop open this same library.
        </p>
      </aside>
    </div>
  );
}
