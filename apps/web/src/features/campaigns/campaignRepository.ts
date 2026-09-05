import type { StorageLike } from "../characters/characterRepository";
import { LOCAL_DATA_CHANGED_EVENT } from "../characters/characterRepository";

export const CAMPAIGN_STORE_KEY = "mathfinder:campaigns:v1";

const STORE_VERSION = 1;

export interface CampaignRecord {
  id: string;
  ownerId?: string;
  name: string;
  description?: string;
  role: "gm" | "player";
  createdAt: string;
  updatedAt: string;
}

export interface CampaignCharacterAssignment {
  campaignId: string;
  characterId: string;
  assignedAt: string;
}

interface CampaignStore {
  version: typeof STORE_VERSION;
  initializedAt: string;
  campaigns: CampaignRecord[];
  assignments: CampaignCharacterAssignment[];
}

interface RepositoryOptions {
  now?: () => string;
  createId?: () => string;
}

interface CreateCampaignInput {
  name: string;
  description?: string;
  characterIds?: string[];
}

function defaultId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `campaign-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function validTimestamp(value: unknown, fallback: string) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : fallback;
}

function readStore(storage: StorageLike): CampaignStore | undefined {
  try {
    const raw = storage.getItem(CAMPAIGN_STORE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<CampaignStore>;
    if (
      parsed.version !== STORE_VERSION ||
      !Array.isArray(parsed.campaigns) ||
      !Array.isArray(parsed.assignments)
    ) {
      return undefined;
    }
    const fallback = new Date(0).toISOString();
    const campaigns = parsed.campaigns.filter(
      (campaign): campaign is CampaignRecord =>
        !!campaign &&
        typeof campaign.id === "string" &&
        typeof campaign.name === "string" &&
        (campaign.role === "gm" || campaign.role === "player"),
    );
    const campaignIds = new Set(campaigns.map((campaign) => campaign.id));
    return {
      version: STORE_VERSION,
      initializedAt: validTimestamp(parsed.initializedAt, fallback),
      campaigns,
      assignments: parsed.assignments.filter(
        (assignment): assignment is CampaignCharacterAssignment =>
          !!assignment &&
          typeof assignment.campaignId === "string" &&
          campaignIds.has(assignment.campaignId) &&
          typeof assignment.characterId === "string" &&
          typeof assignment.assignedAt === "string",
      ),
    };
  } catch {
    return undefined;
  }
}

function writeStore(storage: StorageLike, store: CampaignStore) {
  storage.setItem(CAMPAIGN_STORE_KEY, JSON.stringify(store));
  if (typeof window !== "undefined" && storage === window.localStorage) {
    window.dispatchEvent(
      new CustomEvent(LOCAL_DATA_CHANGED_EVENT, {
        detail: { resource: "campaigns" },
      }),
    );
  }
}

function initializeStore(
  storage: StorageLike,
  options: RepositoryOptions = {},
) {
  const existing = readStore(storage);
  if (existing) return existing;
  const store: CampaignStore = {
    version: STORE_VERSION,
    initializedAt: options.now?.() ?? new Date().toISOString(),
    campaigns: [],
    assignments: [],
  };
  writeStore(storage, store);
  return store;
}

export function listCampaigns(storage: StorageLike) {
  return initializeStore(storage).campaigns;
}

export function getCampaign(storage: StorageLike, campaignId: string) {
  return listCampaigns(storage).find((campaign) => campaign.id === campaignId);
}

export function listCampaignAssignments(storage: StorageLike) {
  return initializeStore(storage).assignments;
}

export function characterIdsForCampaign(
  storage: StorageLike,
  campaignId: string,
) {
  return listCampaignAssignments(storage)
    .filter((assignment) => assignment.campaignId === campaignId)
    .map((assignment) => assignment.characterId);
}

export function campaignsForCharacter(
  storage: StorageLike,
  characterId: string,
) {
  const campaignIds = new Set(
    listCampaignAssignments(storage)
      .filter((assignment) => assignment.characterId === characterId)
      .map((assignment) => assignment.campaignId),
  );
  return listCampaigns(storage).filter((campaign) =>
    campaignIds.has(campaign.id),
  );
}

export function createCampaign(
  storage: StorageLike,
  input: CreateCampaignInput,
  options: RepositoryOptions = {},
) {
  const name = input.name.trim();
  if (!name) throw new Error("Campaign name is required.");
  const store = initializeStore(storage, options);
  const now = options.now?.() ?? new Date().toISOString();
  const campaign: CampaignRecord = {
    id: (options.createId ?? defaultId)(),
    name,
    description: input.description?.trim() || undefined,
    role: "gm",
    createdAt: now,
    updatedAt: now,
  };
  const characterIds = [...new Set(input.characterIds ?? [])];
  writeStore(storage, {
    ...store,
    campaigns: [campaign, ...store.campaigns],
    assignments: [
      ...characterIds.map((characterId) => ({
        campaignId: campaign.id,
        characterId,
        assignedAt: now,
      })),
      ...store.assignments,
    ],
  });
  return campaign;
}

export function removeCharacterFromCampaigns(
  storage: StorageLike,
  characterId: string,
) {
  const store = initializeStore(storage);
  writeStore(storage, {
    ...store,
    assignments: store.assignments.filter(
      (assignment) => assignment.characterId !== characterId,
    ),
  });
}

export function setCampaignCharacterAssignment(
  storage: StorageLike,
  campaignId: string,
  characterId: string,
  assigned: boolean,
  options: RepositoryOptions = {},
) {
  const store = initializeStore(storage, options);
  const remaining = store.assignments.filter(
    (assignment) =>
      assignment.campaignId !== campaignId ||
      assignment.characterId !== characterId,
  );
  writeStore(storage, {
    ...store,
    assignments: assigned
      ? [
          {
            campaignId,
            characterId,
            assignedAt: options.now?.() ?? new Date().toISOString(),
          },
          ...remaining,
        ]
      : remaining,
  });
}
