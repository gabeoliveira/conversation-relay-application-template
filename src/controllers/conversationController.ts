import { Twilio } from 'twilio';
import { config } from '../config';
import { createLLMService } from '../services/llm/factory';
import { BaseLLMService } from '../services/llm/types';
import { ConversationMessage, ConversationEvent } from '../types';
import { handleConversationHandoff } from '../utils/conversationHandoff';
import logger from '../utils/logger';
import { withRetry } from '../utils/retry';

const client = new Twilio(config.twilio.accountSid, config.twilio.authToken);

// Store LLM service instances per conversation
const conversationSessions = new Map<string, BaseLLMService>();

// Delay before sending typing indicator to ensure message data is available in Twilio's system
const TYPING_INDICATOR_DELAY_MS = 1000;

/**
 * Sends a typing indicator to WhatsApp by fetching the most recent inbound message.
 * Uses the Messaging API to get the latest message SID from the customer.
 */
async function sendTypingIndicator(customerPhone: string): Promise<void> {
  try {
    // Wait to ensure the message is fully processed and available in the Messaging API
    await new Promise(resolve => setTimeout(resolve, TYPING_INDICATOR_DELAY_MS));
    // Fetch the most recent message from this customer (messages are sorted by DateSent descending)
    const messages = await withRetry(
      () => client.messages.list({ from: customerPhone, limit: 1 }),
      { maxRetries: 2 },
      { operation: 'fetch messages for typing indicator', customerPhone }
    );

    if (messages.length === 0) {
      logger.debug('No messages found for typing indicator', { customerPhone });
      return;
    }

    const messageSid = messages[0].sid;

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
      logger.debug('Typing indicator sent', { messageSid, customerPhone });
    } else {
      const errorText = await response.text();
      logger.warn('Failed to send typing indicator', {
        status: response.status,
        error: errorText,
        messageSid,
        customerPhone
      });
    }
  } catch (error) {
    logger.warn('Error sending typing indicator', { error, customerPhone });
  }
}

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
    const participant = await withRetry(
      () => client.conversations.v1
        .conversations(ConversationSid)
        .participants(ParticipantSid)
        .fetch(),
      {},
      { operation: 'fetch participant', conversationSid: ConversationSid, participantSid: ParticipantSid }
    );

    // Get or create LLM service instance for this conversation
    let llmService = conversationSessions.get(ConversationSid);

    if (!llmService) {
      llmService = createLLMService();

      // Setup user context (similar to voice setup)
      await llmService.setup({
        conversationSid: ConversationSid,
        participantSid: ParticipantSid,
        clientIdentity: messageData.ClientIdentity,
        customerPhone: participant.messagingBinding?.address
      });

      conversationSessions.set(ConversationSid, llmService);
      logger.info('LLM session created', { conversationSid: ConversationSid, participantSid: ParticipantSid });

      // Register event handlers ONCE when the session is created (not on every message)
      llmService.on('chatCompletion:complete', async (assistantMessage) => {
        try {
          // Send response back to the conversation
          await withRetry(
            () => client.conversations.v1
              .conversations(ConversationSid)
              .messages
              .create({
                body: assistantMessage.content || 'Sorry, I had trouble generating a response.',
                author: 'assistant'
              }),
            {},
            { operation: 'send message to conversation', conversationSid: ConversationSid }
          );

          logger.info('Response sent to conversation', { conversationSid: ConversationSid });
        } catch (error) {
          logger.error('Failed to send response to conversation', { error, conversationSid: ConversationSid });
        }
      });

      llmService.on('humanAgentHandoff', async (handoffData) => {
        try {
          // Check if already handed off to prevent duplicates
          const conversation = await withRetry(
            () => client.conversations.v1.conversations(ConversationSid).fetch(),
            {},
            { operation: 'fetch conversation for handoff check', conversationSid: ConversationSid }
          );
          const attributes = JSON.parse(conversation.attributes || '{}');

          if (attributes.handedOff) {
            logger.info('Conversation already handed off, ignoring duplicate', { conversationSid: ConversationSid });
            return;
          }

          // Add participant info to handoff data
          const enrichedHandoffData = {
            ...handoffData,
            customerPhone: participant.messagingBinding?.address,
            proxyAddress: participant.messagingBinding?.proxyAddress,
            conversationSid: ConversationSid
          };

          // Use the new handoff function - bot will handle messaging
          await handleConversationHandoff(ConversationSid, enrichedHandoffData);
        } catch (error) {
          logger.error('Failed to handoff to human agent', { error, conversationSid: ConversationSid });
        }
      });

      llmService.once('endInteraction', async () => {
        try {
          // Clean up the session
          conversationSessions.delete(ConversationSid);
          logger.info('Conversation ended and session cleaned up', { conversationSid: ConversationSid });
        } catch (error) {
          logger.error('Failed to end conversation properly', { error, conversationSid: ConversationSid });
        }
      });
    }

    // Send typing indicator before processing (don't await to avoid blocking)
    const customerPhone = participant.messagingBinding?.address;
    if (customerPhone) {
      sendTypingIndicator(String(customerPhone));
    }

    // Process the message with LLM
    const userMessage = {
      role: "user" as const,
      content: Body
    };

    // Get LLM response
    const completion = await llmService.chatCompletion([userMessage]);
    
    return { message: 'Message processed successfully' };

  } catch (error) {
    logger.error('Error processing incoming message', { error, conversationSid: messageData.ConversationSid });
    throw error;
  }
}

export async function handleConversationEvent(eventData: ConversationEvent): Promise<any> {
  try {
    const { ConversationSid, EventType, ParticipantSid } = eventData;

    logger.info('Conversation event received', { eventType: EventType, conversationSid: ConversationSid, participantSid: ParticipantSid });
    
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
        logger.info('Session cleaned up (participant removed)', { conversationSid: ConversationSid });
        break;
        
      case 'onConversationRemoved':
        // Clean up when conversation is deleted
        conversationSessions.delete(ConversationSid);
        logger.info('Session cleaned up (conversation removed)', { conversationSid: ConversationSid });
        break;

      default:
        logger.debug('Unhandled event type', { eventType: EventType, conversationSid: ConversationSid });
    }
    
    return { message: 'Event processed successfully' };
    
  } catch (error) {
    logger.error('Error processing conversation event', { error, eventData });
    throw error;
  }
}

async function sendWelcomeMessage(conversationSid: string): Promise<void> {
  try {
    await withRetry(
      () => client.conversations.v1
        .conversations(conversationSid)
        .messages
        .create({
          body: config.twilio.welcomeGreeting,
          author: 'assistant'
        }),
      {},
      { operation: 'send welcome message', conversationSid }
    );
    logger.info('Welcome message sent', { conversationSid });
  } catch (error) {
    logger.error('Failed to send welcome message', { error, conversationSid });
  }
}