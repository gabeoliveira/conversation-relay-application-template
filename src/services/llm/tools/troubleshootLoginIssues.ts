import { z } from "zod";
import mockData from "../../../data/mock-data";

// Zod schema - single source of truth
export const troubleshootLoginIssuesSchema = z.object({
  userId: z.string().describe("The user ID from verify_user_identity")
});

// TypeScript type derived from Zod
export type TroubleshootLoginIssuesParams = z.infer<typeof troubleshootLoginIssuesSchema>;

export async function troubleshootLoginIssues(params: TroubleshootLoginIssuesParams): Promise<string> {
  console.log('Troubleshooting login issues', params);

  const user = mockData.users.find((user) => user.userId === params.userId);

  if (user?.login) {
    return JSON.stringify({ userId: params.userId, login: user.login });
  } else {
    return "No login data found.";
  }
}
