import { z } from "zod";
import mockData from "../../../data/mock-data";

// Zod schema - single source of truth
export const checkPendingBillSchema = z.object({
  userId: z.string().describe("The user ID from verify_user_identity")
});

// TypeScript type derived from Zod
export type CheckPendingBillParams = z.infer<typeof checkPendingBillSchema>;

export async function checkPendingBill(
  params: CheckPendingBillParams
): Promise<string> {
  const bill = mockData.bills.find((bill) => bill.userId === params.userId);

  if (!bill) {
    return "No pending bill found.";
  }

  return JSON.stringify({ userId: params.userId, bill });
}
