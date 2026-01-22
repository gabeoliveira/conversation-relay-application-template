import { z } from "zod";
import mockData from "../../../data/mock-data";

// Zod schema - single source of truth
export const searchCommonMedicalTermsSchema = z.object({
  inquiry: z.enum(["DEDUCTIBLE", "COPAY", "HSA", "OUT_OF_POCKET_MAX"])
    .describe("The medical term to search for")
});

// TypeScript type derived from Zod
export type SearchCommonMedicalTermsParams = z.infer<typeof searchCommonMedicalTermsSchema>;

export async function searchCommonMedicalTerms(
  params: SearchCommonMedicalTermsParams
): Promise<string> {
  const normalizedInquiry = params.inquiry.toUpperCase();

  const inquiryKeyMap: {
    [key: string]: keyof typeof mockData.common_terms;
  } = {
    DEDUCTIBLE: "deductible",
    COPAY: "copay",
    HSA: "hsa",
    OUT_OF_POCKET_MAX: "out_of_pocket_max",
  };

  const term = mockData.common_terms[inquiryKeyMap[normalizedInquiry]];

  return (
    term ||
    "No information found. Please let the caller know that you could not find the information they were looking for."
  );
}
