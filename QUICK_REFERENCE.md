# Outbound Call Endpoint - Quick Reference

## Endpoint
```
POST /api/outbound-call
```

## What It Does
Generates TwiML for outbound calls using ConversationRelay with custom parameters.

## Configuration Source
- ✅ **From Environment Variables:** language, voice, TTS provider, STT provider, welcome greeting, all ConversationRelay settings
- ✅ **From API Request:** Only `customParameters` (optional key-value pairs)

## Request Example
```bash
curl -X POST http://localhost:3000/api/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "customParameters": {
      "customerName": "John Doe",
      "accountId": "ACC123456"
    }
  }'
```

## Response
Returns TwiML with `<ConversationRelay>` containing your custom parameters as `<Parameter>` elements.

## Custom Parameters in LLM Context
Custom parameters are automatically passed to the LLM as context:

```typescript
// In llmService.ts setup() method
const userContext = {
  customerPhone: cleanPhone,
  customParameters: message.customParameters
};

// Sent to LLM as system message
{
  role: "system",
  content: "Call Context: { ... customParameters ... }"
}
```

The AI assistant can use these parameters to personalize responses.

## Key Points
1. All voice/language settings come from `.env` file
2. Only custom parameters come from API request
3. Custom parameters are optional
4. Changes to voice settings require server restart
5. All calls use same ConversationRelay configuration

## Common Use Cases
- Pass customer information (name, account ID, etc.)
- Specify call purpose/type
- Include reference IDs (ticket, order, appointment)
- Provide context for AI assistant

## Testing
```bash
node test-outbound-call.js
```

## Logging
The system includes detailed logging to track custom parameters:

📞 **API Endpoint** - Shows parameters received and TwiML generation
🔌 **WebSocket** - Shows setup message with custom parameters from Twilio
🤖 **LLM Service** - Shows parameters being added to conversation context

See [LOGGING_GUIDE.md](LOGGING_GUIDE.md) for complete logging documentation.
