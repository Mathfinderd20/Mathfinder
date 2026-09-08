import { getCloudConnectionState, reconnect } from "../../lib/cloudPersistence";
import { supabase } from "../../lib/supabaseClient";
import {
  parseCharacterCreationRules,
  validateCreationRules,
  type CharacterCreationRules,
} from "@mathfinder/rules-engine";

export interface CampaignPreview {
  creationRules?: CharacterCreationRules;
  id: string;
  name: string;
  description?: string;
}

export interface CreatedCampaign {
  id: string;
  joinCode: string;
}

function requireClient() {
  if (!supabase) throw new Error("The campaign server is unavailable.");
  return supabase;
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

async function refreshCampaignData() {
  await reconnect();
  const connection = getCloudConnectionState();
  if (connection.status !== "connected") {
    throw new Error(
      "The change was saved, but the latest campaign data could not be loaded. Retry the connection.",
    );
  }
}

async function ensureCampaignWriteReady() {
  const connection = getCloudConnectionState();
  if (connection.status !== "connected") {
    throw new Error("Reconnect before changing a shared campaign.");
  }
  if (connection.pending) {
    throw new Error(
      "Wait for your characters to finish saving, then try again.",
    );
  }
}

export function normalizeCampaignCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 20);
}

export function formatCampaignCode(value: string) {
  return (
    normalizeCampaignCode(value)
      .match(/.{1,4}/g)
      ?.join("-") ?? ""
  );
}

export async function createSharedCampaign(input: {
  name: string;
  description?: string;
  characterIds?: string[];
}): Promise<CreatedCampaign> {
  await ensureCampaignWriteReady();
  const client = requireClient();
  const { data, error } = await client.rpc("create_campaign_with_characters", {
    p_name: input.name,
    p_description: input.description || null,
    p_character_ids: [...new Set(input.characterIds ?? [])],
  });
  if (error) throw new Error(errorMessage(error, "Campaign creation failed."));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.campaign_id || !row?.join_code) {
    throw new Error("The server did not return the new campaign.");
  }
  await refreshCampaignData();
  return { id: String(row.campaign_id), joinCode: String(row.join_code) };
}

export async function previewCampaignByCode(
  code: string,
): Promise<CampaignPreview> {
  await ensureCampaignWriteReady();
  const client = requireClient();
  const normalized = normalizeCampaignCode(code);
  if (normalized.length !== 20)
    throw new Error("Enter a complete campaign ID.");
  const { data, error } = await client.rpc("preview_campaign_by_code", {
    p_code: normalized,
  });
  if (error) throw new Error(errorMessage(error, "Campaign lookup failed."));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.campaign_id) {
    throw new Error("Campaign ID is invalid or the campaign is inactive.");
  }
  const rules = await client.rpc("preview_campaign_creation_rules", {
    p_code: normalized,
  });
  if (rules.error)
    throw new Error(
      errorMessage(rules.error, "Campaign rules could not be loaded."),
    );
  return {
    creationRules: parseCharacterCreationRules(rules.data),
    id: String(row.campaign_id),
    name: String(row.campaign_name),
    description: row.campaign_description
      ? String(row.campaign_description)
      : undefined,
  };
}

export async function joinCampaignByCode(code: string, characterIds: string[]) {
  await ensureCampaignWriteReady();
  const client = requireClient();
  const normalized = normalizeCampaignCode(code);
  if (normalized.length !== 20)
    throw new Error("Enter a complete campaign ID.");
  if (!characterIds.length) throw new Error("Select at least one character.");
  const { data, error } = await client.rpc("join_campaign_by_code", {
    p_code: normalized,
    p_character_ids: [...new Set(characterIds)],
  });
  if (error) throw new Error(errorMessage(error, "Joining failed."));
  if (!data) throw new Error("The server did not return the campaign.");
  await refreshCampaignData();
  return String(data);
}

export async function setSharedCampaignCharacter(
  campaignId: string,
  characterId: string,
  assigned: boolean,
) {
  await ensureCampaignWriteReady();
  const client = requireClient();
  const identity = await client.auth.getUser();
  if (
    identity.error ||
    !identity.data.user ||
    identity.data.user.is_anonymous
  ) {
    throw new Error("Sign in again to update campaign characters.");
  }
  if (assigned) {
    const { error } = await client.from("campaign_characters").insert({
      campaign_id: campaignId,
      character_id: characterId,
      assigned_by: identity.data.user.id,
    });
    if (error) throw new Error(errorMessage(error, "Character update failed."));
  } else {
    const { data, error } = await client
      .from("campaign_characters")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("character_id", characterId)
      .select("character_id");
    if (error) throw new Error(errorMessage(error, "Character update failed."));
    if (!data?.length)
      throw new Error("The character link could not be removed.");
  }
  await refreshCampaignData();
}

export async function deactivateSharedCampaign(campaignId: string) {
  await ensureCampaignWriteReady();
  const client = requireClient();
  const { error } = await client.rpc("deactivate_campaign", {
    p_campaign_id: campaignId,
  });
  if (error) throw new Error(errorMessage(error, "Deactivation failed."));
  await refreshCampaignData();
}

export async function saveCampaignCreationRules(
  campaignId: string,
  rules: CharacterCreationRules,
) {
  const errors = validateCreationRules(rules);
  if (errors.length) throw new Error(errors.join(" "));
  await ensureCampaignWriteReady();
  const { error } = await requireClient().rpc("set_campaign_creation_rules", {
    p_campaign_id: campaignId,
    p_rules: rules,
  });
  if (error)
    throw new Error(errorMessage(error, "Saving campaign rules failed."));
  await refreshCampaignData();
}
