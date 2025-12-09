import { Twilio } from 'twilio';
import { config } from '../config';
import { HandoffData } from '../types';

const client = new Twilio(config.twilio.accountSid, config.twilio.authToken);

/**
 * Removes bot webhooks from a conversation.
 * This prevents the bot from receiving messages after handoff to an agent.
 * Identifies bot webhooks by matching the NGROK_DOMAIN in the webhook URL.
 */
async function removeBotWebhooks(conversationSid: string): Promise<void> {
  const ngrokDomain = config.ngrok.domain;

  if (!ngrokDomain) {
    console.warn('NGROK_DOMAIN not configured, cannot identify bot webhooks to remove');
    return;
  }

  try {
    // List all webhooks for this conversation
    const webhooks = await client.conversations.v1
      .conversations(conversationSid)
      .webhooks
      .list();

    // Find and remove webhooks that contain our ngrok domain
    for (const webhook of webhooks) {
      const webhookUrl = (webhook.configuration as { url?: string })?.url;

      if (webhookUrl && webhookUrl.includes(ngrokDomain)) {
        console.log(`Removing bot webhook ${webhook.sid} with URL: ${webhookUrl}`);

        await client.conversations.v1
          .conversations(conversationSid)
          .webhooks(webhook.sid)
          .remove();

        console.log(`Successfully removed webhook ${webhook.sid}`);
      }
    }
  } catch (error) {
    console.error('Error removing bot webhooks:', error);
    // Don't throw - we still want the handoff to proceed even if webhook removal fails
  }
}

export async function handleConversationHandoff(
  conversationSid: string, 
  handoffData: HandoffData
): Promise<void> {
  try {
    // Prepare task attributes
    const taskAttributes = {
      type: 'conversation',
      conversationSid: conversationSid,
      name: 'whatsapp:+5511976932682',
      channel_type: 'chat',
      direction: 'inbound',
      handoff_reason: handoffData.reason || 'customer_request',
      priority: handoffData.priority || 0,
      ...handoffData.attributes,
      ...handoffData.customerInfo
    };

    console.log('Creating Flex interaction for conversation handoff:', {
      conversationSid,
      taskAttributes
    });

    // Create a Flex interaction using the Interactions API
    const interaction = await client.flexApi.v1.interaction.create({
      channel: {
        type: 'whatsapp',
        initiated_by: 'customer',
        properties: {
          media_channel_sid: conversationSid,
        },
      },
      routing: {
        properties: {
          workspace_sid: config.twilio.workspaceSid,
          workflow_sid: config.twilio.workflowSid,
          task_channel_unique_name: 'chat',
          attributes: taskAttributes
        }
      }
    });

    console.log('Flex interaction created successfully:', interaction.sid);

    // Remove bot webhooks so the bot stops receiving messages
    await removeBotWebhooks(conversationSid);

    // Update conversation attributes
    await client.conversations.v1
      .conversations(conversationSid)
      .update({
        attributes: JSON.stringify({
          ...JSON.parse((await client.conversations.v1.conversations(conversationSid).fetch()).attributes || '{}'),
          handedOff: true,
          interactionSid: interaction.sid,
          handoffTimestamp: new Date().toISOString()
        })
      });

  } catch (error) {
    console.error('Failed to create Flex interaction for conversation handoff:', error);
    throw error;
  }
}



