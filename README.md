# Personal AI OS (Jarvis)

A unified chat interface backed by Gemini function calling, with real-time authenticated
access to your email, calendar, tasks, and finances.

## Architecture

- **Backend** (`/src`): Node.js + Express + TypeScript. Validates Supabase JWTs, runs the
  Gemini tool-calling loop, and exposes OAuth/Plaid Link flows.
- **Mobile** (`/mobile`): Expo + React Native + TypeScript. Glassmorphic chat UI, an
  Integrations sheet for connecting Google/Yahoo/Bank, and a WebView-based Plaid Link flow.
- **Database & Auth** (Supabase/Postgres): `user_integrations` table (RLS-protected) stores
  OAuth tokens/credentials per user per provider. See `supabase/schema.sql`.
- **AI Brain**: Google Gemini (`gemini-3.5-flash-lite`) with function calling over the tools
  in `src/tools/`.

## Backend setup

```bash
npm install
cp .env.example .env   # fill in Supabase, Gemini, Google OAuth, Plaid credentials
npm run dev             # ts-node-dev on http://localhost:4000
```

Apply `supabase/schema.sql` to your Supabase project (SQL editor or `supabase db push`)
before first run.

### Google Cloud setup

1. Enable the Gmail, Calendar, and Tasks APIs.
2. Create an OAuth 2.0 Client ID (Web application) with redirect URI matching
   `GOOGLE_REDIRECT_URI` (default `http://localhost:4000/auth/google/callback`).
3. Add the client id/secret to `.env`.

### Plaid setup

Create a Sandbox app at dashboard.plaid.com, and add `PLAID_CLIENT_ID` / `PLAID_SECRET` to
`.env` (`PLAID_ENV=sandbox`).

### Yahoo Mail

No server-side app registration needed — users generate an
[App Password](https://help.yahoo.com/kb/SLN15241.html) in their Yahoo account and enter it
directly in the Integrations sheet. The backend validates it with a real IMAP login before
saving it.

## Mobile setup

```bash
cd mobile
npm install
cp .env.example .env    # EXPO_PUBLIC_SUPABASE_URL / ANON_KEY / API_BASE_URL
npm start                # opens Expo dev tools; press i / a for simulator, or scan the QR code
```

Point `EXPO_PUBLIC_API_BASE_URL` at your backend (use your machine's LAN IP, not `localhost`,
when testing on a physical device).

## Key implementation notes

- **Timeouts**: the Gemini tool loop (plus IMAP round trips) can take 15–30s. The backend
  sets `Keep-Alive: timeout=120` and raises `server.keepAliveTimeout` / `headersTimeout`;
  the mobile client uses a 90s `AbortController` on `/chat` so iOS doesn't kill the socket
  early.
- **Gemini model**: pinned to `gemini-3.5-flash-lite` (configurable via `GEMINI_MODEL`) for
  high-throughput function calling.
- **Yahoo IMAP**: sequence-number ranges are fetched *without* `{ uid: true }` — passing it
  alongside a range causes `imapflow` to over-fetch and time out. Single-message lookups by
  a known UID are unaffected and use `{ uid: true }` safely.
- **Plaid in Expo Go**: Plaid Link runs inside a `react-native-webview` loading Plaid's own
  web bundle, bridged back to the app via `postMessage`, so no custom dev client is required.
- **Graceful tool failures**: every tool in `src/tools/` catches its own errors and returns a
  stringified `{ error }` payload to Gemini instead of throwing, so a downstream failure
  (expired token, IMAP hiccup, Plaid error) becomes something the assistant can explain to
  the user rather than a crashed request.

## Project layout

```
src/
  config/        env loading, Supabase admin client
  middleware/    Supabase JWT auth guard
  services/      integrations store, Google/Plaid client helpers, Gemini chat loop
  tools/         Gemini-callable tools (email router, calendar, tasks, finance)
  routes/        Express routers (auth, integrations, plaid, chat)
  server.ts      app wiring + HTTP keep-alive tuning
mobile/
  src/screens/       LoginScreen, ChatScreen
  src/components/    IntegrationsModal, PlaidLinkWebView
  src/context/       AuthContext (Supabase session)
  src/lib/           supabase client, API helpers
supabase/
  schema.sql     user_integrations + chat_messages tables, RLS policies
```
