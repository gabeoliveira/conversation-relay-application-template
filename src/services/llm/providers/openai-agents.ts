import { Agent, run, tool } from "@openai/agents";
import { BaseLLMService, BaseMessage, BaseTool, CompletionOptions, ToolCall } from "../types";
import { systemPrompt } from "../../../prompts/systemPrompt";
import { getAdditionalContext } from "../../../prompts/additionalContext";
import { config } from "../../../config";

// Import tool implementations and their Zod schemas (single source of truth)
import {
  checkIncreaseLimit,
  checkIncreaseLimitSchema,
  checkCardDelivery,
  checkCardDeliverySchema,
  troubleshootLoginIssues,
  troubleshootLoginIssuesSchema,
  checkPendingBill,
  checkPendingBillSchema,
  searchCommonMedicalTerms,
  searchCommonMedicalTermsSchema,
  checkHsaAccount,
  checkHsaAccountSchema,
  switchLanguage,
  switchLanguageSchema,
  identifyUser,
  identifyUserSchema,
  addSurveyResponse,
  addSurveyResponseSchema,
  bookDriver,
  bookDriverSchema,
  humanAgentHandoffSchema,
} from "../tools";

/**
 * OpenAI Agents SDK Service
 *
 * This service uses the OpenAI Agents SDK which provides:
 * - Built-in agent loop with automatic tool execution
 * - Zod-powered tool validation
 * - Handoffs between specialized agents
 * - Built-in tracing and debugging
 * - Support for hosted tools (file search, web search, etc.)
 *
 * @see https://openai.github.io/openai-agents-js/
 */
export class OpenAIAgentsService extends BaseLLMService {
  private agent: Agent;
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private _interruptionMessage?: BaseMessage;
  private customerContext: Record<string, any> = {};

  constructor(apiKey?: string) {
    super();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 [OpenAIAgentsService] Initializing...');
    console.log('   Provider: OpenAI Agents SDK');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Set API key for the SDK
    if (apiKey || process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = apiKey || process.env.OPENAI_API_KEY;
    }

    // Create the main agent with tools
    this.agent = this.createAgent();

    // Initialize conversation with welcome greeting
    this.conversationHistory.push({
      role: "assistant",
      content: config.twilio.welcomeGreeting || "Hello! How can I help you today?"
    });
  }

  /**
   * Create the main agent with all tools
   */
  private createAgent(): Agent {
    const instructions = `${systemPrompt}\n\n${getAdditionalContext()}`;

    return new Agent({
      name: "ConversationRelayAgent",
      instructions,
      model: config.llm.model,
      tools: this.createTools(),
    });
  }

