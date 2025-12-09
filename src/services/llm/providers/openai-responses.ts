import OpenAI from "openai";
import { BaseLLMService, BaseMessage, BaseTool, CompletionOptions, ToolCall } from "../types";
import { systemPrompt } from "../../../prompts/systemPrompt";
import { getAdditionalContext } from "../../../prompts/additionalContext";
import { config } from "../../../config";
import { responsesApiTools, toOpenAIResponses } from "../tools/converter";
import {
  checkIncreaseLimit,
  checkCardDelivery,
  troubleshootLoginIssues,
  checkPendingBill,
  searchCommonMedicalTerms,
  humanAgentHandoff,
  checkHsaAccount,
  checkPaymentOptions,
  switchLanguage,
  identifyUser,
  addSurveyResponse,
  bookDriver
} from "../tools";

/**
 * OpenAI Responses API Service
 *
 * This service uses the new OpenAI Responses API which provides:
 * - Built-in conversation state management
 * - Simpler tool definition format
 * - Automatic tool result handling
 * - Instructions parameter for system prompts (more efficient token usage)
 *
 * @see https://platform.openai.com/docs/api-reference/responses
 */
export class OpenAIResponsesService extends BaseLLMService {
  private openai: OpenAI;
  private conversationHistory: Array<OpenAI.Responses.ResponseInputItem>;
  private _interruptionMessage?: BaseMessage;
  private instructions: string;

