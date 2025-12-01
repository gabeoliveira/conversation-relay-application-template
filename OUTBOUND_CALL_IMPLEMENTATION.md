# Outbound Call Implementation Summary

This document summarizes the implementation of the outbound call endpoint with dynamic ConversationRelay parameters.

## Overview

A new endpoint has been created that generates TwiML for outbound calls using ConversationRelay. The endpoint accepts custom parameters via API calls, which are sent to your WebSocket server in the setup message's `customParameters` field.

**Important:** All ConversationRelay configuration (language, voice, TTS/STT providers, welcome greeting, etc.) comes from environment variables via the config file. Only custom parameters for passing call context are accepted via the API request.

## Files Modified

### 1. [src/controllers/callController.ts](src/controllers/callController.ts)

**Added:**
- `OutboundCallParams` interface - Defines the structure for custom parameters only
- `handleOutboundCall()` function - Generates TwiML for outbound calls with custom parameters
- `escapeXml()` helper function - Safely escapes XML special characters

**Key Features:**
- Accepts custom parameters that are sent to the WebSocket
- All ConversationRelay settings (voice, language, providers, etc.) come from config/environment variables
- Properly escapes XML to prevent injection vulnerabilities
- Consistent configuration across all outbound calls

### 2. [src/routes/callRoutes.ts](src/routes/callRoutes.ts)

**Added:**
- `POST /api/outbound-call` route - Endpoint that accepts parameters and returns TwiML

**Request Body Format:**
```json
{
  "customParameters": {
    "customerName": "John Doe",
    "accountId": "ACC123456",
    "callReason": "Support follow-up"
  }
}
```

**Note:** The `customParameters` field is optional. All other ConversationRelay configuration comes from environment variables.

### 3. [src/types/index.ts](src/types/index.ts)

**Modified:**
- `SetupMessage` type - Added optional `customParameters` field to handle custom parameters from TwiML

### 4. [src/services/llm/llmService.ts](src/services/llm/llmService.ts)

**Modified:**
- `setup()` method - Now extracts and includes `customParameters` in the LLM context
- Custom parameters are sent to the LLM as part of a system message containing call context
- This allows the AI assistant to use the custom parameters (customer name, account info, call reason, etc.) to personalize the conversation

## Files Created

### 1. [OUTBOUND_CALL_EXAMPLES.md](OUTBOUND_CALL_EXAMPLES.md)

Comprehensive documentation with:
- API endpoint details and parameter descriptions
- Multiple usage examples (basic, with custom parameters, multi-language, etc.)
- Integration with Twilio Calls API
- How to access parameters in your WebSocket handler
- Best practices and troubleshooting

### 2. [test-outbound-call.js](test-outbound-call.js)

Test script with:
- Multiple test scenarios
- Example code for making actual Twilio calls
- Easy-to-run tests for validating the endpoint

## How It Works

### 1. API Request Flow

```
Client → POST /api/outbound-call (with parameters)
  ↓
callRoutes.ts extracts parameters
  ↓
callController.handleOutboundCall() generates TwiML
  ↓
TwiML returned with <Parameter> elements
  ↓
Twilio processes TwiML and connects to WebSocket
  ↓
WebSocket receives setup message with customParameters
```

### 2. TwiML Generation

The endpoint generates TwiML like this:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Transcription intelligenceService="ISXXX..."
      languageCode="pt-BR"
      inboundTrackLabel="OpenAI Assistant"
      outboundTrackLabel="Customer"
      statusCallbackUrl="..."/>
  </Start>
  <Connect action="https://your-domain/api/action">
    <ConversationRelay url="wss://your-domain"
      dtmfDetection="true"
      interruptible="true"
      welcomeGreeting="Hello! How can I help?"
      ttsProvider="ElevenLabs"
      ttsLanguage="pt-BR"
      voice="voice-id"
      transcriptionProvider="Deepgram"
      transcriptionLanguage="pt-BR"
      elevenlabsTextNormalization="on">
      <Parameter name="customerName" value="John Doe"/>
      <Parameter name="accountId" value="ACC123456"/>
      <!-- More parameters as provided -->
    </ConversationRelay>
  </Connect>
