/**
 * WriteWell (Platform C): a mock free-response writing site. Runs on port 4003.
 *
 * What makes this platform different from the others:
 *   - Login is a MULTI-STEP form: type the username, click "Continue", and
 *     only then does the password field appear (after a short delay).
 *   - The dashboard is a grid of <article class="prompt-card"> elements, and
 *     the due date is only available as human text ("Due Oct 8, 2026").
 *   - An assignment is a prompt plus a <textarea>. There is no right answer:
 *     the server records the text and returns a word count. Responses under
 *     the prompt's minimum word count are REJECTED with a validation message.
 *
 * This site exists only to give the automation bot a safe local target.
 */
const path = require('node:path');
const express = require('express');
const { createSessions } = require('../shared/session');
const { createStore } = require('../shared/store');
const { page, escapeHtml } = require('../shared/html');
const config = require('./config.json');
const { DEFAULT_DB } = require('./seed');

/** Count words the same simple way a student would: runs of non-space characters. */
function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function createApp({ dbPath = DEFAULT_DB } = {}) {
  const app = express();
  const store = createStore(dbPath);
  const sessions = createSessions(config.cookieName, '/signin');

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use('/static', express.static(path.join(__dirname, 'public')));

  function frame(title, inner, scripts, { loggedIn = true } = {}) {
    return page({
      title: `${title} · WriteWell`,
      css: '/static/writewell.css',
      body: `
<div class="ww-frame">
  <aside class="ww-side">
    <div class="ww-mark">WriteWell</div>
    ${loggedIn ? `<a href="/prompts" class="side-link">Prompts</a>
    <form method="post" action="/signout"><button type="submit" class="signout">Sign out</button></form>` : '<p class="side-note">Write a little every day.</p>'}
  </aside>
  <main class="ww-main">${inner}</main>
</div>`,
      scripts,
    });
  }

  // ---------- Multi-step sign in / sign out ----------

  function signinPage(error) {
    return frame('Sign in', `
<form id="signin" class="stepper" method="post" action="/signin">
  <h1>Sign in</h1>
  ${error ? `<div class="alert" role="alert">${escapeHtml(error)}</div>` : ''}
  <div class="step step-1">
    <label for="ww-user">Username</label>
    <input id="ww-user" name="user" type="text" autocomplete="username">
    <button type="button" id="continue-btn">Continue</button>
    <p class="step-error" hidden></p>
  </div>
  <div class="step step-2" hidden>
    <p class="who">Signing in as <b class="who-name"></b></p>
    <label for="ww-pass">Password</label>
    <input id="ww-pass" name="pass" type="password" autocomplete="current-password">
    <button type="submit" id="signin-btn">Sign in</button>
  </div>
  <p class="demo">Demo account: student / practice123</p>
</form>`, ['/static/signin.js'], { loggedIn: false });
  }

  app.get('/', (req, res) => res.redirect('/prompts'));

  app.get('/signin', (req, res) => {
    if (sessions.currentUser(req)) return res.redirect('/prompts');
    res.send(signinPage());
  });

  // Step 1: does this username exist? (Like "Continue" on many real sign-in pages.)
  app.post('/api/signin/identify', (req, res) => {
    const user = String((req.body && req.body.user) || '').trim();
    if (user === config.demoUser.username) return res.json({ ok: true, user });
    res.status(404).json({ ok: false, error: "We couldn't find an account with that username." });
  });

  // Step 2: username + password, submitted as a normal HTML form.
  app.post('/signin', (req, res) => {
    const { user, pass } = req.body || {};
    if (user === config.demoUser.username && pass === config.demoUser.password) {
      sessions.start(res, user);
      return res.redirect('/prompts');
    }
    res.status(401).send(signinPage('Incorrect username or password. Please start again.'));
  });

  app.post('/signout', (req, res) => {
    sessions.end(req, res);
    res.redirect('/signin');
  });

  // ---------- Pages (protected) ----------

  app.get('/prompts', sessions.requirePage, (req, res) => {
    res.send(frame('Prompts', `
<h1>Writing prompts</h1>
<p class="lede">Pick a prompt and write your response.</p>
<section class="prompt-grid" aria-busy="true"><p class="busy-text">Fetching prompts&hellip;</p></section>`, ['/static/prompts.js']));
  });

  app.get('/write/:id', sessions.requirePage, (req, res) => {
    const p = store.load().prompts.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).send(frame('Not found', '<h1>Prompt not found</h1>', []));
    const done = p.status === 'done';
    res.send(frame(p.title, `
<article class="editor" data-prompt-id="${p.id}">
  <h1 class="prompt-title">${escapeHtml(p.title)}</h1>
  <blockquote class="prompt-text">${escapeHtml(p.prompt)}</blockquote>
  ${done ? `<div class="confirmation">Already submitted (${p.submission.wordCount} words).</div>
  <div class="submitted-text">${escapeHtml(p.submission.text)}</div>` : `
  <textarea id="response" name="response" rows="10" placeholder="Start writing...">${escapeHtml(p.draft)}</textarea>
  <p class="counter"><span id="word-count">0</span> words</p>
  <div class="validation-error" role="alert" hidden></div>
  <button type="button" id="submit-response">Submit</button>
  <div class="confirmation" hidden>Submitted! Word count: <b class="final-count"></b></div>`}
  <a href="/prompts" class="back">&larr; All prompts</a>
</article>`, done ? [] : ['/static/write.js']));
  });

  // ---------- JSON API (protected: 401 without a session) ----------

  app.get('/api/prompts', sessions.requireApi, (req, res) => {
    res.json(store.load().prompts.map((p) => ({
      id: p.id,
      title: p.title,
      dueDate: p.dueDate,
      status: p.status,
      url: `/write/${p.id}`,
    })));
  });

  // Record a response. There's no right answer, so "success" means the text
  // was accepted: it must meet the minimum word count.
  app.post('/api/prompts/:id/submit', sessions.requireApi, (req, res) => {
    const db = store.load();
    const p = db.prompts.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'No such prompt' });
    if (p.status === 'done') return res.status(409).json({ error: 'Already submitted' });

    const text = String((req.body && req.body.text) || '');
    const wordCount = countWords(text);
    if (wordCount < p.minWords) {
      p.rejectedAttempts++;
      store.save(db);
      return res.status(422).json({
        submitted: false,
        wordCount,
        error: `Too short: your response has ${wordCount} words, but this prompt requires at least ${p.minWords} words.`,
      });
    }
    p.status = 'done';
    p.submission = { text, wordCount, submittedAt: new Date().toISOString() };
    store.save(db);
    res.json({ submitted: true, wordCount });
  });

  return app;
}

if (require.main === module) {
  createApp().listen(config.port, () => {
    console.log(`WriteWell running at http://localhost:${config.port}  (login: ${config.demoUser.username} / ${config.demoUser.password})`);
  });
}

module.exports = { createApp, config, countWords };
