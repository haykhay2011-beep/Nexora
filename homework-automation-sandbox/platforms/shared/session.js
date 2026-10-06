/**
 * session.js: a small cookie-based session system shared by all three mock platforms.
 *
 * How it works:
 *   1. When a user logs in successfully, we create a random, unguessable token
 *      and remember (token -> username) in an in-memory Map.
 *   2. We send that token to the browser in an HTTP-only cookie. "HTTP-only"
 *      means page JavaScript cannot read it (document.cookie won't show it),
 *      which is how real sites protect session cookies from XSS.
 *   3. On every later request, the browser sends the cookie back automatically.
 *      We look the token up in the Map to find out who is logged in.
 *
 * Note on cookies and ports: browsers do NOT separate cookies by port, so
 * localhost:4001, :4002 and :4003 share one cookie jar. That's why each
 * platform uses its own cookie name (md_session, qz_session, ww_session):
 * otherwise logging into one platform would overwrite the others' sessions.
 */
const crypto = require('node:crypto');

/** Parse the raw "Cookie" header ("a=1; b=2") into a plain object. */
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  }
  return out;
}

/**
 * Create a session manager for one platform.
 * @param {string} cookieName  e.g. "md_session"
 * @param {string} loginPath   where unauthenticated page requests are redirected
 */
function createSessions(cookieName, loginPath) {
  const sessions = new Map(); // token -> username

  /** Returns the logged-in username, or null if the cookie is missing/invalid. */
  function currentUser(req) {
    const token = parseCookies(req.headers.cookie)[cookieName];
    if (!token) return null;
    return sessions.get(token) || null;
  }

  /** Start a session: store the token and set the HTTP-only cookie. */
  function start(res, username) {
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, username);
    res.cookie(cookieName, token, { httpOnly: true, sameSite: 'lax', path: '/' });
    return token;
  }

  /** End a session: forget the token server-side AND tell the browser to delete the cookie. */
  function end(req, res) {
    const token = parseCookies(req.headers.cookie)[cookieName];
    if (token) sessions.delete(token);
    res.clearCookie(cookieName, { path: '/' });
  }

  /** Express middleware for HTML pages: no valid session -> redirect to the login page. */
  function requirePage(req, res, next) {
    const user = currentUser(req);
    if (!user) return res.redirect(loginPath);
    req.user = user;
    next();
  }

  /** Express middleware for JSON APIs: no valid session -> 401 Unauthorized. */
  function requireApi(req, res, next) {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    req.user = user;
    next();
  }

  return { currentUser, start, end, requirePage, requireApi };
}

module.exports = { createSessions, parseCookies };
