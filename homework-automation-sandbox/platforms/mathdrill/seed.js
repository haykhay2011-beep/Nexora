/**
 * MathDrill seed script: generates arithmetic and algebra problems and writes data/db.json.
 *
 * Run:  node platforms/mathdrill/seed.js   (or `npm run seed` for all platforms)
 *
 * Three problem types (each problem is tagged with its type so you can check
 * that the bot handles all of them):
 *   - "arithmetic"  e.g. "14 * 3" or "6 + 4 * 5" (order of operations!)
 *   - "one-step"    e.g. "x + 9 = 20, solve for x"
 *   - "two-step"    e.g. "3x + 7 = 22, solve for x"
 *
 * Messy input: about 1 in 6 problems is *displayed* with extra whitespace
 * and/or a trailing period, so the bot's parser has to trim and normalize
 * the text instead of assuming a clean string. The stored "text" is always
 * clean; "display" is what the page shows.
 *
 * Problems come from a seeded random number generator, so every seed run
 * produces the same problems (handy for tests and for re-running demos).
 */
const path = require('node:path');
const { createStore, isoDateFromToday } = require('../shared/store');

const DEFAULT_DB = path.join(__dirname, 'data', 'db.json');

/** Deterministic pseudo-random generator (mulberry32). Returns floats in [0, 1). */
function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generator(seed) {
  const rng = makeRng(seed);
  const int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)); // inclusive
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const variables = ['x', 'x', 'x', 'y', 'n', 'k'];

  function arithmetic() {
    if (rng() < 0.3) {
      // Three operands: tests that the bot respects order of operations.
      const a = int(2, 20), b = int(2, 9), c = int(2, 9);
      if (rng() < 0.5) return { text: `${a} + ${b} * ${c}`, answer: a + b * c };
      return { text: `${b} * ${c} - ${a}`, answer: b * c - a };
    }
    const op = pick(['+', '-', '*', '/']);
    if (op === '+') { const a = int(10, 99), b = int(10, 99); return { text: `${a} + ${b}`, answer: a + b }; }
    if (op === '-') { const a = int(30, 99), b = int(2, 29); return { text: `${a} - ${b}`, answer: a - b }; }
    if (op === '*') { const a = int(3, 15), b = int(3, 15); return { text: `${a} * ${b}`, answer: a * b }; }
    const b = int(2, 12), q = int(2, 12); // division that always comes out even
    return { text: `${b * q} / ${b}`, answer: q };
  }

  function oneStep() {
    const v = pick(variables);
    const x = int(-5, 20);
    const form = pick(['add', 'sub', 'mul', 'div']);
    if (form === 'add') { const b = int(2, 30); return { text: `${v} + ${b} = ${x + b}, solve for ${v}`, answer: x }; }
    if (form === 'sub') { const b = int(2, 30); return { text: `${v} - ${b} = ${x - b}, solve for ${v}`, answer: x }; }
    if (form === 'mul') { const a = int(2, 9); return { text: `${a}${v} = ${a * x}, solve for ${v}`, answer: x }; }
    const a = int(2, 6); const y = int(2, 12); // v / a = y  ->  v = a*y
    return { text: `${v} / ${a} = ${y}, solve for ${v}`, answer: a * y };
  }

  function twoStep() {
    const v = pick(variables);
    const a = int(2, 9), x = int(-4, 12), b = int(1, 25);
    if (rng() < 0.5) return { text: `${a}${v} + ${b} = ${a * x + b}, solve for ${v}`, answer: x };
    return { text: `${a}${v} - ${b} = ${a * x - b}, solve for ${v}`, answer: x };
  }

  /** Make the displayed text "messy": extra spaces and/or a trailing period. */
  function messify(text) {
    const style = int(0, 2);
    const spaced = '  ' + text.replace(/ /g, '   ') + '   ';
    if (style === 0) return spaced;
    if (style === 1) return text + '.';
    return spaced.trimEnd() + '.  ';
  }

  function problem(type) {
    const p = type === 'arithmetic' ? arithmetic() : type === 'one-step' ? oneStep() : twoStep();
    const messy = rng() < 1 / 6;
    return {
      type,
      text: p.text,
      display: messy ? messify(p.text) : p.text,
      messy,
      answer: p.answer,
      submitted: null, // what the student typed
      correct: null,   // whether it was right
    };
  }

  /** Build a set of `count` problems cycling through the requested types. */
  function problemSet(count, types) {
    const list = [];
    for (let i = 0; i < count; i++) list.push(problem(types[i % types.length]));
    return list;
  }

  return { problemSet };
}

function buildDb(seed = 2026) {
  const gen = generator(seed);
  const all = ['arithmetic', 'one-step', 'two-step'];
  const assignments = [
    { id: 'md-1', title: 'Warm-up: Mental Arithmetic', dueDate: isoDateFromToday(1), problems: gen.problemSet(6, ['arithmetic']) },
    { id: 'md-2', title: 'One-Step Equations', dueDate: isoDateFromToday(4), problems: gen.problemSet(7, ['one-step', 'one-step', 'arithmetic']) },
    { id: 'md-3', title: 'Two-Step Equations Challenge', dueDate: isoDateFromToday(9), problems: gen.problemSet(8, ['two-step', 'one-step', 'two-step']) },
    { id: 'md-4', title: 'Mixed Review (started last week)', dueDate: isoDateFromToday(2), problems: gen.problemSet(10, all) },
  ];
  for (const a of assignments) {
    a.status = 'not started';
    a.currentIndex = 0;
  }
  // md-4 is already "in progress": the first two problems were answered earlier,
  // so the page resumes at problem 3. The bot must read where it is instead of
  // assuming every assignment starts at problem 1.
  const md4 = assignments[3];
  md4.status = 'in progress';
  for (let i = 0; i < 2; i++) {
    md4.problems[i].submitted = String(md4.problems[i].answer);
    md4.problems[i].correct = true;
  }
  md4.currentIndex = 2;
  return { assignments };
}

function seed(dbPath = DEFAULT_DB) {
  const db = buildDb();
  createStore(dbPath).save(db);
  return db;
}

if (require.main === module) {
  const db = seed();
  const count = db.assignments.reduce((n, a) => n + a.problems.length, 0);
  console.log(`MathDrill: seeded ${db.assignments.length} assignments (${count} problems) into ${DEFAULT_DB}`);
}

module.exports = { seed, buildDb, DEFAULT_DB };
