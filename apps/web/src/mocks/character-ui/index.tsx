import { StrictMode, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { EquipmentSilhouette } from "../../components/EquipmentSilhouette";
import "../../styles.css";
import "./mock.css";

type WorkspaceTab = "notes" | "character" | "inventory" | "magic" | "build";
type ScenarioKey = "player" | "multiclass" | "monster";
type RailSectionKey = "active" | "abilities" | "effects";

const TABS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "notes", label: "Notes" },
  { id: "character", label: "Character" },
  { id: "inventory", label: "Inventory" },
  { id: "magic", label: "Magic" },
  { id: "build", label: "Build" },
];

const SCENARIOS = {
  player: {
    name: "Seren Ashfall",
    eyebrow: "Player character · Level 7",
    descriptor: "Half-elf · Ranger 7 · Horizon walker",
    alignment: "Neutral Good",
    size: "Medium",
    health: "48 / 62",
    status: "Healthy",
    workspace: "My Characters",
    owner: "Player view",
  },
  multiclass: {
    name: "Elowen Vey",
    eyebrow: "Player character · Level 10",
    descriptor: "Human · Cleric 5 / Wizard 5",
    alignment: "Lawful Neutral",
    size: "Medium",
    health: "53 / 53",
    status: "Healthy",
    workspace: "My Characters",
    owner: "Player view",
  },
  monster: {
    name: "The Sanguine Owlbear",
    eyebrow: "Campaign actor · CR 11",
    descriptor: "Vampire owlbear · Magical beast 7 / Rogue 2",
    alignment: "Chaotic Evil",
    size: "Large",
    health: "96 / 118",
    status: "Bloodied",
    workspace: "The Ashen Road",
    owner: "GM view",
  },
} as const;

const ABILITIES = [
  ["STR", "18", "+4"],
  ["DEX", "17", "+3"],
  ["CON", "14", "+2"],
  ["INT", "12", "+1"],
  ["WIS", "16", "+3"],
  ["CHA", "13", "+1"],
];

const MONSTER_ABILITIES = [
  ["STR", "30", "+10"],
  ["DEX", "18", "+4"],
  ["CON", "—", "—"],
  ["INT", "14", "+2"],
  ["WIS", "17", "+3"],
  ["CHA", "21", "+5"],
];

const SKILLS: Array<[string, string, string, string]> = [
  ["Acrobatics", "DEX", "+12", "A"],
  ["Climb", "STR", "+14", "A"],
  ["Diplomacy", "CHA", "+8", ""],
  ["Escape Artist", "DEX", "+10", "A"],
  ["Handle Animal", "CHA", "+11", "T"],
  ["Heal", "WIS", "+10", ""],
  ["Knowledge (geography)", "INT", "+8", "T"],
  ["Knowledge (nature)", "INT", "+11", "T"],
  ["Perception", "WIS", "+15", ""],
  ["Ride", "DEX", "+12", "A"],
  ["Sense Motive", "WIS", "+10", ""],
  ["Stealth", "DEX", "+13", "A"],
  ["Survival", "WIS", "+16", ""],
  ["Swim", "STR", "+9", "A"],
  ["Use Magic Device", "CHA", "+7", "T"],
];

const MONSTER_SKILLS: Array<[string, string, string, string]> = [
  ["Acrobatics", "DEX", "+17", "A"],
  ["Climb", "STR", "+22", "A"],
  ["Intimidate", "CHA", "+18", ""],
  ["Knowledge (nature)", "INT", "+13", "T"],
  ["Perception", "WIS", "+21", ""],
  ["Sense Motive", "WIS", "+16", ""],
  ["Stealth", "DEX", "+20", "A"],
  ["Survival", "WIS", "+15", ""],
];

const FEATS = [
  "Deadly Aim",
  "Endurance",
  "Manyshot",
  "Point-Blank Shot",
  "Precise Shot",
  "Rapid Shot",
];

interface MockNote {
  id: string;
  title: string;
  category: string;
  pinned: boolean;
  body: string;
}

const NOTES: MockNote[] = [
  {
    id: "watchtower",
    title: "The ruined watchtower",
    category: "Location",
    pinned: true,
    body: "Brother’s signet found beneath the western stair. The caravan marks continue north, but no tracks leave the tower.\n\nAsk Captain Voss who last held the watch.\n\nThe old bell reacted when I crossed the threshold.",
  },
  {
    id: "contacts",
    title: "People who owe me",
    category: "Character",
    pinned: false,
    body: "Captain Elara Voss — one favor.\nMira at the river market — safe storage.\nOld Fen — knows the marsh paths.",
  },
  {
    id: "session",
    title: "Session 12",
    category: "Session",
    pinned: false,
    body: "Rain on the old road. Goblin scouts retreated toward the crypt. Brann heard a bell beneath the chapel.",
  },
];

const PLAYER_EQUIPMENT = new Map<string, string[]>([
  ["head", ["Headband of inspired wisdom +2"]],
  ["neck", ["Amulet of natural armor +1"]],
  ["shoulders", ["Cloak of resistance +2"]],
  ["armor", ["Mithral chain shirt +1"]],
  ["belt", ["Belt of incredible dexterity +2"]],
  ["feet", ["Boots of striding and springing"]],
  ["ring", ["Ring of protection +1", "Ring of sustenance"]],
]);

function App() {
  const [scenario, setScenario] = useState<ScenarioKey>("player");
  const [tab, setTab] = useState<WorkspaceTab>("character");
  const [railOpen, setRailOpen] = useState(true);
  const [railSections, setRailSections] = useState<Record<RailSectionKey, boolean>>({
    active: true,
    abilities: true,
    effects: true,
  });
  const [detail, setDetail] = useState<string>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [targeting, setTargeting] = useState(false);
  const [saveAttempt, setSaveAttempt] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [leveling, setLeveling] = useState<{ level?: number; className?: string; editing?: boolean }>();
  const [creationGuideOpen, setCreationGuideOpen] = useState(false);
  const [toast, setToast] = useState<string>();
  const character = SCENARIOS[scenario];
  const gm = scenario === "monster";
  const tabHasRail = tab === "character" || tab === "inventory" || tab === "magic";

  function chooseScenario(next: ScenarioKey) {
    setScenario(next);
    setTab(next === "multiclass" ? "magic" : next === "monster" ? "build" : "character");
    setDetail(undefined);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(undefined), 2600);
  }

  return (
    <div className="character-mock" data-workspace={gm ? "gm" : "player"}>
      <header className="mf-topbar">
        <a className="mf-brand" href="#top" aria-label="Mathfinder home">
          <span className="mf-brand-mark">M</span>
          <span>Mathfinder</span>
          <small>Pathfinder 1e smart sheet</small>
        </a>
        <div className="scenario-switcher" aria-label="Mock scenario">
          <span>Mock scenario</span>
          <button className={scenario === "player" ? "selected" : ""} onClick={() => chooseScenario("player")}>Player</button>
          <button className={scenario === "multiclass" ? "selected" : ""} onClick={() => chooseScenario("multiclass")}>Multiclass caster</button>
          <button className={scenario === "monster" ? "selected" : ""} onClick={() => chooseScenario("monster")}>GM monster</button>
        </div>
        <button className="quiet-button">Profile</button>
      </header>

      {gm ? <GmCommandBar onToast={showToast} /> : null}

      <section className="identity-bar" id="top">
        <img src="/mock-assets/seren-ashfall.png" alt="Seren Ashfall character portrait" />
        <div className="identity-main">
          <span className="eyebrow">{character.eyebrow}</span>
          <div className="identity-title-row">
            <h1>{character.name}</h1>
            <button className="text-button" onClick={() => setProfileOpen(true)}>Edit profile</button>
          </div>
          <p>{character.descriptor}</p>
        </div>
        <dl className="identity-facts">
          <div><dt>Alignment</dt><dd>{character.alignment}</dd></div>
          <div><dt>Size</dt><dd>{character.size}</dd></div>
          <div><dt>Workspace</dt><dd>{character.workspace}</dd></div>
        </dl>
        <button className="health-pill" onClick={() => setHealthOpen(true)}>
          <span>Hit points</span>
          <strong>{character.health}</strong>
          <em className={character.status === "Bloodied" ? "danger" : "ok"}>{character.status}</em>
        </button>
      </section>

      <nav className="character-tabs" aria-label="Character workspace">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className={`workspace-frame ${tabHasRail ? railOpen ? "rail-is-open" : "rail-is-closed" : "no-side-rail"}`}>
        <main className="workspace-main">
          {tab === "character" ? (
            <CharacterTab
              gm={gm}
              scenario={scenario}
              onDetail={setDetail}
              onHealth={() => setHealthOpen(true)}
              onRest={() => setRestOpen(true)}
            />
          ) : null}
          {tab === "notes" ? <NotesTab gm={gm} /> : null}
          {tab === "inventory" ? <InventoryTab scenario={scenario} onToast={showToast} /> : null}
          {tab === "magic" ? <MagicTab scenario={scenario} onTarget={() => setTargeting(true)} onToast={showToast} /> : null}
          {tab === "build" ? <BuildTab scenario={scenario} onToast={showToast} onLevelUp={() => setLeveling({})} onEditLevel={(level, className) => setLeveling({ level, className, editing: true })} onCreationGuide={() => setCreationGuideOpen(true)} /> : null}
        </main>

        {tab === "inventory" ? (
          <InventoryRail open={railOpen} onToggle={() => setRailOpen((value) => !value)} />
        ) : tab === "magic" ? (
          <MagicRail open={railOpen} onToggle={() => setRailOpen((value) => !value)} />
        ) : tab === "character" ? (
          <EffectsRail
            gm={gm}
            open={railOpen}
            sections={railSections}
            onToggle={() => setRailOpen((value) => !value)}
            onSection={(key) => setRailSections((previous) => ({ ...previous, [key]: !previous[key] }))}
            onSave={() => setSaveAttempt(true)}
            onToast={showToast}
          />
        ) : null}
      </div>

      {detail ? <StatDrawer gm={gm} stat={detail} onClose={() => setDetail(undefined)} onToast={showToast} /> : null}
      {profileOpen ? <ProfileDrawer onClose={() => setProfileOpen(false)} onToast={showToast} /> : null}
      {targeting ? <TargetDialog onClose={() => setTargeting(false)} onCast={() => { setTargeting(false); showToast("Spell sent to 3 affected character sheets"); }} /> : null}
      {saveAttempt ? <SaveDialog onClose={() => setSaveAttempt(false)} onResolve={() => { setSaveAttempt(false); showToast("Will save succeeded · Hold Person removed"); }} /> : null}
      {healthOpen ? <HealthDrawer scenario={scenario} onClose={() => setHealthOpen(false)} onToast={showToast} /> : null}
      {restOpen ? <RestDialog scenario={scenario} onClose={() => setRestOpen(false)} onRest={() => { setRestOpen(false); showToast("Rest completed · HP and daily resources restored"); }} /> : null}
      {leveling ? <LevelUpDialog scenario={scenario} target={leveling} onClose={() => setLeveling(undefined)} onContinue={() => { const editing = leveling.editing; setLeveling(undefined); showToast(editing ? "Level changes staged for review" : "Level-up workflow opened at hit points"); }} /> : null}
      {creationGuideOpen ? <CreationGuideDialog scenario={scenario} onClose={() => setCreationGuideOpen(false)} /> : null}
      {toast ? <div className="mock-toast" role="status">{toast}</div> : null}
    </div>
  );
}

