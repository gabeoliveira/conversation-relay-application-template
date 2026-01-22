import { z } from "zod";
import { google } from "googleapis";
import { JWT } from "google-auth-library";

import { config } from "../../../config";

// Zod schema - single source of truth
export const addSurveyResponseSchema = z.object({
  customerPhone: z.string().describe("Customer's phone number"),
  inGeneral: z.string().describe("General satisfaction (1-5 as string)"),
  lastService: z.string().describe("Last service satisfaction (1-5 as string)"),
  lastDriver: z.string().describe("Last driver satisfaction (1-5 as string)"),
  observations: z.string().optional().describe("Customer's comments")
});

// TypeScript type derived from Zod
export type AddSurveyResponseParams = z.infer<typeof addSurveyResponseSchema>;

export async function addSurveyResponse(params: AddSurveyResponseParams): Promise<string> {
  console.log("Adding Survey Response", params);

  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  : require("../../../keys/googleapis-service-account.json");

  // Auth setup
  const auth = new google.auth.GoogleAuth({
    credentials, 
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authClient = (await auth.getClient()) as JWT;

  const sheets = google.sheets({ version: "v4", auth: authClient });

  const spreadsheetId = config.google.spreadsheetId;
  const range = "Surveys!A1:E1"; // We'll append after the header row

  // Append the new row
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          params.customerPhone,
          params.inGeneral,
          params.lastService,
          params.lastDriver,
          params.observations || ""
        ]
      ]
    },
  });

  return "Survey response recorded successfully.";
}
