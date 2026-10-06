const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startPlatform, cookieFrom, form, json } = require('./helpers');
const { countWords } = require('../writewell/server');

let p;
before(async () => { p = await startPlatform('writewell'); });
after(() => p.close());

async function login() {
  const res = await fetch(`${p.base}/signin`, form({ user: 'student', pass: 'practice123' }));
  assert.equal(res.status, 302);
  return cookieFrom(res, 'ww_session');
}

test('step 1 rejects an unknown username', async () => {
  const res = await fetch(`${p.base}/api/signin/identify`, json({ user: 'nobody' }));
  assert.equal(res.status, 404);
});

test('login with wrong credentials fails and sets no cookie', async () => {
  const res = await fetch(`${p.base}/signin`, form({ user: 'student', pass: 'wrong' }));
  assert.equal(res.status, 401);
  assert.equal(cookieFrom(res, 'ww_session'), null);
});

test('protected API returns 401 without a cookie', async () => {
  assert.equal((await fetch(`${p.base}/api/prompts`)).status, 401);
  assert.equal((await fetch(`${p.base}/api/prompts/ww-1/submit`, json({ text: 'hi' }))).status, 401);
});

test('a response under the minimum word count is rejected with a message', async () => {
  const cookie = await login();
  const res = await fetch(`${p.base}/api/prompts/ww-1/submit`, json({ text: 'A variable stores a value.' }, cookie));
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.submitted, false);
  assert.match(body.error, /at least 30 words/);
});

test('a long-enough response is accepted and returns its word count', async () => {
  const cookie = await login();
  const text = Array.from({ length: 35 }, (_, i) => `word${i}`).join(' ');
  const res = await fetch(`${p.base}/api/prompts/ww-1/submit`, json({ text }, cookie));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { submitted: true, wordCount: 35 });
});

test('countWords ignores extra whitespace', () => {
  assert.equal(countWords('  one   two\nthree\t four  '), 4);
  assert.equal(countWords(''), 0);
});
