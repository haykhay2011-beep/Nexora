import { google } from 'googleapis';
import { getAuthenticatedGoogleClient } from '../services/googleClient';

export async function listTodayEvents(userId: string) {
  try {
    const auth = await getAuthenticatedGoogleClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (res.data.items ?? []).map((e) => ({
      id: e.id,
      summary: e.summary,
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      location: e.location,
      attendees: e.attendees?.map((a) => a.email),
    }));

    return JSON.stringify({ events });
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? 'Failed to list today\'s events.' });
  }
}

export async function createCalendarEvent(
  userId: string,
  args: { summary: string; startIso: string; endIso: string; description?: string; attendees?: string[] }
) {
  try {
    const auth = await getAuthenticatedGoogleClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: args.summary,
        description: args.description,
        start: { dateTime: args.startIso },
        end: { dateTime: args.endIso },
        attendees: args.attendees?.map((email) => ({ email })),
      },
    });

    return JSON.stringify({ id: res.data.id, htmlLink: res.data.htmlLink, summary: res.data.summary });
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? 'Failed to create the calendar event.' });
  }
}
