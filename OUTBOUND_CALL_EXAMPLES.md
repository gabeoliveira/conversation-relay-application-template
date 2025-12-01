# Outbound Call Endpoint Examples

This document provides examples of how to use the `/api/outbound-call` endpoint with dynamic custom parameters for ConversationRelay.

## Endpoint

**URL:** `POST https://your-domain.com/api/outbound-call`

**Content-Type:** `application/json`

## Parameters

The endpoint accepts only custom parameters in the request body. All ConversationRelay settings (welcomeGreeting, language, ttsProvider, voice, etc.) are loaded from your environment variables via the config file.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customParameters` | object | Optional | Key-value pairs sent to your WebSocket in the setup message's `customParameters` field |

**Note:** All ConversationRelay configuration (language, voice, TTS/STT providers, welcome greeting, etc.) comes from your `.env` file and config settings. This ensures consistent behavior and centralized configuration management.

## Usage Examples

### Example 1: Basic Outbound Call (No Custom Parameters)

```bash
curl -X POST https://your-domain.com/api/outbound-call \
  -H "Content-Type: application/json" \
  -d '{}'
```

This will use all default settings from your environment variables.

### Example 2: Outbound Call with Custom Parameters

Custom parameters are sent to your WebSocket server in the setup message and can be used to pass context about the call.

```bash
curl -X POST https://your-domain.com/api/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "customParameters": {
      "customerName": "John Doe",
      "accountId": "ACC123456",
      "callReason": "Follow-up on support ticket",
      "ticketId": "TICKET-789",
      "priority": "high"
    }
  }'
```

**Resulting Setup Message in WebSocket:**
```json
{
  "type": "setup",
  "sessionId": "VX00000000000000000000000000000000",
  "callSid": "CA00000000000000000000000000000000",
  "customParameters": {
    "customerName": "John Doe",
    "accountId": "ACC123456",
    "callReason": "Follow-up on support ticket",
    "ticketId": "TICKET-789",
    "priority": "high"
  }
}
```

### Example 3: Customer Service Follow-up

```bash
curl -X POST https://your-domain.com/api/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "customParameters": {
      "callType": "customer_service",
      "customerName": "Jane Smith",
      "accountNumber": "12345",
      "issueType": "billing_inquiry",
      "lastInteractionDate": "2025-11-28"
    }
  }'
```

### Example 4: Sales Campaign Call

```bash
curl -X POST https://your-domain.com/api/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "customParameters": {
      "callType": "sales",
      "campaignId": "CAMP-2025-01",
      "productInterest": "premium_subscription",
      "leadSource": "website_form"
    }
  }'
```

### Example 5: Appointment Reminder

```bash
curl -X POST https://your-domain.com/api/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "customParameters": {
      "callType": "appointment_reminder",
      "customerName": "Robert Johnson",
      "appointmentDate": "2025-12-05",
      "appointmentTime": "14:30",
      "appointmentType": "dental_checkup"
    }
  }'
```

## Using with Twilio Calls API

To make an actual outbound call using this endpoint as the TwiML URL:

```javascript
const twilio = require('twilio');
const client = twilio(accountSid, authToken);

client.calls
  .create({
    url: 'https://your-domain.com/api/outbound-call',
    to: '+15558675310',
    from: '+15551234567',
    method: 'POST',
    // Pass parameters via statusCallback or use the TwiML endpoint directly
  })
  .then(call => console.log(call.sid));
```

### Advanced: Passing Custom Parameters when Creating a Call

Since the endpoint only accepts custom parameters, you'll need to make the call first, then pass the custom data through your system. Here's a common pattern:

```javascript
// Option 1: Create a call with custom parameters via your own API
const response = await fetch('https://your-backend.com/api/make-outbound-call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: '+15558675310',
    from: '+15551234567',
    customParameters: {
      customerName: 'John Doe',
      accountId: 'ACC123456'
    }
  })
});

// Your backend would then:
// 1. Store the custom parameters in a database with a unique identifier
// 2. Create the Twilio call
// 3. Pass the identifier as a query parameter to the TwiML URL
// 4. The TwiML endpoint retrieves the custom parameters using that identifier
```

**Better Approach:** Store call context before initiating the call:

```javascript
// 1. Store call context in your database
const callContext = {
  customerName: 'John Doe',
  accountId: 'ACC123456',
  callReason: 'Support follow-up'
};

