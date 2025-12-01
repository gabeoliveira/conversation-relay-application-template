# Using Custom Parameters with the LLM

This guide explains how custom parameters flow through the system and how to instruct your LLM to use them effectively.

## Flow Overview

```
API Request → TwiML Generation → WebSocket Setup → LLM Context
```

### 1. API Request with Custom Parameters

```bash
curl -X POST http://localhost:3000/api/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "customParameters": {
      "customerName": "John Doe",
      "accountId": "ACC123456",
      "callReason": "Payment overdue",
      "amount": "$150.00",
      "dueDate": "2025-11-15"
    }
  }'
```

### 2. TwiML Generation

The endpoint generates TwiML with `<Parameter>` elements:

```xml
<ConversationRelay url="wss://your-domain.com">
  <Parameter name="customerName" value="John Doe"/>
  <Parameter name="accountId" value="ACC123456"/>
  <Parameter name="callReason" value="Payment overdue"/>
  <Parameter name="amount" value="$150.00"/>
  <Parameter name="dueDate" value="2025-11-15"/>
</ConversationRelay>
```

### 3. WebSocket Setup Message

Twilio sends this to your WebSocket:

```json
{
  "type": "setup",
  "sessionId": "VX...",
  "callSid": "CA...",
  "from": "+15558675310",
  "customParameters": {
    "customerName": "John Doe",
    "accountId": "ACC123456",
    "callReason": "Payment overdue",
    "amount": "$150.00",
    "dueDate": "2025-11-15"
  }
}
```

### 4. LLM Context

The LLMService adds this to the conversation:

```json
{
  "role": "system",
  "content": "Call Context: {\n  \"customerPhone\": \"+15558675310\",\n  \"customParameters\": {\n    \"customerName\": \"John Doe\",\n    \"accountId\": \"ACC123456\",\n    \"callReason\": \"Payment overdue\",\n    \"amount\": \"$150.00\",\n    \"dueDate\": \"2025-11-15\"\n  }\n}"
}
```

## Instructing the LLM to Use Custom Parameters

To make your LLM use the custom parameters effectively, update your system prompt in [src/prompts/systemPrompt.ts](src/prompts/systemPrompt.ts).

### Example System Prompt Enhancement

```typescript
export const systemPrompt = `You are a helpful AI assistant for [Company Name].

## Call Context Usage
You will receive call context information in a system message at the start of the conversation.
This context may include:
- customerName: The name of the person you're calling
- accountId: Their account identifier
- callReason: The purpose of this call
- Other relevant information specific to this call

IMPORTANT: Use this context to personalize your responses and stay focused on the call purpose.

## Examples

If you receive context like:
{
  "customerName": "John Doe",
  "callReason": "Payment overdue",
  "amount": "$150.00"
}

You should:
1. Greet the customer by name: "Hello John, this is [Company Name] calling."
2. Reference the call reason: "I'm calling regarding your payment of $150.00"
3. Be empathetic and helpful based on the context

## Guidelines
- Always use the customer's name when provided
- Reference the call reason early in the conversation
- Use account details when relevant but avoid repeating them unnecessarily
- If critical information is missing from context, politely ask the customer

...rest of your system prompt...
`;
```

## Use Case Examples

### 1. Payment Reminder Call

**Custom Parameters:**
```json
{
  "customerName": "Sarah Johnson",
  "accountId": "ACC78910",
  "callReason": "Payment reminder",
  "amount": "$250.00",
  "dueDate": "2025-12-10",
  "lastPaymentDate": "2025-10-15"
}
```

**Expected LLM Behavior:**
```
AI: Hello Sarah, this is [Company Name]. I'm calling to remind you about
    your upcoming payment of $250.00 due on December 10th. Would you like
    to discuss payment options?
```

### 2. Appointment Reminder

**Custom Parameters:**
```json
{
  "customerName": "Michael Brown",
  "appointmentType": "Annual checkup",
  "appointmentDate": "2025-12-08",
  "appointmentTime": "2:30 PM",
  "doctorName": "Dr. Smith"
}
```

