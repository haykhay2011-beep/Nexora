import { ImapFlow, FetchMessageObject } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { getIntegration } from '../../services/integrationsStore';
import { IntegrationNotConnectedError } from '../../services/googleClient';

interface YahooCreds {
  email: string;
  appPassword: string;
}

async function getYahooCreds(userId: string): Promise<YahooCreds> {
  const integration = await getIntegration(userId, 'yahoo');
  const email = integration?.metadata?.email as string | undefined;
  const appPassword = integration?.metadata?.appPassword as string | undefined;

  if (!integration || !email || !appPassword) {
    throw new IntegrationNotConnectedError('Yahoo Mail');
  }

  return { email, appPassword };
}

async function withYahooClient<T>(userId: string, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const creds = await getYahooCreds(userId);
  const client = new ImapFlow({
    host: 'imap.mail.yahoo.com',
    port: 993,
    secure: true,
    auth: { user: creds.email, pass: creds.appPassword },
    logger: false,
  });

  await client.connect();
  try {
    return await fn(client);
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}

export async function yahooListRecentEmails(userId: string, maxResults = 10) {
  return withYahooClient(userId, async (client) => {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const total = client.mailbox && typeof client.mailbox === 'object' ? client.mailbox.exists : 0;
      if (!total) return [];

      const start = Math.max(1, total - maxResults + 1);
      const range = `${start}:${total}`;

      // NOTE: do NOT pass { uid: true } alongside a sequence-number range here —
      // imapflow misinterprets it and ends up fetching/timing out on a much
      // larger set than intended. Sequence numbers only, snippet-only fields.
      const results: Array<{ id: string; subject: string; from: string; date?: Date }> = [];
      for await (const msg of client.fetch(range, { envelope: true }) as AsyncIterable<FetchMessageObject>) {
        results.push({
          id: String(msg.uid),
          subject: msg.envelope?.subject ?? '(no subject)',
          from: msg.envelope?.from?.map((a) => a.address).filter(Boolean).join(', ') ?? '',
          date: msg.envelope?.date,
        });
      }

      return results.reverse();
    } finally {
      lock.release();
    }
  });
}

export async function yahooReadEmail(userId: string, uid: string) {
  return withYahooClient(userId, async (client) => {
    const lock = await client.getMailboxLock('INBOX');
    try {
      // A single known UID is safe to target directly with { uid: true } -
      // the pitfall above is specific to sequence-number ranges.
      const msg = await client.fetchOne(uid, { envelope: true, source: true }, { uid: true });

      if (!msg || !msg.source) {
        throw new Error(`Could not find email with id ${uid}.`);
      }

      const parsed = await simpleParser(msg.source);

      return {
        id: uid,
        subject: parsed.subject ?? '(no subject)',
        from: parsed.from?.text,
        to: parsed.to && 'text' in parsed.to ? parsed.to.text : undefined,
        date: parsed.date,
        body: (parsed.text ?? '').slice(0, 6000),
      };
    } finally {
      lock.release();
    }
  });
}

export async function yahooDraftReply(userId: string, uid: string, body: string) {
  return withYahooClient(userId, async (client) => {
    const lock = await client.getMailboxLock('INBOX');
    let original;
    try {
      const msg = await client.fetchOne(uid, { envelope: true }, { uid: true });
      if (!msg) throw new Error(`Could not find email with id ${uid}.`);
      original = msg;
    } finally {
      lock.release();
    }

    const to = original.envelope?.from?.map((a) => a.address).filter(Boolean).join(', ') ?? '';
    const subject = original.envelope?.subject ?? '';
    const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`;
    const messageId = original.envelope?.messageId ?? '';

    const rawMessage = [
      `To: ${to}`,
      `Subject: ${replySubject}`,
      messageId ? `In-Reply-To: ${messageId}` : '',
      messageId ? `References: ${messageId}` : '',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      body,
    ]
      .filter(Boolean)
      .join('\r\n');

    // Yahoo IMAP has no SMTP send capability here, so a "draft reply" is
    // appended straight to the Drafts mailbox for the user to review and send.
    await client.append('Drafts', rawMessage, ['\\Draft']);

    return { to, subject: replySubject, savedTo: 'Drafts' };
  });
}

export async function yahooSendEmail(userId: string, to: string, subject: string, body: string) {
  const creds = await getYahooCreds(userId);

  const transporter = nodemailer.createTransport({
    host: 'smtp.mail.yahoo.com',
    port: 465,
    secure: true,
    auth: { user: creds.email, pass: creds.appPassword },
  });

  const info = await transporter.sendMail({ from: creds.email, to, subject, text: body });

  return { messageId: info.messageId, to, subject };
}

export async function yahooMarkEmailRead(userId: string, uid: string) {
  return withYahooClient(userId, async (client) => {
    const lock = await client.getMailboxLock('INBOX');
    try {
      await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      return { id: uid, read: true };
    } finally {
      lock.release();
    }
  });
}

export async function yahooArchiveEmail(userId: string, uid: string) {
  return withYahooClient(userId, async (client) => {
    const lock = await client.getMailboxLock('INBOX');
    try {
      await client.messageMove(uid, 'Archive', { uid: true });
      return { id: uid, archived: true };
    } finally {
      lock.release();
    }
  });
}
