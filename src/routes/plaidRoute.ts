import { Router } from 'express';
import { CountryCode, Products } from 'plaid';
import { requireAuth } from '../middleware/auth';
import { plaidClient } from '../services/plaidClient';
import { upsertIntegration } from '../services/integrationsStore';

export const plaidRouter = Router();

plaidRouter.use(requireAuth);

plaidRouter.post('/create-link-token', async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.userId! },
      client_name: 'Personal AI OS',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    res.json({ linkToken: response.data.link_token });
  } catch (err: any) {
    res.status(500).json({ error: err?.response?.data?.error_message ?? err.message ?? 'Failed to create link token.' });
  }
});

plaidRouter.post('/exchange-public-token', async (req, res) => {
  const { publicToken } = req.body ?? {};

  if (!publicToken) {
    return res.status(400).json({ error: 'publicToken is required.' });
  }

  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });

    await upsertIntegration(req.userId!, 'plaid', {
      access_token: response.data.access_token,
      metadata: { itemId: response.data.item_id },
    });

    res.json({ connected: true });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: err?.response?.data?.error_message ?? err.message ?? 'Failed to link bank account.' });
  }
});
