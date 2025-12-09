import { Twilio } from 'twilio';
import { config } from '../config';

const client = new Twilio(config.twilio.accountSid, config.twilio.authToken);

const SYNC_MAP_NAME = 'active-bot-conversations';
const ITEM_TTL_SECONDS = 86400; // 24 hours

export interface ActiveConversation {
  conversationSid: string;
  startedAt: string;
}

/**
 * Checks if Sync Service is configured.
 * Typing indicators feature requires TWILIO_SYNC_SERVICE_SID to be set.
 */
export function isSyncEnabled(): boolean {
  return !!config.twilio.syncServiceSid;
}

/**
 * Ensures the Sync Map exists, creating it if necessary.
 */
async function ensureSyncMapExists(): Promise<boolean> {
  if (!isSyncEnabled()) {
    return false;
  }

  try {
    await client.sync.v1
      .services(config.twilio.syncServiceSid!)
      .syncMaps(SYNC_MAP_NAME)
      .fetch();
    return true;
  } catch (error: any) {
    if (error.code === 20404) {
      // Map doesn't exist, create it
      await client.sync.v1
        .services(config.twilio.syncServiceSid!)
        .syncMaps
        .create({ uniqueName: SYNC_MAP_NAME });
      console.log(`Created Sync Map: ${SYNC_MAP_NAME}`);
      return true;
    } else {
      throw error;
    }
  }
}

/**
 * Normalizes a phone number by removing the 'whatsapp:' prefix if present.
 */
function normalizePhone(phone: string): string {
  return phone.replace('whatsapp:', '');
}

/**
 * Stores an active bot conversation in the Sync Map.
 * Does nothing if Sync Service is not configured.
 * @param customerPhone - The customer's phone number (with or without whatsapp: prefix)
 * @param conversationSid - The Twilio Conversation SID
 */
export async function storeActiveConversation(
  customerPhone: string,
  conversationSid: string
): Promise<void> {
  if (!isSyncEnabled()) {
    return;
  }

  try {
    await ensureSyncMapExists();

    const key = normalizePhone(customerPhone);
    const data: ActiveConversation = {
      conversationSid,
      startedAt: new Date().toISOString()
    };

    try {
      // Try to update existing item
      await client.sync.v1
        .services(config.twilio.syncServiceSid!)
        .syncMaps(SYNC_MAP_NAME)
        .syncMapItems(key)
        .update({ data, ttl: ITEM_TTL_SECONDS });
      console.log(`Updated active conversation for ${key}: ${conversationSid}`);
    } catch (error: any) {
      if (error.code === 20404) {
        // Item doesn't exist, create it
        await client.sync.v1
          .services(config.twilio.syncServiceSid!)
          .syncMaps(SYNC_MAP_NAME)
          .syncMapItems
          .create({ key, data, ttl: ITEM_TTL_SECONDS });
        console.log(`Stored active conversation for ${key}: ${conversationSid}`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error storing active conversation in Sync:', error);
  }
}

/**
 * Checks if there's an active bot conversation for a customer.
 * Returns null if Sync Service is not configured.
 * @param customerPhone - The customer's phone number (with or without whatsapp: prefix)
 * @returns The active conversation data if exists, null otherwise
 */
export async function getActiveConversation(
  customerPhone: string
): Promise<ActiveConversation | null> {
  if (!isSyncEnabled()) {
    return null;
  }

  try {
    await ensureSyncMapExists();

    const key = normalizePhone(customerPhone);
    const item = await client.sync.v1
      .services(config.twilio.syncServiceSid!)
      .syncMaps(SYNC_MAP_NAME)
      .syncMapItems(key)
      .fetch();

    return item.data as ActiveConversation;
  } catch (error: any) {
    if (error.code === 20404) {
      // Item doesn't exist
      return null;
    }
    console.error('Error fetching active conversation from Sync:', error);
    return null;
  }
}

/**
 * Removes an active bot conversation from the Sync Map.
 * Does nothing if Sync Service is not configured.
 * Should be called when handoff to agent occurs or conversation ends.
 * @param customerPhone - The customer's phone number (with or without whatsapp: prefix)
 */
export async function removeActiveConversation(
  customerPhone: string
): Promise<void> {
  if (!isSyncEnabled()) {
    return;
  }

  try {
    const key = normalizePhone(customerPhone);
    await client.sync.v1
      .services(config.twilio.syncServiceSid!)
      .syncMaps(SYNC_MAP_NAME)
      .syncMapItems(key)
      .remove();
    console.log(`Removed active conversation for ${key}`);
  } catch (error: any) {
    if (error.code === 20404) {
      // Item doesn't exist, that's fine
      console.log(`No active conversation found for ${customerPhone}`);
    } else {
      console.error('Error removing active conversation from Sync:', error);
    }
  }
}
