const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startPlatform, cookieFrom, json } = require('./helpers');

let p;
before(async () => { p = await startPlatform('quizzone'); });
after(() => p.close());

async function login() {
  const res = await fetch(`${p.base}/api/login`, json({ email: 'student@quizzone.local', pw: 'practice123' }));
  assert.equal(res.status, 200);
  return cookieFrom(res, 'qz_session');
}

test('login with wrong credentials fails and sets no cookie', async () => {
  const res = await fetch(`${p.base}/api/login`, json({ email: 'student@quizzone.local', pw: 'nope' }));
  assert.equal(res.status, 401);
  assert.equal(cookieFrom(res, 'qz_session'), null);
});

test('protected endpoints return 401 without a cookie', async () => {
  for (const url of ['/api/quizzes', '/debug/answers']) {
    const res = await fetch(`${p.base}${url}`);
    assert.equal(res.status, 401, url);
  }
  const submit = await fetch(`${p.base}/api/quizzes/qz-1/submit`, json({ answers: {} }));
  assert.equal(submit.status, 401);
});

test('the test-only answer key leaves out "review" questions', async () => {
  const cookie = await login();
  const res = await fetch(`${p.base}/debug/answers?quiz=qz-1`, { headers: { Cookie: cookie } });
  const body = await res.json();
  assert.match(body.warning, /TEST-ONLY/);
  assert.equal(body.quizzes[0].answers.length, 4); // 5 questions, 1 under review
});

test('option order is shuffled between page loads', async () => {
  const cookie = await login();
  const orders = new Set();
  for (let i = 0; i < 10; i++) {
    const html = await (await fetch(`${p.base}/quiz/qz-2`, { headers: { Cookie: cookie } })).text();
    const q1 = html.split('data-qid="q1"')[1].split('</fieldset>')[0];
    orders.add([...q1.matchAll(/value="(\d)"/g)].map((m) => m[1]).join(''));
  }
  assert.ok(orders.size > 1, 'expected more than one option order across 10 loads');
});

test('submitting grades every question and returns a breakdown', async () => {
  const cookie = await login();
  const quiz = p.readDb().quizzes.find((q) => q.id === 'qz-3');
  const answers = {};
  for (const question of quiz.questions) answers[question.id] = String(question.correctIndex);
  answers.q1 = String((quiz.questions[0].correctIndex + 1) % 4); // get one wrong on purpose

  const res = await fetch(`${p.base}/api/quizzes/qz-3/submit`, json({ answers }, cookie));
  const body = await res.json();
  assert.equal(body.score, 4);
  assert.equal(body.total, 5);
  assert.equal(body.breakdown.find((b) => b.questionId === 'q1').correct, false);
});

test('submitting with an unanswered question is rejected', async () => {
  const cookie = await login();
  const res = await fetch(`${p.base}/api/quizzes/qz-4/submit`, json({ answers: { q1: '0' } }, cookie));
  assert.equal(res.status, 400);
});
