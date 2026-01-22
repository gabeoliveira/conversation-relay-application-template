import { z } from "zod";
import mockData from "../../../data/mock-data";

// Zod schema - single source of truth
export const checkHsaAccountSchema = z.object({
  userId: z.string().describe("The user ID from verify_user_identity")
});

// TypeScript type derived from Zod
export type CheckHsaAccountParams = z.infer<typeof checkHsaAccountSchema>;

export async function checkHsaAccount(params: CheckHsaAccountParams): Promise<string> {
  console.log('Check HSA Account Params', params);

  const user = mockData.users.find((user) => user.userId === params.userId);

  if (user?.hsaAccount) {
    return JSON.stringify({ userId: params.userId, hsaAccount: user.hsaAccount });
  } else {
    return "No HSA account found.";
  }
}
