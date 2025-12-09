import { BaseLLMService, LLMProvider, LLMServiceConfig } from "./types";
import { OpenAIChatCompletionsService } from "./providers/openai-chat-completions";
import { OpenAIResponsesService } from "./providers/openai-responses";
import { config } from "../../config";

/**
 * Factory function to create the appropriate LLM service based on configuration
 *
 * @param serviceConfig - Optional configuration to override defaults
 * @returns An instance of BaseLLMService
 *
 * @example
 * // Use default provider from environment
 * const llm = createLLMService();
 *
 * @example
 * // Explicitly specify provider
 * const llm = createLLMService({ provider: 'openai-responses' });
 *
 * @example
 * // With custom API key
 * const llm = createLLMService({
 *   provider: 'openai-chat-completions',
 *   apiKey: 'sk-...'
 * });
 */
export function createLLMService(serviceConfig?: Partial<LLMServiceConfig>): BaseLLMService {
  // Get provider from config or default to chat-completions for backwards compatibility
  const configuredProvider = config.llm?.provider;
  const requestedProvider = serviceConfig?.provider;

  const provider: LLMProvider = requestedProvider ||
    (configuredProvider as LLMProvider) ||
    'openai-chat-completions';

  const apiKey = serviceConfig?.apiKey || config.openai.apiKey;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🏭 [LLM Factory] Creating LLM Service`);
  console.log(`   Configured (env): ${configuredProvider || '(not set)'}`);
  console.log(`   Requested (arg):  ${requestedProvider || '(not set)'}`);
  console.log(`   ➡️  Selected:      ${provider}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  switch (provider) {
    case 'openai-responses':
      console.log('[LLM Factory] Instantiating OpenAIResponsesService...');
      return new OpenAIResponsesService(apiKey);

    case 'openai-chat-completions':
    default:
      console.log('[LLM Factory] Instantiating OpenAIChatCompletionsService...');
      return new OpenAIChatCompletionsService(apiKey);
  }
}

/**
 * Get the list of available LLM providers
 */
export function getAvailableProviders(): LLMProvider[] {
  return ['openai-chat-completions', 'openai-responses'];
}

/**
 * Check if a provider is valid
 */
export function isValidProvider(provider: string): provider is LLMProvider {
  return getAvailableProviders().includes(provider as LLMProvider);
}

export default createLLMService;
