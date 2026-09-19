import { supabaseAdmin } from '../config/supabaseAdmin';

export async function createReminder(userId: string, args: { text: string; dueIso: string }) {
  try {
    const { data, error } = await supabaseAdmin
      .from('reminders')
      .insert({ user_id: userId, text: args.text, due_at: args.dueIso })
      .select('id, text, due_at')
      .single();

    if (error) throw error;

    return JSON.stringify({ id: data.id, text: data.text, dueAt: data.due_at });
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? 'Failed to create the reminder.' });
  }
}

export async function listReminders(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('reminders')
      .select('id, text, due_at, completed')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('due_at', { ascending: true });

    if (error) throw error;

    return JSON.stringify({ reminders: data ?? [] });
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? 'Failed to list reminders.' });
  }
}
