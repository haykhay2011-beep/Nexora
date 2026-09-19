import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { env } from '../config/env';
import { getIntegration } from './integrationsStore';
import { IntegrationNotConnectedError } from './googleClient';

const configuration = new Configuration({
  basePath: PlaidEnvironments[env.plaidEnv as keyof typeof PlaidEnvironments] ?? PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': env.plaidClientId,
      'PLAID-SECRET': env.plaidSecret,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export async function getPlaidAccessToken(userId: string): Promise<string> {
  const integration = await getIntegration(userId, 'plaid');

  if (!integration || !integration.access_token) {
    throw new IntegrationNotConnectedError('Plaid (bank account)');
  }

  return integration.access_token;
}
