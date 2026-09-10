import { accountStorage } from "../../lib/accountCache";
import type { CharacterBuild } from "@mathfinder/rules-engine";

export const CHARACTER_STORE_KEY = "mathfinder:characters:v1";
export const LEGACY_BUILD_KEY = "mathfinder:web-build:v1";
export const LEGACY_LEVEL_KEY = "mathfinder:web-current-level:v1";
export const LEGACY_SLOTS_KEY = "mathfinder:web-build-slots:v1";
export const LEGACY_RUNTIME_KEY = "mathfinder:web-runtime:v1";
export const LOCAL_DATA_CHANGED_EVENT = "mathfinder:local-data-changed";

const CHARACTER_DETAILS_KEY = "__mathfinderCharacterDetails";
const CHARACTER_PRIVATE_DETAILS_KEY = "__mathfinderPrivateCharacterDetails";

const STORE_VERSION = 1;

export interface CharacterRecord {
  id: string;
  ownerId?: string;
  name: string;
  build: CharacterBuild;
  details?: CharacterDetails;
  currentLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterNote {
  createdAt?: string;
  id: string;
  title: string;
  category: string;
  pinned: boolean;
  body: string;
}

export interface CharacterProfile {
  portraitDataUrl?: string;
  deity?: string;
  gender?: string;
  age?: string;
  height?: string;
  weight?: string;
  homeland?: string;
  associations?: string;
}

export interface CharacterDetails {
  profile?: CharacterProfile;
  notes?: CharacterNote[];
  campaignTraits?: string[];
}

interface CharacterStore {
  version: typeof STORE_VERSION;
  initializedAt: string;
  characters: CharacterRecord[];
}

interface LegacyBuildSlot {
  id?: string;
  label?: string;
  savedAt?: string;
  build?: CharacterBuild;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface RepositoryOptions {
  now?: () => string;
  createId?: () => string;
}

function defaultId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `character-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isCharacterBuild(value: unknown): value is CharacterBuild {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CharacterBuild>;
  return (
    typeof candidate.name === "string" &&
    !!candidate.race &&
    typeof candidate.race === "object" &&
    Array.isArray(candidate.levels)
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function normalizeDetails(value: unknown): CharacterDetails | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<CharacterDetails>;
  const profileCandidate =
    candidate.profile && typeof candidate.profile === "object"
      ? candidate.profile
      : undefined;
  const profile = profileCandidate
    ? Object.fromEntries(
        Object.entries(profileCandidate)
          .map(([key, entry]) => [key, cleanText(entry)] as const)
          .filter(([, entry]) => !!entry),
      )
    : undefined;
  const notes = Array.isArray(candidate.notes)
    ? candidate.notes
        .filter(
          (note): note is CharacterNote =>
            !!note &&
            typeof note.id === "string" &&
            typeof note.title === "string" &&
            typeof note.category === "string" &&
            typeof note.pinned === "boolean" &&
            typeof note.body === "string",
        )
        .map((note) => ({ ...note }))
    : undefined;
  const campaignTraits = Array.isArray(candidate.campaignTraits)
    ? candidate.campaignTraits
        .map(cleanText)
        .filter((trait): trait is string => !!trait)
    : undefined;
  if (
    (!profile || Object.keys(profile).length === 0) &&
    (!notes || notes.length === 0) &&
    (!campaignTraits || campaignTraits.length === 0)
  ) {
    return undefined;
  }
  return {
    profile:
      profile && Object.keys(profile).length > 0
        ? (profile as CharacterProfile)
        : undefined,
    notes: notes?.length ? notes : undefined,
    campaignTraits: campaignTraits?.length ? campaignTraits : undefined,
  };
}

export function serializeCharacterBuild(record: CharacterRecord): unknown {
  if (!record.details) return record.build;
  const sharedDetails = { ...record.details };
  delete sharedDetails.notes;
  if (Object.keys(sharedDetails).length === 0) return record.build;
  return {
    ...record.build,
    [CHARACTER_DETAILS_KEY]: sharedDetails,
  };
}

export function serializeCharacterRuntime(
  state: unknown,
  record: CharacterRecord,
): unknown {
  const runtimeState =
    state && typeof state === "object"
      ? (state as Record<string, unknown>)
      : {};
  if (!record.details?.notes?.length) return runtimeState;
  return {
    ...runtimeState,
    [CHARACTER_PRIVATE_DETAILS_KEY]: { notes: record.details.notes },
  };
}

export function deserializeCharacterRuntime(value: unknown): {
  state: Record<string, unknown>;
  privateDetails?: Pick<CharacterDetails, "notes">;
} {
  if (!value || typeof value !== "object") return { state: {} };
  const serialized = value as Record<string, unknown>;
  const { [CHARACTER_PRIVATE_DETAILS_KEY]: rawPrivateDetails, ...state } =
    serialized;
  const details = normalizeDetails(rawPrivateDetails);
  return {
    state,
    privateDetails: details?.notes ? { notes: details.notes } : undefined,
  };
}

export function deserializeCharacterBuild(value: unknown):
  | {
      build: CharacterBuild;
      details?: CharacterDetails;
    }
  | undefined {
  if (!isCharacterBuild(value)) return undefined;
  const serialized = value as CharacterBuild &
    Record<typeof CHARACTER_DETAILS_KEY, unknown>;
  const { [CHARACTER_DETAILS_KEY]: rawDetails, ...rawBuild } = serialized;
  if (!isCharacterBuild(rawBuild)) return undefined;
  const details = normalizeDetails(rawDetails);
  if (details) delete details.notes;
  return { build: rawBuild, details };
}

function clampLevel(build: CharacterBuild, level: unknown) {
  const parsed = typeof level === "number" ? level : Number(level);
  const maximum = Math.max(1, build.levels.length);
  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(maximum, Math.floor(parsed)))
    : maximum;
}

function validTimestamp(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  return Number.isNaN(Date.parse(value)) ? fallback : value;
}

function normalizeRecord(value: unknown): CharacterRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<CharacterRecord>;
  if (typeof candidate.id !== "string" || !isCharacterBuild(candidate.build)) {
    return undefined;
  }
  const fallbackTimestamp = new Date(0).toISOString();
  const createdAt = validTimestamp(candidate.createdAt, fallbackTimestamp);
  return {
    id: candidate.id,
    ownerId:
      typeof candidate.ownerId === "string" ? candidate.ownerId : undefined,
    name:
      candidate.build.name.trim() || candidate.name?.trim() || "Unnamed Hero",
    build: candidate.build,
    details: normalizeDetails(candidate.details),
    currentLevel: clampLevel(candidate.build, candidate.currentLevel),
    createdAt,
    updatedAt: validTimestamp(candidate.updatedAt, createdAt),
  };
}

function readStore(storage: StorageLike): CharacterStore | undefined {
  try {
    const raw = storage.getItem(CHARACTER_STORE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<CharacterStore>;
    if (parsed.version !== STORE_VERSION || !Array.isArray(parsed.characters)) {
      return undefined;
    }
    return {
      version: STORE_VERSION,
      initializedAt: validTimestamp(
        parsed.initializedAt,
        new Date(0).toISOString(),
      ),
      characters: parsed.characters
        .map(normalizeRecord)
        .filter((record): record is CharacterRecord => !!record),
    };
  } catch {
    return undefined;
  }
}

function writeStore(storage: StorageLike, store: CharacterStore) {
  storage.setItem(CHARACTER_STORE_KEY, JSON.stringify(store));
  if (typeof window !== "undefined" && storage === accountStorage) {
    window.dispatchEvent(
      new CustomEvent(LOCAL_DATA_CHANGED_EVENT, {
        detail: { resource: "characters" },
      }),
    );
  }
}

function buildFingerprint(build: CharacterBuild) {
  return JSON.stringify(build);
}

export function initializeCharacterStore(
  storage: StorageLike,
  options: RepositoryOptions = {},
): CharacterStore {
  const existing = readStore(storage);
  if (existing) return existing;

  const now = options.now?.() ?? new Date().toISOString();
  const createId = options.createId ?? defaultId;
  const candidates: CharacterRecord[] = [];

  try {
    const rawBuild = storage.getItem(LEGACY_BUILD_KEY);
    const build = rawBuild ? (JSON.parse(rawBuild) as unknown) : undefined;
    if (isCharacterBuild(build)) {
      candidates.push({
        id: createId(),
        name: build.name.trim() || "Unnamed Hero",
        build,
        currentLevel: clampLevel(build, storage.getItem(LEGACY_LEVEL_KEY)),
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch {
    // A broken current build must not prevent valid saved slots from migrating.
  }

  try {
    const rawSlots = storage.getItem(LEGACY_SLOTS_KEY);
    const slots = rawSlots ? (JSON.parse(rawSlots) as unknown) : [];
    if (Array.isArray(slots)) {
      for (const value of slots) {
        const slot = value as LegacyBuildSlot;
        if (!isCharacterBuild(slot?.build)) continue;
        const savedAt = validTimestamp(slot.savedAt, now);
        candidates.push({
          id: createId(),
          name: slot.build.name.trim() || slot.label?.trim() || "Unnamed Hero",
          build: slot.build,
          currentLevel: slot.build.levels.length,
          createdAt: savedAt,
          updatedAt: savedAt,
        });
      }
    }
  } catch {
    // The initialized store is still written so migration remains idempotent.
  }

  const byBuild = new Map<string, CharacterRecord>();
  for (const candidate of candidates) {
    const fingerprint = buildFingerprint(candidate.build);
    const existingCandidate = byBuild.get(fingerprint);
    if (
      !existingCandidate ||
      Date.parse(candidate.updatedAt) > Date.parse(existingCandidate.updatedAt)
    ) {
      byBuild.set(fingerprint, candidate);
    }
  }

  const store: CharacterStore = {
    version: STORE_VERSION,
    initializedAt: now,
    characters: [...byBuild.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    ),
  };
  writeStore(storage, store);

  const currentCharacter = candidates[0];
  const legacyRuntime = storage.getItem(LEGACY_RUNTIME_KEY);
  if (currentCharacter && legacyRuntime) {
    storage.setItem(runtimeStorageKey(currentCharacter.id), legacyRuntime);
  }

  return store;
}

export function listCharacters(storage: StorageLike): CharacterRecord[] {
  return initializeCharacterStore(storage).characters;
}

export function getCharacter(
  storage: StorageLike,
  characterId: string,
): CharacterRecord | undefined {
  return listCharacters(storage).find((record) => record.id === characterId);
}

export function createCharacter(
  storage: StorageLike,
  build: CharacterBuild,
  options: RepositoryOptions = {},
): CharacterRecord {
  const store = initializeCharacterStore(storage, options);
  const now = options.now?.() ?? new Date().toISOString();
  const record: CharacterRecord = {
    id: (options.createId ?? defaultId)(),
    name: build.name.trim() || "Unnamed Hero",
    build,
    currentLevel: Math.max(1, build.levels.length),
    createdAt: now,
    updatedAt: now,
  };
  writeStore(storage, {
    ...store,
    characters: [record, ...store.characters],
  });
  return record;
}

export function saveCharacter(
  storage: StorageLike,
  characterId: string,
  build: CharacterBuild,
  currentLevel: number,
  options: RepositoryOptions = {},
): CharacterRecord | undefined {
  const store = initializeCharacterStore(storage, options);
  const existing = store.characters.find((record) => record.id === characterId);
  if (!existing) return undefined;
  const updated: CharacterRecord = {
    ...existing,
    name: build.name.trim() || "Unnamed Hero",
    build,
    currentLevel: clampLevel(build, currentLevel),
    updatedAt: options.now?.() ?? new Date().toISOString(),
  };
  writeStore(storage, {
    ...store,
    characters: [
      updated,
      ...store.characters.filter((record) => record.id !== characterId),
    ],
  });
  return updated;
}

export function saveCharacterDetails(
  storage: StorageLike,
  characterId: string,
  details: CharacterDetails,
  options: RepositoryOptions = {},
): CharacterRecord | undefined {
  const store = initializeCharacterStore(storage, options);
  const existing = store.characters.find((record) => record.id === characterId);
  if (!existing) return undefined;
  const updated: CharacterRecord = {
    ...existing,
    details: normalizeDetails(details),
    updatedAt: options.now?.() ?? new Date().toISOString(),
  };
  writeStore(storage, {
    ...store,
    characters: [
      updated,
      ...store.characters.filter((record) => record.id !== characterId),
    ],
  });
  return updated;
}

export function renameCharacter(
  storage: StorageLike,
  characterId: string,
  name: string,
  options: RepositoryOptions = {},
) {
  const character = getCharacter(storage, characterId);
  if (!character) return undefined;
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("Character name is required.");
  return saveCharacter(
    storage,
    characterId,
    { ...character.build, name: normalizedName },
    character.currentLevel,
    options,
  );
}

export function deleteCharacter(storage: StorageLike, characterId: string) {
  const store = initializeCharacterStore(storage);
  writeStore(storage, {
    ...store,
    characters: store.characters.filter((record) => record.id !== characterId),
  });
}

export function runtimeStorageKey(characterId: string) {
  return `mathfinder:web-runtime:v2:${characterId}`;
}
