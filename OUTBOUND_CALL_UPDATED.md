# Outbound Call API - Complete Guide

## Overview

The outbound call system now **makes actual calls** using Twilio's API with custom parameters that are passed to the AI assistant.

## Environment Setup

Add this to your `.env` file:

```bash
# Twilio Phone Number (your FROM number)
TWILIO_PHONE_NUMBER=+1234567890
```

This is the phone number Twilio will use as the "From" number for outbound calls.

## How It Works

```
1. POST /api/outbound-call
   ↓ (Your app calls Twilio API)
2. Twilio initiates the call
   ↓ (Call connects)
3. Twilio requests TwiML from /api/outbound-call-twiml
   ↓ (Your app returns TwiML with custom parameters)
4. WebSocket connection established
   ↓ (Custom parameters sent in setup message)
5. LLM receives context
   ↓
6. AI conversation begins
```

## API Endpoints

### 1. Make Outbound Call
**Endpoint:** `POST /api/outbound-call`

**Purpose:** Initiates an outbound call using Twilio

**Request Body:**
```json
{
  "to": "+15558675310",
  "customParameters": {
    "customerName": "John Doe",
    "accountId": "ACC123456",
    "callReason": "Account verification"
  }
}
```

**Response:**
```json
{
  "callSid": "CA1234567890abcdef1234567890abcd",
  "status": "queued",
  "to": "+15558675310",
  "from": "+15551234567"
}
```

### 2. Serve TwiML (Internal)
**Endpoint:** `POST /api/outbound-call-twiml`

**Purpose:** Called by Twilio to get TwiML for the call

**Note:** This endpoint is called automatically by Twilio. You don't call it directly.

### 3. Call Status Updates
**Endpoint:** `POST /api/call-status`

**Purpose:** Receives status updates from Twilio

**Statuses:** `initiated`, `ringing`, `answered`, `completed`

## Complete Example

### Making a Call with Custom Parameters

```bash
curl -X POST http://localhost:3000/api/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+15558675310",
    "customParameters": {
      "customerName": "Sarah Johnson",
      "accountId": "ACC78910",
      "callReason": "Payment reminder",
      "amount": "$250.00",
      "dueDate": "2025-12-10"
    }
  }'
```

### Response

```json
{
  "callSid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "status": "queued",
  "to": "+15558675310",
  "from": "+15551234567"
}
```

### What Happens Next

1. **Twilio makes the call** to +15558675310
2. **Person answers**
3. **Twilio requests TwiML** from your server at `/api/outbound-call-twiml?customParams=...`
4. **WebSocket connects**, setup message includes:
   ```json
   {
     "type": "setup",
     "customParameters": {
       "customerName": "Sarah Johnson",
       "accountId": "ACC78910",
       "callReason": "Payment reminder",
       "amount": "$250.00",
       "dueDate": "2025-12-10"
     }
   }
   ```
5. **LLM receives context**:
   ```json
   {
     "role": "system",
     "content": "Call Context: {\n  \"customerPhone\": \"+15558675310\",\n  \"customParameters\": {\n    \"customerName\": \"Sarah Johnson\",\n    \"accountId\": \"ACC78910\",\n    \"callReason\": \"Payment reminder\",\n    \"amount\": \"$250.00\",\n    \"dueDate\": \"2025-12-10\"\n  }\n}"
   }
   ```
6. **AI speaks**: "Hello Sarah! I'm calling from [Company] regarding your payment of $250.00 due on December 10th..."

## Console Logs

When you make a call, you'll see:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 [CallController] Initiating outbound call
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📲 To: +15558675310
📱 From: +15551234567
📋 Custom Parameters: {
  "customerName": "Sarah Johnson",
  "accountId": "ACC78910",
  "callReason": "Payment reminder"
}
🔗 TwiML URL: https://your-domain.com/api/outbound-call-twiml?customParams=...
✅ Call initiated successfully
📞 Call SID: CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
📊 Status: queued
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 [Call Status] Update received
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 Call SID: CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
📊 Status: initiated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

