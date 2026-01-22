import { z } from "zod";
import mockData from "../../../data/mock-data";

// Zod schema - single source of truth
export const checkIncreaseLimitSchema = z.object({
  userId: z.string().describe("The user ID from verify_user_identity")
});

// TypeScript type derived from Zod
export type CheckIncreaseLimitParams = z.infer<typeof checkIncreaseLimitSchema>;

export async function checkIncreaseLimit(params: CheckIncreaseLimitParams): Promise<string> {
  console.log('Check Increase Limit', params);

  const user = mockData.users.find((user) => user.userId === params.userId);

  if (user?.bankAccount) {
    return JSON.stringify({ userId: params.userId, bankAccount: user.bankAccount });
  } else {
    return "No Bank account found.";
  }
}
