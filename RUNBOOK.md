# Voice AI Assistant Deployment Runbook

## Overview
This runbook will guide you through deploying a Twilio Voice AI Assistant using ConversationRelay. Estimated completion time: **45-60 minutes**.

---

## Pre-Flight Checks

Before starting, ensure you have:

- [ ] **Twilio Account** with Flex provisioned
- [ ] **Node.js v16+** installed (`node --version`)
- [ ] **npm or yarn** installed
- [ ] **ngrok** installed ([download here](https://ngrok.com/download))
- [ ] **OpenAI API Key** ([get one here](https://platform.openai.com/api-keys))
- [ ] Code editor (VS Code recommended)
- [ ] Terminal/command line access

---

## Phase 1: Environment Setup (15 min)

### Step 1: Clone and Install Dependencies

```bash
cd conversation-relay-application-template
yarn install
```

**Validation:** You should see `success Saved lockfile` and no error messages.

---

### Step 2: Start ngrok Tunnel

Open a **new terminal window** (keep this running throughout):

```bash
ngrok http 3000
```

**Expected output:**
```
Forwarding    https://[your-unique-id].ngrok.app -> http://localhost:3000
```

**✅ Copy the `https://` URL** - you'll need it in the next steps.

**Troubleshooting:**
- If port 3000 is in use, you'll change this later in `.env` (use `PORT=3001` and update ngrok to `ngrok http 3001`)
- ngrok URL changes each restart on free tier - you'll need to update Twilio webhook if you restart ngrok

---

### Step 3: Configure Environment Variables

Create your environment file:

```bash
cp .env.example .env
```

Open `.env` in your code editor and configure the following **required** variables:

| Variable | Where to Find | Example |
|----------|---------------|---------|
| `NGROK_DOMAIN` | From Step 2 (without `https://`) | `abc123.ngrok.app` |
| `TWILIO_ACCOUNT_SID` | [Twilio Console](https://console.twilio.com) - Account Info | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio Console - Account Info (click "View") | `your_auth_token` |
| `TWILIO_WORKFLOW_SID` | Twilio Console > TaskRouter > Workspaces > Flex Task Assignment > Workflows | `WWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `WELCOME_GREETING` | Your choice | `Hello! I'm your AI assistant. How can I help you today?` |
| `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) | `sk-...` |
| `TWILIO_VOICE_INTELLIGENCE_SID` | Twilio Console > Voice Intelligence > Services | `GAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

**Optional LLM Configuration** (can skip for initial testing - uses defaults):

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | API to use: `openai-chat-completions`, `openai-responses`, or `openai-agents` | `openai-chat-completions` |
| `LLM_MODEL` | OpenAI model (see [Model Selection Guide](docs/MODEL_SELECTION.md)) | `gpt-4.1` |
| `OPENAI_MAX_COMPLETION_TOKENS` | Max response tokens (150-200 for voice) | No limit |

**Optional Google integrations** (can skip for initial testing):
- `GOOGLESHEETS_SPREADSHEET_ID`
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_SERVICE_ACCOUNT_KEY`

**Validation:** No missing required values in `.env` file.

---

## Phase 2: Twilio Configuration (10 min)

### Step 4: Configure Phone Number Webhook

1. Go to [Twilio Console > Phone Numbers > Manage > Active Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Select an existing number or **Buy a Number**
3. Scroll to **Voice Configuration**
4. Set **"A call comes in"**:
   - Webhook: `https://[your-ngrok-domain].ngrok.app/api/incoming-call`
   - HTTP Method: `POST`
5. Click **Save configuration**

**Validation:** Configuration saved without errors.

---

## Phase 3: Application Launch (5 min)

### Step 5: Start Development Server

In your original terminal (not the ngrok one):

```bash
npm run dev
```

**Expected output:**
```
Server running on port 3000
WebSocket server initialized
```

**Troubleshooting:**
- **Port in use error:** Change `PORT=3001` in `.env`, restart ngrok with `ngrok http 3001`, update Twilio webhook
- **Missing env vars:** Double-check all required variables in `.env`

---

## Phase 4: Testing (10 min)

### Step 6: Test Voice AI Assistant

1. **Call your Twilio phone number** from your mobile phone
2. **Expected behavior:**
   - You hear the welcome greeting
   - AI assistant responds to your questions
   - Conversation flows naturally

**Test scenarios:**
- Ask a general question: "What's the weather?"
- Request human handoff: "I need to speak to an agent"
- Test tools: "Check my card delivery status"

**Troubleshooting:**
- **No answer:** Check Twilio webhook URL matches your current ngrok domain
- **Connection drops immediately:** Check server logs in terminal for errors
- **AI not responding:** Verify `OPENAI_API_KEY` is valid and has credits

---

## Phase 5: Verification Checklist

- [ ] ngrok tunnel running and accessible
- [ ] Development server running without errors
- [ ] Phone call connects successfully
- [ ] Welcome greeting plays
- [ ] AI responds to basic questions
- [ ] Can request human handoff (transfers to Flex)

---

## Quick Reference

### Important URLs
- **Incoming call webhook:** `https://[your-ngrok-domain].ngrok.app/api/incoming-call`
- **Action webhook:** `https://[your-ngrok-domain].ngrok.app/api/action`

### Log Files
Monitor these terminals:
1. **ngrok terminal:** Shows incoming webhook requests
2. **Server terminal:** Shows application logs and errors

### Stop/Restart
```bash
# Stop server: Ctrl+C in server terminal
# Stop ngrok: Ctrl+C in ngrok terminal

# Restart server
npm run dev

# Restart ngrok (will generate NEW URL - update Twilio webhook!)
ngrok http 3000
```

---

## Key Customization Points

This section highlights where to make common customizations. Each entry shows the **file location** and **what you can change**.

### 🤖 LLM Provider & Model Configuration

**Provider Selection** - [.env](.env) / [src/config.ts](src/config.ts)
- **What:** Choose between OpenAI Chat Completions API, Responses API, or Agents SDK
- **Options:**
  - `openai-chat-completions` (default) - Mature, stable API
  - `openai-responses` - Newer API with built-in state management, uses `instructions` parameter
  - `openai-agents` - Advanced: Agents SDK with automatic tool execution (see [Advanced: Agents SDK](#advanced-openai-agents-sdk) below)
- **Config:** Set `LLM_PROVIDER` in `.env`

**Model Selection** - [.env](.env) / [src/config.ts](src/config.ts)
- **What:** Choose which OpenAI model to use
- **Options:** `gpt-4.1` (default), `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`
- **Config:** Set `LLM_MODEL` in `.env`
- **Guide:** See [Model Selection Guide](docs/MODEL_SELECTION.md) for detailed recommendations

**Response Length** - [.env](.env)
- **What:** Limit token count in responses (important for voice)
- **Recommended:** 150-200 tokens for conversational voice bots
- **Config:** Set `OPENAI_MAX_COMPLETION_TOKENS` in `.env`

---

### 🎯 AI Prompts & Behavior

**System Prompt** - [src/prompts/systemPrompt.ts](src/prompts/systemPrompt.ts)
- **What:** Core AI instructions, personality, and guidelines
- **Examples:**
  - Change AI name and role (line 4)
  - Modify conversation rules (lines 6-19)
  - Adjust function call behavior (lines 25-60)
- **Tip:** This is your primary control for AI behavior

**Additional Context** - [src/prompts/additionalContext.ts](src/prompts/additionalContext.ts)
- **What:** Dynamic context injected into each conversation (date/time, user data)
- **Use:** Add session-specific information the AI needs

---

### 🌍 Language Configuration

**Language Options** - [src/languageOptions.ts](src/languageOptions.ts)
- **What:** Available languages, voices, and TTS/transcription providers
- **Current languages:** Portuguese (ElevenLabs), Spanish (ElevenLabs), English (Google)
- **How to add:** Copy existing language block, modify:
  - `locale_code`: Language locale (e.g., "fr-FR")
  - `voice`: Provider-specific voice ID
  - `ttsProvider`: "google" or "ElevenLabs"
  - `transcriptionProvider`: "google" or "Deepgram"

**Default Language** - [src/prompts/systemPrompt.ts:1](src/prompts/systemPrompt.ts#L1)
- **What:** Default conversation language
- **Current:** Brazilian Portuguese (pt-BR)
- **Change:** Edit line 1 to set different default

**Switch Language Tool** - [src/services/llm/tools/switchLanguage.ts](src/services/llm/tools/switchLanguage.ts)
- **What:** Allows AI to switch languages mid-conversation
- **Config:** [src/services/llm/websocketService.ts:120-136](src/services/llm/websocketService.ts#L120-L136)

---

### 🔊 Interruption Handling

**Interruption Logic** - [src/services/llm/websocketService.ts:38-49](src/services/llm/websocketService.ts#L38-L49)
- **What:** How the system handles when users interrupt the AI
- **Key behaviors:**
  - Line 41: Sets `userInterrupted` flag
  - Line 42: Waits for post-interruption prompt
  - Lines 45-48: Tells AI what it said before being interrupted
- **Customize:** Modify the system message sent to AI (line 47)

**Resume After Interruption** - [src/services/llm/websocketService.ts:20-30](src/services/llm/websocketService.ts#L20-L30)
- **What:** Controls when new prompts are accepted
- **Line 22:** Checks if stream is active or awaiting post-interrupt prompt

---

### 🔢 DTMF (Keypad Input)

**DTMF Processing** - [src/services/llm/dtmfHelper.ts](src/services/llm/dtmfHelper.ts)
- **What:** Maps phone keypad digits to words the AI understands
- **Current mapping (lines 3-17):**
  - `1` → "One"
  - `*` → "Star"
  - `#` → "Pound"
- **Customize:** Change words or add new mappings for your language

**DTMF Integration** - [src/services/llm/websocketService.ts:51-57](src/services/llm/websocketService.ts#L51-L57)
- **What:** Sends DTMF input to AI as system message
- **Use case:** AI can ask users to "press 1 for yes, 2 for no"

---

### 🛠️ Tools & Integrations

**Tool Definitions** - [src/services/llm/tools/toolDefinitions.ts](src/services/llm/tools/toolDefinitions.ts)
- **What:** OpenAI function definitions that tell the LLM what tools are available
- **Format:** Array of `LLMToolDefinition` objects with function name, description, and parameters
- **Line 15:** `toolDefinitions` array - add your tool definition here

**Tool Implementations** - [src/services/llm/tools/](src/services/llm/tools/)
- **What:** Functions that execute when the AI calls a tool
- **Examples:**
  - [humanAgentHandoff.ts](src/services/llm/tools/humanAgentHandoff.ts) - Transfer to Flex agent
  - [checkCardDelivery.ts](src/services/llm/tools/checkCardDelivery.ts) - Check delivery status
  - [bookDriver.ts](src/services/llm/tools/bookDriver.ts) - Schedule appointments
  - [identifyUser.ts](src/services/llm/tools/identifyUser.ts) - User lookup

**LLM Service Integration** - [src/services/llm/providers/](src/services/llm/providers/)
- **What:** Connects tool definitions to their implementations
- **Providers:** `openai-chat-completions.ts`, `openai-responses.ts`, and `openai-agents.ts` implement the same interface
- **Tool registration:** In `executeToolCall` method of each provider (Chat Completions/Responses) or in `createTools()` for Agents SDK

**Add New Tool (using Zod - recommended):**

All tools use **Zod schemas as the single source of truth**. This ensures type safety and automatic JSON Schema generation.

1. **Create tool file** in `src/services/llm/tools/myNewTool.ts`:
   ```typescript
   import { z } from "zod";

   // Zod schema - single source of truth
   export const myNewToolSchema = z.object({
     requiredParam: z.string().describe("Description for the LLM"),
     optionalParam: z.number().optional().describe("Optional parameter")
   });

   // TypeScript type derived from Zod
   export type MyNewToolParams = z.infer<typeof myNewToolSchema>;

   // Implementation
   export async function myNewTool(params: MyNewToolParams): Promise<string> {
     // Your tool logic here
     return "Result";
   }
   ```

2. **Add to toolDefinitions.ts** (for Chat Completions/Responses):
   ```typescript
   // Import the schema
   import { myNewToolSchema } from "./myNewTool";

   // Add to toolDefinitions array
   {
     type: 'function',
     function: {
       name: 'my_new_tool',
       description: 'What this tool does',
       parameters: zodToOpenAIParams(myNewToolSchema),
     },
   }
   ```

3. **Export** from [index.ts](src/services/llm/tools/index.ts): `export * from './myNewTool';`

4. **Register in providers:**
   - **Chat Completions/Responses:** Add to `toolFunction` map in `executeToolCall`
   - **Agents SDK:** Add `tool()` wrapper in `createTools()` (see [Advanced: Agents SDK](#advanced-openai-agents-sdk))

---

### 📊 Mock Data

**Test Data** - [src/data/mock-data.ts](src/data/mock-data.ts)
- **What:** Sample data for testing tools (users, orders, schedules)
- **Replace:** Connect to real databases/APIs in tool implementations

---

### 🔗 External Integrations

**Google Sheets/Calendar** - [src/config.ts:62-63](src/config.ts#L62-L63)
- **What:** Configuration for Google service integrations
- **Required env vars:**
  - `GOOGLESHEETS_SPREADSHEET_ID`
  - `GOOGLE_CALENDAR_ID`
  - `GOOGLE_SERVICE_ACCOUNT_KEY`

**Conversation Service** - [src/config.ts:62](src/config.ts#L62)
- **What:** Twilio Conversations service for Flex integration
- **Env var:** `TWILIO_CONVERSATION_SERVICE_SID`

---

### 🤖 Advanced: OpenAI Agents SDK

The Agents SDK (`openai-agents`) is an advanced provider option that offers automatic tool execution and agentic workflows. It's recommended for complex orchestration scenarios.

**When to use Agents SDK:**
- Complex multi-step tool execution
- Automatic tool orchestration without manual loop handling
- Agentic workflows that benefit from built-in tracing
- Zod-powered type safety for tool parameters

**Key differences from Chat Completions/Responses:**

| Aspect | Chat Completions / Responses | Agents SDK |
|--------|------------------------------|------------|
| Tool execution | Manual loop in provider | Automatic via SDK |
| Schema format | JSON Schema (via toolDefinitions.ts) | Zod schemas (direct) |
| Tool registration | `executeToolCall` method | `createTools()` with `tool()` wrapper |
| State management | Manual | Built-in |

**Adding a tool for Agents SDK:**

In [openai-agents.ts](src/services/llm/providers/openai-agents.ts), add to the `createTools()` method:

```typescript
tool({
  name: "my_new_tool",
  description: "What this tool does",
  parameters: myNewToolSchema,  // Import from your tool file
  execute: async (args) => {
    console.log('[AgentsSDK] 🔧 Executing my_new_tool');
    // Optional: emit events for special behavior
    // self.emit("someEvent", { data: args });
    return await myNewTool(args);
  }
})
```

**Special behaviors in execute wrapper:**
- **Logging:** Add console.log for debugging
- **Event emission:** Use `self.emit()` for events like `switchLanguage`, `humanAgentHandoff`
- **State flags:** Set `self._shouldEndAfterStream = true` to end conversation after tool execution

**Note:** If you're using only the Agents SDK, you don't need to update `toolDefinitions.ts` - the SDK uses Zod schemas directly.

See [Model Selection Guide](docs/MODEL_SELECTION.md) for detailed provider comparison.

---

---

## Phase 6: Messaging Integration (Optional - 20 min)

This phase adds WhatsApp/SMS messaging capabilities to your AI Assistant using Twilio Conversations.

### Prerequisites for Messaging

- [ ] WhatsApp Sender or Messaging Service configured in Twilio
- [ ] Twilio Conversations Service created

---

### Step 7: Gather Messaging SIDs

Add these to your `.env` file:

| Variable | Where to Find | Example |
|----------|---------------|---------|
| `TWILIO_CONVERSATION_SERVICE_SID` | Twilio Console > Conversations > Services | `ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_WORKSPACE_SID` | Twilio Console > TaskRouter > Workspaces | `WSxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

---

### Step 8: Configure Conversations Webhook

1. Go to [Twilio Console > Conversations > Services](https://console.twilio.com/us1/develop/conversations/manage/services)
2. Select your Conversations Service
3. Click **Webhooks** in the left menu
4. Configure **Post-webhooks**:
   - **Post-Event URL:** `https://[your-ngrok-domain].ngrok.app/api/conversations/incoming-message`
   - **Events:** Select `onMessageAdded`
5. Click **Save**

**Validation:** Webhook saved without errors.

---

### Step 9: Test Messaging

1. **Restart your development server** to load new environment variables:
   ```bash
   # Press Ctrl+C to stop, then:
   npm run dev
   ```

2. **Send a WhatsApp message** to your Twilio WhatsApp number

3. **Expected behavior:**
   - Typing indicator appears while bot processes
   - AI assistant responds to your message
   - Conversation continues naturally

**Test scenarios:**
- Send a greeting: "Hello!"
- Ask a question: "What can you help me with?"
- Request human handoff: "I need to speak to an agent"

**Troubleshooting:**
- **No response:** Check Conversations webhook URL is correct
- **Handoff not working:** Check `TWILIO_WORKFLOW_SID` and `TWILIO_WORKSPACE_SID` are correct

---

### Step 10: Verify Handoff (Messaging)

When handoff occurs in messaging:

1. **Bot creates Flex Interaction** - Task appears in Flex
2. **Bot webhooks are removed** - Bot stops receiving messages for this conversation
3. **Agent takes over** - Conversation continues in Flex

**To verify:**
1. Send a message asking for a human agent
2. Check Flex for new task
3. Verify bot no longer responds to that conversation
4. Agent can reply from Flex

---

## Phase 7: Messaging Verification Checklist

- [ ] `TWILIO_CONVERSATION_SERVICE_SID` configured in `.env`
- [ ] `TWILIO_WORKSPACE_SID` configured in `.env`
- [ ] Conversations webhook pointing to `/api/conversations/incoming-message`
- [ ] WhatsApp message receives AI response
- [ ] Typing indicator appears while processing
- [ ] Human handoff creates Flex task
- [ ] Bot stops responding after handoff

---

## Quick Reference (Updated)

### Important URLs

**Voice:**
- **Incoming call webhook:** `https://[your-ngrok-domain].ngrok.app/api/incoming-call`
- **Action webhook:** `https://[your-ngrok-domain].ngrok.app/api/action`

**Messaging:**
- **Conversations webhook:** `https://[your-ngrok-domain].ngrok.app/api/conversations/incoming-message`

### Log Files
Monitor these terminals:
1. **ngrok terminal:** Shows incoming webhook requests
2. **Server terminal:** Shows application logs and errors

### Stop/Restart
```bash
# Stop server: Ctrl+C in server terminal
# Stop ngrok: Ctrl+C in ngrok terminal

# Restart server
npm run dev

# Restart ngrok (will generate NEW URL - update ALL Twilio webhooks!)
ngrok http 3000
```

---

## Key Customization Points (Messaging)

### 💬 Messaging Controller

**Conversation Handler** - [src/controllers/conversationController.ts](src/controllers/conversationController.ts)
- **What:** Processes incoming Conversations messages
- **Key functions:**
  - `handleIncomingMessage`: Main message handler (line 12)
  - `handleConversationEvent`: Lifecycle events (line 130)
- **Customize:** Modify message filtering, session management

---

### 🤝 Messaging Handoff

**Handoff Logic** - [src/utils/conversationHandoff.ts](src/utils/conversationHandoff.ts)
- **What:** Transfers messaging conversations to Flex agents
- **Key behaviors:**
  - Creates Flex Interaction via Interactions API
  - Removes bot webhooks (identified by `NGROK_DOMAIN`)
  - Updates conversation attributes with handoff info
- **Customize:** Modify task attributes, add custom handoff data

---

## Next Steps

You've successfully deployed the Voice AI Assistant with optional messaging capabilities!

For customization topics:
- Modifying the AI prompt and behavior
- Adding custom tools and integrations
- Configuring Google Sheets/Calendar integration
- Advanced Flex integration
- Production deployment considerations

See [README.md](README.md) for detailed technical reference.
