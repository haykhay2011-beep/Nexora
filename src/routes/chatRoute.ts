import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { runChatTurn, transcribeAudio, ChatTurn } from '../services/geminiService';
import { supabaseAdmin } from '../config/supabaseAdmin';

export const chatRouter = Router();

chatRouter.use(requireAuth);

const HISTORY_LIMIT = 50;

chatRouter.get('/history', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);

    if (error) throw error;

    res.json({ messages: (data ?? []).reverse() });
  } catch (err: any) {
    console.error('[chat/history] failed', err);
    res.status(500).json({ error: 'Failed to load chat history.' });
  }
});

chatRouter.post('/transcribe', async (req, res) => {
  const { audioBase64, mimeType } = req.body ?? {};

  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ error: 'audioBase64 is required.' });
  }

  try {
    const text = await transcribeAudio(audioBase64, mimeType || 'audio/m4a');
    res.json({ text });
  } catch (err: any) {
    console.error('[chat/transcribe] failed', err);
    res.status(500).json({ error: 'Failed to transcribe audio.' });
  }
});

chatRouter.post('/', async (req, res) => {
  const { message, history } = req.body ?? {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required.' });
  }

  // Long-running tool loops (IMAP fetch + LLM reasoning) can take 15-30s.
  // Make sure the mobile client's connection isn't dropped mid-flight.
  res.setHeader('Keep-Alive', 'timeout=120');
  res.setHeader('Connection', 'keep-alive');

  try {
    const reply = await runChatTurn(req.userId!, message, Array.isArray(history) ? (history as ChatTurn[]) : []);

    // Persist both turns so history survives app restarts. Best-effort: a
    // storage hiccup shouldn't fail a chat response the user already got.
    supabaseAdmin
      .from('chat_messages')
      .insert([
        { user_id: req.userId!, role: 'user', content: message },
        { user_id: req.userId!, role: 'model', content: reply },
      ])
      .then(({ error }) => {
        if (error) console.error('[chat] failed to persist messages', error);
      });

    res.json({ reply });
  } catch (err: any) {
    console.error('[chat] failed', err);
    res.status(500).json({ error: 'Something went wrong talking to the assistant. Please try again.' });
  }
});
