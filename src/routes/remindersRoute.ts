import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabaseAdmin';

export const remindersRouter = Router();

remindersRouter.use(requireAuth);

// Called when the app opens - returns reminders that are due and haven't
// been shown yet, then marks them surfaced so they don't repeat every launch.
remindersRouter.get('/due', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('reminders')
      .select('id, text, due_at')
      .eq('user_id', req.userId!)
      .eq('completed', false)
      .eq('surfaced', false)
      .lte('due_at', new Date().toISOString());

    if (error) throw error;

    const due = data ?? [];

    if (due.length > 0) {
      await supabaseAdmin
        .from('reminders')
        .update({ surfaced: true })
        .in(
          'id',
          due.map((r) => r.id)
        );
    }

    res.json({ reminders: due });
  } catch (err: any) {
    console.error('[reminders/due] failed', err);
    res.status(500).json({ error: 'Failed to load due reminders.' });
  }
});
