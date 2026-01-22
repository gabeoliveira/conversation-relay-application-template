import { z } from "zod";

// Zod schema - single source of truth
export const humanAgentHandoffSchema = z.object({
  reason: z.string().describe("The reason for the handoff"),
  context: z.string().optional().describe("Any relevant conversation context")
});

// TypeScript type derived from Zod
export type HumanAgentHandoffParams = z.infer<typeof humanAgentHandoffSchema>;

export async function humanAgentHandoff(params: HumanAgentHandoffParams): Promise<string> {
  return `The call has been handed off to a human agent. Reason: ${params.reason}. Context: ${params.context || 'N/A'}`;
}