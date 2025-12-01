import { CallDetails } from '../types';
import { config } from '../config';
import { Twilio } from 'twilio';

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
    await client.calls(callSid).recordings.create({
      recordingStatusCallback: 'https://events.hookdeck.com/e/src_su8VnSes9EUDvIpR3fV01ywb/recordings',
      recordingStatusCallbackMethod: 'POST',
      recordingChannels: 'dual',
      recordingTrack: 'both'
    });
    console.log(`Recording started for Call SID: ${callSid}`);
  } catch (error) {
    console.error('Failed to initiate recording:', error);
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
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📞 [CallController] Initiating outbound call');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📲 To:', params.to);
  console.log('📱 From:', config.twilio.phoneNumber);
  console.log('📋 Custom Parameters:', params.customParameters ? JSON.stringify(params.customParameters, null, 2) : 'None provided');

  try {
    // Create the TwiML URL endpoint with custom parameters
    const twimlUrl = `https://${config.ngrok.domain}/api/outbound-call-twiml`;

    // Store custom parameters in a way that can be retrieved when TwiML is generated
    // For now, we'll pass them as query parameters (in production, use a database)
    const customParamsQuery = params.customParameters
      ? `?customParams=${encodeURIComponent(JSON.stringify(params.customParameters))}`
      : '';

    console.log('🔗 TwiML URL:', twimlUrl + customParamsQuery);

    const call = await client.calls.create({
      to: params.to,
      from: config.twilio.phoneNumber,
      url: twimlUrl + customParamsQuery,
      method: 'POST',
      statusCallback: `https://${config.ngrok.domain}/api/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST'
    });

    console.log('✅ Call initiated successfully');
    console.log('📞 Call SID:', call.sid);
    console.log('📊 Status:', call.status);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return {
      callSid: call.sid,
      status: call.status,
      to: call.to,
      from: call.from
    };
  } catch (error) {
    console.error('❌ Failed to initiate outbound call:', error);
    throw error;
  }
}

export async function generateOutboundCallTwiML(params: OutboundCallParams = { to: '' }): Promise<string> {
  // All configuration comes from environment variables/config
  // Only customParameters come from the API request

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📞 [CallController] Generating outbound call TwiML');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Custom Parameters:', params.customParameters ? JSON.stringify(params.customParameters, null, 2) : 'None provided');

  // Build custom parameters XML
  let customParametersXml = '';
  if (params.customParameters) {
    customParametersXml = Object.entries(params.customParameters)
      .map(([name, value]) => `<Parameter name="${escapeXml(name)}" value="${escapeXml(value)}"/>`)
      .join('\n                      ');

    console.log(`✅ Generated ${Object.keys(params.customParameters).length} TwiML <Parameter> element(s)`);
  } else {
    console.log('ℹ️  No custom parameters to include in TwiML');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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