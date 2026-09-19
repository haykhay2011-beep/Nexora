import { getIntegration } from '../services/integrationsStore';
import {
  googleArchiveEmail,
  googleDraftReply,
  googleListRecentEmails,
  googleMarkEmailRead,
  googleReadEmail,
  googleSendEmail,
} from './providers/googleEmail';
import {
  yahooArchiveEmail,
  yahooDraftReply,
  yahooListRecentEmails,
  yahooMarkEmailRead,
  yahooReadEmail,
  yahooSendEmail,
} from './providers/yahooEmail';

type EmailProvider = 'google' | 'yahoo';

async function resolveActiveEmailProvider(userId: string): Promise<EmailProvider> {
  const [google, yahoo] = await Promise.all([getIntegration(userId, 'google'), getIntegration(userId, 'yahoo')]);

  if (google?.refresh_token) return 'google';
  if (yahoo?.metadata?.appPassword) return 'yahoo';

  throw new Error(
    'No email account is connected yet. Ask the user to connect Google or Yahoo Mail from the Integrations menu.'
  );
}

export async function listRecentEmails(userId: string, args: { maxResults?: number }) {
  try {
    const provider = await resolveActiveEmailProvider(userId);
    const maxResults = args.maxResults ?? 10;

    const emails =
      provider === 'google'
        ? await googleListRecentEmails(userId, maxResults)
        : await yahooListRecentEmails(userId, maxResults);

    return JSON.stringify({ provider, emails });
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? 'Failed to list recent emails.' });
  }
}

export async function readEmail(userId: string, args: { messageId: string }) {
  try {
    const provider = await resolveActiveEmailProvider(userId);

    const email =
      provider === 'google'
        ? await googleReadEmail(userId, args.messageId)
        : await yahooReadEmail(userId, args.messageId);

    return JSON.stringify({ provider, email });
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? 'Failed to read that email.' });
  }
}

export async function draftReply(userId: string, args: { messageId: string; body: string }) {
  try {
    const provider = await resolveActiveEmailProvider(userId);

    const draft =
      provider === 'google'
        ? await googleDraftReply(userId, args.messageId, args.body)
        : await yahooDraftReply(userId, args.messageId, args.body);

    return JSON.stringify({ provider, draft });
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? 'Failed to save the draft reply.' });
  }
}

export async function sendEmail(userId: string, args: { to: string; subject: string; body: string }) {
  try {
    const provider = await resolveActiveEmailProvider(userId);

    const sent =
      provider === 'google'
        ? await googleSendEmail(userId, args.to, args.subject, args.body)
        : await yahooSendEmail(userId, args.to, args.subject, args.body);

    return JSON.stringify({ provider, sent });
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? 'Failed to send the email.' });
  }
}

export async function markEmailRead(userId: string, args: { messageId: string }) {
  try {
    const provider = await resolveActiveEmailProvider(userId);

    const result =
      provider === 'google'
        ? await googleMarkEmailRead(userId, args.messageId)
        : await yahooMarkEmailRead(userId, args.messageId);

    return JSON.stringify({ provider, result });
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? 'Failed to mark the email as read.' });
  }
}

export async function archiveEmail(userId: string, args: { messageId: string }) {
  try {
    const provider = await resolveActiveEmailProvider(userId);

    const result =
      provider === 'google'
        ? await googleArchiveEmail(userId, args.messageId)
        : await yahooArchiveEmail(userId, args.messageId);

    return JSON.stringify({ provider, result });
  } catch (err: any) {
    return JSON.stringify({ error: err.message ?? 'Failed to archive the email.' });
  }
}
