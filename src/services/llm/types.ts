import { EventEmitter } from "events";

/**
 * Base tool definition format (provider-agnostic)
 * This is the canonical format used internally, converted to provider-specific formats as needed
 */
export interface BaseTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * OpenAI Chat Completions API tool format
 */
export interface ChatCompletionsTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * OpenAI Responses API tool format
 */
export interface ResponsesApiTool {
  type: 'function';
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
  strict: boolean;
}

/**
 * Union type for all supported tool formats
 */
export type ProviderTool = ChatCompletionsTool | ResponsesApiTool;

/**
 * Tool call from LLM response
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Message roles supported across providers
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Base message format (provider-agnostic)
 */
export interface BaseMessage {
  role: MessageRole;
  content: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

/**
 * Completion options shared across providers
 */
export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

/**
 * LLM Provider types
 */
export type LLMProvider = 'openai-chat-completions' | 'openai-responses' | 'openai-agents';

/**
 * Events emitted by LLM services
 */
export interface LLMServiceEvents {
  'humanAgentHandoff': (args: { reason: string; context?: string }) => void;
  'switchLanguage': (args: { targetLanguage: string }) => void;
  'endInteraction': () => void;
  'streamChatCompletion:partial': (content: string) => void;
  'streamChatCompletion:complete': (content: string) => void;
  'streamChatCompletion:interrupted': (partialResponse: string) => void;
  'chatCompletion:complete': (message: any) => void;
  'chatCompletion:error': (error: Error) => void;
  'toolCall:error': (error: Error) => void;
}

/**
 * Abstract base class for LLM services
 * All provider implementations should extend this class
 */
export abstract class BaseLLMService extends EventEmitter {
  protected _userInterrupted: boolean = false;
  protected _streamActive: boolean = false;
  protected _streamDepth: number = 0;
  protected _awaitingPostInterruptPrompt: boolean = false;
  protected _shouldEndAfterStream: boolean = false;

  public get userInterrupted(): boolean {
    return this._userInterrupted;
  }

  public set userInterrupted(value: boolean) {
    this._userInterrupted = value;
  }

  public get streamActive(): boolean {
    return this._streamActive;
  }

  public get awaitingPostInterruptPrompt(): boolean {
    return this._awaitingPostInterruptPrompt;
  }

  public set awaitingPostInterruptPrompt(value: boolean) {
    this._awaitingPostInterruptPrompt = value;
  }

  /**
   * Add an interruption message to be processed
   */
  abstract addInterruptionMessage(message: BaseMessage): void;

  /**
   * Setup the LLM service with initial context
   */
  abstract setup(message: any): Promise<void>;

  /**
   * Non-streaming chat completion
   */
  abstract chatCompletion(
    messages: BaseMessage[],
    tools?: BaseTool[],
    options?: CompletionOptions
  ): Promise<any>;

  /**
   * Streaming chat completion
   */
  abstract streamChatCompletion(
    messages: BaseMessage[],
    tools?: BaseTool[],
    options?: CompletionOptions
  ): Promise<void>;

  /**
   * Execute a tool call
   */
  abstract executeToolCall(toolCall: ToolCall): Promise<string>;
}

/**
 * Configuration for creating an LLM service
 */
export interface LLMServiceConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
  maxCompletionTokens?: number;
}