function GmCommandBar({ onToast }: { onToast: (message: string) => void }) {
  return (
    <div className="gm-command-bar">
      <span className="gm-badge">GM · Campaign copy</span>
      <button className="command-button active">● On tabletop</button>
      <label>Initiative <input type="number" defaultValue={22} /></label>
      <label>Group <select defaultValue="Boss"><option>Boss</option><option>Independent</option></select></label>
      <label>Turn state <select><option>Normal</option><option>Delayed</option><option>Readied</option></select></label>
      <label className="compact-check"><input type="checkbox" defaultChecked /> Dual initiative</label>
      <button className="quiet-button" onClick={() => onToast("Campaign copy saved")}>Saved · now</button>
    </div>
  );
}

function Section({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mock-panel ${className}`}>
      <header className="panel-heading"><h2>{title}</h2>{action}</header>
      {children}
    </section>
  );
}

function StatButton({ label, value, helper, onClick, tone = "" }: { label: string; value: string; helper?: string; onClick: () => void; tone?: string }) {
  return (
    <button className={`stat-button ${tone}`} onClick={onClick}>
      <span>{label}</span><strong>{value}</strong>{helper ? <small>{helper}</small> : null}
    </button>
  );
}

function CharacterTab({ gm, scenario, onDetail, onHealth, onRest }: { gm: boolean; scenario: ScenarioKey; onDetail: (stat: string) => void; onHealth: () => void; onRest: () => void }) {
  const abilities = gm ? MONSTER_ABILITIES : ABILITIES;
  const skills = gm ? MONSTER_SKILLS : SKILLS;
  return (
    <div className="character-sheet-grid">
      <div className="character-left-column">
        <Section title="Ability scores" action={<span className="section-note">Select any value for its math</span>}>
          <div className="ability-table">
            {abilities.map(([key, score, modifier]) => (
              <button key={key} onClick={() => onDetail(`${key} ${score}`)}>
                <b>{key}</b><strong>{score}</strong><span>{modifier}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Defense & health" action={<div className="section-actions"><button className="text-button" onClick={onHealth}>Manage Health</button><button className="rest-button" onClick={onRest}>Rest</button></div>}>
          <div className="defense-grid">
            <StatButton label="Armor class" value={gm ? "28" : "22"} helper="normal" onClick={() => onDetail("Armor Class")} />
            <StatButton label="Touch" value={gm ? "14" : "14"} onClick={() => onDetail("Touch AC")} />
            <StatButton label="Flat-footed" value={gm ? "24" : "18"} onClick={() => onDetail("Flat-footed AC")} />
            <StatButton label="Fortitude" value={gm ? "+12" : "+9"} helper="roll" onClick={() => onDetail("Fortitude")} />
            <StatButton label="Reflex" value={gm ? "+15" : "+11"} helper="roll" onClick={() => onDetail("Reflex")} />
            <StatButton label="Will" value={gm ? "+10" : "+8"} helper="roll" onClick={() => onDetail("Will")} />
          </div>
          <div className="health-inline">
            <span><b>{gm ? "96" : "48"}</b> / {gm ? "118" : "62"} HP</span>
            <div className="health-meter"><i style={{ width: gm ? "81%" : "77%" }} /></div>
            <span className="micro-stat">Temp <b>0</b></span>
            <span className="micro-stat">Nonlethal <b>0</b></span>
            <button onClick={onHealth}>Damage</button><button onClick={onHealth}>Heal</button>
          </div>
        </Section>

        <Section title="Combat & movement">
          <div className="combat-strip">
            <StatButton label="Base attack" value={gm ? "+9" : "+7"} onClick={() => onDetail("Base Attack Bonus")} />
            <StatButton label="Initiative" value={gm ? "+9" : "+5"} helper="roll" onClick={() => onDetail("Initiative")} />
            <StatButton label="Speed" value={gm ? "40 ft" : "30 ft"} onClick={() => onDetail("Speed")} />
            <StatButton label="CMB" value={gm ? "+19" : "+11"} helper="roll" onClick={() => onDetail("CMB")} />
            <StatButton label="CMD" value={gm ? "33" : "25"} onClick={() => onDetail("CMD")} />
          </div>
        </Section>

        <Section title="Weapons" action={<span className="section-note">Attack-ready loadout</span>}>
          <div className="weapon-table" role="table" aria-label="Carried weapons">
            <div className="weapon-head" role="row"><span>Weapon</span><span>Attack</span><span>Damage</span><span>Critical</span><span>Ammunition</span><span /></div>
            {(gm ? [
              ["Bite", "+19", "2d6+15", "20/×2", "—"],
              ["Claw ×2", "+19", "1d8+10", "20/×2", "—"],
            ] : [
              ["Ashwood longbow +1", "+14/+9", "1d8+5", "×3", "Cold iron 18"],
              ["Elven curve blade", "+11/+6", "1d10+6", "18–20/×2", "—"],
            ]).map((weapon) => (
              <div className="weapon-row" role="row" key={weapon[0]}>
                {weapon.map((value, index) => <span key={`${weapon[0]}-${index}`}><b>{index === 0 ? value : undefined}</b>{index === 0 ? null : value}</span>)}
                <button onClick={() => onDetail(`${weapon[0]} attack`)}>Attack</button>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Feats & special abilities" className="reference-panel">
          <div className="reference-list">
            {(gm ? ["Blood Drain", "Change Shape", "Grab", "Pounce", "Sneak Attack +1d6", "Uncanny Dodge", "Vampire Resistances"] : FEATS).map((feat) => (
              <button key={feat} onClick={() => onDetail(feat)}>{feat}<span>View</span></button>
            ))}
          </div>
        </Section>
      </div>

      <aside className="skills-panel mock-panel">
        <header className="panel-heading"><h2>Skills</h2><span className="section-note">Tap a row to roll</span></header>
        <div className="skill-heading"><span>Skill</span><span>Ability</span><span>Total</span><span /></div>
        <div className="skill-list">
          {skills.map(([name, ability, total, flag]) => (
            <button key={name} onClick={() => onDetail(name)}>
              <span>{name}{flag ? <small>{flag}</small> : null}</span><span>{ability}</span><strong>{total}</strong><em>Roll</em>
            </button>
          ))}
        </div>
        <details className="compact-details"><summary>Languages & senses</summary><p>Common, Elven, Sylvan · Low-light vision</p></details>
        <details className="compact-details"><summary>Resistances & immunities</summary><p>{gm ? "Cold 10, electricity 10 · undead immunities" : "Trackless step · favored terrain"}</p></details>
      </aside>
    </div>
  );
}

function EffectsRail({ gm, open, sections, onToggle, onSection, onSave, onToast }: { gm: boolean; open: boolean; sections: Record<RailSectionKey, boolean>; onToggle: () => void; onSection: (key: RailSectionKey) => void; onSave: () => void; onToast: (message: string) => void }) {
  if (!open) return <aside className="collapsed-rail"><button onClick={onToggle} aria-label="Open abilities and effects rail"><span>‹</span><b>Abilities &amp; Effects</b><i>3</i></button></aside>;
  return (
    <aside className="side-rail effects-rail">
      <header className="rail-heading"><div><span className="eyebrow">At the table</span><h2>Abilities &amp; Effects</h2></div><button onClick={onToggle} aria-label="Collapse abilities and effects rail">›</button></header>
      <label className="rail-search"><span>Search</span><input placeholder="Ability, condition, source…" /></label>
      <RailSection title="Active Now" count={3} open={sections.active} onToggle={() => onSection("active")}>
        <EffectCard title="Hunter’s Bond" source="Ranger · player" tone="active" action={<button onClick={() => onToast("Hunter’s Bond ended")}>End</button>}><p>Allies gain +2 against Seren’s quarry.</p><span>8 rounds remaining</span></EffectCard>
        <EffectCard title="Bless" source="Brann Ironwood · spell" tone="active" action={<button onClick={() => onToast("Bless removed by its source")}>Remove</button>}><p>+1 morale bonus on attacks and fear saves.</p><span>Source may remove</span></EffectCard>
      </RailSection>
      <RailSection title="My Abilities" count={5} open={sections.abilities} onToggle={() => onSection("abilities")}>
        <EffectCard title="Deadly Aim" source="Feat · player" action={<label className="switch"><input type="checkbox" /><span /></label>}><p>Trade ranged accuracy for damage.</p></EffectCard>
        <EffectCard title="Favored Terrain" source="Ranger · passive" action={<button onClick={() => onToast("Terrain selector opened")}>Apply</button>}><p>Choose the terrain currently in play.</p></EffectCard>
      </RailSection>
      <RailSection title="Effects & Conditions" count={1} open={sections.effects} onToggle={() => onSection("effects")}>
        <EffectCard title="Hold Person" source="Hollow Warden · Will DC 18" tone="danger" action={<button onClick={onSave}>Attempt save</button>}><p>Paralyzed. Attempt another Will save at the end of each turn.</p><span>{gm ? "GM may remove at any time" : "You or the source may remove"}</span></EffectCard>
        {gm ? <button className="rail-primary" onClick={() => onToast("Modifier composer opened")}>+ Add effect or modifier</button> : null}
      </RailSection>
    </aside>
  );
}

function RailSection({ title, count, open, onToggle, children }: { title: string; count: number; open: boolean; onToggle: () => void; children: ReactNode }) {
  return <section className="rail-section"><button className="rail-section-toggle" aria-expanded={open} onClick={onToggle}><span>{title}</span><b>{count}</b><i>{open ? "−" : "+"}</i></button>{open ? <div className="rail-section-body">{children}</div> : null}</section>;
}

function EffectCard({ title, source, tone = "", action, children }: { title: string; source: string; tone?: string; action: ReactNode; children: ReactNode }) {
  return <article className={`effect-card ${tone}`}><header><div><strong>{title}</strong><span>{source}</span></div>{action}</header>{children}</article>;
}

function NotesTab({ gm }: { gm: boolean }) {
  const [notes, setNotes] = useState(NOTES);
  const [selected, setSelected] = useState(NOTES[0]!.id);
  const [search, setSearch] = useState("");
  const note = notes.find((entry) => entry.id === selected) ?? notes[0] ?? NOTES[0]!;
  const visible = notes.filter((entry) => `${entry.title} ${entry.body}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => Number(b.pinned) - Number(a.pinned));
  function update(patch: Partial<MockNote>) { setNotes((previous) => previous.map((entry) => entry.id === note.id ? { ...entry, ...patch } : entry)); }
  return (
    <div className="notes-workspace">
      <aside className="notes-index mock-panel">
        <header><span className="eyebrow">{gm ? "GM character notes" : "My character notes"}</span><h2>Notes <small>{notes.length}</small></h2><button onClick={() => { const next = { id: `note-${Date.now()}`, title: "Untitled note", category: "General", pinned: false, body: "" }; setNotes([...notes, next]); setSelected(next.id); }}>+ New note</button></header>
        <input className="notes-search" aria-label="Search notes" placeholder="Search notes…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="note-list">{visible.map((entry) => <button key={entry.id} className={entry.id === note.id ? "active" : ""} onClick={() => setSelected(entry.id)}><span>{entry.pinned ? "◆ Pinned · " : ""}{entry.category}</span><strong>{entry.title}</strong><small>{entry.body.slice(0, 72)}</small></button>)}</div>
        <p className="privacy-note">{gm ? "Visible only to the GM in The Ashen Road." : "Visible only to you. Campaign GMs cannot access these notes."}</p>
      </aside>
      <section className="note-editor mock-panel">
        <header><span className="privacy-lock">Private · Autosaved just now</span><button className={note.pinned ? "active" : ""} onClick={() => update({ pinned: !note.pinned })}>{note.pinned ? "Pinned" : "Pin"}</button></header>
        <input className="note-title" aria-label="Note title" value={note.title} onChange={(event) => update({ title: event.target.value })} />
        <div className="note-toolbar"><select aria-label="Note category" value={note.category} onChange={(event) => update({ category: event.target.value })}><option>Session</option><option>Location</option><option>Character</option><option>Plot</option><option>General</option></select><button><b>B</b></button><button><i>I</i></button><button>List</button><button>Link</button></div>
        <textarea aria-label="Note body" value={note.body} onChange={(event) => update({ body: event.target.value })} />
      </section>
    </div>
  );
}

