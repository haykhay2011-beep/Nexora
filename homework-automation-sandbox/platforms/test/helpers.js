/**
 * Test helpers: start a platform on a random free port with a throwaway
 * database, so the tests never touch the real data/db.json files.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function startPlatform(name) {
  const { seed } = require(`../${name}/seed`);
  const { createApp } = require(`../${name}/server`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-test-`));
  const dbPath = path.join(dir, 'db.json');
  const db = seed(dbPath);
  const server = createApp({ dbPath }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://localhost:${server.address().port}`;
  return {
    base,
    db,
    dbPath,
    readDb: () => JSON.parse(fs.readFileSync(dbPath, 'utf8')),
    close: () => new Promise((resolve) => server.close(() => { fs.rmSync(dir, { recursive: true, force: true }); resolve(); })),
  };
}

/** Pull "name=value" for one cookie out of a response's Set-Cookie headers. */
function cookieFrom(res, name) {
  const header = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return header ? header.split(';')[0] : null;
}

const form = (obj) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(obj).toString(),
  redirect: 'manual',
});

const json = (obj, cookie) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(obj),
  redirect: 'manual',
});

module.exports = { startPlatform, cookieFrom, form, json };
