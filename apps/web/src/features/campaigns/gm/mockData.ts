export type ActorKind = "Player" | "Ally" | "NPC" | "Monster" | "Villain";
export interface Actor {
  id: string;
  name: string;
  kind: ActorKind;
  ancestry: string;
  role: string;
  level: string;
  hp: number;
  maxHp: number;
  ac: number;
  initiative: number;
  initiativeBonus?: number;
  onTable: boolean;
  saved: boolean;
  dual: boolean;
  aware: boolean;
  group: string;
  stance: "Normal" | "Delayed" | "Readied";
  conditions: string;
  notes: string;
}

export const initialActors: Actor[] = [
  {
    id: "seren",
    name: "Seren Ashfall",
    kind: "Player",
    ancestry: "Half-elf",
    role: "Ranger · Horizon walker",
    level: "Level 7",
    hp: 48,
    maxHp: 62,
    ac: 21,
    initiative: 19,
    onTable: true,
    saved: true,
    dual: false,
    aware: true,
    group: "",
    stance: "Normal",
    conditions: "Bless",
    notes:
      "Following the missing caravan. Her brother's signet was found at the watchtower.",
  },
  {
    id: "brann",
    name: "Brann Ironwood",
    kind: "Player",
    ancestry: "Dwarf",
    role: "Fighter · Shield bearer",
    level: "Level 7",
    hp: 71,
    maxHp: 78,
    ac: 24,
    initiative: 12,
    onTable: true,
    saved: true,
    dual: false,
    aware: true,
    group: "",
    stance: "Normal",
    conditions: "",
    notes: "Owes Captain Voss a favor. Does not trust the old road.",
  },
  {
    id: "voss",
    name: "Captain Elara Voss",
    kind: "Ally",
    ancestry: "Human",
    role: "Veteran · City watch",
    level: "Level 6",
    hp: 45,
    maxHp: 45,
    ac: 20,
    initiative: 14,
    onTable: false,
    saved: true,
    dual: false,
    aware: true,
    group: "",
    stance: "Normal",
    conditions: "",
    notes: "Knows more about the vanished patrol than she admits.",
  },
  {
    id: "warden",
    name: "The Hollow Warden",
    kind: "Villain",
    ancestry: "Undead",
    role: "Guardian · Dual initiative",
    level: "CR 9",
    hp: 93,
    maxHp: 110,
    ac: 25,
    initiative: 22,
    onTable: true,
    saved: true,
    dual: true,
    aware: true,
    group: "",
    stance: "Normal",
    conditions: "",
    notes:
      "Bound to the bell beneath the chapel. Two turns each round; the second occurs 20 initiative counts later (preview convention).",
  },
  {
    id: "goblin-1",
    name: "Goblin scout 1",
    kind: "Monster",
    ancestry: "Small humanoid",
    role: "Skirmisher · Shortbow",
    level: "CR 1/3",
    hp: 6,
    maxHp: 6,
    ac: 16,
    initiative: 16,
    onTable: true,
    saved: true,
    dual: false,
    aware: true,
    group: "Scouts",
    stance: "Normal",
    conditions: "",
    notes: "A lookout in the broken rafters.",
  },
  {
    id: "goblin-2",
    name: "Goblin scout 2",
    kind: "Monster",
    ancestry: "Small humanoid",
    role: "Skirmisher · Shortbow",
    level: "CR 1/3",
    hp: 6,
    maxHp: 6,
    ac: 16,
    initiative: 16,
    onTable: true,
    saved: true,
    dual: false,
    aware: false,
    group: "Scouts",
    stance: "Normal",
    conditions: "",
    notes: "Distracted by the abandoned provisions.",
  },
];

export const codexActors = [
  {
    name: "Goblin scout",
    ancestry: "Small humanoid",
    role: "Skirmisher · Shortbow",
    level: "CR 1/3",
    hp: 6,
    ac: 16,
  },
  {
    name: "Owlbear",
    ancestry: "Large magical beast",
    role: "Brute · Claws and bite",
    level: "CR 4",
    hp: 47,
    ac: 15,
  },
  {
    name: "Skeleton champion",
    ancestry: "Medium undead",
    role: "Guardian · Longsword",
    level: "CR 2",
    hp: 17,
    ac: 21,
  },
  {
    name: "Town guard",
    ancestry: "Human",
    role: "NPC · Warrior",
    level: "CR 1",
    hp: 13,
    ac: 18,
  },
  {
    name: "Summoned wolf",
    ancestry: "Medium animal",
    role: "Summon · Bite and trip",
    level: "CR 1",
    hp: 13,
    ac: 14,
  },
];

export interface Turn {
  id: string;
  actorId: string;
  score: number;
  second: boolean;
}
export function initiativeOrder(actors: Actor[], surprise: boolean): Turn[] {
  return actors
    .filter((a) => a.onTable && a.hp > 0 && (!surprise || a.aware))
    .flatMap((a) => {
      const first = {
        id: `${a.id}:1`,
        actorId: a.id,
        score: a.initiative,
        second: false,
      };
      return a.dual
        ? [
            first,
            {
              ...first,
              id: `${a.id}:2`,
              score: a.initiative - 20,
              second: true,
            },
          ]
        : [first];
    })
    .sort((a, b) => b.score - a.score);
}

export interface Note {
  id: string;
  title: string;
  category: string;
  pinned: boolean;
  body: string;
}
export const initialNotes: Note[] = [
  {
    id: "session",
    title: "Session 12 · The bell below",
    category: "Session",
    pinned: true,
    body: "OPENING SCENE\n\nRain on the old road. A bell rings from beneath the ruined chapel, though its tower fell thirty years ago.\n\nTHE HOOK\n\nSeren recognizes the caravan's crest on a broken wagon. No bodies. No tracks leading away.\n\nIF THEY INVESTIGATE\n\nThe scouts retreat toward the crypt. The Warden does not attack until someone touches the bell.\n\nREMEMBER\n\nGive Brann a moment with the watch captain before the party leaves town.",
  },
  {
    id: "chapel",
    title: "The sunken chapel",
    category: "Location",
    pinned: false,
    body: "A sanctuary swallowed by marshland. Silver bells once kept the dead asleep.\n\nThree entrances: the flooded nave, a collapsed vestry, and a narrow tunnel beneath the cemetery.",
  },
  {
    id: "thread",
    title: "Who paid the ferryman?",
    category: "Plot",
    pinned: false,
    body: "An unresolved thread: the ferryman was paid in coins minted after his death.\n\nPossible connection to the Warden's patron.",
  },
];
