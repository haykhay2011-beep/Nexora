import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabaseAdmin';

/**
 * Validates the Supabase JWT Bearer token on every protected request and
 * attaches the resolved userId/email to `req` for downstream handlers.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }

    req.userId = data.user.id;
    req.userEmail = data.user.email ?? undefined;
    next();
  } catch (err) {
    console.error('[requireAuth] unexpected error', err);
    res.status(500).json({ error: 'Authentication check failed.' });
  }
}
