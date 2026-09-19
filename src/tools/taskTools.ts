import { google } from 'googleapis';
import { getAuthenticatedGoogleClient } from '../services/googleClient';

export async function listTasks(userId: string) {
  try {
    const auth = await getAuthenticatedGoogleClient(userId);
    const tasks = google.tasks({ version: 'v1', auth });

    const res = await tasks.tasks.list({ tasklist: '@default', showCompleted: false });

    const items = (res.data.items ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      notes: t.notes,
      due: t.due,
      status: t.status,
    }));

    return JSON.stringify({ tasks: items });
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? 'Failed to list tasks.' });
  }
}

export async function createTask(userId: string, args: { title: string; notes?: string; dueIso?: string }) {
  try {
    const auth = await getAuthenticatedGoogleClient(userId);
    const tasks = google.tasks({ version: 'v1', auth });

    const res = await tasks.tasks.insert({
      tasklist: '@default',
      requestBody: {
        title: args.title,
        notes: args.notes,
        due: args.dueIso,
      },
    });

    return JSON.stringify({ id: res.data.id, title: res.data.title });
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? 'Failed to create the task.' });
  }
}

export async function completeTask(userId: string, args: { taskId: string }) {
  try {
    const auth = await getAuthenticatedGoogleClient(userId);
    const tasks = google.tasks({ version: 'v1', auth });

    const res = await tasks.tasks.patch({
      tasklist: '@default',
      task: args.taskId,
      requestBody: { status: 'completed' },
    });

    return JSON.stringify({ id: res.data.id, status: res.data.status });
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? 'Failed to complete the task.' });
  }
}