(more status updates as call progresses...)
```

When the call connects and TwiML is requested:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 [CallController] Generating outbound call TwiML
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Custom Parameters: {
  "customerName": "Sarah Johnson",
  "accountId": "ACC78910"
}
✅ Generated 2 TwiML <Parameter> element(s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Use Cases

### 1. Payment Reminders

```javascript
const response = await fetch('http://localhost:3000/api/outbound-call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: '+15558675310',
    customParameters: {
      customerName: 'John Doe',
      callType: 'payment_reminder',
      amount: '$150.00',
      dueDate: '2025-12-15',
      accountId: 'ACC123'
    }
  })
});

const { callSid, status } = await response.json();
console.log(`Call ${callSid} status: ${status}`);
```

### 2. Appointment Reminders

```javascript
await fetch('http://localhost:3000/api/outbound-call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: '+15558675310',
    customParameters: {
      customerName: 'Jane Smith',
      callType: 'appointment_reminder',
      appointmentDate: '2025-12-08',
      appointmentTime: '2:30 PM',
      doctorName: 'Dr. Johnson',
      appointmentType: 'Annual checkup'
    }
  })
});
```

### 3. Customer Service Follow-up

```javascript
await fetch('http://localhost:3000/api/outbound-call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: '+15558675310',
    customParameters: {
      customerName: 'Robert Wilson',
      callType: 'followup',
      ticketId: 'TICKET-789',
      issueType: 'billing_inquiry',
      lastContactDate: '2025-11-28',
      agentName: 'Maria'
    }
  })
});
```

## Integration Example

### Node.js/Express Server

```javascript
app.post('/schedule-call', async (req, res) => {
  const { phoneNumber, customerData } = req.body;

  try {
    const response = await fetch('http://localhost:3000/api/outbound-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phoneNumber,
        customParameters: customerData
      })
    });

    const result = await response.json();
    res.json({
      success: true,
      callSid: result.callSid,
      status: result.status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Python/Flask

```python
import requests

@app.route('/make-call', methods=['POST'])
def make_call():
    data = request.json

    response = requests.post(
        'http://localhost:3000/api/outbound-call',
        json={
            'to': data['phone_number'],
            'customParameters': {
                'customerName': data['name'],
                'accountId': data['account_id'],
                'callReason': data['reason']
            }
        }
    )

    return response.json()
```

## Error Handling

### Missing Required Field

**Request:**
```json
{
  "customParameters": {
    "customerName": "John"
  }
}
```

**Response:** `400 Bad Request`
```json
{
  "error": "Missing required field: to"
}
```

### Twilio API Error

**Response:** `500 Internal Server Error`
```json
{
  "error": "Failed to initiate outbound call",
  "message": "The 'To' number +1234567890 is not a valid phone number."
}
```

## Testing

### Test Script

```bash
node test-outbound-call.js
```

### Manual Test

```bash
curl -X POST http://localhost:3000/api/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1YOUR_TEST_NUMBER",
    "customParameters": {
      "customerName": "Test User",
      "testMode": "true"
    }
  }'
```

## Best Practices

1. **Validate Phone Numbers**: Always validate the `to` number before making calls
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **Store Call Records**: Log all outbound calls to a database
4. **Monitor Costs**: Track Twilio usage and costs
5. **Handle Failures**: Implement retry logic for failed calls
6. **Time Zones**: Consider time zones when making calls
7. **Opt-Out Lists**: Check do-not-call lists before making calls
8. **Custom Parameters**: Keep parameters focused and relevant

## Next Steps

1. Add phone number validation
2. Implement call scheduling system
3. Add database logging for calls
4. Create admin dashboard for call management
5. Add retry mechanism for failed calls
6. Implement do-not-call list checking
