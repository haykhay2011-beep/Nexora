import { supabaseAdmin } from '../config/supabaseAdmin';

export type Provider = 'google' | 'yahoo' | 'plaid';

export interface IntegrationRow {
  id: string;
  user_id: string;
  provider: Provider;
  access_token: string | null;
  refresh_token: string | null;
  scope: string | null;
  expiry_date: number | null;
  metadata: Record<string, unknown>;
}

export async function getIntegration(userId: string, provider: Provider): Promise<IntegrationRow | null> {
  const { data, error } = await supabaseAdmin
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load ${provider} integration: ${error.message}`);
  }

  return data as IntegrationRow | null;
}

export async function upsertIntegration(
  userId: string,
  provider: Provider,
  fields: Partial<Omit<IntegrationRow, 'id' | 'user_id' | 'provider'>>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_integrations')
    .upsert(
      {
        user_id: userId,
        provider,
        ...fields,
      },
      { onConflict: 'user_id,provider' }
    );

  if (error) {
    throw new Error(`Failed to save ${provider} integration: ${error.message}`);
  }
}

export async function deleteIntegration(userId: string, provider: Provider): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_integrations')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) {
    throw new Error(`Failed to remove ${provider} integration: ${error.message}`);
  }
}

export async function listConnectedProviders(userId: string): Promise<Provider[]> {
  const { data, error } = await supabaseAdmin
    .from('user_integrations')
    .select('provider')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to list integrations: ${error.message}`);
  }

  return (data ?? []).map((row) => row.provider as Provider);
}
