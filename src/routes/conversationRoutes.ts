import express, { Request, Response } from 'express';
import { handleIncomingMessage, handleConversationEvent } from '../controllers/conversationController';
import logger from '../utils/logger';
import { twilioWebhookValidation } from '../middleware/twilioWebhookValidation';

const router = express.Router();

// Handle incoming messages from Twilio Conversations
router.post('/incoming-message', twilioWebhookValidation, async (req: Request, res: Response) => {
  try {
    logger.info('Incoming conversation message', {
      requestId: req.requestId,
      conversationSid: req.body.ConversationSid,
      author: req.body.Author
    });

    const response = await handleIncomingMessage(req.body);

    // Twilio Conversations expects a 200 response
    res.status(200).json(response);
  } catch (error) {
    logger.error('Failed to process incoming message', {
      error,
      requestId: req.requestId,
      conversationSid: req.body.ConversationSid
    });
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Handle conversation events (user joined, left, etc.)
router.post('/conversation-events', twilioWebhookValidation, async (req: Request, res: Response) => {
  try {
    logger.info('Conversation event', {
      requestId: req.requestId,
      eventType: req.body.EventType,
      conversationSid: req.body.ConversationSid
    });

    const response = await handleConversationEvent(req.body);

    res.status(200).json(response);
  } catch (error) {
    logger.error('Failed to process conversation event', {
      error,
      requestId: req.requestId,
      eventType: req.body.EventType
    });
    res.status(500).json({ error: 'Failed to process event' });
  }
});

// Optional: Handle delivery receipts
router.post('/message-status', twilioWebhookValidation, async (req: Request, res: Response) => {
  try {
    logger.debug('Message status update', {
      requestId: req.requestId,
      messageSid: req.body.MessageSid,
      status: req.body.MessageStatus
    });

    // Just log for now, could be used for analytics
    res.status(200).json({ message: 'Status received' });
  } catch (error) {
    logger.error('Failed to process message status', {
      error,
      requestId: req.requestId
    });
    res.status(500).json({ error: 'Failed to process status' });
  }
});

export default router;