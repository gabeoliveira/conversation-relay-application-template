import { config } from '../config';
import { getActiveConversation, isSyncEnabled } from '../utils/syncService';

const TYPING_INDICATOR_DELAY_MS = 1000; // 1 second delay before sending typing indicator

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Incoming message payload from Twilio Messaging webhook.
 */
interface IncomingMessageWebhook {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  AccountSid: string;
}

/**
 * Sends a typing indicator to WhatsApp.
 * This signals to the user that a response is being prepared.
 * The typing indicator will disappear when the response is delivered or after 25 seconds.
 */
async function sendTypingIndicator(messageSid: string): Promise<void> {
  try {
    const response = await fetch('https://messaging.twilio.com/v2/Indicators/Typing.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64')
      },
      body: new URLSearchParams({
        messageId: messageSid,
        channel: 'whatsapp'
      }).toString()
    });

    if (response.ok) {
      console.log(`Typing indicator sent for message: ${messageSid}`);
    } else {
      const errorText = await response.text();
      console.warn(`Failed to send typing indicator: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.warn('Error sending typing indicator:', error);
  }
}

/**
 * Handles incoming WhatsApp messages from the Messaging Service webhook.
 * Sends a typing indicator only if the customer has an active bot conversation.
 *
 * Note: This feature requires TWILIO_SYNC_SERVICE_SID to be configured.
 * If Sync is not enabled, this endpoint will do nothing.
 */
export async function handleIncomingWhatsAppMessage(
  messageData: IncomingMessageWebhook
): Promise<{ typingIndicatorSent: boolean }> {
  // Skip if Sync is not configured
  if (!isSyncEnabled()) {
    console.log('Sync Service not configured, skipping typing indicator');
    return { typingIndicatorSent: false };
  }

  const { MessageSid, From } = messageData;

  console.log(`Incoming WhatsApp message from ${From}, MessageSid: ${MessageSid}`);

  // Check if there's an active bot conversation for this customer
  const activeConversation = await getActiveConversation(From);

  if (activeConversation) {
    console.log(`Active bot conversation found for ${From}: ${activeConversation.conversationSid}`);

    // Add a small delay to ensure message is fully processed by Twilio
    await delay(TYPING_INDICATOR_DELAY_MS);

    // Send typing indicator - customer is talking to the bot
    await sendTypingIndicator(MessageSid);

    return { typingIndicatorSent: true };
  } else {
    console.log(`No active bot conversation for ${From}, skipping typing indicator (agent may be handling)`);
    return { typingIndicatorSent: false };
  }
}