  constructor(apiKey?: string) {
    super();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 [OpenAIResponsesService] Initializing...');
    console.log('   Provider: OpenAI Responses API');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });

    // Use instructions parameter for system prompt (more efficient)
    this.instructions = `${systemPrompt}\n\n${getAdditionalContext()}`;

    // Initialize conversation history with just the welcome greeting
    this.conversationHistory = [
      {
        type: "message",
        role: "assistant",
        content: config.twilio.welcomeGreeting || "Hello! How can I help you today?"
      }
    ];
  }

  addInterruptionMessage(message: BaseMessage): void {
    this._interruptionMessage = message;
  }

  async setup(message: any): Promise<void> {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 [OpenAIResponsesService] Processing setup message');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const rawPhone = message.from || message.customerPhone;
    const cleanPhone = rawPhone?.replace(/^whatsapp:/, '');

    console.log('📱 Customer Phone:', cleanPhone || 'N/A');

    const userContext: Record<string, any> = {
      customerPhone: cleanPhone
    };

    if (message.customParameters) {
      userContext.customParameters = message.customParameters;
      console.log('✅ Custom parameters included in LLM context:');
      console.log(JSON.stringify(message.customParameters, null, 2));
    } else {
      console.log('ℹ️  No custom parameters provided');
    }

    // Add context as a system message in the conversation history
    const contextMessage: OpenAI.Responses.ResponseInputItem = {
      type: "message",
      role: "system",
      content: `Call Context: ${JSON.stringify(userContext, null, 2)}`
    };

    this.conversationHistory.push(contextMessage);

    console.log('\n📤 Context message added to conversation:');
    console.log(contextMessage.content);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  /**
   * Log token usage from a response
   */
  private logTokenUsage(usage: OpenAI.Responses.Response['usage']): void {
    if (usage) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 [ResponsesAPI] Token Usage:');
      console.log(`   Input tokens:  ${usage.input_tokens}`);
      console.log(`   Output tokens: ${usage.output_tokens}`);
      console.log(`   Total tokens:  ${usage.total_tokens}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  }

  async chatCompletion(
    messages: BaseMessage[],
    tools?: BaseTool[],
    options?: CompletionOptions
  ): Promise<any> {
    const model = options?.model || config.llm.model;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📨 [OpenAIResponsesService] chatCompletion called');
    console.log('   Mode: Non-streaming');
    console.log('   Model:', model);
    console.log('   Incoming messages:', messages.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Convert incoming messages to Responses API format
      const inputMessages = this.convertToResponsesFormat(messages);
      this.conversationHistory.push(...inputMessages);

      console.log('[ResponsesAPI] Total conversation history:', this.conversationHistory.length, 'messages');

      // Get tools in Responses API format
      const toolsToUse = tools ? toOpenAIResponses(tools) : responsesApiTools;
      console.log('[ResponsesAPI] Tools available:', toolsToUse.length);

      console.log('[ResponsesAPI] Sending request to OpenAI Responses API...');
      const response = await this.openai.responses.create({
        model,
        instructions: this.instructions,
        input: this.conversationHistory,
        tools: toolsToUse,
        ...(config.openai.maxCompletionTokens && {
          max_output_tokens: config.openai.maxCompletionTokens
        }),
      });

      console.log('[ResponsesAPI] Response received, processing...');
      this.logTokenUsage(response.usage);

      // Process the response
      return this.processResponse(response, tools, options);

    } catch (error) {
      this.emit("chatCompletion:error", error);
      console.error('❌ [OpenAIResponsesService] Chat Completion Error:', error);
      throw error;
    }
  }

  async streamChatCompletion(
    messages: BaseMessage[],
    tools?: BaseTool[],
    options?: CompletionOptions
  ): Promise<void> {
    const model = options?.model || config.llm.model;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📨 [OpenAIResponsesService] streamChatCompletion called');
    console.log('   Mode: Streaming');
    console.log('   Model:', model);
    console.log('   Incoming messages:', messages.length);
    console.log('   userInterrupted:', this._userInterrupted);
    console.log('   awaitingPostInterruptPrompt:', this._awaitingPostInterruptPrompt);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Handle interruption message
      if (this._userInterrupted && this._interruptionMessage) {
        messages.push(this._interruptionMessage);
        this._interruptionMessage = undefined;
        this._userInterrupted = false;
      }

      // Convert and add messages
      const inputMessages = this.convertToResponsesFormat(messages);
      this.conversationHistory.push(...inputMessages);

      console.log("[ResponsesAPI] Conversation history:", this.conversationHistory.length, "messages");

      // Prevent multiple simultaneous completions
      if (this._streamDepth === 0 && this._streamActive) {
        console.warn('[ResponsesAPI] ⚠️ Stream already active. Skipping new request.');
        return;
      }
      this._streamActive = true;
      this._streamDepth++;
      console.log(`[ResponsesAPI] Stream depth: ${this._streamDepth}`);

      // Get tools in Responses API format
      const toolsToUse = tools ? toOpenAIResponses(tools) : responsesApiTools;
      console.log('[ResponsesAPI] Tools available:', toolsToUse.length);

      console.log('[ResponsesAPI] Starting streaming request to OpenAI Responses API...');
      const stream = await this.openai.responses.create({
        model,
        instructions: this.instructions,
        input: this.conversationHistory,
        tools: toolsToUse,
        stream: true,
        ...(config.openai.maxCompletionTokens && {
          max_output_tokens: config.openai.maxCompletionTokens
        }),
      });

      let llmResponse = "";
      const pendingToolCalls: ToolCall[] = [];

      for await (const event of stream) {
        if (this._userInterrupted) {
          console.log("Stream interrupted by user.");
          this.emit("streamChatCompletion:interrupted", llmResponse);
          break;
        }

        // Handle different event types from Responses API streaming
        if (event.type === "response.output_text.delta") {
          const content = event.delta || "";
          llmResponse += content;
          console.log("[ResponsesAPI] 📝 Text chunk:", content.substring(0, 50) + (content.length > 50 ? '...' : ''));
          this.emit("streamChatCompletion:partial", content);
        }

        if (event.type === "response.function_call_arguments.delta") {
          // Accumulate function call arguments
          const lastCall = pendingToolCalls[pendingToolCalls.length - 1];
          if (lastCall) {
            lastCall.arguments += event.delta || "";
          }
        }

        if (event.type === "response.output_item.added") {
          // New output item - could be text or function call
          if (event.item?.type === "function_call") {
            console.log('[ResponsesAPI] 🔧 Tool call detected:', event.item.name);
            pendingToolCalls.push({
              id: event.item.call_id || `call_${Date.now()}`,
              name: event.item.name || "",
              arguments: ""
            });
          }
        }

        if (event.type === "response.completed") {
          console.log('[ResponsesAPI] ✅ Stream completed');

          // Log token usage from completed response
          if (event.response?.usage) {
            this.logTokenUsage(event.response.usage);
          }

          // Stream finished
          if (llmResponse) {
            console.log('[ResponsesAPI] Final response length:', llmResponse.length, 'chars');
            // Add assistant response to history
            this.conversationHistory.push({
              type: "message",
              role: "assistant",
              content: llmResponse
            });
            this.emit("streamChatCompletion:complete", llmResponse);

            // Handle graceful ending
            if (this._shouldEndAfterStream) {
              console.log("[ResponsesAPI] 👋 Gracefully ending after final response...");
              this.emit("endInteraction");
              this._shouldEndAfterStream = false;
              return;
            }
          }

          // Process any pending tool calls
          if (pendingToolCalls.length > 0) {
            console.log('[ResponsesAPI] Processing', pendingToolCalls.length, 'tool call(s)...');

            // IMPORTANT: Add the function call items to history BEFORE processing
            // The Responses API requires the function_call to be in history before function_call_output
            for (const tc of pendingToolCalls) {
              this.conversationHistory.push({
                type: "function_call",
                call_id: tc.id,
                name: tc.name,
                arguments: tc.arguments
              } as OpenAI.Responses.ResponseInputItem);
            }

            await this.processToolCalls(pendingToolCalls, tools, options);
          }
        }
      }

    } catch (error) {
      console.error('❌ [OpenAIResponsesService] Stream Chat Completion Error:', error);
      throw error;
    } finally {
      this._streamDepth--;
      console.log(`[ResponsesAPI] Stream exited — depth: ${this._streamDepth}`);

      if (this._streamDepth <= 0) {
        this._streamDepth = 0;
        this._streamActive = false;
        this._userInterrupted = false;
      }
    }
  }

  async executeToolCall(toolCall: ToolCall): Promise<string> {
    console.log('[ResponsesAPI] 🔧 Executing tool:', toolCall.name);
    console.log('[ResponsesAPI]    Arguments:', toolCall.arguments.substring(0, 100) + (toolCall.arguments.length > 100 ? '...' : ''));

    try {
      const { name, arguments: args } = toolCall;

      if (name === "human_agent_handoff") {
        console.log('[ResponsesAPI] 🤝 Human agent handoff requested');
        this.emit("humanAgentHandoff", JSON.parse(args));
        return "Handoff request initiated. Connecting you to a human agent.";
      }

      const toolFunction = {
        check_increase_limit: checkIncreaseLimit,
        check_card_delivery: checkCardDelivery,
        troubleshoot_login_issues: troubleshootLoginIssues,
        check_pending_bill: checkPendingBill,
        search_common_medical_terms: searchCommonMedicalTerms,
        check_hsa_account: checkHsaAccount,
        check_payment_options: checkPaymentOptions,
        switch_language: switchLanguage,
        identify_user: identifyUser,
        add_survey_response: addSurveyResponse,
        book_driver: bookDriver
      }[name];

      if (!toolFunction) {
        console.error('[ResponsesAPI] ❌ Tool not found:', name);
        throw new Error(`Tool ${name} not implemented`);
      }

      const result = await toolFunction(JSON.parse(args));
      console.log('[ResponsesAPI] ✅ Tool executed successfully:', name);
      console.log('[ResponsesAPI]    Result preview:', result.substring(0, 100) + (result.length > 100 ? '...' : ''));

      if (name === "switch_language") {
        console.log('[ResponsesAPI] 🌐 Language switch requested');
        this.emit("switchLanguage", JSON.parse(args));
      } else if (name === "add_survey_response") {
        console.log('[ResponsesAPI] 📊 Survey response added, will end after stream');
        this._shouldEndAfterStream = true;
      }

      return result;
    } catch (error) {
      this.emit("toolCall:error", error as Error);
      console.error('[ResponsesAPI] ❌ Tool Call Error:', error);
      throw error;
    }
  }

  /**
   * Convert base messages to Responses API format
   */
  private convertToResponsesFormat(messages: BaseMessage[]): OpenAI.Responses.ResponseInputItem[] {
    return messages.map(msg => {
      if (msg.role === 'tool' && msg.toolCallId) {
        return {
          type: "function_call_output" as const,
          call_id: msg.toolCallId,
          output: msg.content || ""
        };
      }

      return {
        type: "message" as const,
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content || ""
      };
    });
  }

  /**
   * Process a non-streaming response
   */
  private async processResponse(
    response: OpenAI.Responses.Response,
    tools?: BaseTool[],
    options?: CompletionOptions
  ): Promise<any> {
    const output = response.output;

    // Check for function calls
    const functionCalls = output.filter(item => item.type === "function_call");

    if (functionCalls.length > 0) {
      // IMPORTANT: Add the function call items to history BEFORE processing
      // The Responses API requires the function_call to be in history before function_call_output
      for (const fc of functionCalls) {
        this.conversationHistory.push({
          type: "function_call",
          call_id: fc.call_id || `call_${Date.now()}`,
          name: fc.name || "",
          arguments: fc.arguments || "{}"
        } as OpenAI.Responses.ResponseInputItem);
      }

      const toolCalls: ToolCall[] = functionCalls.map(fc => ({
        id: fc.call_id || `call_${Date.now()}`,
        name: fc.name || "",
        arguments: fc.arguments || "{}"
      }));

      // Process tool calls and continue conversation
      return this.processToolCalls(toolCalls, tools, options);
    }

    // Extract text response
    const textOutput = output.find(item => item.type === "message");
    if (textOutput && textOutput.type === "message") {
      const content = textOutput.content?.[0];
      if (content?.type === "output_text") {
        const responseText = content.text;

        // Add to history
        this.conversationHistory.push({
          type: "message",
          role: "assistant",
          content: responseText
        });

        console.log("final message:", responseText);
        this.emit("chatCompletion:complete", { role: "assistant", content: responseText });

        if (this._shouldEndAfterStream) {
          console.log("Ending conversation after final response...");
          this.emit("endInteraction");
          this._shouldEndAfterStream = false;
        }

        return response;
      }
    }

    return response;
  }

  /**
   * Process tool calls and continue the conversation
   */
  private async processToolCalls(
    toolCalls: ToolCall[],
    tools?: BaseTool[],
    options?: CompletionOptions
  ): Promise<any> {
    // Execute all tool calls
    const results = await Promise.all(
      toolCalls.map(async (toolCall) => {
        try {
          const result = await this.executeToolCall(toolCall);
          return {
            toolCallId: toolCall.id,
            result
          };
        } catch (error) {
          console.error(`Tool call ${toolCall.name} failed:`, error);
          return {
            toolCallId: toolCall.id,
            result: `Error executing tool: ${error instanceof Error ? error.message : "Unknown error"}`
          };
        }
      })
    );

    // Add function call outputs to history
    for (const { toolCallId, result } of results) {
      this.conversationHistory.push({
        type: "function_call_output",
        call_id: toolCallId,
        output: result
      });
    }

    // Continue the conversation with tool results
    return this.chatCompletion([], tools, options);
  }
}

export default OpenAIResponsesService;
