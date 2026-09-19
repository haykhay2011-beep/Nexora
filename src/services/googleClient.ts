import { google } from 'googleapis';
import { env } from '../config/env';
import { getIntegration, upsertIntegration } from './integrationsStore';

export class IntegrationNotConnectedError extends Error {
  constructor(provider: string) {
    super(`${provider} is not connected for this user yet.`);
    this.name = 'IntegrationNotConnectedError';
  }
}

export function createGoogleOAuthClient() {
  return new google.auth.OAuth2(env.googleClientId, env.googleClientSecret, env.googleRedirectUri);
}

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * Returns an OAuth2 client pre-loaded with this user's stored Google tokens.
 * Persists refreshed tokens back to Supabase automatically so future calls
 * don't need to re-authenticate.
 */
export async function getAuthenticatedGoogleClient(userId: string) {
  const integration = await getIntegration(userId, 'google');

  if (!integration || !integration.refresh_token) {
    throw new IntegrationNotConnectedError('Google');
  }

  const client = createGoogleOAuthClient();
  client.setCredentials({
    access_token: integration.access_token ?? undefined,
    refresh_token: integration.refresh_token,
    scope: integration.scope ?? undefined,
    expiry_date: integration.expiry_date ?? undefined,
  });

  client.on('tokens', (tokens) => {
    upsertIntegration(userId, 'google', {
      access_token: tokens.access_token ?? integration.access_token,
      refresh_token: tokens.refresh_token ?? integration.refresh_token,
      scope: tokens.scope ?? integration.scope,
      expiry_date: tokens.expiry_date ?? integration.expiry_date,
    }).catch((err) => console.error('[googleClient] failed to persist refreshed tokens', err));
  });

  return client;
}
