import { Router } from 'express';
import { google } from 'googleapis';
import { requireAuth } from '../middleware/auth';
import { listTodayEvents } from '../tools/calendarTools';
import { listTasks } from '../tools/taskTools';
import { getAuthenticatedGoogleClient } from '../services/googleClient';
import { getIntegration } from '../services/integrationsStore';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

async function getUnreadEmailCount(userId: string): Promise<number | null> {
  const google_ = await getIntegration(userId, 'google');
  if (!google_?.refresh_token) return null;

  try {
    const auth = await getAuthenticatedGoogleClient(userId);
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.messages.list({ userId: 'me', labelIds: ['INBOX', 'UNREAD'], maxResults: 1 });
    return res.data.resultSizeEstimate ?? 0;
  } catch {
    return null;
  }
}

dashboardRouter.get('/today', async (req, res) => {
  const userId = req.userId!;

  const [eventsRaw, tasksRaw, unreadCount] = await Promise.all([
    listTodayEvents(userId),
    listTasks(userId),
    getUnreadEmailCount(userId),
  ]);

  const eventsParsed = JSON.parse(eventsRaw);
  const tasksParsed = JSON.parse(tasksRaw);

  res.json({
    events: eventsParsed.error ? [] : eventsParsed.events,
    eventsConnected: !eventsParsed.error,
    tasks: tasksParsed.error ? [] : tasksParsed.tasks,
    tasksConnected: !tasksParsed.error,
    unreadEmailCount: unreadCount,
  });
});
