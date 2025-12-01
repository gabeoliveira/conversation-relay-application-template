import OpenAI from "openai";
import { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import { ChatCompletionMessageParam } from "openai/resources/chat";
import { Stream } from "openai/streaming";
import { ChatCompletionChunk } from "openai/resources/chat/completions";

// import { Stream } from "openai/streaming";
// import {
//   ChatCompletionChunk,
//   ChatCompletionMessage,
// } from "openai/resources/chat/completions";
import { systemPrompt } from "../../prompts/systemPrompt";
import { getAdditionalContext } from "../../prompts/additionalContext";
import { config } from "../../config";
import { EventEmitter } from "events";
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
} from "./tools";

export class LLMService extends EventEmitter {
  private openai: OpenAI;
  private messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  private _interruptionMessage?: ChatCompletionMessageParam;
  private _userInterrupted: boolean | undefined;
  private _streamActive: boolean | undefined;
  private _streamDepth = 0;
  private _awaitingPostInterruptPrompt = false;
  private _shouldEndAfterStream: boolean = false;


  public get userInterrupted(): boolean | undefined {
    return this._userInterrupted;
  }

  public set userInterrupted(value: boolean | undefined) {
    this._userInterrupted = value;
  }

  public get streamActive() {
    return this._streamActive;
  }

  public get awaitingPostInterruptPrompt(): boolean {
    return this._awaitingPostInterruptPrompt;
  }
  
  public set awaitingPostInterruptPrompt(value: boolean) {
    this._awaitingPostInterruptPrompt = value;
  }
  

  constructor(apiKey?: string) {
    super();
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.messages =
      new Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>({
        role: "system",
        content: systemPrompt
      },
      {
        role: "system",
        content: getAdditionalContext()   
      },
      {
        role: "assistant",
        content: config.twilio.welcomeGreeting
        
      });
  }

