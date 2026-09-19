import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { runChatTurn, ChatTurn } from '../services/geminiService';

export const chatRouter = Router();

chatRouter.use(requireAuth);

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
    res.json({ reply });
  } catch (err: any) {
    console.error('[chat] failed', err);
    res.status(500).json({ error: 'Something went wrong talking to the assistant. Please try again.' });
  }
});
