import { CallDetails } from '../types';
import { config } from '../config';
import { Twilio } from 'twilio';
import logger from '../utils/logger';
import { withRetry } from '../utils/retry';

// Twilio client
const client = new Twilio(config.twilio.accountSid, config.twilio.authToken);

export async function handleIncomingCall(callData: CallDetails): Promise<string> {
  // Validate and process incoming call
  if (!callData) {
    throw new Error('Invalid call data');
  }

  // Refer the ConversationRelay docs for a complete list of attributes - https://www.twilio.com/docs/voice/twiml/connect/conversationrelay#conversationrelay-attributes
  return `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
              <Start>
                <Transcription intelligenceService="${config.twilio.voiceIntelligenceSid}"
                  languageCode="pt-BR" 
                  inboundTrackLabel="OpenAI Assistant"
                  outboundTrackLabel="Customer"
                  statusCallbackUrl="https://events.hookdeck.com/e/src_su8VnSes9EUDvIpR3fV01ywb/transcriptions"/> 
              </Start>   
              <Connect action="https://${config.ngrok.domain}/api/action">
                    <ConversationRelay url="wss://${config.ngrok.domain}" dtmfDetection="true" interruptible="true"
                      welcomeGreeting="${config.twilio.welcomeGreeting}"
                      ttsProvider="${config.languages.portuguese.ttsProvider}"
                      ttsLanguage="${config.languages.portuguese.locale_code}"
                      voice="${config.languages.portuguese.voice}"
                      transcriptionProvider="${config.languages.portuguese.transcriptionProvider}"
                      transcriptionLanguage="${config.languages.portuguese.transcriptionLanguage}"
                      elevenlabsTextNormalization="on"
                      > 
                    </ConversationRelay>
              </Connect>
          </Response>`;
}

export async function initiateRecording(callSid: string): Promise<void> {
  try {
    await withRetry(
      () => client.calls(callSid).recordings.create({
        recordingStatusCallback: 'https://events.hookdeck.com/e/src_su8VnSes9EUDvIpR3fV01ywb/recordings',
        recordingStatusCallbackMethod: 'POST',
        recordingChannels: 'dual',
        recordingTrack: 'both'
      }),
      {},
      { operation: 'initiate recording', callSid }
    );
    logger.info('Recording started', { callSid });
  } catch (error) {
    logger.error('Failed to initiate recording', { error, callSid });
    throw error;
  }
}

export interface OutboundCallParams {
  to: string;
  customParameters?: Record<string, string>;
}

export interface OutboundCallResponse {
  callSid: string;
  status: string;
  to: string;
  from: string;
}

export async function makeOutboundCall(params: OutboundCallParams): Promise<OutboundCallResponse> {
  logger.info('Initiating outbound call', {
    to: params.to,
    from: config.twilio.phoneNumber,
    customParameters: params.customParameters
  });

  try {
    // Create the TwiML URL endpoint with custom parameters
    const twimlUrl = `https://${config.ngrok.domain}/api/outbound-call-twiml`;

    // Store custom parameters in a way that can be retrieved when TwiML is generated
    // For now, we'll pass them as query parameters (in production, use a database)
    const customParamsQuery = params.customParameters
      ? `?customParams=${encodeURIComponent(JSON.stringify(params.customParameters))}`
      : '';

    logger.debug('Outbound call TwiML URL', { url: twimlUrl + customParamsQuery });

    const call = await withRetry(
      () => client.calls.create({
        to: params.to,
        from: config.twilio.phoneNumber,
        url: twimlUrl + customParamsQuery,
        method: 'POST',
        statusCallback: `https://${config.ngrok.domain}/api/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST'
      }),
      {},
      { operation: 'create outbound call', to: params.to }
    );

    logger.info('Outbound call initiated successfully', {
      callSid: call.sid,
      status: call.status,
      to: params.to
    });

    return {
      callSid: call.sid,
      status: call.status,
      to: call.to,
      from: call.from
    };
  } catch (error) {
    logger.error('Failed to initiate outbound call', { error, to: params.to });
    throw error;
  }
}

export async function generateOutboundCallTwiML(params: OutboundCallParams = { to: '' }): Promise<string> {
  // All configuration comes from environment variables/config
  // Only customParameters come from the API request

  logger.debug('Generating outbound call TwiML', {
    customParameters: params.customParameters
  });

  // Build custom parameters XML
  let customParametersXml = '';
  if (params.customParameters) {
    customParametersXml = Object.entries(params.customParameters)
      .map(([name, value]) => `<Parameter name="${escapeXml(name)}" value="${escapeXml(value)}"/>`)
      .join('\n                      ');

    logger.debug('Generated TwiML Parameter elements', {
      count: Object.keys(params.customParameters).length
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
              <Start>
                <Transcription intelligenceService="${config.twilio.voiceIntelligenceSid}"
                  languageCode="${config.languages.portuguese.locale_code}"
                  inboundTrackLabel="OpenAI Assistant"
                  outboundTrackLabel="Customer"
                  statusCallbackUrl="https://events.hookdeck.com/e/src_su8VnSes9EUDvIpR3fV01ywb/transcriptions"/>
              </Start>
              <Connect action="https://${config.ngrok.domain}/api/action">
                    <ConversationRelay url="wss://${config.ngrok.domain}"
                      dtmfDetection="true"
                      interruptible="true"
                      welcomeGreeting="${escapeXml(config.twilio.welcomeGreeting || 'Hello! How can I help you today?')}"
                      ttsProvider="${config.languages.portuguese.ttsProvider}"
                      ttsLanguage="${config.languages.portuguese.locale_code}"
                      voice="${config.languages.portuguese.voice}"
                      transcriptionProvider="${config.languages.portuguese.transcriptionProvider}"
                      transcriptionLanguage="${config.languages.portuguese.transcriptionLanguage}"
                      elevenlabsTextNormalization="on">
                      ${customParametersXml}
                    </ConversationRelay>
              </Connect>
          </Response>`;
}

// Helper function to escape XML special characters
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}