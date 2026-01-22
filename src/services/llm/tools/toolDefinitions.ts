import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

// Import all Zod schemas from individual tool files
import { switchLanguageSchema } from "./switchLanguage";
import { checkPendingBillSchema } from "./checkPendingBill";
import { searchCommonMedicalTermsSchema } from "./searchCommonMedicalTerms";
import { checkHsaAccountSchema } from "./checkHsaAccount";
import { checkIncreaseLimitSchema } from "./checkIncreaseLimit";
import { troubleshootLoginIssuesSchema } from "./troubleshootLoginIssues";
import { checkCardDeliverySchema } from "./checkCardDelivery";
import { humanAgentHandoffSchema } from "./humanAgentHandoff";
import { identifyUserSchema } from "./identifyUser";
import { addSurveyResponseSchema } from "./addSurveyResponse";
import { bookDriverSchema } from "./bookDriver";

// Re-export all schemas for convenience
export {
  switchLanguageSchema,
  checkPendingBillSchema,
  searchCommonMedicalTermsSchema,
  checkHsaAccountSchema,
  checkIncreaseLimitSchema,
  troubleshootLoginIssuesSchema,
  checkCardDeliverySchema,
  humanAgentHandoffSchema,
  identifyUserSchema,
  addSurveyResponseSchema,
  bookDriverSchema,
};

export interface LLMToolDefinition {
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
 * Helper function to convert a Zod schema to OpenAI function parameters format
 */
function zodToOpenAIParams(schema: z.ZodTypeAny): LLMToolDefinition['function']['parameters'] {
  // @ts-expect-error - zodToJsonSchema has deep type inference that causes TS2589
  const jsonSchema: Record<string, unknown> = zodToJsonSchema(schema, { target: "openAi" });

  return {
    type: 'object',
    properties: (jsonSchema.properties as Record<string, unknown>) || {},
    required: (jsonSchema.required as string[]) || [],
  };
}

/**
 * Tool definitions for OpenAI Chat Completions and Responses API
 * Auto-generated from Zod schemas - single source of truth
 *
 * @see https://platform.openai.com/docs/guides/function-calling
 */
export const toolDefinitions: LLMToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'switch_language',
      description: 'Switch the language of the conversation',
      parameters: zodToOpenAIParams(switchLanguageSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_pending_bill',
      description: 'Check if the user has a pending medical bill',
      parameters: zodToOpenAIParams(checkPendingBillSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_common_medical_terms',
      description: 'Check knowledge base for medical terms',
      parameters: zodToOpenAIParams(searchCommonMedicalTermsSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_hsa_account',
      description: "Check the balance of a user's Health Savings Account (HSA)",
      parameters: zodToOpenAIParams(checkHsaAccountSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_increase_limit',
      description: 'Checks whether the user is eligible for a credit or account limit increase',
      parameters: zodToOpenAIParams(checkIncreaseLimitSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'troubleshoot_login_issues',
      description: 'Assists the user in resolving common login issues',
      parameters: zodToOpenAIParams(troubleshootLoginIssuesSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_card_delivery',
      description: 'Checks the status of a card delivery for the user',
      parameters: zodToOpenAIParams(checkCardDeliverySchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'human_agent_handoff',
      description: 'Transfers the customer to a live agent in case they request help from a real person.',
      parameters: zodToOpenAIParams(humanAgentHandoffSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'identify_user',
      description: 'Identify the user based on the incoming phone number. Everytime the user needs to perform ANY action, you should start with this one',
      parameters: zodToOpenAIParams(identifyUserSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_survey_response',
      description: "Add a Customer Satisfaction Survey Response. This should be called everytime the user says there's nothing else you can help with",
      parameters: zodToOpenAIParams(addSurveyResponseSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_driver',
      description: 'Books a driver using Conductor Eligido or Motorista da Rodada services with specified details.',
      parameters: zodToOpenAIParams(bookDriverSchema),
    },
  },
];