  async chatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools?: LLMToolDefinition[],
    options?: Partial<ChatCompletionCreateParams>
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    try {
      // Add incoming messages to the conversation history
      this.messages.push(...messages);

      console.log("chatCompletion messages:", this.messages);

      // Prepare the completion request
      const completion = await this.openai.chat.completions.create({
        model: options?.model || "gpt-4-turbo-preview",
        messages: this.messages,
        tools: tools || toolDefinitions,
        tool_choice: tools ? "auto" : undefined,
        ...options,
      });

      if ("choices" in completion) {
        const message = completion.choices[0]?.message;

        if (!message) {
          throw new Error("No message received from completion");
        }

        // Check if there are tool calls that need to be executed
        if (message?.tool_calls && message.tool_calls.length > 0) {
          // Process all tool calls
          const toolCallResults = await Promise.all(
            message.tool_calls.map(async (toolCall) => {
              try {
                const result = await this.executeToolCall(toolCall);
                return {
                  tool_call_id: toolCall.id,
                  role: "tool" as const,
                  content: result,
                };
              } catch (error) {
                console.error(
                  `Tool call ${toolCall.function.name} failed:`,
                  error
                );
                return {
                  tool_call_id: toolCall.id,
                  role: "tool" as const,
                  content: `Error executing tool: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`,
                };
              }
            })
          );

          // Prepare messages for next completion - include the assistant message with tool calls
          const newMessages: ChatCompletionMessageParam[] = [
            {
              role: "assistant",
              tool_calls: message.tool_calls,
              content: message.content,
            },
            ...toolCallResults,
          ];

          // Recursive call to continue completion after tool calls
          return this.chatCompletion(newMessages, tools, options);
        }

        // Add the assistant's message to conversation history
        this.messages.push(message);
        console.log("final message:", message);
        this.emit("chatCompletion:complete", message);

        // Check for graceful ending after completion
        if (this._shouldEndAfterStream) {
          console.log("Ending conversation after final response...");
          this.emit("endInteraction");
          this._shouldEndAfterStream = false;
        }

        return completion;
      } else {
        throw new Error("Invalid completion response format");
      }

    } catch (error) {
      this.emit("chatCompletion:error", error);
      console.error("LLM Chat Completion Error:", error);
      throw error;
    }
  }

  async streamChatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools?: LLMToolDefinition[],
    options?: Partial<ChatCompletionCreateParams>
  ): Promise<void> {
    console.log("userInterrupted?", this._userInterrupted);
    console.log("awaitingPostInterruptPrompt?", this.awaitingPostInterruptPrompt);
    console.log("messages to stream:", messages);

    try {
      if (this._userInterrupted && this._interruptionMessage) {
        messages.push(this._interruptionMessage); // or push, depending on style
        this._interruptionMessage = undefined;
        this._userInterrupted = false;
      }

      this.messages.push(...messages);

      console.log("streamChatCompletion", this.messages);
      // Prevent multiple simultaneous completions
      if (this._streamDepth === 0 && this._streamActive) {
        console.warn("Stream already active. Skipping new request.");
        return;
      }
      this._streamActive = true;
      this._streamDepth++;
      console.log(`streamChatCompletion entered — depth: ${this._streamDepth}`);

      const stream = await this.openai.chat.completions.create({
        stream: true,
        model: options?.model || "gpt-4.1",
        messages: this.messages,
        tools: toolDefinitions, // functions as any,
        tool_choice: tools ? "auto" : undefined,
        ...options,
      }) as Stream<ChatCompletionChunk>;

      const toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] =
        [];

      let llmResponse = "";
      for await (const chunk of stream) {
        if (this._userInterrupted) {
          console.log("Stream interrupted by user.");
          this.emit("streamChatCompletion:interrupted", llmResponse);
          break;
        }

        let content = chunk.choices[0]?.delta?.content || "";
        let deltas = chunk.choices[0].delta;
        let finishReason = chunk.choices[0].finish_reason;

        llmResponse = llmResponse + content;

        console.log("chunk", content, finishReason, deltas);

        if (finishReason === "stop") {
          this.messages.push({ role: "assistant", content: llmResponse });
          this.emit("streamChatCompletion:complete", content);

          // Graceful hang-up after stream
          if (this._shouldEndAfterStream) {
            console.log("Gracefully ending after final response...");
            this.emit("endInteraction");
            this._shouldEndAfterStream = false; // reset flag

            return;
          }
        } else {
          this.emit("streamChatCompletion:partial", content);
        }

        if (chunk.choices[0].delta.tool_calls) {
          chunk.choices[0].delta.tool_calls.forEach((toolCall) => {
            if (toolCall.id) {
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
              lastToolCall.function.arguments +=
                toolCall.function?.arguments || "";
            }
          });
        }

        // Check for stream end or tool call requirement
        if (chunk.choices[0].finish_reason === "tool_calls") {
          // Process tool calls
          const toolCallResults = await Promise.all(
            toolCalls.map(async (toolCall) => {
              try {
                const result = await this.executeToolCall(toolCall);
                return {
                  tool_call_id: toolCall.id,
                  role: "tool" as const,
                  content: result,
                };
              } catch (error) {
                console.error(
                  `Tool call ${toolCall.function.name} failed:`,
                  error
                );
                return {
                  tool_call_id: toolCall.id,
                  role: "tool" as const,
                  content: `Error executing tool: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`,
                };
              }
            })
          );

          // Prepare messages for next completion
          const newMessages = [
            // ...messages,
            ...toolCalls.map((toolCall, index) => ({
              role: "assistant" as const,
              tool_calls: [toolCall],
            })),
            ...toolCallResults,
          ];

          // Recursive call to continue completion after tool calls
          return this.streamChatCompletion(newMessages, tools, options);
        }
      }


    } catch (error) {
      console.error("LLM Stream Chat Completion Error:", error);
      throw error;
    }
    finally {
      this._streamDepth--;
      console.log(`streamChatCompletion exited — depth: ${this._streamDepth}`);
    
      // ✅ Only reset flags at the outermost layer
      if (this._streamDepth <= 0) {
        this._streamDepth = 0;
        this._streamActive = false;
        this._userInterrupted = false;
      }
    }
  }

  public addInterruptionMessage(message: ChatCompletionMessageParam) {
    this._interruptionMessage = message;
  }

  async setup(message: any) {
   // Handle setup message
   console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
   console.log('🤖 [LLMService] Processing setup message');
   console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

   // Extract customerPhone from different message structures (voice uses .from, conversations use .customerPhone)
   const rawPhone = message.from || message.customerPhone;
   // Remove 'whatsapp:' prefix if present
   const cleanPhone = rawPhone?.replace(/^whatsapp:/, '');

   console.log('📱 Customer Phone:', cleanPhone || 'N/A');

   // Build user context with phone and any custom parameters
   const userContext: Record<string, any> = {
     customerPhone: cleanPhone
   };

   // Include custom parameters if they exist
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

  async executeToolCall(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
  ): Promise<string> {
    try {
      const {
        function: { name, arguments: args },
      } = toolCall;

       if (name === "human_agent_handoff") {
        this.emit("humanAgentHandoff", JSON.parse(args));
        return "Handoff request initiated. Connecting you to a human agent.";
      }


      // update the toolFunction to use the toolDefinitions
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
        throw new Error(`Tool ${name} not implemented`);
      }

      const result = await toolFunction(JSON.parse(args));

      if (name === "switch_language") {
        this.emit("switchLanguage", JSON.parse(args));
      } else if (name === "add_survey_response") {
        this._shouldEndAfterStream = true;
      }      

      return result;
    } catch (error) {
      this.emit("toolCall:error", error);
      console.error("Tool Call Error:", error);
      throw error;
    }
  }
}

export default LLMService;
