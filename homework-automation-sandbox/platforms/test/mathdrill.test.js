const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startPlatform, cookieFrom, form, json } = require('./helpers');

let p;
before(async () => { p = await startPlatform('mathdrill'); });
after(() => p.close());

async function login() {
  const res = await fetch(`${p.base}/login`, form({ username: 'student', password: 'practice123' }));
  assert.equal(res.status, 302);
  const cookie = cookieFrom(res, 'md_session');
  assert.ok(cookie, 'login should set the md_session cookie');
  return cookie;
}

test('login with wrong credentials fails and sets no cookie', async () => {
  const res = await fetch(`${p.base}/login`, form({ username: 'student', password: 'wrong' }));
  assert.equal(res.status, 401);
  assert.equal(cookieFrom(res, 'md_session'), null);
  assert.match(await res.text(), /Invalid username or password/);
});

test('session cookie is HTTP-only', async () => {
  const res = await fetch(`${p.base}/login`, form({ username: 'student', password: 'practice123' }));
  const header = res.headers.getSetCookie().find((c) => c.startsWith('md_session='));
  assert.match(header, /HttpOnly/i);
});

test('protected API returns 401 without a cookie', async () => {
  const res = await fetch(`${p.base}/api/assignments`);
  assert.equal(res.status, 401);
});

test('protected API returns 401 with a forged cookie', async () => {
  const res = await fetch(`${p.base}/api/assignments`, { headers: { Cookie: 'md_session=not-a-real-token' } });
  assert.equal(res.status, 401);
});

test('protected page redirects to /login without a cookie', async () => {
  const res = await fetch(`${p.base}/dashboard`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
});

test('a correct answer to a seeded problem is marked correct; a wrong one is not', async () => {
  const cookie = await login();
  const seeded = p.readDb().assignments.find((a) => a.id === 'md-1');

  const right = await fetch(`${p.base}/api/assignments/md-1/answer`, json({ index: 0, answer: String(seeded.problems[0].answer) }, cookie));
  assert.equal(right.status, 200);
  assert.equal((await right.json()).correct, true);

  const wrong = await fetch(`${p.base}/api/assignments/md-1/answer`, json({ index: 1, answer: String(seeded.problems[1].answer + 1) }, cookie));
  assert.equal((await wrong.json()).correct, false);
  assert.equal(p.readDb().assignments.find((a) => a.id === 'md-1').status, 'in progress');
});

test('answering the last problem marks the assignment done and returns the score', async () => {
  const cookie = await login();
  const seeded = p.readDb().assignments.find((a) => a.id === 'md-2');
  let last;
  for (let i = 0; i < seeded.problems.length; i++) {
    const res = await fetch(`${p.base}/api/assignments/md-2/answer`, json({ index: i, answer: String(seeded.problems[i].answer) }, cookie));
    last = await res.json();
  }
  assert.equal(last.done, true);
  assert.equal(last.score, seeded.problems.length);
  assert.equal(p.readDb().assignments.find((a) => a.id === 'md-2').status, 'done');
});

test('seed data includes all three problem types and some messy display text', () => {
  const problems = p.db.assignments.flatMap((a) => a.problems);
  const types = new Set(problems.map((q) => q.type));
  assert.deepEqual([...types].sort(), ['arithmetic', 'one-step', 'two-step']);
  assert.ok(problems.some((q) => q.messy && q.display !== q.text));
});

test('logout invalidates the session', async () => {
  const cookie = await login();
  await fetch(`${p.base}/logout`, { method: 'POST', headers: { Cookie: cookie }, redirect: 'manual' });
  const res = await fetch(`${p.base}/api/assignments`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 401);
});
