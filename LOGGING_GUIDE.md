# Logging Guide - Custom Parameters Flow

This guide shows you what logs to expect when custom parameters flow through your system.

## Log Flow Overview

When you make an outbound call with custom parameters, you'll see logs at three key stages:

1. **API Endpoint** - When TwiML is generated
2. **WebSocket** - When Twilio sends the setup message
3. **LLM Service** - When parameters are added to the conversation

## Example Log Output

### Stage 1: API Endpoint Receives Request

When you call the `/api/outbound-call` endpoint:

```
Outbound call TwiML requested with custom parameters: {
  customerName: 'John Doe',
  accountId: 'ACC123456',
  callReason: 'Account verification'
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 [CallController] Generating outbound call TwiML
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Custom Parameters: {
  "customerName": "John Doe",
  "accountId": "ACC123456",
  "callReason": "Account verification"
}
✅ Generated 3 TwiML <Parameter> element(s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Stage 2: WebSocket Receives Setup Message

When the call connects and Twilio sends the setup message:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔌 [WebSocket] Setup message received from Twilio
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 Call SID: CA1234567890abcdef1234567890abcd
📍 Session ID: VX1234567890abcdef1234567890abcd
📱 From: +15558675310
📲 To: +15551234567
📦 Custom Parameters received:
{
  "customerName": "John Doe",
  "accountId": "ACC123456",
  "callReason": "Account verification"
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Stage 3: LLM Service Processes Context

When the LLM service adds parameters to the conversation:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 [LLMService] Processing setup message
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Customer Phone: +15558675310
✅ Custom parameters included in LLM context:
{
  "customerName": "John Doe",
  "accountId": "ACC123456",
  "callReason": "Account verification"
}

📤 System message sent to LLM:
Call Context: {
  "customerPhone": "+15558675310",
  "customParameters": {
    "customerName": "John Doe",
    "accountId": "ACC123456",
    "callReason": "Account verification"
  }
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Complete Flow Example

Here's what you'll see in your console for a complete call:

```bash
# 1. API Request
POST /api/outbound-call
Outbound call TwiML requested with custom parameters: { customerName: 'John Doe', ... }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 [CallController] Generating outbound call TwiML
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Custom Parameters: { "customerName": "John Doe", ... }
✅ Generated 3 TwiML <Parameter> element(s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 2. Call Initiated (Twilio makes the call)

# 3. Call Answered (Person picks up)

# 4. WebSocket Connection
New WebSocket connection

# 5. Setup Message Received
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔌 [WebSocket] Setup message received from Twilio
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 Call SID: CA...
📍 Session ID: VX...
📱 From: +15558675310
📲 To: +15551234567
📦 Custom Parameters received:
{
  "customerName": "John Doe",
  "accountId": "ACC123456",
  "callReason": "Account verification"
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 6. LLM Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 [LLMService] Processing setup message
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Customer Phone: +15558675310
✅ Custom parameters included in LLM context:
{
  "customerName": "John Doe",
  "accountId": "ACC123456",
  "callReason": "Account verification"
}

📤 System message sent to LLM:
Call Context: {
  "customerPhone": "+15558675310",
  "customParameters": {
    "customerName": "John Doe",
    "accountId": "ACC123456",
    "callReason": "Account verification"
  }
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 7. Conversation Begins
# (You'll see prompt messages, LLM responses, etc.)
```

## Testing Without Making a Real Call

You can test the TwiML generation endpoint directly:

```bash
# Test the endpoint
node test-outbound-call.js

# Or use curl
curl -X POST http://localhost:3000/api/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "customParameters": {
      "customerName": "Test User",
      "testMode": "true"
    }
  }'
```

You should see:

```
Outbound call TwiML requested with custom parameters: { customerName: 'Test User', testMode: 'true' }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 [CallController] Generating outbound call TwiML
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Custom Parameters: {
  "customerName": "Test User",
  "testMode": "true"
}
✅ Generated 2 TwiML <Parameter> element(s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## No Custom Parameters

If you don't include custom parameters:

```bash
curl -X POST http://localhost:3000/api/outbound-call \
  -H "Content-Type: application/json" \
  -d '{}'
```

You'll see:

```
Outbound call TwiML requested with custom parameters: undefined

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 [CallController] Generating outbound call TwiML
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Custom Parameters: None provided
ℹ️  No custom parameters to include in TwiML
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

And when the setup message arrives:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔌 [WebSocket] Setup message received from Twilio
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 Call SID: CA...
📍 Session ID: VX...
📱 From: +15558675310
📲 To: +15551234567
📦 Custom Parameters: None
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 [LLMService] Processing setup message
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Customer Phone: +15558675310
ℹ️  No custom parameters provided

📤 System message sent to LLM:
Call Context: {
  "customerPhone": "+15558675310"
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Emoji Legend

- 📞 Call/TwiML related
- 🔌 WebSocket connection
- 🤖 LLM/AI processing
- 📋 Data/Parameters
- 📱 Phone number (From)
- 📲 Phone number (To)
- 📍 Session/Call identifiers
- 📦 Custom parameters
- ✅ Success/Confirmation
- ℹ️  Information
- 📤 Outgoing message

## Troubleshooting

### Not Seeing Custom Parameters?

1. **Check API Request Logs** - You should see parameters in the first log section
2. **Check WebSocket Logs** - Parameters should appear in setup message
3. **Check LLM Logs** - Parameters should be in the system message

### Parameters Missing at WebSocket Stage?

- TwiML might not be generated correctly
- Check that `<Parameter>` elements are in the TwiML response
- Verify the endpoint returned valid XML

### Parameters Missing in LLM?

- Check the setup method is being called
- Verify `message.customParameters` exists in the setup message
- Look for the "Custom parameters included in LLM context" log

## Log Files

All logs go to the console (stdout). To save logs to a file:

```bash
# Save logs to a file
npm start > logs.txt 2>&1

# Or save with timestamp
npm start 2>&1 | tee logs-$(date +%Y%m%d-%H%M%S).txt
```

## Filtering Logs

To see only custom parameter logs:

```bash
# Linux/Mac
npm start 2>&1 | grep -E "(Custom Parameters|customParameters|📦)"

# View in real-time
npm start 2>&1 | grep --line-buffered -E "(Custom Parameters|customParameters|📦)"
```
