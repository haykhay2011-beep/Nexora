import { google } from 'googleapis';
import { getAuthenticatedGoogleClient } from '../../services/googleClient';

function decodeHeader(headers: { name?: string | null; value?: string | null }[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function base64UrlEncode(input: string) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function googleListRecentEmails(userId: string, maxResults = 10) {
  const auth = await getAuthenticatedGoogleClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  const list = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    labelIds: ['INBOX'],
  });

  const messages = list.data.messages ?? [];

  const details = await Promise.all(
    messages.map(async (m) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: m.id!,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });
      return {
        id: msg.data.id,
        threadId: msg.data.threadId,
        subject: decodeHeader(msg.data.payload?.headers, 'Subject'),
        from: decodeHeader(msg.data.payload?.headers, 'From'),
        date: decodeHeader(msg.data.payload?.headers, 'Date'),
        snippet: msg.data.snippet,
      };
    })
  );

  return details;
}

function extractPlainTextBody(payload: any): string {
  if (!payload) return '';

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainTextBody(part);
      if (text) return text;
    }
  }

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  return '';
}

export async function googleReadEmail(userId: string, messageId: string) {
  const auth = await getAuthenticatedGoogleClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  const msg = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });

  return {
    id: msg.data.id,
    threadId: msg.data.threadId,
    subject: decodeHeader(msg.data.payload?.headers, 'Subject'),
    from: decodeHeader(msg.data.payload?.headers, 'From'),
    to: decodeHeader(msg.data.payload?.headers, 'To'),
    date: decodeHeader(msg.data.payload?.headers, 'Date'),
    body: extractPlainTextBody(msg.data.payload).slice(0, 6000),
  };
}

export async function googleDraftReply(userId: string, messageId: string, body: string) {
  const auth = await getAuthenticatedGoogleClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  const original = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'metadata',
    metadataHeaders: ['Subject', 'From', 'To', 'Message-ID', 'References'] });

  const subject = decodeHeader(original.data.payload?.headers, 'Subject');
  const to = decodeHeader(original.data.payload?.headers, 'From');
  const messageIdHeader = decodeHeader(original.data.payload?.headers, 'Message-ID');
  const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`;

  const rawMessage = [
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${messageIdHeader}`,
    `References: ${messageIdHeader}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ].join('\r\n');

  const draft = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: base64UrlEncode(rawMessage),
        threadId: original.data.threadId ?? undefined,
      },
    },
  });

  return { draftId: draft.data.id, to, subject: replySubject };
}
