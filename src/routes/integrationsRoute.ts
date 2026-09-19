import { Router } from 'express';
import { ImapFlow } from 'imapflow';
import { requireAuth } from '../middleware/auth';
import { deleteIntegration, listConnectedProviders, upsertIntegration } from '../services/integrationsStore';

export const integrationsRouter = Router();

integrationsRouter.use(requireAuth);

integrationsRouter.get('/', async (req, res) => {
  try {
    const providers = await listConnectedProviders(req.userId!);
    res.json({ connected: providers });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to load integrations.' });
  }
});

// Yahoo has no OAuth redirect flow here - the user supplies an IMAP App
// Password directly, which we validate with a real login before saving it.
integrationsRouter.post('/yahoo', async (req, res) => {
  const { email, appPassword } = req.body ?? {};

  if (!email || !appPassword) {
    return res.status(400).json({ error: 'email and appPassword are required.' });
  }

  const client = new ImapFlow({
    host: 'imap.mail.yahoo.com',
    port: 993,
    secure: true,
    auth: { user: email, pass: appPassword },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();
  } catch (err: any) {
    return res.status(400).json({ error: `Could not sign in to Yahoo Mail: ${err.message}` });
  }

  try {
    await upsertIntegration(req.userId!, 'yahoo', { metadata: { email, appPassword } });
    res.json({ connected: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to save Yahoo credentials.' });
  }
});

integrationsRouter.delete('/:provider', async (req, res) => {
  const provider = req.params.provider as 'google' | 'yahoo' | 'plaid';

  if (!['google', 'yahoo', 'plaid'].includes(provider)) {
    return res.status(400).json({ error: 'Unknown provider.' });
  }

  try {
    await deleteIntegration(req.userId!, provider);
    res.json({ disconnected: provider });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to disconnect integration.' });
  }
});