// 2. Make the call - Twilio will call your endpoint when answered
const call = await client.calls.create({
  url: 'https://your-domain.com/api/outbound-call',
  to: '+15558675310',
  from: '+15551234567',
  method: 'POST',
  statusCallback: `https://your-domain.com/api/call-status?context=${contextId}`,
  machineDetection: 'Enable'
});

// 3. Update your endpoint to look up context based on CallSid or custom identifier
// 4. Custom parameters are then included in the TwiML based on the call context
```

## Accessing Custom Parameters in Your WebSocket Handler

Custom parameters are automatically passed to the LLM as context when the setup message is received.

### How It Works

The custom parameters are included in the conversation context sent to the LLM. When you send custom parameters like this:

```json
{
  "customParameters": {
    "customerName": "John Doe",
    "accountId": "ACC123456",
    "callReason": "Account verification"
  }
}
```

The LLM receives a system message with this context:

```json
{
  "role": "system",
  "content": "Call Context: {\n  \"customerPhone\": \"+15558675310\",\n  \"customParameters\": {\n    \"customerName\": \"John Doe\",\n    \"accountId\": \"ACC123456\",\n    \"callReason\": \"Account verification\"\n  }\n}"
}
```

### LLM Usage Example

With this context, the AI assistant can personalize the conversation:

**Without custom parameters:**
- AI: "Hello! How can I help you today?"

**With custom parameters:**
- AI: "Hello John! I'm calling regarding your account verification for account ACC123456. How can I assist you today?"

### Implementation Details

In [llmService.ts](src/services/llm/llmService.ts), the `setup()` method:
1. Extracts custom parameters from the setup message
2. Combines them with the customer phone number
3. Sends this context to the LLM as a system message
4. The LLM can then reference this information throughout the conversation

```typescript
// The setup method in llmService.ts processes custom parameters
async setup(message: any) {
  const userContext = {
    customerPhone: cleanPhone,
    customParameters: message.customParameters // Available to LLM
  };

  const userContextMessage = {
    role: "system",
    content: `Call Context: ${JSON.stringify(userContext, null, 2)}`
  };

  this.messages.push(userContextMessage);
}
```

## Best Practices

1. **Use Custom Parameters for Context**: Pass relevant customer information, call purpose, or any context that helps personalize the conversation.

2. **Avoid Sensitive Data in Parameters**: Don't pass sensitive information like passwords or credit card numbers. Use identifiers and fetch sensitive data server-side in your WebSocket handler.

3. **Centralize Configuration**: All voice settings (language, TTS provider, voice, etc.) come from environment variables, ensuring consistent behavior across all calls.

4. **Store Call Context**: For production use, store call context in a database and retrieve it using CallSid or a custom identifier when generating TwiML.

5. **Use Meaningful Parameter Names**: Choose descriptive names for your custom parameters to make your WebSocket handler code more readable.

## Generated TwiML Example

When you call the endpoint with custom parameters, it generates TwiML like this:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Transcription intelligenceService="ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
      languageCode="pt-BR"
      inboundTrackLabel="OpenAI Assistant"
      outboundTrackLabel="Customer"
      statusCallbackUrl="https://events.hookdeck.com/e/src_su8VnSes9EUDvIpR3fV01ywb/transcriptions"/>
  </Start>
  <Connect action="https://your-domain.com/api/action">
    <ConversationRelay url="wss://your-domain.com"
      dtmfDetection="true"
      interruptible="true"
      welcomeGreeting="Hello! This is an automated call."
      ttsProvider="ElevenLabs"
      ttsLanguage="pt-BR"
      voice="your-voice-id"
      transcriptionProvider="Deepgram"
      transcriptionLanguage="pt-BR"
      elevenlabsTextNormalization="on">
      <Parameter name="customerName" value="John Doe"/>
      <Parameter name="accountId" value="ACC123456"/>
      <Parameter name="callReason" value="Follow-up on support ticket"/>
    </ConversationRelay>
  </Connect>
</Response>
```

## Troubleshooting

- **Issue**: Custom parameters not appearing in setup message
  - **Solution**: Ensure you're sending `Content-Type: application/json` header and the request body is valid JSON with a `customParameters` object

- **Issue**: Want to change voice/language settings
  - **Solution**: Update your `.env` file and restart your server. All ConversationRelay settings come from environment variables

- **Issue**: Need different settings for different calls
  - **Solution**: Currently all calls use the same configuration from environment variables. To support different configurations, you would need to modify the endpoint to accept a configuration identifier and look up settings from a database
