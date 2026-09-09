import { useState } from "react";
import { ActorSheet } from "./ActorSheet";
import { codexActors, type Actor } from "./mockData";

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

  if (!creature) {
    return (
      <section className="gm-sheet gm-empty">
        <h2>Your library is empty.</h2>
        <p>Create a character in Roster to build a reusable stat block.</p>
      </section>
    );
  }

  const source = creature as Partial<Actor> & typeof creature;
  const preview: Actor = {
    id: source.id ?? `codex-${selected}`,
    name: creature.name,
    kind:
      source.kind ??
      (creature.role.includes("NPC")
        ? "NPC"
        : creature.role.includes("Summon")
          ? "Ally"
          : "Monster"),
    ancestry: creature.ancestry,
    role: creature.role,
    level: creature.level,
    hp: creature.hp,
    maxHp: source.maxHp ?? creature.hp,
    ac: creature.ac,
    initiative: source.initiative ?? 0,
    initiativeBonus: source.initiativeBonus ?? 0,
    onTable: false,
    saved: false,
    dual: source.dual ?? false,
    aware: source.aware ?? true,
    group: source.group ?? "",
    stance: source.stance ?? "Normal",
    conditions: "",
    notes: "",
    build: source.build,
  };

  return (
    <div className="gm-workspace gm-codex-workspace">
      <div>
        <section className="gm-codex-addbar">
          <div>
            <span className="gm-kicker">
              {live ? "Codex / Campaign library" : "Codex / Sample library"}
            </span>
            <strong>Independent campaign copies</strong>
          </div>
          <label>
            Quantity
            <input
              aria-label="Quantity"
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  Math.max(
                    1,
                    Math.min(20, Math.floor(Number(event.target.value)) || 1),
                  ),
                )
              }
            />
          </label>
          <label className="gm-check">
            <input
              type="checkbox"
              checked={save}
              onChange={(event) => setSave(event.target.checked)}
            />{" "}
            Save tabletop additions to Roster
          </label>
          <button className="gm-primary" onClick={() => insert(true)}>
            + Add to Tabletop
          </button>
          <button onClick={() => insert(false)}>+ Add to Roster</button>
          <span role="status" className="gm-save">
            {message}
          </span>
        </section>
        <ActorSheet
          actor={preview}
          live={false}
          previewOnly
          tabletop={false}
          update={() => undefined}
          remove={() => undefined}
        />
      </div>
      <aside className="gm-rail">
        <div className="gm-rail-head">
          <span className="gm-kicker">Creatures &amp; characters</span>
          <h3>The Codex</h3>
          <input
            aria-label="Search Codex"
            placeholder="Search the Codex…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            aria-label="Creature category"
            value={type}
            onChange={(event) => setType(event.target.value)}
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
              key={entry.name}
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
          Every reference opens the same Character workspace before it becomes
          an independent campaign copy.
        </p>
      </aside>
    </div>
  );
}
