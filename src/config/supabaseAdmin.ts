import { createClient } from '@supabase/supabase-js';
import { env } from './env';

if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
  console.warn(
    '[supabaseAdmin] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. ' +
      'Auth and integration lookups will fail until they are configured.'
  );
}

// Service-role client used server-side only. Every route that touches user
// data must first resolve `userId` via the auth middleware (which verifies
// the caller's JWT), then scope all queries to that userId manually since
// this client intentionally bypasses RLS.
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
