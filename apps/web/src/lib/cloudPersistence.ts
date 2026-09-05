import type { CharacterBuild } from "@mathfinder/rules-engine";
import {
  CHARACTER_STORE_KEY,
  LOCAL_DATA_CHANGED_EVENT,
  listCharacters,
  runtimeStorageKey,
  type CharacterRecord,
} from "../features/characters/characterRepository";
import {
  CAMPAIGN_STORE_KEY,
  listCampaignAssignments,
  listCampaigns,
  type CampaignCharacterAssignment,
  type CampaignRecord,
} from "../features/campaigns/campaignRepository";
import { supabase } from "./supabaseClient";

export type CloudConnectionState =
  | { status: "disabled" }
  | { status: "connecting" }
  | { status: "connected"; userId: string }
  | { status: "error"; message: string };

let connectionState: CloudConnectionState = supabase
  ? { status: "connecting" }
  : { status: "disabled" };
const subscribers = new Set<() => void>();
let activeUserId: string | undefined;
let syncTimer: number | undefined;
const runtimeSyncTimers = new Map<string, number>();
const characterOwners = new Map<string, string>();

export function getCloudConnectionState() {
  return connectionState;
}

export function subscribeToCloudConnection(listener: () => void) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function setConnectionState(next: CloudConnectionState) {
  connectionState = next;
  for (const subscriber of subscribers) subscriber();
}

function messageFrom(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const parts = [candidate.message, candidate.details, candidate.hint]
      .filter((part): part is string => typeof part === "string" && !!part)
      .join(" ");
    if (parts) {
      return typeof candidate.code === "string"
        ? `${parts} (${candidate.code})`
        : parts;
    }
    try {
      return JSON.stringify(error);
    } catch {
      // Fall through to the generic representation below.
    }
  }
  return String(error);
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isNewerTimestamp(candidate: string, baseline: string) {
  return Date.parse(candidate) > Date.parse(baseline);
}

function characterRow(record: CharacterRecord, ownerId: string) {
  const firstLevel = record.build.levels[0];
  const classes = record.build.levels
    .map((level) => level.className)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" / ");
  return {
    id: record.id,
    owner_id: ownerId,
    name: record.name,
    ancestry_name: record.build.race?.name ?? "",
    class_summary: classes || firstLevel?.className || "",
    level: record.currentLevel,
    build: record.build,
    build_version: 1,
    updated_at: record.updatedAt,
  };
}

function campaignRow(record: CampaignRecord, ownerId: string) {
  return {
    id: record.id,
    owner_id: ownerId,
    name: record.name,
    description: record.description ?? null,
    updated_at: record.updatedAt,
  };
}

function writeCharacterCache(records: CharacterRecord[]) {
  const initializedAt = new Date().toISOString();
  window.localStorage.setItem(
    CHARACTER_STORE_KEY,
    JSON.stringify({ version: 1, initializedAt, characters: records }),
  );
}

function writeCampaignCache(
  campaigns: CampaignRecord[],
  assignments: CampaignCharacterAssignment[],
) {
  window.localStorage.setItem(
    CAMPAIGN_STORE_KEY,
    JSON.stringify({
      version: 1,
      initializedAt: new Date().toISOString(),
      campaigns,
      assignments,
    }),
  );
}