function InventoryTab({ scenario, onToast }: { scenario: ScenarioKey; onToast: (message: string) => void }) {
  const empty = scenario === "monster";
  return (
    <div className="inventory-page">
      <div className="inventory-summary-strip">
        <span><small>Platinum</small><b>4</b></span><span><small>Gold</small><b>286</b></span><span><small>Silver</small><b>17</b></span><span><small>Copper</small><b>8</b></span><span className="wide"><small>Total wealth</small><b>{empty ? "1,200 gp" : "14,822 gp"}</b></span><span className="wide"><small>Carried load</small><b>{empty ? "68 / 1,600 lb" : "61 / 100 lb"}</b></span><button onClick={() => onToast("Coin editor opened")}>Edit coins</button>
      </div>
      <section className="carried-weapons mock-panel">
        <header className="panel-heading"><h2>Carried weapons</h2><button onClick={() => onToast("Weapon picker opened")}>+ Add weapon</button></header>
        <div className="weapon-table">
          <div className="weapon-head"><span>Weapon</span><span>Ready</span><span>Attack</span><span>Damage</span><span>Ammunition</span><span /></div>
          {(empty ? [["Bite", "Natural", "+19", "2d6+15", "—"]] : [["Ashwood longbow +1", "Two hands", "+14/+9", "1d8+5", "Cold iron arrows · 18"], ["Elven curve blade", "Stowed", "+11/+6", "1d10+6", "—"]]).map((row) => <div className="weapon-row" key={row[0]}>{row.map((value, index) => <span key={value}><b>{index === 0 ? value : undefined}</b>{index ? value : null}</span>)}<button>Manage</button></div>)}
        </div>
      </section>
      <div className="inventory-body-grid">
        <section className="equipment-focus mock-panel">
          <header className="panel-heading"><div><span className="eyebrow">Equipped now</span><h2>Equipment</h2></div><span className="section-note">Select a slot to inspect or replace it</span></header>
          {empty ? <div className="inventory-empty"><strong>No worn equipment</strong><p>Add treasure, armor, or magic items without changing the base codex creature.</p><button onClick={() => onToast("Equipment picker opened")}>Add equipment</button></div> : <EquipmentSilhouette equippedSlots={PLAYER_EQUIPMENT} />}
        </section>
        <div className="inventory-lists">
          <Section title="Carried" action={<b className="count-badge">8</b>}><InventoryRows rows={[["Explorer’s pack", "1", "14 lb"], ["Potion of cure moderate wounds", "2", "—"], ["Rope, silk · 50 ft", "1", "5 lb"], ["Cold iron arrows", "18", "2.7 lb"]]} /></Section>
          <Section title="Stored" action={<b className="count-badge">4</b>}><InventoryRows rows={[["Winter blanket", "1", "3 lb"], ["Silver arrows", "12", "1.8 lb"], ["Antitoxin", "2", "—"], ["Merchant’s clothes", "1", "6 lb"]]} /></Section>
        </div>
      </div>
    </div>
  );
}

function InventoryRows({ rows }: { rows: string[][] }) { return <div className="inventory-rows">{rows.map((row) => <button key={row[0]}><strong>{row[0]}</strong><span>×{row[1]}</span><small>{row[2]}</small><i>›</i></button>)}</div>; }

