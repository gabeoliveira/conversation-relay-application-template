import { Twilio } from 'twilio';
import { config } from '../config';
import { HandoffData } from '../types';

const client = new Twilio(config.twilio.accountSid, config.twilio.authToken);

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



