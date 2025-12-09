import OpenAI from "openai";
import { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import { ChatCompletionMessageParam } from "openai/resources/chat";
import { Stream } from "openai/streaming";
import { ChatCompletionChunk } from "openai/resources/chat/completions";

import { systemPrompt } from "../../../prompts/systemPrompt";
import { getAdditionalContext } from "../../../prompts/additionalContext";
import { config } from "../../../config";
import { BaseLLMService, BaseMessage, BaseTool, CompletionOptions, ToolCall } from "../types";
import { chatCompletionsTools, toOpenAIChatCompletions } from "../tools/converter";
import {
  checkIncreaseLimit,
  checkCardDelivery,
  troubleshootLoginIssues,
  checkPendingBill,
  searchCommonMedicalTerms,
  humanAgentHandoff,
  toolDefinitions,
  LLMToolDefinition,
  checkHsaAccount,
  checkPaymentOptions,
  switchLanguage,
  identifyUser,
  addSurveyResponse,
  bookDriver
} from "../tools";

/**
 * OpenAI Chat Completions API Service
 *
 * This service uses the traditional OpenAI Chat Completions API which provides:
 * - Mature, stable API
 * - Wide compatibility
 * - Well-documented behavior
 *
 * @see https://platform.openai.com/docs/api-reference/chat
 */
export class OpenAIChatCompletionsService extends BaseLLMService {
  private openai: OpenAI;
  private messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  private _interruptionMessage?: ChatCompletionMessageParam;

  constructor(apiKey?: string) {
    super();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 [OpenAIChatCompletionsService] Initializing...');
    console.log('   Provider: OpenAI Chat Completions API');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });

    // Initialize conversation with system context
    this.messages = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "system",
        content: getAdditionalContext()
      },
      {
        role: "assistant",
        content: config.twilio.welcomeGreeting || "Hello! How can I help you today?"
      }
    ];
  }

  addInterruptionMessage(message: BaseMessage): void {
    this._interruptionMessage = {
      role: message.role,
      content: message.content
    } as ChatCompletionMessageParam;
  }

  async setup(message: any): Promise<void> {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 [OpenAIChatCompletionsService] Processing setup message');
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

    const userContextMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
      role: "system",
      content: `Call Context: ${JSON.stringify(userContext, null, 2)}`
    };

    this.messages.push(userContextMessage);

    console.log('\n📤 System message sent to LLM:');
    console.log(userContextMessage.content);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  async chatCompletion(
    messages: BaseMessage[],
    tools?: BaseTool[],
    options?: CompletionOptions
  ): Promise<any> {
    const model = options?.model || config.llm.model;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📨 [OpenAIChatCompletionsService] chatCompletion called');
    console.log('   Mode: Non-streaming');
    console.log('   Model:', model);
    console.log('   Incoming messages:', messages.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Convert incoming messages to Chat Completions format
      const chatMessages = this.convertToChatCompletionsFormat(messages);
      this.messages.push(...chatMessages);

      console.log('[ChatCompletions] Total conversation history:', this.messages.length, 'messages');

      // Get tools in Chat Completions format
      const toolsToUse = tools ? toOpenAIChatCompletions(tools) : toolDefinitions;
      console.log('[ChatCompletions] Tools available:', toolsToUse.length);

      console.log('[ChatCompletions] Sending request to OpenAI Chat Completions API...');
      const completion = await this.openai.chat.completions.create({
        model,
        messages: this.messages,
        tools: toolsToUse,
        tool_choice: "auto",
        ...(config.openai.maxCompletionTokens && {
          max_completion_tokens: config.openai.maxCompletionTokens
        }),
      });

      console.log('[ChatCompletions] Response received, processing...');

      if ("choices" in completion) {
        const message = completion.choices[0]?.message;

        if (!message) {
          throw new Error("No message received from completion");
        }

        // Check if there are tool calls that need to be executed
        if (message?.tool_calls && message.tool_calls.length > 0) {
          console.log('[ChatCompletions] 🔧 Tool calls detected:', message.tool_calls.length);

          // Process all tool calls
          const toolCallResults = await Promise.all(
            message.tool_calls.map(async (toolCall) => {
              try {
                const result = await this.executeToolCall({
                  id: toolCall.id,
                  name: toolCall.function.name,
                  arguments: toolCall.function.arguments
                });
                return {
                  tool_call_id: toolCall.id,
                  role: "tool" as const,
                  content: result,
                };
              } catch (error) {
                console.error(`[ChatCompletions] ❌ Tool call ${toolCall.function.name} failed:`, error);
                return {
                  tool_call_id: toolCall.id,
                  role: "tool" as const,
                  content: `Error executing tool: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
              }
            })
          );

          // Prepare messages for next completion - include the assistant message with tool calls
          const newMessages: BaseMessage[] = [
            {
              role: "assistant",
              content: message.content,
              toolCalls: message.tool_calls.map(tc => ({
                id: tc.id,
                name: tc.function.name,
                arguments: tc.function.arguments
              }))
            },
            ...toolCallResults.map(r => ({
              role: "tool" as const,
              content: r.content,
              toolCallId: r.tool_call_id
            }))
          ];

          // Recursive call to continue completion after tool calls
          return this.chatCompletion(newMessages, tools, options);
        }

        // Add the assistant's message to conversation history
        this.messages.push(message);
        console.log('[ChatCompletions] ✅ Final message:', message.content?.substring(0, 100) + (message.content && message.content.length > 100 ? '...' : ''));
        this.emit("chatCompletion:complete", message);

        // Check for graceful ending after completion
        if (this._shouldEndAfterStream) {
          console.log("[ChatCompletions] 👋 Ending conversation after final response...");
          this.emit("endInteraction");
          this._shouldEndAfterStream = false;
        }

        return completion;
      } else {
        throw new Error("Invalid completion response format");
      }

    } catch (error) {
      this.emit("chatCompletion:error", error);
      console.error('❌ [OpenAIChatCompletionsService] Chat Completion Error:', error);
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
    console.log('📨 [OpenAIChatCompletionsService] streamChatCompletion called');
    console.log('   Mode: Streaming');
    console.log('   Model:', model);
    console.log('   Incoming messages:', messages.length);
    console.log('   userInterrupted:', this._userInterrupted);
    console.log('   awaitingPostInterruptPrompt:', this._awaitingPostInterruptPrompt);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Handle interruption message
      if (this._userInterrupted && this._interruptionMessage) {
        const interruptMsg = this.convertToChatCompletionsFormat([{
          role: this._interruptionMessage.role as any,
          content: this._interruptionMessage.content as string
        }]);
        this.messages.push(...interruptMsg);
        this._interruptionMessage = undefined;
        this._userInterrupted = false;
      }

      // Convert and add messages
      const chatMessages = this.convertToChatCompletionsFormat(messages);
      this.messages.push(...chatMessages);

      console.log("[ChatCompletions] streamChatCompletion messages:", this.messages.length);

      // Prevent multiple simultaneous completions
      if (this._streamDepth === 0 && this._streamActive) {
        console.warn('[ChatCompletions] ⚠️ Stream already active. Skipping new request.');
        return;
      }
      this._streamActive = true;
      this._streamDepth++;
      console.log(`[ChatCompletions] Stream depth: ${this._streamDepth}`);
      console.log('[ChatCompletions] Total conversation history:', this.messages.length, 'messages');

      // Get tools
      const toolsToUse = tools ? toOpenAIChatCompletions(tools) : toolDefinitions;
      console.log('[ChatCompletions] Tools available:', toolsToUse.length);

      console.log('[ChatCompletions] Starting streaming request to OpenAI Chat Completions API...');
      const stream = await this.openai.chat.completions.create({
        stream: true,
        model,
        messages: this.messages,
        tools: toolsToUse,
        tool_choice: "auto",
        ...(config.openai.maxCompletionTokens && {
          max_completion_tokens: config.openai.maxCompletionTokens
        }),
      }) as Stream<ChatCompletionChunk>;

      const toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
      let llmResponse = "";

      for await (const chunk of stream) {
        if (this._userInterrupted) {
          console.log("[ChatCompletions] Stream interrupted by user.");
          this.emit("streamChatCompletion:interrupted", llmResponse);
          break;
        }

        const content = chunk.choices[0]?.delta?.content || "";
        const deltas = chunk.choices[0].delta;
        const finishReason = chunk.choices[0].finish_reason;

        llmResponse = llmResponse + content;

        if (content) {
          console.log("[ChatCompletions] 📝 Text chunk:", content.substring(0, 50) + (content.length > 50 ? '...' : ''));
        }

        if (finishReason === "stop") {
          console.log('[ChatCompletions] ✅ Stream completed');
          console.log('[ChatCompletions] Final response length:', llmResponse.length, 'chars');
          this.messages.push({ role: "assistant", content: llmResponse });
          this.emit("streamChatCompletion:complete", content);

          // Graceful hang-up after stream
          if (this._shouldEndAfterStream) {
            console.log("[ChatCompletions] 👋 Gracefully ending after final response...");
            this.emit("endInteraction");
            this._shouldEndAfterStream = false;
            return;
          }
        } else {
          this.emit("streamChatCompletion:partial", content);
        }

        if (chunk.choices[0].delta.tool_calls) {
          chunk.choices[0].delta.tool_calls.forEach((toolCall) => {
            if (toolCall.id) {
              console.log('[ChatCompletions] 🔧 Tool call detected:', toolCall.function?.name);
              // New tool call
              toolCalls.push({
                id: toolCall.id,
                type: "function",
                function: {
                  name: toolCall.function?.name || "",
                  arguments: toolCall.function?.arguments || "",
                },
              });
            } else if (toolCalls.length > 0) {
              // Continuing arguments of the last tool call
              const lastToolCall = toolCalls[toolCalls.length - 1];
              lastToolCall.function.arguments += toolCall.function?.arguments || "";
            }
          });
        }

        // Check for stream end or tool call requirement
        if (chunk.choices[0].finish_reason === "tool_calls") {
          console.log('[ChatCompletions] Processing', toolCalls.length, 'tool call(s)...');

          // Process tool calls
          const toolCallResults = await Promise.all(
            toolCalls.map(async (toolCall) => {
              try {
                const result = await this.executeToolCall({
                  id: toolCall.id,
                  name: toolCall.function.name,
                  arguments: toolCall.function.arguments
                });
                return {
                  tool_call_id: toolCall.id,
                  role: "tool" as const,
                  content: result,
                };
              } catch (error) {
                console.error(`[ChatCompletions] ❌ Tool call ${toolCall.function.name} failed:`, error);
                return {
                  tool_call_id: toolCall.id,
                  role: "tool" as const,
                  content: `Error executing tool: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
              }
            })
          );

          // Prepare messages for next completion
          const newMessages: BaseMessage[] = [
            ...toolCalls.map((toolCall) => ({
              role: "assistant" as const,
              content: null,
              toolCalls: [{ id: toolCall.id, name: toolCall.function.name, arguments: toolCall.function.arguments }]
            })),
            ...toolCallResults.map(r => ({
              role: "tool" as const,
              content: r.content,
              toolCallId: r.tool_call_id
            }))
          ];

          // Recursive call to continue completion after tool calls
          return this.streamChatCompletion(newMessages, tools, options);
        }
      }

    } catch (error) {
      console.error('❌ [OpenAIChatCompletionsService] Stream Chat Completion Error:', error);
      throw error;
    } finally {
      this._streamDepth--;
      console.log(`[ChatCompletions] Stream exited — depth: ${this._streamDepth}`);

      if (this._streamDepth <= 0) {
        this._streamDepth = 0;
        this._streamActive = false;
        this._userInterrupted = false;
      }
    }
  }

  async executeToolCall(toolCall: ToolCall): Promise<string> {
    console.log('[ChatCompletions] 🔧 Executing tool:', toolCall.name);
    console.log('[ChatCompletions]    Arguments:', toolCall.arguments.substring(0, 100) + (toolCall.arguments.length > 100 ? '...' : ''));

    try {
      const { name, arguments: args } = toolCall;

      if (name === "human_agent_handoff") {
        console.log('[ChatCompletions] 🤝 Human agent handoff requested');
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
        console.error('[ChatCompletions] ❌ Tool not found:', name);
        throw new Error(`Tool ${name} not implemented`);
      }

      const result = await toolFunction(JSON.parse(args));
      console.log('[ChatCompletions] ✅ Tool executed successfully:', name);
      console.log('[ChatCompletions]    Result preview:', result.substring(0, 100) + (result.length > 100 ? '...' : ''));

      if (name === "switch_language") {
        console.log('[ChatCompletions] 🌐 Language switch requested');
        this.emit("switchLanguage", JSON.parse(args));
      } else if (name === "add_survey_response") {
        console.log('[ChatCompletions] 📊 Survey response added, will end after stream');
        this._shouldEndAfterStream = true;
      }

      return result;
    } catch (error) {
      this.emit("toolCall:error", error as Error);
      console.error('[ChatCompletions] ❌ Tool Call Error:', error);
      throw error;
    }
  }

  /**
   * Convert base messages to Chat Completions format
   */
  private convertToChatCompletionsFormat(messages: BaseMessage[]): ChatCompletionMessageParam[] {
    return messages.map(msg => {
      if (msg.role === 'tool' && msg.toolCallId) {
        return {
          role: "tool" as const,
          tool_call_id: msg.toolCallId,
          content: msg.content || ""
        };
      }

      if (msg.role === 'assistant' && msg.toolCalls) {
        return {
          role: "assistant" as const,
          content: msg.content,
          tool_calls: msg.toolCalls.map(tc => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: tc.arguments
            }
          }))
        };
      }

      return {
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content || ""
      };
    });
  }
}

export default OpenAIChatCompletionsService;
