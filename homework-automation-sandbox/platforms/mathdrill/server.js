/**
 * MathDrill (Platform A): a mock arithmetic/algebra drill site. Runs on port 4001.
 *
 * What makes this platform different from the others:
 *   - Login form uses id="username" / id="password" and a classic form POST.
 *   - The dashboard is a <table> of assignments, filled in by JavaScript
 *     after a 300 ms delay (so the bot must wait for dynamic content).
 *   - An assignment shows ONE problem at a time in <div class="problem">,
 *     with an <input name="answer"> and a Next button (Submit on the last one).
 *     Each new problem appears after a 200 ms delay.
 *   - The answer for every problem is checked on the server, and a results
 *     page shows the score when the drill is finished.
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

/**
 * Build the Express app. Exported (instead of starting immediately) so the
 * Node tests can start it on a random port with a temporary database.
 */
function createApp({ dbPath = DEFAULT_DB } = {}) {
  const app = express();
  const store = createStore(dbPath);
  const sessions = createSessions(config.cookieName, '/login');

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use('/static', express.static(path.join(__dirname, 'public')));

  // ---------- Login / logout ----------

  function loginPage(error) {
    return page({
      title: 'MathDrill - Log in',
      css: '/static/style.css',
      body: `
<div class="login-wrap">
  <h1 class="brand">MathDrill</h1>
  <p class="tagline">Daily practice, one problem at a time.</p>
  ${error ? `<div class="error-box" role="alert">${escapeHtml(error)}</div>` : ''}
  <form method="post" action="/login" class="login-form">
    <label for="username">Username</label>
    <input id="username" name="username" type="text" autocomplete="username" required>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button id="login-btn" type="submit">Log in</button>
  </form>
  <p class="hint">Demo account: student / practice123</p>
</div>`,
    });
  }

  app.get('/', (req, res) => res.redirect('/dashboard'));

  app.get('/login', (req, res) => {
    if (sessions.currentUser(req)) return res.redirect('/dashboard');
    res.send(loginPage());
  });

  app.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    const demo = config.demoUser;
    if (username === demo.username && password === demo.password) {
      sessions.start(res, username);
      return res.redirect('/dashboard');
    }
    // Wrong credentials: no cookie, 401 status, and the form again with an error.
    res.status(401).send(loginPage('Invalid username or password.'));
  });

  app.post('/logout', (req, res) => {
    sessions.end(req, res);
    res.redirect('/login');
  });

  // ---------- Pages (protected: redirect to /login without a session) ----------

  function shell(title, inner, script) {
    return page({
      title: `MathDrill - ${title}`,
      css: '/static/style.css',
      body: `
<header class="topbar">
  <a class="brand-small" href="/dashboard">MathDrill</a>
  <form method="post" action="/logout" class="logout-form">
    <button id="logout-btn" type="submit">Log out</button>
  </form>
</header>
<main class="container">${inner}</main>`,
      scripts: [script],
    });
  }

  app.get('/dashboard', sessions.requirePage, (req, res) => {
    res.send(shell('Dashboard', `
<h1>My Drills</h1>
<p class="welcome">Welcome back, <strong>${escapeHtml(req.user)}</strong>.</p>
<p id="loading-msg" class="loading">Loading assignments&hellip;</p>
<table id="assignment-table" hidden>
  <thead><tr><th>Assignment</th><th>Due</th><th>Problems</th><th>Status</th></tr></thead>
  <tbody></tbody>
</table>`, '/static/dashboard.js'));
  });

  app.get('/assignment/:id', sessions.requirePage, (req, res) => {
    const a = store.load().assignments.find((x) => x.id === req.params.id);
    if (!a) return res.status(404).send(shell('Not found', '<h1>Assignment not found</h1>', '/static/dashboard.js'));
    res.send(shell(a.title, `
<section class="drill" data-assignment-id="${escapeHtml(a.id)}">
  <h1 id="assignment-title">${escapeHtml(a.title)}</h1>
  <p class="progress" id="progress"></p>
  <p id="loading" class="loading">Loading problem&hellip;</p>
  <div id="problem-area" hidden>
    <div class="problem"></div>
    <input type="text" name="answer" autocomplete="off" placeholder="Your answer">
    <div class="buttons">
      <button id="next-btn" type="button">Next</button>
      <button id="submit-btn" type="button" hidden>Submit</button>
    </div>
    <p class="error-text" id="error-text" role="alert"></p>
  </div>
  <div id="results" hidden>
    <h2>Results</h2>
    <p class="score-line"><span id="score"></span> out of <span id="total"></span> correct</p>
    <table class="breakdown"><thead><tr><th>Type</th><th>Correct</th></tr></thead><tbody></tbody></table>
    <a href="/dashboard" class="back-link">Back to dashboard</a>
  </div>
</section>`, '/static/assignment.js'));
  });

  // ---------- JSON API (protected: 401 without a session) ----------

  /** Summarize finished work: total score plus a per-type breakdown. */
  function results(a) {
    const byType = {};
    let score = 0;
    for (const p of a.problems) {
      byType[p.type] = byType[p.type] || { correct: 0, total: 0 };
      byType[p.type].total++;
      if (p.correct) { byType[p.type].correct++; score++; }
    }
    return { done: true, score, total: a.problems.length, byType };
  }

  app.get('/api/assignments', sessions.requireApi, (req, res) => {
    const list = store.load().assignments.map((a) => ({
      id: a.id,
      title: a.title,
      dueDate: a.dueDate,
      status: a.status,
      problemCount: a.problems.length,
      url: `/assignment/${a.id}`,
    }));
    res.json(list);
  });

  // The current problem (or the results, if the drill is finished).
  // The answer is never sent to the browser.
  app.get('/api/assignments/:id/current', sessions.requireApi, (req, res) => {
    const a = store.load().assignments.find((x) => x.id === req.params.id);
    if (!a) return res.status(404).json({ error: 'No such assignment' });
    if (a.status === 'done') return res.json(results(a));
    const p = a.problems[a.currentIndex];
    res.json({
      done: false,
      index: a.currentIndex,
      total: a.problems.length,
      text: p.display,
      isLast: a.currentIndex === a.problems.length - 1,
    });
  });

  // Record one answer. Returns whether it was correct; marks the assignment
  // done after the last problem.
  app.post('/api/assignments/:id/answer', sessions.requireApi, (req, res) => {
    const db = store.load();
    const a = db.assignments.find((x) => x.id === req.params.id);
    if (!a) return res.status(404).json({ error: 'No such assignment' });
    if (a.status === 'done') return res.status(409).json({ error: 'Assignment already submitted' });

    const index = Number(req.body.index);
    if (index !== a.currentIndex) {
      return res.status(409).json({ error: `Expected an answer for problem ${a.currentIndex + 1}` });
    }
    const raw = String(req.body.answer ?? '').trim();
    if (raw === '' || Number.isNaN(Number(raw))) {
      return res.status(400).json({ error: 'Please enter a number.' });
    }

    const p = a.problems[index];
    p.submitted = raw;
    p.correct = Math.abs(Number(raw) - p.answer) < 1e-6;
    a.currentIndex++;
    a.status = a.currentIndex >= a.problems.length ? 'done' : 'in progress';
    store.save(db);

    const body = { correct: p.correct, done: a.status === 'done' };
    if (body.done) Object.assign(body, results(a));
    res.json(body);
  });

  return app;
}

if (require.main === module) {
  createApp().listen(config.port, () => {
    console.log(`MathDrill running at http://localhost:${config.port}  (login: ${config.demoUser.username} / ${config.demoUser.password})`);
  });
}

module.exports = { createApp, config };
