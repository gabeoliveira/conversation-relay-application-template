import express, { Request, Response } from 'express';
import { handleConnectAction } from '../controllers/connectActionController';
import { twilioWebhookValidation } from '../middleware/twilioWebhookValidation';

const router = express.Router();

router.post('/action', twilioWebhookValidation, async (req: Request, res: Response) => {
  try {
    const response = await handleConnectAction(req.body);
    res.type('text/xml');
    res.status(200).send(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to process connect action' });
  }
});

export default router;