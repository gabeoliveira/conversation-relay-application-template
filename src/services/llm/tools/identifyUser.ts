import { z } from "zod";
import { config } from "../../../config";

import { google } from "googleapis";
import { JWT } from "google-auth-library";

// Zod schema - single source of truth
export const identifyUserSchema = z.object({
  customerPhone: z.string().describe("Customer's phone number in MSISDN format")
});

// TypeScript type derived from Zod
export type IdentifyUserParams = z.infer<typeof identifyUserSchema>;

export async function identifyUser(params: IdentifyUserParams): Promise<string> {
  console.log("Identifying User", params);

  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  : require("../../../keys/googleapis-service-account.json");

  // Auth with Google Sheets API using a service account
  const auth = new google.auth.GoogleAuth({
    credentials, 
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const authClient = (await auth.getClient()) as JWT;

  const sheets = google.sheets({ version: "v4", auth: authClient });

  const spreadsheetId = config.google.spreadsheetId;
  const range = "Users!A1:Z1000"; // adjust the range if needed

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return "No data found.";
  }

  const headers = rows[0];
  const customerPhoneIndex = headers.indexOf("customerPhone");

  if (customerPhoneIndex === -1) {
    return "customerPhone column not found.";
  }

  const matchedRow = rows.find((row, index) =>
    index > 0 && row[customerPhoneIndex] === params.customerPhone
  );

  if (matchedRow) {
    console.log(matchedRow);
    const customerName = matchedRow[headers.indexOf("customerName")];
    const preferredCity = matchedRow[headers.indexOf("preferredCity")];
    const licensePlate = matchedRow[headers.indexOf("licensePlate")];


    if (customerName) {
      return JSON.stringify({ customerName, preferredCity, licensePlate });
    } else {
      return "Unregistered user.";
    }
  } else {
    return "User not found.";
  }
}
