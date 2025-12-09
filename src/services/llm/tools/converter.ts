import {
  BaseTool,
  ChatCompletionsTool,
  ResponsesApiTool
} from '../types';
import { toolDefinitions, LLMToolDefinition } from './toolDefinitions';

/**
 * Convert base tool definitions to OpenAI Chat Completions API format
 */
export function toOpenAIChatCompletions(tools: BaseTool[]): ChatCompletionsTool[] {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

/**
 * Convert base tool definitions to OpenAI Responses API format
 *
 * By default, strict mode is disabled to preserve optional parameters behavior.
 * When strict=true, OpenAI requires:
 * - additionalProperties: false
 * - ALL properties must be in the 'required' array
 */
export function toOpenAIResponses(tools: BaseTool[], strict: boolean = false): ResponsesApiTool[] {
  return tools.map(tool => {
    if (strict) {
      // Strict mode: ALL properties must be required
      const allPropertyKeys = Object.keys(tool.parameters.properties || {});
      return {
        type: 'function' as const,
        name: tool.name,
        description: tool.description,
        parameters: {
          ...tool.parameters,
          required: allPropertyKeys,
          additionalProperties: false
        } as Record<string, unknown>,
        strict: true
      };
    }

    // Non-strict mode: preserve original required array
    return {
      type: 'function' as const,
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as Record<string, unknown>,
      strict: false
    };
  });
}

/**
 * Convert OpenAI Chat Completions format to base format
 */
export function fromOpenAIChatCompletions(tools: ChatCompletionsTool[] | LLMToolDefinition[]): BaseTool[] {
  return tools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description || '',
    parameters: tool.function.parameters
  }));
}

/**
 * Convert OpenAI Responses API format to base format
 */
export function fromOpenAIResponses(tools: ResponsesApiTool[]): BaseTool[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description || '',
    parameters: tool.parameters as BaseTool['parameters']
  }));
}

/**
 * Base tool definitions - derived from toolDefinitions.ts (single source of truth)
 * These are the canonical tool definitions used across all providers
 */
export const baseToolDefinitions: BaseTool[] = fromOpenAIChatCompletions(toolDefinitions);

// Pre-converted tool definitions for each provider format
export const chatCompletionsTools = toOpenAIChatCompletions(baseToolDefinitions);
export const responsesApiTools = toOpenAIResponses(baseToolDefinitions);