function InventoryRail({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  if (!open) return <aside className="collapsed-rail"><button onClick={onToggle}><span>‹</span><b>Inventory search</b></button></aside>;
  return <aside className="side-rail inventory-rail"><header className="rail-heading"><div><span className="eyebrow">Find & manage</span><h2>Inventory</h2></div><button onClick={onToggle}>›</button></header><label className="rail-search"><span>Search</span><input placeholder="Item, slot, container…" /></label><div className="filter-stack"><label>Location<select><option>All locations</option><option>Carried</option><option>Stored</option></select></label><label>Type<select><option>All item types</option><option>Weapons</option><option>Armor</option><option>Consumables</option><option>Magic items</option></select></label><label>Sort<select><option>Manual order</option><option>Name</option><option>Weight</option><option>Value</option></select></label></div><div className="rail-callout"><strong>61 lb carried</strong><p>Light load · 39 lb before medium load</p></div><button className="rail-primary">+ Add inventory item</button><button className="rail-secondary">View equipment warnings <b>1</b></button></aside>;
}

interface MockSpell {
  name: string;
  level: number | "—";
  description: string;
  dc: string;
  components: string;
  preparation: string;
  kind?: "domain" | "normal";
}

const SPELL_RULES: Record<string, { school: string; castingTime: string; range: string; target: string; duration: string; resistance: string; full: string }> = {
  Bless: { school: "Enchantment (compulsion) [mind-affecting]", castingTime: "1 standard action", range: "50 ft", target: "All allies within a 50-ft burst centered on you", duration: "1 minute / level", resistance: "Yes (harmless)", full: "Bless fills your allies with courage. Each ally gains a +1 morale bonus on attack rolls and on saving throws against fear effects. Bless counters and dispels bane." },
  Longstrider: { school: "Transmutation", castingTime: "1 standard action", range: "Personal", target: "You", duration: "1 hour / level", resistance: "No", full: "This spell gives you a +10-foot enhancement bonus to your base land speed. It has no effect on other modes of movement." },
  "Hold Person": { school: "Enchantment (compulsion) [mind-affecting]", castingTime: "1 standard action", range: "Medium", target: "One humanoid creature", duration: "1 round / level", resistance: "Yes", full: "The subject becomes paralyzed and freezes in place. At the end of each turn, the subject may attempt a new Will save to end the effect." },
  "Locate Object": { school: "Divination", castingTime: "1 standard action", range: "Long", target: "Circle centered on you", duration: "1 minute / level", resistance: "No", full: "You sense the direction of a well-known or clearly visualized object. The spell can locate a general kind of object, but lead and certain transformations block it." },
  Prayer: { school: "Enchantment (compulsion) [mind-affecting]", castingTime: "1 standard action", range: "40 ft", target: "All allies and foes in a 40-ft burst", duration: "1 round / level", resistance: "Yes", full: "Allies gain a +1 luck bonus on attack rolls, weapon damage rolls, saves, and skill checks. Enemies take a −1 penalty on those rolls." },
  Fly: { school: "Transmutation", castingTime: "1 standard action", range: "Touch", target: "Creature touched", duration: "1 minute / level", resistance: "Yes (harmless)", full: "The subject gains a fly speed of 60 feet with good maneuverability. The spell supports normal movement and safe descent when its duration ends." },
  "Mirror Image": { school: "Illusion (figment)", castingTime: "1 standard action", range: "Personal", target: "You", duration: "1 minute / level", resistance: "No", full: "Several illusory duplicates surround you and make it difficult for enemies to determine which target is real. Successful attacks may destroy an image instead of striking you." },
  Web: { school: "Conjuration (creation)", castingTime: "1 standard action", range: "Medium", target: "Webs in a 20-ft-radius spread", duration: "10 minutes / level", resistance: "No", full: "Sticky strands fill the area, grappling creatures and creating difficult terrain. The webs must be anchored and can be burned or cut away." },
  Haste: { school: "Transmutation", castingTime: "1 standard action", range: "Close", target: "One creature / level, no two more than 30 ft apart", duration: "1 round / level", resistance: "Yes (harmless)", full: "Affected creatures move faster, gain a +1 bonus on attack rolls, AC, and Reflex saves, and gain one additional attack during a full attack." },
  "Dispel Magic": { school: "Abjuration", castingTime: "1 standard action", range: "Medium", target: "One spellcaster, creature, object, or spell", duration: "Instantaneous", resistance: "No", full: "Choose a targeted dispel or counterspell. Make a caster-level check against the effect's dispel DC; successful checks end eligible spells without affecting their remaining duration." },
};

function MagicTab({ scenario, onTarget, onToast }: { scenario: ScenarioKey; onTarget: () => void; onToast: (message: string) => void }) {
  const defaultSource = scenario === "multiclass" ? "cleric" : scenario === "monster" ? "sla" : "ranger";
  const [source, setSource] = useState(defaultSource);
  const [view, setView] = useState<"prepared" | "available" | "library">("prepared");
  const [prepareAmounts, setPrepareAmounts] = useState<Record<string, number>>({});
  const [spellDetail, setSpellDetail] = useState<MockSpell>();
  const [reprepareSpell, setReprepareSpell] = useState<MockSpell>();
  const sourceInfo = source === "wizard" ? { name: "Wizard 5", type: "Prepared · INT", level: "Caster level 5", concentration: "+9", dc: "DC 15–18", prepared: true } : source === "cleric" ? { name: "Cleric 5", type: "Prepared · WIS · Travel & Liberation domains", level: "Caster level 5", concentration: "+9", dc: "DC 15–18", prepared: true } : source === "sla" ? { name: "Vampire abilities", type: "Spell-like abilities · CHA", level: "Caster level 12", concentration: "+17", dc: "DC 15–22", prepared: false } : source === "granted" ? { name: "Granted / SLA", type: "Granted ability · WIS", level: "Caster level 10", concentration: "+14", dc: "DC 18", prepared: false } : { name: "Ranger 7", type: "Prepared · WIS", level: "Caster level 4", concentration: "+7", dc: "DC 14", prepared: true };
  const libraryMode = view === "library" && sourceInfo.prepared;
  const spellCatalog: Record<string, MockSpell[]> = {
    cleric: [
      { name: "Bless", level: 1, description: "Allies gain +1 on attack rolls and saves against fear.", dc: "—", components: "V, S, DF", preparation: "Prepared ×1", kind: "normal" },
      { name: "Longstrider", level: 1, description: "Increase your base land speed by 10 feet.", dc: "—", components: "V, S, M", preparation: "Domain slot ×1", kind: "domain" },
      { name: "Hold Person", level: 2, description: "Paralyze one humanoid; a new save is allowed each round.", dc: "Will 17", components: "V, S, F/DF", preparation: "Prepared ×2", kind: "normal" },
      { name: "Locate Object", level: 2, description: "Sense the direction of a familiar or described object.", dc: "—", components: "V, S, F/DF", preparation: "Domain slot ×1", kind: "domain" },
      { name: "Prayer", level: 3, description: "Allies gain +1 and enemies take −1 on attacks, damage, and saves.", dc: "—", components: "V, S, DF", preparation: "Prepared ×1", kind: "normal" },
      { name: "Fly", level: 3, description: "Grant a creature a 60-foot fly speed with good maneuverability.", dc: "Will 18", components: "V, S, F/DF", preparation: "Domain slot ×1", kind: "domain" },
    ],
    wizard: [
      { name: "Mirror Image", level: 2, description: "Create illusory duplicates that misdirect incoming attacks.", dc: "—", components: "V, S", preparation: "Prepared ×2" },
      { name: "Web", level: 2, description: "Fill an area with sticky strands that grapple and hinder movement.", dc: "Ref 17", components: "V, S, M", preparation: "Prepared ×1" },
      { name: "Haste", level: 3, description: "Grant extra speed, attacks, and defensive bonuses to allies.", dc: "—", components: "V, S, M", preparation: "Prepared ×1" },
      { name: "Dispel Magic", level: 3, description: "End one spell or counter an active magical effect.", dc: "CL check", components: "V, S", preparation: "Prepared ×1" },
    ],
    ranger: [
      { name: "Gravity Bow", level: 1, description: "Your bow deals damage as though it were one size larger.", dc: "—", components: "V, S", preparation: "Prepared ×1" },
      { name: "Longstrider", level: 1, description: "Increase your base land speed by 10 feet.", dc: "—", components: "V, S, M", preparation: "Prepared ×1" },
      { name: "Lead Blades", level: 1, description: "Your melee weapons deal damage as if one size larger.", dc: "—", components: "V, S", preparation: "Prepared ×1" },
    ],
    sla: [
      { name: "Dominate", level: 5, description: "Control a humanoid through a sustained mental link.", dc: "Will 21", components: "—", preparation: "At will" },
      { name: "Children of the Night", level: "—", description: "Call a swarm or pack of nocturnal creatures.", dc: "—", components: "—", preparation: "1/day" },
      { name: "Gaseous Form", level: "—", description: "Assume an insubstantial mist form.", dc: "—", components: "—", preparation: "At will" },
    ],
    granted: [
      { name: "Starlight Step", level: 3, description: "Teleport between two spaces touched by dim light.", dc: "Will 18", components: "V", preparation: "1/day" },
    ],
  };
  const libraryExtras: MockSpell[] = source === "cleric" ? [
    { name: "Remove Fear", level: 1, description: "Suppress fear and grant a bonus against later fear effects.", dc: "—", components: "V, S", preparation: "Domain option", kind: "domain" },
    { name: "Cure Light Wounds", level: 1, description: "Restore 1d8 + caster level hit points.", dc: "Will 16", components: "V, S", preparation: "Not prepared", kind: "normal" },
    { name: "Shield of Faith", level: 1, description: "Grant a deflection bonus to armor class.", dc: "Will 16", components: "V, S, M", preparation: "Not prepared", kind: "normal" },
    { name: "Cure Moderate Wounds", level: 2, description: "Restore 2d8 + caster level hit points.", dc: "Will 17", components: "V, S", preparation: "Not prepared", kind: "normal" },
    { name: "Silence", level: 2, description: "Suppress sound in a 20-foot radius.", dc: "Will 17", components: "V, S", preparation: "Not prepared", kind: "normal" },
    { name: "Remove Paralysis", level: 2, description: "Free one or more creatures from paralysis or slowing magic.", dc: "Will 17", components: "V, S", preparation: "Domain option", kind: "domain" },
    { name: "Daylight", level: 3, description: "Create bright light that counters magical darkness.", dc: "—", components: "V, S", preparation: "Not prepared", kind: "normal" },
    { name: "Remove Curse", level: 3, description: "Attempt to end a curse affecting a creature or object.", dc: "CL check", components: "V, S", preparation: "Domain option", kind: "domain" },
  ] : [];
  const spells = libraryMode ? [...(spellCatalog[source] ?? []), ...libraryExtras] : spellCatalog[source] ?? [];
  const availableSlots: Record<number, number> = { 0: 4, 1: 3, 2: 2, 3: 2, 4: 0, 5: 1 };
  return (
    <div className="magic-page">
      <div className="casting-sources" role="tablist" aria-label="Casting source">
        {scenario === "multiclass" ? <><button className={source === "cleric" ? "active" : ""} onClick={() => { setSource("cleric"); setView("prepared"); }}><span>Divine</span><strong>Cleric 5</strong><small>7 slots ready</small></button><button className={source === "wizard" ? "active" : ""} onClick={() => { setSource("wizard"); setView("prepared"); }}><span>Arcane</span><strong>Wizard 5</strong><small>6 slots ready</small></button><button className={source === "granted" ? "active" : ""} onClick={() => { setSource("granted"); setView("prepared"); }}><span>Other</span><strong>Granted / SLA</strong><small>1 ability</small></button></> : <button className="active"><span>{scenario === "monster" ? "Template" : "Class"}</span><strong>{sourceInfo.name}</strong><small>Active source</small></button>}
        <button className="add-source">+ Add source</button>
      </div>
      <section className="casting-header mock-panel">
        <div><span className="eyebrow">Selected casting source</span><h2>{sourceInfo.name}</h2><p>{sourceInfo.type}</p></div>
        <StatButton label="Caster level" value={sourceInfo.level.replace("Caster level ", "")} onClick={() => undefined} />
        <StatButton label="Concentration" value={sourceInfo.concentration} onClick={() => undefined} />
        <StatButton label="Save DC range" value={sourceInfo.dc.replace("DC ", "")} onClick={() => undefined} />
        <button className="quiet-button">Manage source</button>
      </section>
      <section className="slot-ledger mock-panel">
        <header className="panel-heading"><h2>Daily magic</h2><span className="section-note">Prepared · available · spent</span></header>
        <div className="level-ledger">{[["0", "4", "At will", "4 ready"], ["1", source === "cleric" ? "3 + 1" : "4", source === "cleric" ? "Domain 1" : "1 spent", "3 ready"], ["2", source === "cleric" ? "2 + 1" : "3", source === "cleric" ? "Domain 1" : "1 spent", "2 ready"], ["3", source === "cleric" ? "2 + 1" : "2", source === "cleric" ? "Domain 1" : "0 spent", "2 ready"], ["4", "—", "—", "Locked"]].map((row) => <button key={row[0]}><span>Level {row[0]}</span><strong>{row[1]}</strong><small>{row[2]}</small><em>{row[3]}</em></button>)}</div>
      </section>
      <section className="spell-table-panel mock-panel">
        <header className="panel-heading"><div><span className="eyebrow">{libraryMode ? "Prepare from this source" : "Ready to cast"}</span><h2>Spells</h2></div><div className="inline-filters"><button className={view === "prepared" ? "active" : ""} onClick={() => setView("prepared")}>Prepared</button><button className={view === "available" ? "active" : ""} onClick={() => setView("available")}>Available</button><button className={libraryMode ? "active" : ""} disabled={!sourceInfo.prepared} onClick={() => setView("library")}>Library</button></div></header>
        {source === "cleric" ? <div className="domain-key"><span className="spell-kind domain">Domain</span><p>Travel and Liberation domain spells share the dedicated +1 domain slot at each spell level.</p></div> : null}
        <div className="spell-table"><div className="spell-head"><span>Spell</span><span>Level</span><span>DC</span><span>Components</span><span>{libraryMode ? "Prepare" : "Status"}</span><span /></div>{spells.map((spell) => {
          const maxPrepare = typeof spell.level === "number" ? spell.kind === "domain" ? 1 : availableSlots[spell.level] ?? 0 : 0;
          const amount = prepareAmounts[spell.name] ?? Math.min(1, maxPrepare);
          return <div className={`spell-row ${spell.kind === "domain" ? "domain-spell" : ""}`} key={`${spell.name}-${spell.kind ?? "spell"}`}><button className="spell-detail-trigger" onClick={() => setSpellDetail(spell)}><span><strong>{spell.name}</strong><span className={`spell-kind ${spell.kind === "domain" ? "domain" : "standard"}`}>{spell.kind === "domain" ? "Domain" : "Spell"}</span><small>{spell.description}</small></span><em>View full spell</em></button><span>{spell.level}</span><span>{spell.dc}</span><span>{spell.components}</span>{libraryMode ? <label className="prepare-amount"><span className="sr-only">Prepare quantity</span><select value={amount} onChange={(event) => setPrepareAmounts((previous) => ({ ...previous, [spell.name]: Number(event.target.value) }))}>{Array.from({ length: maxPrepare + 1 }, (_, index) => <option key={index} value={index}>{index}</option>)}</select><small>of {maxPrepare} open</small></label> : <span>{spell.preparation}</span>}<div className="spell-actions"><button onClick={libraryMode ? () => onToast(`${amount} × ${spell.name} prepared`) : onTarget}>{libraryMode ? spell.kind === "domain" ? "Prepare Domain" : "Prepare" : "Cast"}</button>{sourceInfo.prepared && view === "prepared" ? <button className="reprepare-button" onClick={() => setReprepareSpell(spell)}>Reprepare</button> : null}</div></div>;
        })}</div>
      </section>
      {spellDetail ? <SpellDetailDialog spell={spellDetail} sourceName={sourceInfo.name} libraryMode={libraryMode} onClose={() => setSpellDetail(undefined)} onAction={() => { setSpellDetail(undefined); if (libraryMode) onToast(`${spellDetail.name} added to preparation`); else onTarget(); }} /> : null}
      {reprepareSpell ? <ReprepareDialog spell={reprepareSpell} sourceName={sourceInfo.name} options={[...(spellCatalog[source] ?? []), ...libraryExtras].filter((candidate) => candidate.level === reprepareSpell.level && candidate.name !== reprepareSpell.name && (reprepareSpell.kind === "domain" ? candidate.kind === "domain" : candidate.kind !== "domain"))} onClose={() => setReprepareSpell(undefined)} onConfirm={(replacement) => { setReprepareSpell(undefined); onToast(`${reprepareSpell.name} reprepared as ${replacement}`); }} /> : null}
    </div>
  );
}

function SpellDetailDialog({ spell, sourceName, libraryMode, onClose, onAction }: { spell: MockSpell; sourceName: string; libraryMode: boolean; onClose: () => void; onAction: () => void }) {
  const rules = SPELL_RULES[spell.name] ?? { school: "Class spell or supernatural effect", castingTime: "1 standard action", range: "See source", target: "See source", duration: "See source", resistance: "See source", full: `${spell.description} The complete source text, scaling, exceptions, and interaction rules appear here when connected to the rules catalog.` };
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="spell-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="spell-detail-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">{sourceName} · Level {spell.level}</span><div className="spell-dialog-title"><h2 id="spell-detail-title">{spell.name}</h2>{spell.kind === "domain" ? <span className="spell-kind domain">Domain</span> : null}</div><p>{rules.school}</p></div><button onClick={onClose}>×</button></header><dl className="spell-rules-grid"><div><dt>Casting time</dt><dd>{rules.castingTime}</dd></div><div><dt>Components</dt><dd>{spell.components}</dd></div><div><dt>Range</dt><dd>{rules.range}</dd></div><div><dt>Target / Area</dt><dd>{rules.target}</dd></div><div><dt>Duration</dt><dd>{rules.duration}</dd></div><div><dt>Saving throw</dt><dd>{spell.dc}</dd></div><div><dt>Spell resistance</dt><dd>{rules.resistance}</dd></div><div><dt>Preparation</dt><dd>{spell.preparation}</dd></div></dl><section className="spell-full-description"><h3>Description</h3><p>{rules.full}</p></section>{spell.kind === "domain" ? <div className="domain-detail-note"><span className="spell-kind domain">Domain slot</span><p>This spell belongs to the selected domain and uses that level’s dedicated domain slot when prepared.</p></div> : null}<footer><button className="quiet-button" onClick={onClose}>Close</button><button className="dialog-primary" onClick={onAction}>{libraryMode ? "Prepare Spell" : "Cast Spell"}</button></footer></section></div>;
}

function ReprepareDialog({ spell, sourceName, options, onClose, onConfirm }: { spell: MockSpell; sourceName: string; options: MockSpell[]; onClose: () => void; onConfirm: (replacement: string) => void }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(options[0]?.name ?? "");
  const visible = options.filter((option) => `${option.name} ${option.description}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="reprepare-dialog" role="dialog" aria-modal="true" aria-labelledby="reprepare-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">{sourceName} · Level {spell.level} {spell.kind === "domain" ? "domain" : "prepared"} slot</span><h2 id="reprepare-title">Reprepare {spell.name}</h2><p>Release this preparation and replace it with another known spell for the same slot.</p></div><button onClick={onClose}>×</button></header><ol className="reprepare-steps"><li className="complete"><b>1</b><span>Release slot</span></li><li className="active"><b>2</b><span>Choose spell</span></li><li><b>3</b><span>Confirm</span></li></ol><div className="reprepare-slot"><span>Current preparation</span><strong>{spell.name}</strong><em>{spell.kind === "domain" ? "Domain slot" : `Level ${spell.level} slot`} · changes on confirmation</em></div><label className="dialog-search">Known spells eligible for this slot<input placeholder="Search known spells…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>{spell.kind === "domain" ? <p className="reprepare-rule">Only spells granted by the character’s selected domains are eligible for this domain slot.</p> : null}<div className="replacement-list">{visible.map((option) => <button key={option.name} className={selected === option.name ? "selected" : ""} onClick={() => setSelected(option.name)}><span><strong>{option.name}</strong><small>{option.description}</small></span><span><b>{option.dc}</b><small>{option.components}</small></span><em>{selected === option.name ? "Selected" : "Choose"}</em></button>)}</div><div className="reprepare-summary"><span>After confirmation</span><strong>{spell.name} → {selected || "Choose a replacement"}</strong><small>The slot remains prepared and no additional slot is consumed.</small></div><footer><button className="quiet-button" onClick={onClose}>Cancel</button><button className="dialog-primary" disabled={!selected} onClick={() => onConfirm(selected)}>Confirm Reprepare</button></footer></section></div>;
}

function RestDialog({ scenario, onClose, onRest }: { scenario: ScenarioKey; onClose: () => void; onRest: () => void }) {
  const gmMonster = scenario === "monster";
  const multiclass = scenario === "multiclass";
  const currentHp = gmMonster ? 96 : multiclass ? 53 : 48;
  const maximumHp = gmMonster ? 118 : multiclass ? 53 : 62;
  const healing = gmMonster ? 0 : Math.min(maximumHp - currentHp, multiclass ? 10 : 7);
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="rest-dialog" role="dialog" aria-modal="true" aria-labelledby="rest-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">The Ashen Road · Campaign rest rules</span><h2 id="rest-title">Take a Rest</h2><p>Preview every recovery change before advancing the character’s rest state.</p></div><button onClick={onClose}>×</button></header><div className="rest-rule-card"><div><span>Rest period</span><strong>8 hours</strong></div><div><span>Natural healing</span><strong>{gmMonster ? "Not eligible" : `Level × 1 · +${healing} HP`}</strong></div><div><span>Interruption rule</span><strong>1 hour of strenuous activity breaks rest</strong></div></div><section className="rest-results"><h3>Rest will restore</h3><div><article><span>Hit points</span><strong>{currentHp} → {currentHp + healing}</strong><small>{healing ? `Recover ${healing} HP under campaign rules` : gmMonster ? "Undead do not receive natural healing from rest" : "Already at maximum HP"}</small></article><article><span>Spell slots</span><strong>All expended slots</strong><small>Existing prepared spells stay assigned; use Reprepare to change them</small></article><article><span>Daily resources</span><strong>Reset eligible uses</strong><small>Class features, magic items, and abilities marked per day</small></article><article><span>Conditions</span><strong>Rule-dependent only</strong><small>Conditions are not removed unless their duration or campaign rule says so</small></article></div></section><div className="rest-confirmation"><label><input type="checkbox" defaultChecked /> Apply rest to HP and daily resources</label><span>Last rest: Yesterday · 6:10 AM</span></div><footer><button className="quiet-button" onClick={onClose}>Cancel</button><button className="dialog-primary" onClick={onRest}>Complete Rest</button></footer></section></div>;
}

function MagicRail({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  if (!open) return <aside className="collapsed-rail"><button onClick={onToggle}><span>‹</span><b>Magic Search</b></button></aside>;
  return <aside className="side-rail magic-rail"><header className="rail-heading"><div><span className="eyebrow">Every source</span><h2>Find Magic</h2></div><button onClick={onToggle}>›</button></header><label className="rail-search"><span>Search</span><input placeholder="Spell, school, source…" /></label><div className="filter-stack"><label>Source<select><option>All casting sources</option><option>Cleric 5</option><option>Wizard 5</option><option>Granted / SLA</option></select></label><label>Level<select><option>All levels</option><option>Can cast now</option><option>0</option><option>1</option><option>2</option><option>3</option></select></label><label>Status<select><option>All statuses</option><option>Prepared</option><option>Available</option><option>Spent</option></select></label><label>School<select><option>All schools</option><option>Conjuration</option><option>Divination</option><option>Evocation</option></select></label></div><div className="rail-callout"><strong>13 spells ready</strong><p>Across 2 casting sources</p></div><button className="rail-primary">Prepare &amp; manage spells</button></aside>;
}

function BuildTab({ scenario, onToast, onLevelUp, onEditLevel, onCreationGuide }: { scenario: ScenarioKey; onToast: (message: string) => void; onLevelUp: () => void; onEditLevel: (level: number, className: string) => void; onCreationGuide: () => void }) {
  const multiclass = scenario === "multiclass";
  const currentLevel = multiclass ? 10 : 7;
  if (scenario === "monster") return <MonsterBuild onToast={onToast} onEditLevel={onEditLevel} />;
  const progression = multiclass
    ? [
        [1, "Cleric", 1, "Domains · feat · skills"],
        [2, "Wizard", 1, "Arcane school · spellbook"],
        [3, "Cleric", 2, "Channel energy · 2nd-level slots"],
        [4, "Wizard", 2, "Ability score +1 · arcane discovery"],
        [5, "Cleric", 3, "Feat · 2nd-level divine spells"],
        [6, "Wizard", 3, "3rd-level arcane spells"],
        [7, "Cleric", 4, "Channel energy 3d6 · domain power"],
        [8, "Wizard", 4, "Ability score +1 · school power"],
        [9, "Cleric", 5, "Feat · 3rd-level divine spells"],
        [10, "Wizard", 5, "Bonus feat · 3rd-level arcane spells"],
      ]
    : [
        [1, "Ranger", 1, "Favored enemy · feat · skills"],
        [2, "Ranger", 2, "Combat style feat"],
        [3, "Ranger", 3, "Endurance · favored terrain"],
        [4, "Ranger", 4, "Ability score +1 · hunter’s bond"],
        [5, "Ranger", 5, "Second favored enemy · feat"],
        [6, "Ranger", 6, "Combat style feat"],
        [7, "Ranger", 7, "Woodland stride · feat"],
      ];
  return (
    <div className="build-mock-page">
      <section className="build-summary mock-panel">
        <div><span className="eyebrow">Character progression</span><h2>{multiclass ? "Level 10 · Cleric 5 / Wizard 5" : "Level 7 · Ranger 7"}</h2><p>{multiclass ? "Human · Lawful Neutral" : "Half-elf · Neutral Good"} · All current choices resolved</p></div>
        <div className="foundation-chips"><span>Scores <b>{multiclass ? "10 · 14 · 12 · 18 · 18 · 11" : "18 · 17 · 14 · 12 · 16 · 13"}</b></span><span>Race <b>{multiclass ? "Human" : "Half-elf"}</b></span></div>
        <div className="build-actions"><button onClick={onCreationGuide}>Creation Guide</button><button onClick={() => onToast("Build Library opened with class, feat, skill, and spell filters")}>Build Library</button><button className="level-up-button" onClick={onLevelUp}>Level Up</button></div>
      </section>
      <div className="build-foundation-grid">
        <section className="build-foundation-section mock-panel">
          <header className="panel-heading"><div><span className="eyebrow">Creation choice · editable</span><h2>Race</h2></div><button onClick={() => onToast("Race editor opened with change-impact review")}>Modify Race</button></header>
          <div className="foundation-record"><div><strong>{multiclass ? "Human" : "Half-elf"}</strong><small>Medium humanoid · 30 ft speed</small></div><span className="foundation-status">Complete</span></div>
          <div className="trait-list">{(multiclass ? [["Skilled", "+1 skill rank at every level"], ["Bonus Feat", "Additional feat selected at 1st level"], ["Flexible Ability", "+2 Intelligence"]] : [["Adaptability", "Skill Focus selected at creation"], ["Elven Immunities", "Immune to magical sleep; +2 vs enchantments"], ["Keen Senses", "+2 racial bonus to Perception"], ["Multitalented", "Two favored classes selected"]]).map(([name, detail]) => <button key={name} onClick={() => onToast(`${name} racial trait opened`)}><span><strong>{name}</strong><small>{detail}</small></span><em>›</em></button>)}</div>
        </section>
        <section className="build-foundation-section mock-panel">
          <header className="panel-heading"><div><span className="eyebrow">Optional · campaign governed</span><h2>Campaign Traits</h2></div><button onClick={() => onToast("Campaign trait library opened")}>+ Add Trait</button></header>
          <div className="campaign-rule-line"><span>The Ashen Road allows <b>2</b> campaign traits</span><em>2 / 2 selected</em></div>
          <div className="trait-list">{(multiclass ? [["Scholar of the Old Ways", "+1 Knowledge (arcana); becomes a class skill"], ["Divine Witness", "+1 initiative when carrying a holy symbol"]] : [["Caravan Guard", "+1 Perception and Survival along trade routes"], ["Marked by the Bell", "+1 Will saves against sonic and fear effects"]]).map(([name, detail]) => <button key={name} onClick={() => onToast(`${name} campaign trait opened`)}><span><strong>{name}</strong><small>{detail}</small></span><em>Modify</em></button>)}</div>
        </section>
      </div>
      <details className="vertical-progression mock-panel" open>
        <summary><div><span className="eyebrow">Top to bottom</span><h2>Level progression</h2></div><span>{currentLevel} character levels · every level expands</span></summary>
        <div className="progression-list">
          {progression.map(([level, className, classLevel, detail]) => (
            <details className="progression-level" key={level} open={level === currentLevel ? true : undefined}>
              <summary><span className="progression-index">Level {level}</span><strong>{className}</strong><span>{className} {classLevel}</span><small>{detail}</small><button className="level-edit-button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onEditLevel(Number(level), String(className)); }}>Edit</button><em>+</em></summary>
              <div className="progression-breakdown">
                <div className="level-choice-grid"><label>Class<select defaultValue={String(className)}><option>{className}</option></select></label><label>Hit points<input defaultValue={className === "Wizard" ? "5" : "8"} /></label><label>Favored class bonus<select><option>+1 hit point</option><option>+1 skill rank</option></select></label><label>Feat or choice<select><option>{detail}</option></select></label></div>
                <div className="level-grants"><span>Resolved grants</span><strong>{detail}</strong><small>Class features, prerequisites, skill ranks, spell access, and derived changes for this level remain editable here.</small></div>
              </div>
            </details>
          ))}
        </div>
      </details>
    </div>
  );
}

function MonsterBuild({ onToast, onEditLevel }: { onToast: (message: string) => void; onEditLevel: (level: number, className: string) => void }) {
  const progression = [
    [1, "Magical Beast", "Racial HD 1", "Codex base · feat · skill ranks"],
    [2, "Magical Beast", "Racial HD 2", "Codex base · BAB and saves"],
    [3, "Magical Beast", "Racial HD 3", "Codex base · feat · skills"],
    [4, "Magical Beast", "Racial HD 4", "Codex base · ability increase"],
    [5, "Magical Beast", "Racial HD 5", "Codex base · grab and scent"],
    [6, "Magical Beast", "Racial HD 6", "Added HD · feat · skills"],
    [7, "Magical Beast", "Racial HD 7", "Added HD · BAB and saves"],
    [8, "Rogue", "Rogue 1", "Sneak attack +1d6 · trapfinding"],
    [9, "Rogue", "Rogue 2", "Evasion · rogue talent"],
  ];
  return (
    <div className="build-mock-page">
      <section className="build-summary mock-panel"><div><span className="eyebrow">Actor progression</span><h2>CR 11 · 9 Hit Dice / class levels</h2><p>Codex creature extended through racial HD, a template, and class levels</p></div><div className="build-actions"><button onClick={() => onToast("Codex browser opened")}>Browse codex</button><button className="level-up-button" onClick={() => onToast("Build layer menu opened")}>+ Add HD, Template, or Class</button></div></section>
      <section className="actor-origin-strip mock-panel"><div><span className="eyebrow">Codex origin</span><strong>Owlbear · Magical Beast 5 HD</strong><small>Imported foundation remains linked to its source record</small></div><div><span className="eyebrow">Applied template</span><strong>Vampire · CR +2</strong><small>Undead traits · blood drain · fast healing 5</small></div><button onClick={() => onToast("Template configuration opened")}>Configure Template</button></section>
      <div className="monster-build-page">
        <details className="vertical-progression mock-panel" open><summary><div><span className="eyebrow">Top to bottom</span><h2>Level Progression</h2></div><span>7 racial Hit Dice · 2 class levels</span></summary><div className="progression-list">{progression.map(([level, className, classLevel, detail]) => <details className="progression-level" key={level} open={level === 9 ? true : undefined}><summary><span className="progression-index">Level {level}</span><strong>{className}</strong><span>{classLevel}</span><small>{detail}</small><button className="level-edit-button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onEditLevel(Number(level), String(className)); }}>Edit</button><em>+</em></summary><div className="progression-breakdown"><div className="level-choice-grid"><label>Progression type<select defaultValue={String(className)}><option>{className}</option></select></label><label>Hit points<input defaultValue={className === "Rogue" ? "7" : "11"} /></label><label>Skill ranks<input defaultValue={className === "Rogue" ? "8" : "2"} /></label><label>Feat or feature<select><option>{detail}</option></select></label></div><div className="level-grants"><span>Resolved grants</span><strong>{detail}</strong><small>Creature type, racial HD, class features, prerequisites, and derived changes stay editable at this level.</small></div></div></details>)}</div></details>
        <aside className="derived-preview mock-panel"><span className="eyebrow">Final derived actor</span><h2>CR 11</h2><p>The Sanguine Owlbear</p><dl><div><dt>Hit Dice</dt><dd>7d8 + 2d8</dd></div><div><dt>Hit points</dt><dd>118</dd></div><div><dt>Armor class</dt><dd>28</dd></div><div><dt>Base attack</dt><dd>+9</dd></div><div><dt>Fort / Ref / Will</dt><dd>+12 / +15 / +10</dd></div><div><dt>Special abilities</dt><dd>11</dd></div></dl><button>Review all calculations</button><div className="validation-ok">✓ All build choices resolved</div></aside>
      </div>
    </div>
  );
}

function LevelUpDialog({ scenario, target, onClose, onContinue }: { scenario: ScenarioKey; target: { level?: number; className?: string; editing?: boolean }; onClose: () => void; onContinue: () => void }) {
  const multiclass = scenario === "multiclass";
  const gmMonster = scenario === "monster";
  const defaultClass = target.className ?? (multiclass ? "Cleric" : "Ranger");
  const [nextClass, setNextClass] = useState(defaultClass);
  const actor = gmMonster ? "The Sanguine Owlbear" : multiclass ? "Elowen" : "Seren";
  const options = gmMonster ? [defaultClass, "Rogue", "Fighter"] : [multiclass ? "Cleric" : "Ranger", multiclass ? "Wizard" : "Horizon Walker", "Rogue"];
  return <div className="modal-backdrop"><section className="level-up-dialog" role="dialog" aria-modal="true" aria-labelledby="level-up-title"><header><div><span className="eyebrow">{target.editing ? "Respec · guided revision" : "Guided character advancement"}</span><h2 id="level-up-title">{target.editing ? `Edit Level ${target.level}` : "Level Up"} · {actor}</h2><p>{target.editing ? "Change anything granted at this level; downstream requirements will be revalidated." : `Character level ${multiclass ? "10 → 11" : gmMonster ? "9 → 10" : "7 → 8"}`}</p></div><button onClick={onClose}>×</button></header>{target.editing ? <div className="respec-warning"><strong>Respec safely</strong><span>You may change the class, feat, skills, spells, or other choices at this level without recreating the character. Dependent later levels are flagged before saving.</span></div> : null}<ol className="level-up-steps"><li className="active"><b>1</b><span>Class</span></li><li><b>2</b><span>Hit points</span></li><li><b>3</b><span>Skills</span></li><li><b>4</b><span>Feats &amp; Magic</span></li><li><b>5</b><span>Review</span></li></ol><div className="level-up-body"><span className="eyebrow">Step 1 of 5</span><h3>{target.editing ? "Keep or replace this level’s class" : "Choose this level’s class"}</h3><p>{target.editing ? "A narrow feat-only change can skip directly to Feats & Magic; a full class change continues through every step." : "The workflow keeps today’s guided level-up behavior, while Build remains the permanent record."}</p><label>Search classes<input placeholder="Search class, archetype, prestige class, or racial HD…" /></label><div className="class-options">{[...new Set(options)].map((name) => <button key={name} className={nextClass === name ? "selected" : ""} onClick={() => setNextClass(name)}><span><strong>{name}</strong><small>{name === defaultClass ? "Current selection" : "Replace this level’s progression"}</small></span><b>{nextClass === name ? "Selected" : "Choose"}</b></button>)}</div></div><footer>{target.editing ? <button className="quiet-button" onClick={() => undefined}>Jump to Feats &amp; Magic</button> : null}<button className="quiet-button" onClick={onClose}>Cancel</button><button className="dialog-primary" onClick={onContinue}>{target.editing ? "Review Level Changes" : `Continue with ${nextClass}`}</button></footer></section></div>;
}

function CreationGuideDialog({ scenario, onClose }: { scenario: ScenarioKey; onClose: () => void }) {
  const [step, setStep] = useState<"Race" | "Campaign Traits">("Race");
  const race = scenario === "multiclass" ? "Human" : "Half-elf";
  const steps = ["Foundation", "Race", "Abilities", "Class", "Skills", "Feats", "Campaign Traits", "Review"];
  return <div className="modal-backdrop"><section className="creation-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="creation-guide-title"><header><div><span className="eyebrow">Character creation</span><h2 id="creation-guide-title">Creation Guide</h2><p>Race is required. Campaign Traits are optional and follow the campaign’s limits.</p></div><button onClick={onClose}>×</button></header><nav className="creation-steps" aria-label="Creation guide steps">{steps.map((name, index) => <button key={name} className={step === name ? "active" : ""} onClick={() => name === "Race" || name === "Campaign Traits" ? setStep(name) : undefined}><b>{index + 1}</b><span>{name}</span>{name === "Campaign Traits" ? <em>Optional</em> : null}</button>)}</nav>{step === "Race" ? <div className="creation-guide-body"><span className="eyebrow">Step 2 · Required</span><h3>Choose Race &amp; Racial Traits</h3><p>The selected race establishes its standard traits. Alternate and choice-based racial traits can be reviewed now and modified later.</p><label>Race<select defaultValue={race}><option>Human</option><option>Half-elf</option><option>Elf</option><option>Dwarf</option></select></label><div className="creation-choice-list">{[["Standard racial traits", "Size, speed, senses, languages, and automatic features"], ["Flexible ability bonus", scenario === "multiclass" ? "+2 Intelligence" : "+2 Dexterity"], ["Alternate racial traits", "Review replacements and prerequisite conflicts"]].map(([name, detail], index) => <label key={name}><input type="checkbox" defaultChecked={index < 2} /><span><strong>{name}</strong><small>{detail}</small></span></label>)}</div></div> : <div className="creation-guide-body"><span className="eyebrow">Step 7 · Optional</span><h3>Choose Campaign Traits</h3><p>The GM’s campaign rules set the available catalog and selection limit. This campaign allows two traits; other campaigns may allow one to three.</p><div className="campaign-policy"><span>The Ashen Road</span><strong>Choose up to 2 traits</strong><em>2 selected</em></div><div className="creation-choice-list">{[["Caravan Guard", "+1 Perception and Survival along trade routes"], ["Marked by the Bell", "+1 Will saves against sonic and fear effects"], ["Local Informant", "+1 Diplomacy; gains a regional contact"]].map(([name, detail], index) => <label key={name}><input type="checkbox" defaultChecked={index < 2} /><span><strong>{name}</strong><small>{detail}</small></span></label>)}</div></div>}<footer><button className="quiet-button" onClick={onClose}>Close Guide</button><button className="dialog-primary" onClick={() => setStep(step === "Race" ? "Campaign Traits" : "Race")}>{step === "Race" ? "Preview Campaign Traits" : "Back to Race"}</button></footer></section></div>;
}

function StatDrawer({ gm, stat, onClose, onToast }: { gm: boolean; stat: string; onClose: () => void; onToast: (message: string) => void }) {
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="detail-drawer" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">Calculation & action</span><h2>{stat}</h2></div><button onClick={onClose} aria-label="Close">×</button></header><div className="drawer-total"><span>Current value</span><strong>{stat.includes("Armor") ? "28" : "+15"}</strong><em>{gm ? "Calculated + GM modifiers" : "Calculated"}</em></div><section><h3>Breakdown</h3>{[["Base value", "+10", "Rules engine"], ["Ability", "+4", "DEX 18"], ["Competence", "+2", "Magic item"], ["Campaign modifier", "−1", "Sickened · GM"]].map((row) => <div className="breakdown-row" key={row[0]}><span><b>{row[0]}</b><small>{row[2]}</small></span><strong>{row[1]}</strong>{gm ? <button aria-label={`Remove ${row[0]}`} onClick={() => onToast(`${row[0]} removed from campaign copy`)}>×</button> : null}</div>)}</section><section className="roll-composer"><h3>Roll</h3><label>d20 result<input type="number" placeholder="Enter roll" /></label><div><span>Total appears here</span><strong>—</strong></div></section>{gm ? <section className="modifier-composer"><h3>Add modifying value</h3><label>Value<input type="number" placeholder="+2" /></label><label>Type<select><option>Untyped</option><option>Enhancement</option><option>Morale</option><option>Penalty</option></select></label><label className="full">Source or note<input placeholder="GM ruling, terrain, spell…" /></label><button onClick={() => onToast("Modifier added to the campaign copy")}>Add modifier</button></section> : <button className="drawer-link">Open the source in Build</button>}</aside></div>;
}

function ProfileDrawer({ onClose, onToast }: { onClose: () => void; onToast: (message: string) => void }) {
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="detail-drawer profile-drawer" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">Presentation metadata</span><h2>Character profile</h2></div><button onClick={onClose}>×</button></header><div className="portrait-editor"><img src="/mock-assets/seren-ashfall.png" alt="Seren Ashfall" /><div><button>Upload new portrait</button><small>JPG or PNG · square images work best</small></div></div><div className="profile-fields"><label>Deity<input defaultValue="Desna" /></label><label>Gender<input defaultValue="Woman" /></label><label>Age<input defaultValue="34" /></label><label>Height<input defaultValue="5 ft 8 in" /></label><label>Weight<input defaultValue="142 lb" /></label><label>Homeland<input defaultValue="Kyonin borderlands" /></label><label className="full">Associations<input defaultValue="Pathfinders · Ashen Road Company" /></label><label className="full">Languages<input defaultValue="Common · Elven · Sylvan" /></label></div><button className="drawer-primary" onClick={() => { onToast("Character profile saved"); onClose(); }}>Save profile</button><p className="metadata-callout">Stored as presentation metadata so the current rules schema and calculations remain unchanged.</p></aside></div>;
}

function TargetDialog({ onClose, onCast }: { onClose: () => void; onCast: () => void }) {
  const [selected, setSelected] = useState(["seren", "brann", "voss"]);
  const targets: Array<[string, string, string, string]> = [["seren", "Seren Ashfall", "Player", "48 / 62 HP"], ["brann", "Brann Ironwood", "Player", "71 / 78 HP"], ["voss", "Captain Elara Voss", "Ally", "45 / 45 HP"], ["warden", "The Hollow Warden", "Enemy", "93 / 110 HP"], ["goblin", "Goblin scouts", "Enemy group", "2 characters"]];
  return <div className="modal-backdrop"><section className="target-dialog" role="dialog" aria-modal="true" aria-labelledby="target-title"><header><div><span className="eyebrow">Cleric 5 · Level 1 slot</span><h2 id="target-title">Who is affected by Bless?</h2><p>Select the characters affected on your physical tabletop.</p></div><button onClick={onClose}>×</button></header><label className="dialog-search">Search tabletop characters<input placeholder="Name, side, group…" /></label><div className="target-list">{targets.map(([id, name, type, status]) => <label key={id} className={selected.includes(id) ? "selected" : ""}><input type="checkbox" checked={selected.includes(id)} onChange={() => setSelected((previous) => previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id])} /><span className="target-avatar">{name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span><strong>{name}</strong><small>{type}</small></span><em>{status}</em></label>)}</div><div className="target-summary"><span><b>{selected.length}</b> targets selected</span><span>Targets resolve their own saves and effects</span></div><footer><button className="quiet-button" onClick={onClose}>Cancel</button><button className="dialog-primary" disabled={selected.length === 0} onClick={onCast}>Cast Bless · spend 1 slot</button></footer></section></div>;
}

function SaveDialog({ onClose, onResolve }: { onClose: () => void; onResolve: () => void }) {
  const [roll, setRoll] = useState("15");
  const total = Number(roll || 0) + 8;
  return <div className="modal-backdrop"><section className="save-dialog" role="dialog" aria-modal="true"><header><div><span className="eyebrow">Effect resolution</span><h2>Attempt save against Hold Person</h2></div><button onClick={onClose}>×</button></header><div className="save-equation"><label>d20 result<input type="number" value={roll} onChange={(event) => setRoll(event.target.value)} /></label><span>+</span><div><small>Will save</small><strong>+8</strong></div><span>=</span><div><small>Total</small><strong>{total}</strong></div><span>vs</span><div><small>DC</small><strong>18</strong></div></div><div className={`save-result ${total >= 18 ? "success" : "failure"}`}><strong>{total >= 18 ? "Success" : "Failure"}</strong><span>{total >= 18 ? "The condition will be removed and the source notified." : "Hold Person remains. Another save may be attempted next turn."}</span></div><footer><button className="quiet-button" onClick={onClose}>Cancel</button><button className="dialog-primary" onClick={total >= 18 ? onResolve : onClose}>{total >= 18 ? "Confirm & remove condition" : "Confirm failed save"}</button></footer></section></div>;
}

function HealthDrawer({ scenario, onClose, onToast }: { scenario: ScenarioKey; onClose: () => void; onToast: (message: string) => void }) {
  const gm = scenario === "monster";
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="detail-drawer health-drawer" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">Combat health</span><h2>{gm ? "96 / 118 HP" : "48 / 62 HP"}</h2></div><button onClick={onClose}>×</button></header><div className="large-health-meter"><i style={{ width: gm ? "81%" : "77%" }} /></div><div className="health-stats"><span><small>Damage</small><strong>{gm ? "22" : "14"}</strong></span><span><small>Temporary HP</small><strong>0</strong></span><span><small>Nonlethal</small><strong>0</strong></span><span><small>Death at</small><strong>{gm ? "—" : "−14"}</strong></span></div><section className="health-actions"><h3>Apply damage</h3><label>Amount<input type="number" defaultValue="8" /></label><label>Damage type<select><option>Physical</option><option>Fire</option><option>Cold</option><option>Electricity</option></select></label><button onClick={() => onToast("8 physical damage applied")}>Apply damage</button></section><section className="health-actions"><h3>Recovery</h3><label>Healing<input type="number" defaultValue="8" /></label><button onClick={() => onToast("8 HP restored")}>Heal</button><label>Temporary HP<input type="number" defaultValue="0" /></label><button>Set temporary HP</button></section><button className="drawer-link">Stability, nonlethal & revival</button></aside></div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
