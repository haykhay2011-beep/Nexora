import { Router } from 'express';
import { supabaseAdmin } from '../config/supabaseAdmin';
import { createGoogleOAuthClient, GOOGLE_SCOPES } from '../services/googleClient';
import { upsertIntegration } from '../services/integrationsStore';

export const authRouter = Router();

/**
 * The mobile app opens this URL in a system browser, passing the user's
 * current Supabase access token as a query param (there's no Authorization
 * header available once we hand off to a browser redirect). We resolve the
 * user, then round-trip their id through Google's `state` param so the
 * callback knows who to attach the resulting tokens to.
 */
authRouter.get('/google', async (req, res) => {
  const accessToken = String(req.query.access_token ?? '');

  if (!accessToken) {
    return res.status(400).send('Missing access_token query parameter.');
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user) {
    return res.status(401).send('Invalid or expired session. Please reopen the app and try again.');
  }

  const client = createGoogleOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    state: data.user.id,
  });

  res.redirect(url);
});

authRouter.get('/google/callback', async (req, res) => {
  const code = String(req.query.code ?? '');
  const userId = String(req.query.state ?? '');

  if (!code || !userId) {
    return res.status(400).send('Missing code or state from Google.');
  }

  try {
    const client = createGoogleOAuthClient();
    const { tokens } = await client.getToken(code);

    await upsertIntegration(userId, 'google', {
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
      scope: tokens.scope ?? null,
      expiry_date: tokens.expiry_date ?? null,
    });

    res.send(
      '<html><body style="font-family: -apple-system, sans-serif; text-align: center; padding-top: 80px;">' +
        '<h2>Google connected ✅</h2><p>You can close this window and return to the app.</p></body></html>'
    );
  } catch (err: any) {
    console.error('[auth/google/callback] token exchange failed', err);
    res.status(500).send('Failed to connect Google. Please try again from the app.');
  }
});
