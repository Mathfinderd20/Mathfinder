import type { User } from "@supabase/supabase-js";
import {
  CHARACTER_STORE_KEY,
  LOCAL_DATA_CHANGED_EVENT,
  runtimeStorageKey,
  type CharacterRecord,
} from "../features/characters/characterRepository";
import {
  CAMPAIGN_STORE_KEY,
  type CampaignRecord,
  type CampaignCharacterAssignment,
} from "../features/campaigns/campaignRepository";
import {
  supabase,
  storedOfflineUser,
  clearStoredSession,
} from "./supabaseClient";
import {
  currentEntries,
  replaceEntries,
  setCacheWritable,
  readCache,
  writeCache,
  type Entries,
} from "./accountCache";

export type CloudConnectionState =
  | { status: "disabled" | "connecting" | "signedOut" }
  | {
      status: "connected" | "offline";
      userId: string;
      name: string;
      message: string;
      cachedAt: string;
      pending: boolean;
      syncing?: boolean;
      generation: number;
    }
  | { status: "error"; message: string };
let state: CloudConnectionState = supabase
  ? { status: "connecting" }
  : { status: "disabled" };
const listeners = new Set<() => void>();
export const getCloudConnectionState = () => state;
export function subscribeToCloudConnection(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function publish(next: CloudConnectionState) {
  state = next;
  for (const listener of listeners) listener();
}
let user: User | undefined;
let baseline: Entries = {};
let cachedAt = "";
let epoch = 0;
let generation = 0;
let initialized = false;
let authSequence = 0;
let busy = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let cacheQueue: Promise<unknown> = Promise.resolve();
const project = String(import.meta.env.VITE_SUPABASE_URL ?? "");
const keyFor = (id: string) => `${project}:${id}`;
const message = (error: unknown) =>
  error && typeof error === "object" && "message" in error
    ? String(error.message)
    : String(error);
export function isConnectionFailure(error: unknown): boolean {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number(error.status)
      : 0;
  return (
    status >= 500 ||
    /fetch|network|timeout|abort|connection|offline/i.test(message(error))
  );
}
function status(online: boolean, text = "") {
  if (!user) return;
  setCacheWritable(!busy);
  publish({
    status: online ? "connected" : "offline",
    userId: user.id,
    name: user.email ?? "Adventurer",
    message: text,
    cachedAt,
    pending: hasChanges(),
    syncing: busy,
    generation,
  });
}
function persist() {
  if (!user || !cachedAt) return Promise.resolve();
  const key = keyFor(user.id);
  const snapshot = {
    version: 1 as const,
    userId: user.id,
    cachedAt,
    entries: currentEntries(),
    baseline: { ...baseline },
  };
  const task = cacheQueue
    .catch(() => undefined)
    .then(() => writeCache(key, snapshot));
  cacheQueue = task;
  return task;
}
type Row = Record<string, unknown>;
interface Item {
  table: string;
  key: string;
  identity: Row;
  payload: Row;
}
function parse<T>(entries: Entries, key: string, fallback: T): T {
  return entries[key] ? (JSON.parse(entries[key]) as T) : fallback;
}
export function changesFor(
  entries: Entries,
  userId: string,
): Map<string, Item> {
  const result = new Map<string, Item>();
  const add = (table: string, identity: Row, payload: Row) => {
    const key = `${table}:${JSON.stringify(identity)}`;
    result.set(key, { table, key, identity, payload });
  };
  add(
    "profiles",
    { id: userId },
    {
      saved_build_slots: parse<unknown[]>(
        entries,
        "mathfinder:web-build-slots:v1",
        [],
      ),
    },
  );
  const characters = parse<{ characters: CharacterRecord[] }>(
    entries,
    CHARACTER_STORE_KEY,
    { characters: [] },
  ).characters;
  for (const c of characters) {
    if (c.ownerId && c.ownerId !== userId) continue;
    add(
      "characters",
      { id: c.id },
      {
        name: c.name,
        ancestry_name: c.build.race?.name ?? "",
        class_summary: [
          ...new Set(c.build.levels.map((l) => l.className)),
        ].join(" / "),
        level: c.currentLevel,
        build: c.build,
        build_version: 1,
      },
    );
    const runtime = entries[runtimeStorageKey(c.id)];
    if (runtime)
      add(
        "character_runtime_states",
        { character_id: c.id },
        { state: JSON.parse(runtime), state_version: 1 },
      );
  }
  const campaigns = parse<{
    campaigns: CampaignRecord[];
    assignments: CampaignCharacterAssignment[];
  }>(entries, CAMPAIGN_STORE_KEY, { campaigns: [], assignments: [] });
  for (const c of campaigns.campaigns) {
    if (c.ownerId && c.ownerId !== userId) continue;
    add(
      "campaigns",
      { id: c.id },
      { name: c.name, description: c.description ?? null },
    );
  }
  const owned = new Set(
    characters
      .filter((c) => !c.ownerId || c.ownerId === userId)
      .map((c) => c.id),
  );
  for (const a of campaigns.assignments)
    if (owned.has(a.characterId))
      add(
        "campaign_characters",
        { campaign_id: a.campaignId, character_id: a.characterId },
        {},
      );
  return result;
}
export function equivalent(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const x = a as Row,
    y = b as Row;
  return (
    Object.keys(x).length === Object.keys(y).length &&
    Object.keys(x).every((k) => equivalent(x[k], y[k]))
  );
}
function hasChanges() {
  if (!user) return false;
  const before = changesFor(baseline, user.id),
    after = changesFor(currentEntries(), user.id);
  return (
    before.size !== after.size ||
    [...after].some(
      ([key, item]) => !equivalent(item.payload, before.get(key)?.payload),
    )
  );
}
function checkEpoch(expected: number) {
  if (epoch !== expected)
    throw new Error("Account changed; operation cancelled.");
}
async function loadCloud(expected: number) {
  if (!supabase || !user) return;
  const id = user.id;
  const tables = [
    "characters",
    "campaigns",
    "campaign_members",
    "campaign_characters",
    "character_runtime_states",
    "profiles",
  ];
  const results = await Promise.all(
    tables.map((table) => {
      let q = supabase!.from(table).select("*");
      if (table === "characters" || table === "campaigns")
        q = q.is("archived_at", null);
      if (table === "campaign_members") q = q.eq("user_id", id);
      if (table === "profiles") q = q.eq("id", id);
      if (table === "character_runtime_states") q = q.is("campaign_id", null);
      return q;
    }),
  );
  checkEpoch(expected);
  for (const r of results) if (r.error) throw { ...r.error, status: r.status };
  const [
    characters = [],
    campaigns = [],
    members = [],
    assignments = [],
    runtime = [],
    profiles = [],
  ] = results.map((r) => r.data ?? []);
  const stamp = new Date().toISOString();
  if (
    characters.some((row) => row.build_version !== 1) ||
    runtime.some((row) => row.state_version !== 1)
  ) {
    throw new Error(
      "This account contains a newer data format. Update Mathfinder before opening it.",
    );
  }
  const roles = new Map(members.map((r) => [r.campaign_id, r.role]));
  const entries: Entries = {
    "mathfinder:web-build-slots:v1": JSON.stringify(
      profiles[0]?.saved_build_slots ?? [],
    ),
    [CHARACTER_STORE_KEY]: JSON.stringify({
      version: 1,
      initializedAt: stamp,
      characters: characters.map((r) => ({
        id: r.id,
        ownerId: r.owner_id,
        name: r.name,
        build: r.build,
        currentLevel: r.level,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    }),
    [CAMPAIGN_STORE_KEY]: JSON.stringify({
      version: 1,
      initializedAt: stamp,
      campaigns: campaigns.map((r) => ({
        id: r.id,
        ownerId: r.owner_id,
        joinCode: r.join_code,
        name: r.name,
        description: r.description ?? undefined,
        role: roles.get(r.id) ?? "player",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      assignments: assignments.map((r) => ({
        campaignId: r.campaign_id,
        characterId: r.character_id,
        assignedAt: r.assigned_at,
      })),
    }),
  };
  for (const r of runtime)
    entries[runtimeStorageKey(r.character_id)] = JSON.stringify(r.state);
  entries.__server = JSON.stringify(
    Object.fromEntries(
      tables.map((table, i) => [table, results[i]?.data ?? []]),
    ),
  );
  baseline = entries;
  replaceEntries(entries);
  cachedAt = stamp;
  generation++;
  await persist();
  checkEpoch(expected);
}
async function sendChanges(expected: number) {
  if (!supabase || !user) return;
  const id = user.id;
  const before = changesFor(baseline, id),
    after = changesFor(currentEntries(), id);
  const server = parse<Record<string, Row[]>>(baseline, "__server", {});
  for (const key of new Set([...after.keys(), ...before.keys()])) {
    checkEpoch(expected);
    const old = before.get(key),
      next = after.get(key),
      item = next ?? old!;
    if (old && next && equivalent(old.payload, next.payload)) continue;
    if (!next && item.table === "character_runtime_states") continue;
    let q = supabase.from(item.table).select("*").match(item.identity);
    if (item.table === "character_runtime_states")
      q = q.is("campaign_id", null);
    const found = await q.maybeSingle();
    checkEpoch(expected);
    if (found.error) throw { ...found.error, status: found.status };
    const remote = found.data as Row | null;
    // Retrying after a lost response recognizes the already committed operation.
    if (
      next &&
      remote &&
      Object.entries(next.payload).every(([k, v]) => equivalent(remote[k], v))
    )
      continue;
    if (!next && !remote) continue;
    const original = server[item.table]?.find((r) =>
      Object.entries(item.identity).every(([k, v]) => r[k] === v),
    );
    if (
      old &&
      (!remote ||
        !original ||
        (original.updated_at
          ? remote.updated_at !== original.updated_at
          : !equivalent(remote, original)))
    )
      throw new Error(
        "Conflict: this record changed on another device. Export your unsynced copy before reloading server data.",
      );
    if (!old && remote)
      throw new Error("Conflict: a record with this ID already exists.");
    let response;
    if (!remote && next) {
      const extra =
        item.table === "characters" || item.table === "campaigns"
          ? { owner_id: id }
          : item.table === "campaign_characters"
            ? { assigned_by: id }
            : { updated_by: id, id: item.identity.character_id };
      response = await supabase
        .from(item.table)
        .insert({ ...item.identity, ...next.payload, ...extra })
        .select();
    } else {
      const payload = {
        ...next?.payload,
        ...(item.table === "character_runtime_states"
          ? { updated_by: id, revision: Number(remote?.revision ?? 0) + 1 }
          : {}),
      };
      let mutation = next
        ? supabase.from(item.table).update(payload)
        : supabase.from(item.table).delete();
      mutation = mutation.match(item.identity);
      if (original?.updated_at)
        mutation = mutation.eq("updated_at", original.updated_at);
      if (original?.assigned_at)
        mutation = mutation.eq("assigned_at", original.assigned_at);
      if (item.table === "character_runtime_states")
        mutation = mutation.is("campaign_id", null);
      response = await mutation.select();
    }
    checkEpoch(expected);
    if (response.error) throw { ...response.error, status: response.status };
    if (!response.data?.length)
      throw new Error(
        "Conflict: the record changed or access was revoked. Your unsynced copy is retained.",
      );
  }
}
export async function reconnect() {
  if (!supabase || !user || busy) return;
  window.dispatchEvent(new Event("mathfinder:flush"));
  clearTimeout(timer);
  busy = true;
  const expected = epoch;
  if (cachedAt) status(state.status === "connected", "Reconnecting…");
  else setCacheWritable(false);
  try {
    const verified = await supabase.auth.getUser();
    checkEpoch(expected);
    if (verified.error) throw verified.error;
    if (
      !verified.data.user ||
      verified.data.user.is_anonymous ||
      verified.data.user.id !== user.id
    )
      throw { status: 401, message: "Sign in again to continue." };
    await persist().catch((error) => {
      throw new Error(`Browser cache unavailable: ${message(error)}`);
    });
    await sendChanges(expected);
    await loadCloud(expected);
    status(true);
  } catch (error) {
    if (epoch !== expected) return;
    const code =
      error && typeof error === "object" && "status" in error
        ? Number(error.status)
        : 0;
    if (code === 401 || code === 403 || code === 400) await signOut();
    else if (
      cachedAt &&
      (isConnectionFailure(error) ||
        message(error).startsWith("Conflict:") ||
        message(error).includes("Browser cache"))
    )
      status(false, message(error));
    else publish({ status: "error", message: message(error) });
  } finally {
    if (epoch === expected) {
      busy = false;
      if (state.status === "connected" || state.status === "offline")
        status(state.status === "connected", state.message);
    }
  }
}
async function activate(next?: User) {
  if (next?.is_anonymous) next = undefined;
  if (next?.id && next.id === user?.id) return;
  const previous = user;
  epoch++;
  busy = false;
  clearTimeout(timer);
  user = next;
  baseline = {};
  cachedAt = "";
  replaceEntries({});
  setCacheWritable(false);
  const expected = epoch;
  publish({ status: next ? "connecting" : "signedOut" });
  if (previous) {
    const key = keyFor(previous.id);
    cacheQueue = cacheQueue
      .catch(() => undefined)
      .then(() => writeCache(key))
      .catch(console.error);
  }
  if (!next) return;
  try {
    const cache = await readCache(keyFor(next.id), next.id);
    checkEpoch(expected);
    if (cache) {
      changesFor(cache.entries, next.id);
      changesFor(cache.baseline, next.id);
      baseline = cache.baseline;
      replaceEntries(cache.entries);
      cachedAt = cache.cachedAt;
    }
  } catch (error) {
    console.warn("Account cache unavailable", error);
  }
  if (epoch !== expected) return;
  await reconnect();
}
export async function signOut() {
  authSequence++;
  await activate(undefined);
  await cacheQueue;
  if (supabase) {
    const result = await supabase.auth.signOut({ scope: "local" });
    if (result.error) {
      await supabase.auth.stopAutoRefresh();
      clearStoredSession();
      await cacheQueue;
      window.location.replace("/sign-in");
    }
  }
}
export function exportUnsyncedCopy() {
  const blob = new Blob(
    [JSON.stringify({ userId: user?.id, entries: currentEntries() }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mathfinder-unsynced.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function reloadServerCopy() {
  if (!user || busy) return;
  replaceEntries(baseline);
  await persist();
  await reconnect();
}
export async function initializeCloudPersistence() {
  if (!supabase || initialized) return;
  initialized = true;
  supabase.auth.onAuthStateChange((event, session) => {
    const sequence = ++authSequence;
    if (event === "SIGNED_OUT") void activate(undefined);
    else
      setTimeout(() => {
        if (sequence === authSequence) void activate(session?.user);
      }, 0);
  });
  window.addEventListener(LOCAL_DATA_CHANGED_EVENT, () => {
    if (
      (state.status !== "connected" && state.status !== "offline") ||
      !user ||
      !hasChanges()
    )
      return;
    const online = state.status === "connected";
    status(
      online,
      online ? "Saving…" : "Changes saved in this browser; waiting to sync.",
    );
    void persist().catch((error) =>
      status(false, `Browser cache failed: ${message(error)}`),
    );
    clearTimeout(timer);
    if (online) timer = setTimeout(() => void reconnect(), 500);
  });
  window.addEventListener("online", () => void reconnect());
  window.addEventListener("offline", () => {
    window.dispatchEvent(new Event("mathfinder:flush"));
    if (user && cachedAt)
      status(false, "Connection lost. Changes will sync when you’re online.");
  });
  setInterval(() => {
    if (user && !busy && state.status === "offline") void reconnect();
  }, 30000);
  const offlineIdentity = storedOfflineUser();
  let sessionTimer: ReturnType<typeof setTimeout> | undefined;
  const session = await Promise.race([
    supabase.auth.getSession(),
    new Promise<{ data: { session: null }; error: Error }>((resolve) => {
      sessionTimer = setTimeout(
        () =>
          resolve({
            data: { session: null },
            error: new Error("Session restoration timeout"),
          }),
        12000,
      );
    }),
  ]);
  clearTimeout(sessionTimer);
  if (session.error) {
    const offlineUser = isConnectionFailure(session.error)
      ? offlineIdentity
      : undefined;
    if (offlineUser) await activate(offlineUser);
    else publish({ status: "error", message: message(session.error) });
    return;
  }
  if (!session.data.session) publish({ status: "signedOut" });
  else await activate(session.data.session.user);
}
