import express, { Request, Response } from 'express';
import { handleIncomingCall, makeOutboundCall, generateOutboundCallTwiML, initiateRecording, OutboundCallParams } from '../controllers/callController';

const router = express.Router();

const RETRY_DELAY = 5000; // Retry after 5 seconds
const MAX_RETRIES = 5; // Max retry attempts

const tryStartRecording = async (CallSid: string, attempt: number = 1) => {
  try {
    await initiateRecording(CallSid);
    console.log('Recording started successfully');
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      console.log(`Retrying to start recording (Attempt ${attempt})...`);
      setTimeout(() => tryStartRecording(CallSid, attempt + 1), RETRY_DELAY);
    } else {
      console.error('Unable to start recording after multiple attempts:', error);
    }
  }
};

router.post('/incoming-call', async (req: Request, res: Response) => {
  try {
    const callDetails = await handleIncomingCall(req.body);
    res.type('text/xml');
    console.log('Incoming call', callDetails);
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
    console.error('Failed to initiate outbound call:', error);
    res.status(500).json({
      error: 'Failed to initiate outbound call',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Route that serves TwiML for outbound calls (called by Twilio)
router.post('/outbound-call-twiml', async (req: Request, res: Response) => {
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
    console.error('Failed to generate outbound call TwiML:', error);
    res.status(500).json({ error: 'Failed to generate TwiML' });
  }
});

// Route to receive call status callbacks
router.post('/call-status', async (req: Request, res: Response) => {
  const { CallSid, CallStatus, To, From } = req.body;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 [Call Status] Update received');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📞 Call SID:', CallSid);
  console.log('📊 Status:', CallStatus);
  console.log('📲 To:', To);
  console.log('📱 From:', From);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  res.status(200).send('OK');
});

export default router;