async function reconcileFromCloud(userId: string) {
  if (!supabase) return;
  const [
    charactersResult,
    campaignsResult,
    membershipsResult,
    assignmentsResult,
    runtimeResult,
  ] = await Promise.all([
    supabase.from("characters").select("*").is("archived_at", null),
    supabase.from("campaigns").select("*").is("archived_at", null),
    supabase
      .from("campaign_members")
      .select("campaign_id, role")
      .eq("user_id", userId),
    supabase.from("campaign_characters").select("*"),
    supabase
      .from("character_runtime_states")
      .select("character_id, state, updated_at")
      .is("campaign_id", null),
  ]);
  const failure =
    charactersResult.error ??
    campaignsResult.error ??
    membershipsResult.error ??
    assignmentsResult.error ??
    runtimeResult.error;
  if (failure) throw failure;

  const localCharacters = listCharacters(window.localStorage);
  const mergedCharacters = new Map<string, CharacterRecord>();
  for (const row of charactersResult.data ?? []) {
    characterOwners.set(row.id, row.owner_id);
    mergedCharacters.set(row.id, {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      build: row.build as unknown as CharacterBuild,
      currentLevel: row.level,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  const charactersToUpload: ReturnType<typeof characterRow>[] = [];
  for (const record of localCharacters) {
    if (!validUuid(record.id)) continue;
    const remote = mergedCharacters.get(record.id);
    if (remote?.ownerId && remote.ownerId !== userId) continue;
    if (!remote || isNewerTimestamp(record.updatedAt, remote.updatedAt)) {
      const ownedRecord = { ...record, ownerId: userId };
      mergedCharacters.set(record.id, ownedRecord);
      characterOwners.set(record.id, userId);
      charactersToUpload.push(characterRow(ownedRecord, userId));
    }
  }
  if (charactersToUpload.length) {
    for (const row of charactersToUpload) {
      const existed = charactersResult.data?.some(
        (remote) => remote.id === row.id,
      );
      const {
        owner_id: _ownerId,
        id: _id,
        updated_at: _updatedAt,
        ...updates
      } = row;
      const result = existed
        ? await supabase.from("characters").update(updates).eq("id", row.id)
        : await supabase.from("characters").insert(row);
      if (result.error) throw result.error;
    }
  }
  writeCharacterCache(
    [...mergedCharacters.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    ),
  );

  const roles = new Map(
    (membershipsResult.data ?? []).map((row) => [row.campaign_id, row.role]),
  );
  const mergedCampaigns = new Map<string, CampaignRecord>();
  for (const row of campaignsResult.data ?? []) {
    mergedCampaigns.set(row.id, {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      description: row.description ?? undefined,
      role: roles.get(row.id) === "gm" ? "gm" : "player",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  const campaignsToUpload: ReturnType<typeof campaignRow>[] = [];
  for (const record of listCampaigns(window.localStorage)) {
    if (
      !validUuid(record.id) ||
      record.role !== "gm" ||
      (record.ownerId && record.ownerId !== userId)
    )
      continue;
    const remote = mergedCampaigns.get(record.id);
    if (!remote || isNewerTimestamp(record.updatedAt, remote.updatedAt)) {
      const ownedRecord = { ...record, ownerId: userId };
      mergedCampaigns.set(record.id, ownedRecord);
      campaignsToUpload.push(campaignRow(ownedRecord, userId));
    }
  }
  if (campaignsToUpload.length) {
    for (const row of campaignsToUpload) {
      const existed = campaignsResult.data?.some(
        (remote) => remote.id === row.id,
      );
      const {
        owner_id: _ownerId,
        id: _id,
        updated_at: _updatedAt,
        ...updates
      } = row;
      const result = existed
        ? await supabase.from("campaigns").update(updates).eq("id", row.id)
        : await supabase.from("campaigns").insert(row);
      if (result.error) throw result.error;
    }
  }

  const mergedAssignments = new Map<string, CampaignCharacterAssignment>();
  for (const row of assignmentsResult.data ?? []) {
    mergedAssignments.set(`${row.campaign_id}:${row.character_id}`, {
      campaignId: row.campaign_id,
      characterId: row.character_id,
      assignedAt: row.assigned_at,
    });
  }
  const assignmentsToUpload = [];
  for (const assignment of listCampaignAssignments(window.localStorage)) {
    if (!validUuid(assignment.campaignId) || !validUuid(assignment.characterId))
      continue;
    const key = `${assignment.campaignId}:${assignment.characterId}`;
    if (!mergedAssignments.has(key)) {
      mergedAssignments.set(key, assignment);
      assignmentsToUpload.push({
        campaign_id: assignment.campaignId,
        character_id: assignment.characterId,
        assigned_by: userId,
        assigned_at: assignment.assignedAt,
      });
    }
  }
  if (assignmentsToUpload.length) {
    const { error } = await supabase
      .from("campaign_characters")
      .upsert(assignmentsToUpload, {
        onConflict: "campaign_id,character_id",
      });
    if (error) throw error;
  }
  writeCampaignCache(
    [...mergedCampaigns.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    ),
    [...mergedAssignments.values()],
  );

  const remoteRuntime = new Map(
    (runtimeResult.data ?? []).map((row) => [row.character_id, row]),
  );
  for (const character of mergedCharacters.values()) {
    const key = runtimeStorageKey(character.id);
    const localState = window.localStorage.getItem(key);
    const remote = remoteRuntime.get(character.id);
    if (remote?.state) {
      window.localStorage.setItem(key, JSON.stringify(remote.state));
    } else if (localState) {
      await pushRuntimeState(character.id, localState, userId);
    }
  }
}

async function pushRuntimeState(
  characterId: string,
  serializedState: string,
  userId = activeUserId,
) {
  if (!supabase || !userId || !validUuid(characterId)) return;
  const ownerId = characterOwners.get(characterId);
  if (ownerId && ownerId !== userId) return;
  let state: unknown;
  try {
    state = JSON.parse(serializedState);
  } catch {
    return;
  }
  const existing = await supabase
    .from("character_runtime_states")
    .select("id, revision")
    .eq("character_id", characterId)
    .is("campaign_id", null)
    .maybeSingle();
  if (existing.error) throw existing.error;
  const result = existing.data
    ? await supabase
        .from("character_runtime_states")
        .update({
          state,
          revision: existing.data.revision + 1,
          updated_by: userId,
        })
        .eq("id", existing.data.id)
    : await supabase.from("character_runtime_states").insert({
        character_id: characterId,
        state,
        updated_by: userId,
      });
  if (result.error) throw result.error;
}

async function pushLocalSnapshot(userId: string) {
  if (!supabase) return;
  const characters = listCharacters(window.localStorage).filter(
    (record) =>
      validUuid(record.id) && (!record.ownerId || record.ownerId === userId),
  );
  const remoteCharacters = await supabase
    .from("characters")
    .select("id, owner_id");
  if (remoteCharacters.error) throw remoteCharacters.error;
  const remoteOwnedCharacterIds = new Set(
    (remoteCharacters.data ?? [])
      .filter((row) => row.owner_id === userId)
      .map((row) => row.id),
  );
  const localCharacterIds = new Set(characters.map((record) => record.id));
  for (const remoteId of remoteOwnedCharacterIds) {
    if (!localCharacterIds.has(remoteId)) {
      const { error } = await supabase
        .from("characters")
        .delete()
        .eq("id", remoteId);
      if (error) throw error;
    }
  }
  for (const record of characters) {
    const row = characterRow(record, userId);
    const {
      owner_id: _ownerId,
      id: _id,
      updated_at: _updatedAt,
      ...updates
    } = row;
    const result = remoteOwnedCharacterIds.has(record.id)
      ? await supabase.from("characters").update(updates).eq("id", record.id)
      : await supabase.from("characters").insert(row);
    if (result.error) throw result.error;
    characterOwners.set(record.id, userId);
  }
  const campaigns = listCampaigns(window.localStorage).filter(
    (record) =>
      validUuid(record.id) &&
      record.role === "gm" &&
      (!record.ownerId || record.ownerId === userId),
  );
  const remoteCampaigns = await supabase
    .from("campaigns")
    .select("id, owner_id");
  if (remoteCampaigns.error) throw remoteCampaigns.error;
  const remoteOwnedCampaignIds = new Set(
    (remoteCampaigns.data ?? [])
      .filter((row) => row.owner_id === userId)
      .map((row) => row.id),
  );
  const localOwnedCampaignIds = new Set(campaigns.map((record) => record.id));
  for (const remoteId of remoteOwnedCampaignIds) {
    if (!localOwnedCampaignIds.has(remoteId)) {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", remoteId);
      if (error) throw error;
    }
  }
  for (const record of campaigns) {
    const row = campaignRow(record, userId);
    const {
      owner_id: _ownerId,
      id: _id,
      updated_at: _updatedAt,
      ...updates
    } = row;
    const result = remoteOwnedCampaignIds.has(record.id)
      ? await supabase.from("campaigns").update(updates).eq("id", record.id)
      : await supabase.from("campaigns").insert(row);
    if (result.error) throw result.error;
  }
  const localAssignments = listCampaignAssignments(window.localStorage).filter(
    (assignment) =>
      validUuid(assignment.campaignId) && validUuid(assignment.characterId),
  );
  const remoteAssignments = await supabase
    .from("campaign_characters")
    .select("campaign_id, character_id");
  if (remoteAssignments.error) throw remoteAssignments.error;
  const localKeys = new Set(
    localAssignments.map(
      (assignment) => `${assignment.campaignId}:${assignment.characterId}`,
    ),
  );
  for (const assignment of remoteAssignments.data ?? []) {
    const key = `${assignment.campaign_id}:${assignment.character_id}`;
    if (
      !localKeys.has(key) &&
      remoteOwnedCharacterIds.has(assignment.character_id)
    ) {
      const { error } = await supabase
        .from("campaign_characters")
        .delete()
        .eq("campaign_id", assignment.campaign_id)
        .eq("character_id", assignment.character_id);
      if (error) throw error;
    }
  }
  if (localAssignments.length) {
    const { error } = await supabase.from("campaign_characters").upsert(
      localAssignments.map((assignment) => ({
        campaign_id: assignment.campaignId,
        character_id: assignment.characterId,
        assigned_by: userId,
        assigned_at: assignment.assignedAt,
      })),
      { onConflict: "campaign_id,character_id" },
    );
    if (error) throw error;
  }
}

function scheduleSnapshotPush(event: Event) {
  const detail = (
    event as CustomEvent<{ resource?: string; storageKey?: string }>
  ).detail;
  if (detail?.resource === "runtime" && detail.storageKey) {
    const prefix = "mathfinder:web-runtime:v2:";
    if (detail.storageKey.startsWith(prefix)) {
      const characterId = detail.storageKey.slice(prefix.length);
      const storageKey = detail.storageKey;
      const existingTimer = runtimeSyncTimers.get(characterId);
      if (existingTimer !== undefined) window.clearTimeout(existingTimer);
      runtimeSyncTimers.set(
        characterId,
        window.setTimeout(() => {
          runtimeSyncTimers.delete(characterId);
          const state = window.localStorage.getItem(storageKey);
          if (state) {
            void pushRuntimeState(characterId, state)
              .then(markConnected)
              .catch(reportSyncError);
          }
        }, 300),
      );
    }
    return;
  }
  if (syncTimer !== undefined) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncTimer = undefined;
    if (activeUserId) {
      void pushLocalSnapshot(activeUserId)
        .then(markConnected)
        .catch(reportSyncError);
    }
  }, 500);
}

function markConnected() {
  if (activeUserId) {
    setConnectionState({ status: "connected", userId: activeUserId });
  }
}

function reportSyncError(error: unknown) {
  console.error("Supabase synchronization failed", error);
  setConnectionState({ status: "error", message: messageFrom(error) });
}

export async function initializeCloudPersistence() {
  if (!supabase || typeof window === "undefined") return connectionState;
  setConnectionState({ status: "connecting" });
  try {
    const sessionResult = await supabase.auth.getSession();
    if (sessionResult.error) throw sessionResult.error;
    let user = sessionResult.data.session?.user;
    if (!user) {
      const signInResult = await supabase.auth.signInAnonymously({
        options: { data: { name: "Local adventurer" } },
      });
      if (signInResult.error) throw signInResult.error;
      user = signInResult.data.user ?? undefined;
    }
    if (!user)
      throw new Error("Supabase did not return an authenticated user.");
    activeUserId = user.id;
    await reconcileFromCloud(user.id);
    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, scheduleSnapshotPush);
    setConnectionState({ status: "connected", userId: user.id });
  } catch (error) {
    reportSyncError(error);
  }
  return connectionState;
}
