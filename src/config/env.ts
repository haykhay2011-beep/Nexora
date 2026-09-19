import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: Number(optional('PORT', '4000')),
  appBaseUrl: optional('APP_BASE_URL', 'http://localhost:4000'),

  supabaseUrl: optional('SUPABASE_URL'),
  supabaseServiceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY'),

  geminiApiKey: optional('GEMINI_API_KEY'),
  geminiModel: optional('GEMINI_MODEL', 'gemini-3.5-flash-lite'),

  googleClientId: optional('GOOGLE_CLIENT_ID'),
  googleClientSecret: optional('GOOGLE_CLIENT_SECRET'),
  googleRedirectUri: optional('GOOGLE_REDIRECT_URI', 'http://localhost:4000/auth/google/callback'),

  plaidClientId: optional('PLAID_CLIENT_ID'),
  plaidSecret: optional('PLAID_SECRET'),
  plaidEnv: optional('PLAID_ENV', 'sandbox'),
};

export { required };
