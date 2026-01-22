import { z } from "zod";
import { config } from "../../../config";

// Zod schema - single source of truth
export const switchLanguageSchema = z.object({
  targetLanguage: z.enum(["portuguese", "english", "spanish"])
    .describe("The target language to switch to")
});

// TypeScript type derived from Zod
export type SwitchLanguageParams = z.infer<typeof switchLanguageSchema>;

export async function switchLanguage(params: SwitchLanguageParams): Promise<string> {
  console.log('Switch Language', params);

  if (params.targetLanguage in config.languages) {
    return `Language switched to ${params.targetLanguage}`;
  }
  else {
    return "Language not supported";
  }
}