  /**
   * Create all tools using the Agents SDK tool() helper with Zod schemas
   * Schemas are imported from individual tool files (single source of truth)
   */
  private createTools() {
    const self = this;

    return [
      tool({
        name: "switch_language",
        description: "Switch the language of the conversation",
        parameters: switchLanguageSchema,
        execute: async ({ targetLanguage }) => {
          console.log('[AgentsSDK] 🌐 Language switch requested:', targetLanguage);
          self.emit("switchLanguage", { targetLanguage });
          const result = await switchLanguage({ targetLanguage });
          return result;
        }
      }),

      tool({
        name: "check_pending_bill",
        description: "Check if the user has a pending medical bill",
        parameters: checkPendingBillSchema,
        execute: async ({ userId }) => {
          console.log('[AgentsSDK] 🔧 Checking pending bill for user:', userId);
          return await checkPendingBill({ userId });
        }
      }),

      tool({
        name: "search_common_medical_terms",
        description: "Check knowledge base for medical terms",
        parameters: searchCommonMedicalTermsSchema,
        execute: async ({ inquiry }) => {
          console.log('[AgentsSDK] 🔧 Searching medical terms:', inquiry);
          return await searchCommonMedicalTerms({ inquiry });
        }
      }),

      tool({
        name: "check_hsa_account",
        description: "Check the balance of a user's Health Savings Account (HSA)",
        parameters: checkHsaAccountSchema,
        execute: async ({ userId }) => {
          console.log('[AgentsSDK] 🔧 Checking HSA account for user:', userId);
          return await checkHsaAccount({ userId });
        }
      }),

      tool({
        name: "check_increase_limit",
        description: "Checks whether the user is eligible for a credit or account limit increase",
        parameters: checkIncreaseLimitSchema,
        execute: async ({ userId }) => {
          console.log('[AgentsSDK] 🔧 Checking increase limit for user:', userId);
          return await checkIncreaseLimit({ userId });
        }
      }),

      tool({
        name: "troubleshoot_login_issues",
        description: "Assists the user in resolving common login issues",
        parameters: troubleshootLoginIssuesSchema,
        execute: async ({ userId }) => {
          console.log('[AgentsSDK] 🔧 Troubleshooting login for user:', userId);
          return await troubleshootLoginIssues({ userId });
        }
      }),

      tool({
        name: "check_card_delivery",
        description: "Checks the status of a card delivery for the user",
        parameters: checkCardDeliverySchema,
        execute: async ({ userId }) => {
          console.log('[AgentsSDK] 🔧 Checking card delivery for user:', userId);
          return await checkCardDelivery({ userId });
        }
      }),

      tool({
        name: "human_agent_handoff",
        description: "Transfers the customer to a live agent",
        parameters: humanAgentHandoffSchema,
        execute: async ({ reason, context }) => {
          console.log('[AgentsSDK] 🤝 Human agent handoff requested');
          self.emit("humanAgentHandoff", { reason, context });
          return "Handoff request initiated. Connecting you to a human agent.";
        }
      }),

      tool({
        name: "identify_user",
        description: "Identify the user based on the incoming phone number",
        parameters: identifyUserSchema,
        execute: async ({ customerPhone }) => {
          console.log('[AgentsSDK] 🔧 Identifying user:', customerPhone);
          return await identifyUser({ customerPhone });
        }
      }),

      tool({
        name: "add_survey_response",
        description: "Add a Customer Satisfaction Survey Response",
        parameters: addSurveyResponseSchema,
        execute: async (args) => {
          console.log('[AgentsSDK] 📊 Adding survey response');
          const result = await addSurveyResponse(args);
          // Signal to end the conversation after survey
          self._shouldEndAfterStream = true;
          return result;
        }
      }),

      tool({
        name: "book_driver",
        description: "Books a driver with specified details",
        parameters: bookDriverSchema,
        execute: async (args) => {
          console.log('[AgentsSDK] 🔧 Booking driver');
          return await bookDriver(args);
        }
      })
    ];
  }

  addInterruptionMessage(message: BaseMessage): void {
    this._interruptionMessage = message;
  }