**Expected LLM Behavior:**
```
AI: Hi Michael! This is a reminder about your annual checkup with
    Dr. Smith on December 8th at 2:30 PM. Can you confirm you'll
    be able to make it?
```

### 3. Customer Service Follow-up

**Custom Parameters:**
```json
{
  "customerName": "Emily Davis",
  "ticketId": "TICKET-5678",
  "issueType": "Billing inquiry",
  "previousAgent": "Agent Maria",
  "lastContactDate": "2025-11-28"
}
```

**Expected LLM Behavior:**
```
AI: Hello Emily, I'm following up on your billing inquiry from November 28th.
    I see you spoke with Maria about ticket #5678. Has your issue been resolved,
    or is there anything else I can help you with?
```

### 4. Sales/Upsell Call

**Custom Parameters:**
```json
{
  "customerName": "Robert Wilson",
  "currentPlan": "Basic",
  "accountAge": "2 years",
  "eligibleUpgrade": "Premium",
  "specialOffer": "20% off for 3 months"
}
```

**Expected LLM Behavior:**
```
AI: Hi Robert! I'm calling from [Company Name]. I wanted to let you know that
    as a valued customer for 2 years, you're eligible for an exclusive upgrade
    to our Premium plan with 20% off for the first 3 months. Would you like to
    hear more about the benefits?
```

## Best Practices

### 1. Keep Parameters Focused
Only include information the LLM needs for this specific call:
```json
// Good
{
  "customerName": "John",
  "callReason": "Account verification"
}

// Too much
{
  "customerName": "John",
  "customerAddress": "123 Main St",
  "customerEmail": "john@example.com",
  "customerAge": "35",
  "favoriteColor": "blue"
  // ... only include what's relevant!
}
```

### 2. Use Clear, Descriptive Keys
```json
// Good
{
  "appointmentDateTime": "2025-12-05 14:30",
  "appointmentType": "Dental cleaning"
}

// Less clear
{
  "dt": "2025-12-05 14:30",
  "type": "cleaning"
}
```

### 3. Include Call Purpose
Always include why you're calling:
```json
{
  "callReason": "Payment reminder",
  "callType": "automated_reminder"
}
```

### 4. Format Dates and Numbers Consistently
```json
{
  "amount": "$150.00",              // Not "150" or "150.0"
  "dueDate": "2025-12-10",         // ISO format
  "appointmentTime": "2:30 PM"      // Human-readable
}
```

## Testing Custom Parameters

Use the test script to see how your LLM responds to different parameters:

```bash
node test-outbound-call.js
```

Then monitor the console output to see:
1. Custom parameters received in setup message
2. Context passed to LLM
3. How the LLM incorporates the parameters in responses

## Debugging

Enable detailed logging in [llmService.ts](src/services/llm/llmService.ts):

```typescript
async setup(message: any) {
  // ... existing code ...

  if (message.customParameters) {
    console.log('Custom parameters received:', message.customParameters);
  }

  console.log('Setup complete with context:', userContext);
}
```

Check the logs to verify:
- ✅ Custom parameters are received from Twilio
- ✅ Parameters are included in the LLM context
- ✅ LLM uses the parameters in its responses

## Advanced: Dynamic System Prompts

For even more control, you can dynamically modify the system prompt based on custom parameters:

```typescript
async setup(message: any) {
  // ... existing code ...

  // Add call-specific instructions based on parameters
  if (message.customParameters?.callReason === 'payment_overdue') {
    const reminderInstruction = {
      role: "system",
      content: "This is a payment reminder call. Be empathetic but clear about the overdue amount. Offer payment plan options if the customer shows financial difficulty."
    };
    this.messages.push(reminderInstruction);
  }

  // ... rest of setup ...
}
```

This allows different call types to have different AI behaviors while sharing the same base system prompt.
