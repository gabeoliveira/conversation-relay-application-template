import express, { Request, Response } from 'express';
import { handleIncomingMessage, handleConversationEvent } from '../controllers/conversationController';

const router = express.Router();

// Handle incoming messages from Twilio Conversations
router.post('/incoming-message', async (req: Request, res: Response) => {
  try {
    console.log('Incoming conversation message:', req.body);
    
    const response = await handleIncomingMessage(req.body);
    
    // Twilio Conversations expects a 200 response
    res.status(200).json(response);
  } catch (error) {
    console.error('Failed to process incoming message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Handle conversation events (user joined, left, etc.)
router.post('/conversation-events', async (req: Request, res: Response) => {
  try {
    console.log('Conversation event:', req.body);
    
    const response = await handleConversationEvent(req.body);
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Failed to process conversation event:', error);
    res.status(500).json({ error: 'Failed to process event' });
  }
});

// Optional: Handle delivery receipts
router.post('/message-status', async (req: Request, res: Response) => {
  try {
    console.log('Message status update:', req.body);
    
    // Just log for now, could be used for analytics
    res.status(200).json({ message: 'Status received' });
  } catch (error) {
    console.error('Failed to process message status:', error);
    res.status(500).json({ error: 'Failed to process status' });
  }
});

export default router;