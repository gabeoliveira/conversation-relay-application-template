import { z } from "zod";
import mockData from "../../../data/mock-data";

// Zod schema - single source of truth
export const checkCardDeliverySchema = z.object({
  userId: z.string().describe("The user ID from verify_user_identity")
});

// TypeScript type derived from Zod
export type CheckCardDeliveryParams = z.infer<typeof checkCardDeliverySchema>;

export async function checkCardDelivery(params: CheckCardDeliveryParams): Promise<string> {
  console.log('Checking Card Delivery Status', params);

  const user = mockData.users.find((user) => user.userId === params.userId);

  if (user?.bankAccount?.cardDelivery) {
    return JSON.stringify({ userId: params.userId, cardDelivery: user.bankAccount.cardDelivery });
  } else {
    return "No card delivery data found.";
  }
}
