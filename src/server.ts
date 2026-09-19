import express from 'express';
import cors from 'cors';
import http from 'http';
import { env } from './config/env';
import { authRouter } from './routes/authRoute';
import { integrationsRouter } from './routes/integrationsRoute';
import { plaidRouter } from './routes/plaidRoute';
import { chatRouter } from './routes/chatRoute';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'personal-ai-os-backend' });
});

app.use('/auth', authRouter);
app.use('/integrations', integrationsRouter);
app.use('/plaid', plaidRouter);
app.use('/chat', chatRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] unhandled error', err);
  res.status(500).json({ error: 'Internal server error.' });
});

const server = http.createServer(app);

// The Gemini tool-calling loop plus IMAP round trips can run well past
// Node's default 5s keep-alive timeout - without this iOS clients get their
// connection silently killed mid-response.
server.keepAliveTimeout = 120_000;
server.headersTimeout = 125_000;

server.listen(env.port, () => {
  console.log(`Personal AI OS backend listening on ${env.appBaseUrl} (port ${env.port})`);
});
