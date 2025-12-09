import { Twilio } from 'twilio';
import { config } from '../config';
import LLMService from '../services/llm/llmService';
import { ConversationMessage, ConversationEvent } from '../types';
import { handleConversationHandoff } from '../utils/conversationHandoff';
import { storeActiveConversation, removeActiveConversation } from '../utils/syncService';

const client = new Twilio(config.twilio.accountSid, config.twilio.authToken);

// Store LLM service instances per conversation
const conversationSessions = new Map<string, LLMService>();

export async function handleIncomingMessage(messageData: ConversationMessage): Promise<any> {
  try {
    const { ConversationSid, Body, Author, EventType, ParticipantSid } = messageData;

    // Ignore messages from the assistant itself
    if (Author === 'system' || Author === config.twilio.conversationServiceSid) {
      return { message: 'Ignored system message' };
    }

    // Only process actual messages
    if (EventType !== 'onMessageAdded') {
      return { message: 'Event ignored' };
    }

    // Get participant details to extract phone number
    const participant = await client.conversations.v1
      .conversations(ConversationSid)
      .participants(ParticipantSid)
      .fetch();

    // Get or create LLM service instance for this conversation
    let llmService = conversationSessions.get(ConversationSid);
    
    if (!llmService) {
      llmService = new LLMService();
      
      // Setup user context (similar to voice setup)
      await llmService.setup({
        conversationSid: ConversationSid,
        participantSid: ParticipantSid,
        clientIdentity: messageData.ClientIdentity,
        customerPhone: participant.messagingBinding?.address
      });
      
      conversationSessions.set(ConversationSid, llmService);
      console.log(`Created new LLM session for conversation: ${ConversationSid}`);

      // Store in Sync Map so typing indicator webhook knows this is an active bot conversation
      const customerPhone = String(participant.messagingBinding?.address || '');
      if (customerPhone) {
        storeActiveConversation(customerPhone, ConversationSid);
      }
    }

    // Process the message with LLM
    const userMessage = {
      role: "user" as const,
      content: Body
    };

    // Handle events from LLM service
    llmService.once('chatCompletion:complete', async (assistantMessage) => {
      try {
        // Send response back to the conversation
        await client.conversations.v1
          .conversations(ConversationSid)
          .messages
          .create({
            body: assistantMessage.content || 'Sorry, I had trouble generating a response.',
            author: 'assistant'
          });
        
        console.log(`Response sent to conversation ${ConversationSid}`);
      } catch (error) {
        console.error('Failed to send response to conversation:', error);
      }
    });

    llmService.once('humanAgentHandoff', async (handoffData) => {
      try {
        // Check if already handed off to prevent duplicates
        const conversation = await client.conversations.v1.conversations(ConversationSid).fetch();
        const attributes = JSON.parse(conversation.attributes || '{}');
        
        if (attributes.handedOff) {
          console.log(`Conversation ${ConversationSid} already handed off, ignoring duplicate request`);
          return;
        }

        // Add participant info to handoff data
        const enrichedHandoffData = {
          ...handoffData,
          customerPhone: participant.messagingBinding?.address,
          proxyAddress: participant.messagingBinding?.proxyAddress,
          conversationSid: ConversationSid
        };
        
        // Remove from Sync Map - agent is now handling the conversation
        const customerPhone = participant.messagingBinding?.address;
        if (customerPhone) {
          removeActiveConversation(String(customerPhone));
        }

        // Use the new handoff function - bot will handle messaging
        await handleConversationHandoff(ConversationSid, enrichedHandoffData);
      } catch (error) {
        console.error('Failed to handoff to human agent:', error);
      }
    });

    llmService.once('endInteraction', async () => {
      try {
        // Optionally close conversation or mark as completed
        await client.conversations.v1
          .conversations(ConversationSid)
          .messages
          .create({
            body: 'Thank you for using our service. This conversation is now complete.',
            author: 'system'
          });

        // Remove from Sync Map - conversation is ending
        const customerPhone = participant.messagingBinding?.address;
        if (customerPhone) {
          removeActiveConversation(String(customerPhone));
        }

        // Clean up the session
        conversationSessions.delete(ConversationSid);
        console.log(`Conversation ${ConversationSid} ended and session cleaned up`);
      } catch (error) {
        console.error('Failed to end conversation properly:', error);
      }
    });

    // Get LLM response
    const completion = await llmService.chatCompletion([userMessage]);
    
    return { message: 'Message processed successfully' };

  } catch (error) {
    console.error('Error processing incoming message:', error);
    throw error;
  }
}

export async function handleConversationEvent(eventData: ConversationEvent): Promise<any> {
  try {
    const { ConversationSid, EventType, ParticipantSid } = eventData;
    
    console.log(`Conversation event: ${EventType} for ${ConversationSid}`);
    
    switch (EventType) {
      case 'onParticipantAdded':
        // Could send welcome message when user joins
        if (ParticipantSid) {
          await sendWelcomeMessage(ConversationSid);
        }
        break;
        
      case 'onParticipantRemoved':
        // Clean up session when user leaves
        conversationSessions.delete(ConversationSid);
        console.log(`Cleaned up session for conversation: ${ConversationSid}`);
        break;
        
      case 'onConversationRemoved':
        // Clean up when conversation is deleted
        conversationSessions.delete(ConversationSid);
        console.log(`Conversation deleted, cleaned up session: ${ConversationSid}`);
        break;
        
      default:
        console.log(`Unhandled event type: ${EventType}`);
    }
    
    return { message: 'Event processed successfully' };
    
  } catch (error) {
    console.error('Error processing conversation event:', error);
    throw error;
  }
}

async function sendWelcomeMessage(conversationSid: string): Promise<void> {
  try {
    await client.conversations.v1
      .conversations(conversationSid)
      .messages
      .create({
        body: config.twilio.welcomeGreeting,
        author: 'assistant'
      });
  } catch (error) {
    console.error('Failed to send welcome message:', error);
  }
}