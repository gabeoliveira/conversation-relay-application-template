import express, { Request, Response } from 'express';
import { handleIncomingCall, makeOutboundCall, generateOutboundCallTwiML, initiateRecording, OutboundCallParams } from '../controllers/callController';
import logger from '../utils/logger';
import { twilioWebhookValidation } from '../middleware/twilioWebhookValidation';

const router = express.Router();

const RETRY_DELAY = 5000; // Retry after 5 seconds
const MAX_RETRIES = 5; // Max retry attempts

const tryStartRecording = async (CallSid: string, attempt: number = 1) => {
  try {
    await initiateRecording(CallSid);
    logger.info('Recording started successfully', { callSid: CallSid });
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      logger.warn('Retrying to start recording', { callSid: CallSid, attempt });
      setTimeout(() => tryStartRecording(CallSid, attempt + 1), RETRY_DELAY);
    } else {
      logger.error('Unable to start recording after multiple attempts', { error, callSid: CallSid, attempts: MAX_RETRIES });
    }
  }
};

router.post('/incoming-call', twilioWebhookValidation, async (req: Request, res: Response) => {
  try {
    const callDetails = await handleIncomingCall(req.body);
    logger.info('Incoming call processed', {
      requestId: req.requestId,
      callSid: req.body.CallSid,
      from: req.body.From
    });
    res.type('text/xml');
    res.status(200).send(callDetails);

    // Attempt to start recording with a retry mechanism
    //tryStartRecording(req.body.CallSid);
  } catch (error) {
    res.status(500).json({ error: 'Failed to process incoming call' });
  }

});

// Route to initiate an outbound call
router.post('/outbound-call', async (req: Request, res: Response) => {
  try {
    // Validate required fields
    if (!req.body.to) {
      return res.status(400).json({ error: 'Missing required field: to' });
    }

    const params: OutboundCallParams = {
      to: req.body.to,
      customParameters: req.body.customParameters
    };

    const result = await makeOutboundCall(params);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Failed to initiate outbound call', { error, requestId: req.requestId });
    res.status(500).json({
      error: 'Failed to initiate outbound call',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Route that serves TwiML for outbound calls (called by Twilio)
router.post('/outbound-call-twiml', twilioWebhookValidation, async (req: Request, res: Response) => {
  try {
    // Extract custom parameters from query string
    let customParameters: Record<string, string> | undefined;
    if (req.query.customParams) {
      customParameters = JSON.parse(decodeURIComponent(req.query.customParams as string));
    }

    const params: OutboundCallParams = {
      to: '', // Not needed for TwiML generation
      customParameters
    };

    const twiml = await generateOutboundCallTwiML(params);
    res.type('text/xml');
    res.status(200).send(twiml);
  } catch (error) {
    logger.error('Failed to generate outbound call TwiML', { error, requestId: req.requestId });
    res.status(500).json({ error: 'Failed to generate TwiML' });
  }
});

// Route to receive call status callbacks
router.post('/call-status', twilioWebhookValidation, async (req: Request, res: Response) => {
  const { CallSid, CallStatus, To, From } = req.body;

  logger.info('Call status update received', {
    requestId: req.requestId,
    callSid: CallSid,
    status: CallStatus,
    to: To,
    from: From
  });

  res.status(200).send('OK');
});

export default router;