  async setup(message: any): Promise<void> {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 [OpenAIAgentsService] Processing setup message');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const rawPhone = message.from || message.customerPhone;
    const cleanPhone = rawPhone?.replace(/^whatsapp:/, '');

    console.log('📱 Customer Phone:', cleanPhone || 'N/A');

    this.customerContext = {
      customerPhone: cleanPhone
    };

    if (message.customParameters) {
      this.customerContext.customParameters = message.customParameters;
      console.log('✅ Custom parameters included in context:');
      console.log(JSON.stringify(message.customParameters, null, 2));
    } else {
      console.log('ℹ️  No custom parameters provided');
    }

    // Add context to conversation history
    this.conversationHistory.push({
      role: "system",
      content: `Call Context: ${JSON.stringify(this.customerContext, null, 2)}`
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  async chatCompletion(
    messages: BaseMessage[],
    tools?: BaseTool[],
    options?: CompletionOptions
  ): Promise<any> {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📨 [OpenAIAgentsService] chatCompletion called');
    console.log('   Mode: Non-streaming (Agent run)');
    console.log('   Model:', config.llm.model);
    console.log('   Incoming messages:', messages.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Add incoming messages to conversation history
      for (const msg of messages) {
        if (msg.content) {
          this.conversationHistory.push({
            role: msg.role,
            content: msg.content
          });
        }
      }

      // Build the input from the last user message
      const lastUserMessage = messages.find(m => m.role === 'user');
      const input = lastUserMessage?.content || "";

      console.log('[AgentsSDK] Running agent with input:', input.substring(0, 100) + (input.length > 100 ? '...' : ''));

      // Run the agent
      const result = await run(this.agent, input, {
        maxTurns: 10,
      });

      // Extract the final output
      const finalOutput = result.finalOutput || "";

      console.log('[AgentsSDK] ✅ Agent completed');
      console.log('[AgentsSDK] Final output:', finalOutput.substring(0, 100) + (finalOutput.length > 100 ? '...' : ''));

      // Add assistant response to history
      this.conversationHistory.push({
        role: "assistant",
        content: finalOutput
      });

      this.emit("chatCompletion:complete", { role: "assistant", content: finalOutput });

      // Handle graceful ending
      if (this._shouldEndAfterStream) {
        console.log("[AgentsSDK] 👋 Ending conversation after final response...");
        this.emit("endInteraction");
        this._shouldEndAfterStream = false;
      }

      return { content: finalOutput };

    } catch (error) {
      this.emit("chatCompletion:error", error);
      console.error('❌ [OpenAIAgentsService] Chat Completion Error:', error);
      throw error;
    }
  }

  async streamChatCompletion(
    messages: BaseMessage[],
    tools?: BaseTool[],
    options?: CompletionOptions
  ): Promise<void> {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📨 [OpenAIAgentsService] streamChatCompletion called');
    console.log('   Mode: Streaming (Agent run with stream)');
    console.log('   Model:', config.llm.model);
    console.log('   Incoming messages:', messages.length);
    console.log('   userInterrupted:', this._userInterrupted);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Handle interruption message
      if (this._userInterrupted && this._interruptionMessage) {
        messages.push(this._interruptionMessage);
        this._interruptionMessage = undefined;
        this._userInterrupted = false;
      }

      // Add incoming messages to conversation history
      for (const msg of messages) {
        if (msg.content) {
          this.conversationHistory.push({
            role: msg.role,
            content: msg.content
          });
        }
      }

      // Prevent multiple simultaneous completions
      if (this._streamDepth === 0 && this._streamActive) {
        console.warn('[AgentsSDK] ⚠️ Stream already active. Skipping new request.');
        return;
      }
      this._streamActive = true;
      this._streamDepth++;

      // Build the input from the last user message
      const lastUserMessage = messages.find(m => m.role === 'user');
      const input = lastUserMessage?.content || "";

      console.log('[AgentsSDK] Running agent with streaming, input:', input.substring(0, 100) + (input.length > 100 ? '...' : ''));

      // Run the agent with streaming
      const result = await run(this.agent, input, {
        maxTurns: 10,
        stream: true,
      });

      let fullResponse = "";

      // Process the stream
      for await (const event of result) {
        if (this._userInterrupted) {
          console.log("[AgentsSDK] Stream interrupted by user.");
          this.emit("streamChatCompletion:interrupted", fullResponse);
          break;
        }

        // Handle different event types
        if (event.type === "raw_model_stream_event") {
          const data = event.data as any;

          // Handle text delta events
          if (data?.type === "response.output_text.delta" && data?.delta) {
            const content = data.delta;
            fullResponse += content;
            console.log("[AgentsSDK] 📝 Text chunk:", content.substring(0, 50) + (content.length > 50 ? '...' : ''));
            this.emit("streamChatCompletion:partial", content);
          }
        }

        // Handle run completion
        if (event.type === "run_item_stream_event" && event.name === "message_output_created") {
          // Message is being created, will get content through deltas
        }
      }

      // Get final output from completed run
      const finalOutput = result.finalOutput || fullResponse;

      if (finalOutput) {
        console.log('[AgentsSDK] ✅ Stream completed');
        console.log('[AgentsSDK] Final response length:', finalOutput.length, 'chars');

        // Add to history
        this.conversationHistory.push({
          role: "assistant",
          content: finalOutput
        });

        // Emit completion with empty string to signal last:true
        // The actual content was already streamed via partial events
        this.emit("streamChatCompletion:complete", "");

        // Handle graceful ending
        if (this._shouldEndAfterStream) {
          console.log("[AgentsSDK] 👋 Gracefully ending after final response...");
          this.emit("endInteraction");
          this._shouldEndAfterStream = false;
        }
      }

    } catch (error) {
      console.error('❌ [OpenAIAgentsService] Stream Chat Completion Error:', error);
      throw error;
    } finally {
      this._streamDepth--;
      console.log(`[AgentsSDK] Stream exited — depth: ${this._streamDepth}`);

      if (this._streamDepth <= 0) {
        this._streamDepth = 0;
        this._streamActive = false;
        this._userInterrupted = false;
      }
    }
  }

  async executeToolCall(toolCall: ToolCall): Promise<string> {
    // Tools are executed automatically by the Agents SDK
    // This method is kept for interface compatibility
    console.log('[AgentsSDK] executeToolCall called directly - tools are auto-executed by SDK');
    return "Tool execution handled by Agents SDK";
  }
}

export default OpenAIAgentsService;