</Response>
```

### 3. WebSocket Setup Message

Your WebSocket handler will receive:

```json
{
  "type": "setup",
  "sessionId": "VX...",
  "callSid": "CA...",
  "customParameters": {
    "customerName": "John Doe",
    "accountId": "ACC123456"
  }
}
```

## Usage Examples

### Basic Example (No Custom Parameters)

```bash
curl -X POST http://localhost:3000/api/outbound-call \
  -H "Content-Type: application/json" \
  -d '{}'
```

### With Custom Parameters

```bash
curl -X POST http://localhost:3000/api/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "customParameters": {
      "customerName": "John Doe",
      "accountId": "ACC123456",
      "callReason": "Account verification"
    }
  }'
```

### Making an Actual Call with Twilio

```javascript
const twilio = require('twilio');
const client = twilio(accountSid, authToken);

// The TwiML endpoint will be called when the call connects
const call = await client.calls.create({
  url: 'https://your-domain.com/api/outbound-call',
  to: '+15558675310',
  from: '+15551234567',
  method: 'POST'
});

console.log(call.sid);
```

## Security Considerations

1. **XML Escaping**: All user input is properly escaped using the `escapeXml()` function to prevent XML injection attacks.

2. **Parameter Validation**: Consider adding validation for critical parameters in production.

3. **Sensitive Data**: Avoid passing sensitive information (passwords, credit cards) in custom parameters. Use identifiers instead and fetch sensitive data server-side.

4. **Authentication**: Consider adding authentication to the `/api/outbound-call` endpoint in production.

## Integration with Your WebSocket Handler

In your WebSocket service ([src/services/llm/websocketService.ts](src/services/llm/websocketService.ts)), access the custom parameters:

```typescript
if (message.type === 'setup') {
  const { customParameters } = message;

  if (customParameters) {
    // Use the parameters to customize the conversation
    const customerName = customParameters.customerName;
    const accountId = customParameters.accountId;

    // Fetch customer data, load context, etc.
    console.log(`Call for customer ${customerName} (Account: ${accountId})`);
  }
}
```

## Testing

Run the test script:

```bash
node test-outbound-call.js
```

This will test various scenarios and show you the generated TwiML.

## How Custom Parameters Are Used

Custom parameters flow through the system as follows:

1. **API Request** → Custom parameters sent in request body
2. **TwiML Generation** → Parameters converted to `<Parameter>` elements in TwiML
3. **Twilio ConversationRelay** → Parameters sent in WebSocket setup message
4. **LLMService** → Parameters added to LLM conversation context
5. **AI Assistant** → Uses parameters to personalize the conversation

For detailed information on how to use custom parameters effectively, see [CUSTOM_PARAMETERS_USAGE.md](CUSTOM_PARAMETERS_USAGE.md).

## Next Steps

1. **Customize System Prompt**: Update [src/prompts/systemPrompt.ts](src/prompts/systemPrompt.ts) to instruct the LLM on how to use custom parameters
2. **Add Authentication**: Implement authentication middleware for the endpoint
3. **Add Validation**: Add request body validation using Zod or similar
4. **Add Logging**: Implement detailed logging for outbound calls
5. **Add Rate Limiting**: Protect the endpoint from abuse
6. **Test Different Scenarios**: Try various custom parameter combinations to see how the LLM responds

## Support

For more information about ConversationRelay parameters, see:
- [Twilio ConversationRelay TwiML Documentation](https://www.twilio.com/docs/voice/twiml/connect/conversationrelay)
- [ConversationRelay WebSocket Messages](https://www.twilio.com/docs/voice/conversationrelay/websocket-messages)
