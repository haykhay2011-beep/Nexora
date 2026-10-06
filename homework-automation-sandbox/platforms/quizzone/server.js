/**
 * QuizZone (Platform B): a mock multiple-choice quiz site. Runs on port 4002.
 *
 * What makes this platform different from the others:
 *   - Login uses name="email" / name="pw" and is submitted by JavaScript
 *     (fetch to /api/login) instead of a classic form POST.
 *   - The dashboard is a list of "cards" (<li class="quiz-card">), and the due
 *     date lives in a <time datetime="..."> attribute, not plain text.
 *   - A quiz shows ALL questions at once inside one <form>. Each question is a
 *     <fieldset> with a <legend>, and each option is a <label> wrapping a
 *     radio button. Option order is shuffled on every page load.
 *   - Submitting posts every answer at once and returns a per-question
 *     breakdown as JSON.
 *   - /debug/answers is a TEST-ONLY answer key (see the big comment below).
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

/** Fisher-Yates shuffle (returns a new array). */
function shuffled(items) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createApp({ dbPath = DEFAULT_DB } = {}) {
  const app = express();
  const store = createStore(dbPath);
  const sessions = createSessions(config.cookieName, '/login');

  app.use(express.json());
  app.use('/static', express.static(path.join(__dirname, 'public')));

  function layout(title, inner, scripts, { loggedIn = true } = {}) {
    return page({
      title: `QuizZone | ${title}`,
      css: '/static/quizzone.css',
      body: `
<nav class="qz-nav">
  <span class="qz-logo">Quiz<b>Zone</b></span>
  ${loggedIn ? '<button type="button" class="btn-logout" data-action="logout">Sign out</button>' : ''}
</nav>
<div class="qz-page">${inner}</div>`,
      scripts: ['/static/common.js', ...scripts],
    });
  }

  // ---------- Login / logout ----------

  app.get('/', (req, res) => res.redirect('/home'));

  app.get('/login', (req, res) => {
    if (sessions.currentUser(req)) return res.redirect('/home');
    res.send(layout('Sign in', `
<form id="signin-form" class="auth-card" novalidate>
  <h1>Sign in to QuizZone</h1>
  <p class="flash flash-error" hidden></p>
  <div class="field"><span class="field-label">Email</span><input name="email" type="email" placeholder="you@school.edu"></div>
  <div class="field"><span class="field-label">Password</span><input name="pw" type="password"></div>
  <button type="submit" class="btn-signin">Sign in</button>
  <p class="demo-note">Demo account: student@quizzone.local / practice123</p>
</form>`, ['/static/login.js'], { loggedIn: false }));
  });

  app.post('/api/login', (req, res) => {
    const { email, pw } = req.body || {};
    const demo = config.demoUser;
    if (email === demo.email && pw === demo.password) {
      sessions.start(res, email);
      return res.json({ ok: true, redirect: '/home' });
    }
    res.status(401).json({ ok: false, error: 'That email and password combination is not recognized.' });
  });

  app.post('/api/logout', (req, res) => {
    sessions.end(req, res);
    res.json({ ok: true, redirect: '/login' });
  });

  // ---------- Pages (protected) ----------

  app.get('/home', sessions.requirePage, (req, res) => {
    res.send(layout('My quizzes', `
<h1 class="page-title">Your quizzes</h1>
<div id="spinner" class="spinner" aria-label="Loading"></div>
<ul class="quiz-list"></ul>`, ['/static/home.js']));
  });

  app.get('/quiz/:id', sessions.requirePage, (req, res) => {
    const db = store.load();
    const quiz = db.quizzes.find((x) => x.id === req.params.id);
    if (!quiz) return res.status(404).send(layout('Not found', '<h1>Quiz not found</h1>', []));

    if (quiz.status === 'done') {
      return res.send(layout(quiz.title, `
<h1 class="page-title">${escapeHtml(quiz.title)}</h1>
<div class="already-done">You already submitted this quiz. Score: ${quiz.lastResult.score}/${quiz.lastResult.total}</div>
<a href="/home">Back to quizzes</a>`, []));
    }

    // Opening a quiz marks it "in progress" (like a real platform tracking attempts).
    if (quiz.status === 'not started') { quiz.status = 'in progress'; store.save(db); }

    const fieldsets = quiz.questions.map((question, n) => {
      // Shuffle the options on every load. The radio's value is the option's
      // ORIGINAL index, so the server can grade it, but its screen position is random.
      const options = shuffled(question.options.map((text, index) => ({ text, index })));
      const labels = options.map((o) => `
      <label class="choice"><input type="radio" name="${question.id}" value="${o.index}"><span class="choice-text">${escapeHtml(o.text)}</span></label>`).join('');
      const review = question.review ? '\n    <p class="review-note">&#9873; Under review: this question may be revised.</p>' : '';
      return `
  <fieldset class="question${question.review ? ' question-review' : ''}" data-qid="${question.id}">
    <legend>${n + 1}. ${escapeHtml(question.text)}</legend>${review}
    <div class="choices">${labels}
    </div>
  </fieldset>`;
    }).join('');

    res.send(layout(quiz.title, `
<h1 class="page-title">${escapeHtml(quiz.title)}</h1>
<form id="quiz-form" class="quiz" data-quiz-id="${quiz.id}">${fieldsets}
  <p class="flash flash-error" hidden></p>
  <button type="submit" class="btn-submit-quiz">Submit quiz</button>
</form>
<section id="quiz-result" class="result-panel" hidden>
  <h2 class="score">Score: <span class="score-value"></span></h2>
  <ol class="breakdown"></ol>
  <details class="raw"><summary>Raw response (JSON)</summary><pre id="result-json"></pre></details>
  <a href="/home">Back to quizzes</a>
</section>`, ['/static/quiz.js']));
  });

  // ---------- JSON API (protected: 401 without a session) ----------

  app.get('/api/quizzes', sessions.requireApi, (req, res) => {
    res.json(store.load().quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      dueDate: quiz.dueDate,
      status: quiz.status,
      questionCount: quiz.questions.length,
      url: `/quiz/${quiz.id}`,
    })));
  });

  // Submit every answer at once: body = { answers: { q1: "2", q2: "0", ... } }
  // where each value is the ORIGINAL index of the chosen option.
  app.post('/api/quizzes/:id/submit', sessions.requireApi, (req, res) => {
    const db = store.load();
    const quiz = db.quizzes.find((x) => x.id === req.params.id);
    if (!quiz) return res.status(404).json({ error: 'No such quiz' });
    if (quiz.status === 'done') return res.status(409).json({ error: 'Quiz already submitted' });

    const answers = (req.body && req.body.answers) || {};
    const missing = quiz.questions.filter((question) => answers[question.id] === undefined || answers[question.id] === '');
    if (missing.length > 0) {
      return res.status(400).json({ error: `Please answer every question (missing: ${missing.map((m) => m.id).join(', ')}).` });
    }

    const breakdown = quiz.questions.map((question) => ({
      questionId: question.id,
      correct: Number(answers[question.id]) === question.correctIndex,
      review: question.review,
    }));
    const score = breakdown.filter((b) => b.correct).length;
    quiz.status = 'done';
    quiz.lastResult = { score, total: quiz.questions.length };
    store.save(db);
    res.json({ quizId: quiz.id, score, total: quiz.questions.length, breakdown });
  });

  // ======================================================================
  //  TEST-ONLY ENDPOINT: /debug/answers
  //
  //  This answer key exists ONLY because we built this sandbox ourselves and
  //  need some basis for the bot's multiple-choice answers (they can't be
  //  computed from the question text the way math answers can). NO REAL
  //  PLATFORM WOULD EVER EXPOSE ITS ANSWER KEY. It stands in for whatever
  //  answering strategy a real system would use.
  //
  //  It returns question TEXT -> answer TEXT (no indexes), so the bot still
  //  has to read and match the shuffled options on the page. Questions marked
  //  "review" are deliberately left out, so the bot must handle a missing key.
  //  It still requires a valid session, like every other API here.
  // ======================================================================
  app.get('/debug/answers', sessions.requireApi, (req, res) => {
    const quizzes = store.load().quizzes.filter((quiz) => !req.query.quiz || quiz.id === req.query.quiz);
    if (quizzes.length === 0) return res.status(404).json({ error: 'No such quiz' });
    res.json({
      warning: 'TEST-ONLY answer key for the local sandbox. A real platform would never expose this.',
      quizzes: quizzes.map((quiz) => ({
        quizId: quiz.id,
        answers: quiz.questions
          .filter((question) => !question.review)
          .map((question) => ({ question: question.text, answer: question.options[question.correctIndex] })),
      })),
    });
  });

  return app;
}

if (require.main === module) {
  createApp().listen(config.port, () => {
    console.log(`QuizZone running at http://localhost:${config.port}  (login: ${config.demoUser.email} / ${config.demoUser.password})`);
  });
}

module.exports = { createApp, config };
