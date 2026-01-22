import { z } from "zod";
import { google } from "googleapis";
import { JWT } from "google-auth-library";

import { config } from "../../../config";

// Zod schema - single source of truth
export const bookDriverSchema = z.object({
  date: z.string().describe("Date of the booking in YYYY-MM-DD format"),
  time: z.string().describe("Time of the booking in HH:mm format (24h)"),
  duration: z.number().describe("Duration of the booking in minutes"),
  summary: z.string().describe("Customer name as summary of the booking"),
  description: z.string().optional().describe("Optional description for the booking"),
  timezone: z.string().optional().describe("Timezone (default: America/Bogota)")
});

// TypeScript type derived from Zod
export type BookDriverParams = z.infer<typeof bookDriverSchema>;

export async function bookDriver(params: BookDriverParams): Promise<string> {
  console.log("Booking slot with params:", params);

  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  : require("../../../keys/googleapis-service-account.json");
    
  if (!credentials) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY");

  const { calendarId } = config.google;
  if (!calendarId) throw new Error("Missing GOOGLE_CALENDAR_ID");

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const authClient = (await auth.getClient()) as JWT;
  const calendar = google.calendar({ version: "v3", auth: authClient });

  const timezone = params.timezone || "America/Bogota";

  const startString = `${params.date}T${params.time}:00`;

    
  console.log("Start string:", startString); // helpful debug

  const start = new Date(startString);
  
  if (isNaN(start.getTime())) {
    throw new Error(`Invalid start time value: ${startString}`);
  }

  const end = new Date(start.getTime() + params.duration * 60000);

  // Check availability
  const freebusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      timeZone: timezone,
      items: [{ id: calendarId }],
    },
  });

  const busySlots = freebusy.data.calendars?.[calendarId]?.busy ?? [];
  if (busySlots.length > 0) {
    return "The selected time slot is not available.";
  }

  // Book the event
  await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: start.toISOString(), timeZone: timezone },
      end: { dateTime: end.toISOString(), timeZone: timezone },
    },
  });

  return "Slot booked successfully.";
}
