/**
 * store.js: a tiny JSON-file "database" used by each platform.
 *
 * Each platform keeps its assignments (and the correct answers) in
 * platforms/<name>/data/db.json, created by that platform's seed script.
 * Reading and writing a whole JSON file is far too simple for a real site,
 * but it keeps the sandbox dependency-free and easy to inspect by hand.
 */
const fs = require('node:fs');
const path = require('node:path');

function createStore(dbPath) {
  function load() {
    if (!fs.existsSync(dbPath)) {
      throw new Error(`No database at ${dbPath}. Run "npm run seed" first.`);
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  }

  function save(db) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  }

  return { load, save };
}

/** Format a Date as YYYY-MM-DD, offset by a number of days from today. */
function isoDateFromToday(daysFromToday) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

/** Small promise-based delay, used to simulate slow servers. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = { createStore, isoDateFromToday, sleep };
