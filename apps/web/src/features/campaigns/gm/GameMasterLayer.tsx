import { useState, type ReactNode } from "react";
import { useWorkspaceField } from "./WorkspaceState";
import { ActorSheet } from "./ActorSheet";
import { Notebook } from "./Notebook";
import { Codex } from "./Codex";
import { CampaignRules } from "./CampaignRules";
import {
  codexActors,
  initialActors,
  initialNotes,
  initiativeOrder,
  type Actor,
} from "./mockData";
import "./gm.css";
import "./gm-responsive.css";

const tabs = [
  "Notes",
  "Roster",
  "Tabletop",
  "Codex",
  "Rules",
  "Invite",
] as const;
type Tab = (typeof tabs)[number];
export function GameMasterLayer({
  live = false,
  catalog = codexActors,
  invite,
  management,
  status,
  campaignName = "The Ashen Road",
  backHref = "/",
  backLabel = "Back to Mathfinder",
}: {
  live?: boolean;
  catalog?: typeof codexActors;
  invite?: ReactNode;
  management?: ReactNode;
  status?: ReactNode;
  campaignName?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const [tab, setTab] = useState<Tab>("Roster");
  const [actors, setActors] = useWorkspaceField<Actor[]>("actors", () =>
    (live ? [] : initialActors).map((actor) => ({ ...actor })),
  );
  const [notes, setNotes] = useWorkspaceField(
    "notes",
    live ? [] : initialNotes,
  );
  const [selected, setSelected] = useState("seren");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [phase, setPhase] = useWorkspaceField<
    "Exploration" | "Awaiting initiative" | "Combat"
  >("phase", "Exploration");
  const [round, setRound] = useWorkspaceField("round", 1);
  const [turnId, setTurnId] = useWorkspaceField("turnId", "");
  const [surprise, setSurprise] = useWorkspaceField("surprise", false);
  const [notice, setNotice] = useState("");
  const tabletop = tab === "Tabletop";
  const order = initiativeOrder(actors, surprise);
  const activeTurn = order.find((turn) => turn.id === turnId) ?? order[0];
  const current = actors.find((actor) => actor.id === activeTurn?.actorId);
  const visible = actors.filter(
    (actor) =>
      (tabletop ? actor.onTable : actor.saved) &&
      (filter === "All" || actor.kind === filter) &&
      actor.name.toLowerCase().includes(search.toLowerCase()),
  );
  const actor = visible.find((entry) => entry.id === selected) ?? visible[0];
  const update = (patch: Partial<Actor>) =>
    setActors((entries) =>
      entries.map((entry) =>
        entry.id === actor?.id ? { ...entry, ...patch } : entry,
      ),
    );
  function add(index: number, quantity: number, table: boolean, save: boolean) {
    const sample = catalog[index];
    if (!sample || quantity < 1) return;
    const additions = Array.from({ length: quantity }, (_, i): Actor => ({
      ...initialActors[4]!,
      ...sample,
      id: crypto.randomUUID(),
      name: quantity > 1 ? `${sample.name} ${i + 1}` : sample.name,
      hp: (sample as Partial<Actor>).maxHp ?? sample.hp,
      maxHp: (sample as Partial<Actor>).maxHp ?? sample.hp,
      onTable: table,
      saved: save,
      group: "",
      initiative: 0,
      conditions: "",
      dual: false,
      aware: true,
      stance: "Normal",
      notes: "",
      kind:
        (sample as Partial<Actor>).kind ??
        (sample.role.includes("NPC") ? "NPC" : "Monster"),
    }));
    setActors((entries) => [...entries, ...additions]);
    setSelected(additions[0]!.id);
  }
  function roll() {
    const groups = new Map<string, number>();
    setActors((entries) =>
      entries.map((entry) => {
        if (!entry.onTable) return entry;
        const key = entry.group.trim() || entry.id;
        if (!groups.has(key))
          groups.set(key, Math.floor(Math.random() * 20) + 1);
        return {
          ...entry,
          initiative: groups.get(key)! + (entry.initiativeBonus ?? 0),
        };
      }),
    );
    setNotice(
      "d20 results assigned with each participant’s initiative modifier. Groups share the d20 roll.",
    );
  }
  function advance(direction: number) {
    if (!order.length) return;
    const index = order.findIndex((turn) => turn.id === activeTurn?.id);
    let next = index + direction;
    if (next >= order.length) {
      next = 0;
      if (surprise) setSurprise(false);
      else setRound(round + 1);
    }
    if (next < 0) {
      if (round === 1) return;
      next = order.length - 1;
      setRound(round - 1);
    }
    const nextTurn =
      surprise && next === 0 && direction > 0
        ? initiativeOrder(actors, false)[0]
        : order[next];
    if (nextTurn) {
      setTurnId(nextTurn.id);
      setSelected(nextTurn.actorId);
    }
  }
  return (
    <div className="gm-page">
      <header className="gm-header">
        <a href={backHref} className="gm-brand" aria-label={backLabel}>
          <span>M</span> Mathfinder
        </a>
        <span className="gm-header-label">GAME MASTER’S LAYER</span>
        <span className="gm-sandbox">
          {live ? "◈ Creator workspace" : "◈ Interactive mock"}
        </span>
      </header>
      <main className="gm-main">
        <div className="gm-campaign-heading">
          <div>
            <span className="gm-kicker">Your world. Behind the screen.</span>
            <h1>{campaignName}</h1>
            <p>Every character. Every secret. One place to run the story.</p>
          </div>
          <a className="gm-settings" href={backHref}>
            {backLabel} ↗
          </a>
        </div>
        {live ? (
          status
        ) : (
          <div className="gm-preview-banner">
            DESIGN SANDBOX{" "}
            <span>
              Synthetic characters · changes last until refresh · no cloud
              writes or player functionality
            </span>
          </div>
        )}
        <nav className="gm-tabs" aria-label="Game Master workspace">
          {tabs
            .filter((name) => live || name !== "Invite")
            .map((name, index) => (
              <button
                key={name}
                aria-current={tab === name ? "page" : undefined}
                onClick={() => {
                  setTab(name);
                  setSearch("");
                  setFilter("All");
                }}
              >
                <span aria-hidden="true">
                  {["▤", "♜", "⚔", "◈", "⚙", "✉"][index]}
                </span>
                {name}
                {name === "Tabletop" && (
                  <small>
                    {actors.filter((entry) => entry.onTable).length}
                  </small>
                )}
              </button>
            ))}
        </nav>
        <div className="gm-page-heading">
          <div>
            <span className="gm-kicker">
              {tab === "Tabletop"
                ? "Run the moment"
                : tab === "Roster"
                  ? "The cast of your campaign"
                  : "Prepare your world"}
            </span>
            <h2>
              {tab === "Roster"
                ? "Campaign Roster"
                : tab === "Notes"
                  ? "Campaign Notes"
                  : tab === "Rules"
                    ? "Campaign Rules"
                    : tab}
            </h2>
          </div>
          <span className="gm-muted">
            {tab === "Roster"
              ? `${actors.filter((entry) => entry.saved).length} saved characters`
              : "GM-only workspace"}
          </span>
        </div>
        <div hidden={tab !== "Notes"}>
          <Notebook notes={notes} setNotes={setNotes} />
        </div>
        <div hidden={tab !== "Codex"}>
          <Codex add={add} catalog={catalog} live={live} />
        </div>
        <div hidden={tab !== "Rules"}>
          <CampaignRules live={live} />
          {management}
        </div>
        {tab === "Invite" && invite}
        {(tab === "Roster" || tabletop) && (
          <>
            {tabletop && (
              <section
                className="gm-combat-bar"
                aria-label="Encounter controls"
              >
                <div>
                  <span className="gm-kicker">
                    {live ? "Campaign encounter" : "The sunken chapel"}
                  </span>
                  <strong>
                    {phase === "Combat"
                      ? surprise
                        ? "Surprise round"
                        : `Round ${round}`
                      : phase}
                  </strong>
                  <small>
                    {phase === "Combat"
                      ? `Current: ${current?.name ?? "No active combatants"}`
                      : "One active encounter"}
                  </small>
                </div>
                <div className="gm-actions">
                  {phase !== "Combat" ? (
                    <>
                      <label className="gm-check">
                        <input
                          type="checkbox"
                          checked={surprise}
                          onChange={(e) => setSurprise(e.target.checked)}
                        />{" "}
                        Surprise round
                      </label>
                      <button
                        onClick={() => {
                          setPhase("Awaiting initiative");
                          setNotice(
                            "Awaiting initiative. Enter results or roll all participants.",
                          );
                        }}
                      >
                        Call for Initiative
                      </button>
                      <button onClick={roll}>Roll all</button>
                      <button
                        className="gm-primary"
                        disabled={!order.length}
                        onClick={() => {
                          setPhase("Combat");
                          setRound(1);
                          setTurnId(order[0]!.id);
                          setSelected(order[0]!.actorId);
                        }}
                      >
                        Begin combat
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        disabled={
                          round === 1 && activeTurn?.id === order[0]?.id
                        }
                        onClick={() => advance(-1)}
                      >
                        ← Previous
                      </button>
                      <button
                        className="gm-primary"
                        disabled={!order.length}
                        onClick={() => advance(1)}
                      >
                        Next turn →
                      </button>
                      <button
                        onClick={() => {
                          setPhase("Exploration");
                          setRound(1);
                          setTurnId("");
                          setSurprise(false);
                        }}
                      >
                        End encounter
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}
            <div className="gm-workspace">
              <div>
                {actor ? (
                  <ActorSheet
                    live={live}
                    actor={actor}
                    update={update}
                    tabletop={tabletop}
                    remove={() => {
                      if (
                        window.confirm(
                          `Remove ${actor.name} from this campaign roster and tabletop?`,
                        )
                      )
                        setActors(
                          actors.filter((entry) => entry.id !== actor.id),
                        );
                    }}
                  />
                ) : (
                  <section className="gm-sheet gm-empty">
                    <h2>
                      {tabletop ? "Set the scene." : "Your cast is waiting."}
                    </h2>
                    <p>
                      No matching characters. Adjust the filters or add someone
                      from the Codex.
                    </p>
                    <button onClick={() => setTab("Codex")}>
                      Explore the Codex
                    </button>
                  </section>
                )}
              </div>
              <aside className="gm-rail">
                <div className="gm-rail-head">
                  <span className="gm-kicker">
                    {tabletop ? "Active participants" : "Campaign cast"}
                  </span>
                  <h3>
                    {tabletop && phase === "Combat"
                      ? "Initiative order"
                      : "Characters"}
                    <small>{visible.length}</small>
                  </h3>
                  <button
                    className="gm-primary"
                    onClick={() => setTab("Codex")}
                  >
                    ◈ Search Codex / Quick add
                  </button>
                  <div className="gm-actions">
                    <button
                      onClick={() => {
                        const id = crypto.randomUUID();
                        setActors([
                          ...actors,
                          {
                            ...initialActors[2]!,
                            ancestry: "",
                            role: "NPC",
                            level: "Level 1",
                            hp: 1,
                            maxHp: 1,
                            ac: 10,
                            initiative: 0,
                            conditions: "",
                            group: "",
                            dual: false,
                            aware: true,
                            stance: "Normal",
                            saved: true,
                            id,
                            name: "New custom NPC",
                            kind: "NPC",
                            notes: "",
                            onTable: tabletop,
                          },
                        ]);
                        setSelected(id);
                        setSearch("");
                        setFilter("All");
                      }}
                    >
                      + Create character
                    </button>
                    {tabletop && (
                      <button onClick={() => setTab("Roster")}>
                        From roster
                      </button>
                    )}
                  </div>
                  <input
                    aria-label="Search characters"
                    placeholder="Find a character…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <select
                    aria-label="Character filter"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {["All", "Player", "Ally", "NPC", "Monster", "Villain"].map(
                      (value) => (
                        <option key={value}>{value}</option>
                      ),
                    )}
                  </select>
                </div>
                {tabletop && phase === "Combat"
                  ? order
                      .filter((turn) =>
                        visible.some((entry) => entry.id === turn.actorId),
                      )
                      .map((turn) => {
                        const entry = actors.find(
                          (item) => item.id === turn.actorId,
                        )!;
                        return (
                          <div
                            className={`gm-turn ${turn.id === activeTurn?.id ? "is-current" : ""}`}
                            key={turn.id}
                          >
                            <button
                              className="gm-list-entry"
                              onClick={() => setSelected(entry.id)}
                            >
                              <span className="gm-turn-score">
                                {turn.score}
                              </span>
                              <strong>{entry.name}</strong>
                              <small>
                                {turn.second ? "Second turn · " : ""}
                                {entry.stance !== "Normal"
                                  ? `${entry.stance} · `
                                  : ""}
                                {entry.group || entry.kind} · {entry.hp} HP
                              </small>
                            </button>
                            <button
                              className="gm-turn-jump"
                              aria-label={`Set current turn to ${entry.name}${turn.second ? " second turn" : ""}`}
                              onClick={() => {
                                setTurnId(turn.id);
                                setSelected(entry.id);
                              }}
                            >
                              ▶
                            </button>
                          </div>
                        );
                      })
                  : visible.map((entry) => (
                      <button
                        className={`gm-list-entry ${actor?.id === entry.id ? "is-selected" : ""}`}
                        key={entry.id}
                        onClick={() => setSelected(entry.id)}
                      >
                        <span className="gm-kicker">
                          {entry.kind} · {entry.level}
                        </span>
                        <strong>{entry.name}</strong>
                        <small>
                          {entry.onTable ? "● On table" : "○ In reserve"} ·{" "}
                          {entry.hp}/{entry.maxHp} HP{" "}
                          {entry.dual ? "· Dual" : ""}
                        </small>
                      </button>
                    ))}
                <p className="gm-rail-foot">
                  {tabletop
                    ? "Ties retain cast order. Edit results to reorder; ▶ sets the current turn. Defeated participants are skipped. Summons join through the Codex."
                    : "Select a character to edit their campaign copy. Use the Codex to import available characters."}
                </p>
              </aside>
            </div>
          </>
        )}
        <p className="gm-notice" role="status">
          {notice}
        </p>
        <footer className="gm-footer">
          <span>MATHFINDER / GAME MASTER’S LAYER</span>
          <span>The world waits for your next move.</span>
        </footer>
      </main>
    </div>
  );
}
