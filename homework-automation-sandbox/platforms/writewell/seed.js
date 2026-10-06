/**
 * WriteWell seed script: writes four free-response prompts to data/db.json.
 *
 * Run:  node platforms/writewell/seed.js   (or `npm run seed`)
 *
 * There is no "correct answer" for these prompts. Success means the response
 * was accepted: it meets the prompt's minimum word count (`minWords`), which
 * the server enforces but the page does NOT show in advance. A too-short
 * response is rejected with a validation message, so the bot has to read
 * that message, lengthen its answer, and try again.
 *
 * The prompts deliberately cover different topics, and ww-4 is a personal
 * reflection that the bot's topic templates don't cover, to show graceful
 * degradation (it still submits, but flags low confidence).
 */
const path = require('node:path');
const { createStore, isoDateFromToday } = require('../shared/store');

const DEFAULT_DB = path.join(__dirname, 'data', 'db.json');

function buildDb() {
  const prompts = [
    {
      id: 'ww-1',
      title: 'What Is a Variable?',
      prompt: 'In 3 to 4 sentences, explain what a variable is in programming.',
      dueDate: isoDateFromToday(2),
      minWords: 30,
    },
    {
      id: 'ww-2',
      title: 'Loops in Everyday Code',
      prompt: 'Describe how a for loop works and give one example of when you would use a loop instead of repeating code.',
      dueDate: isoDateFromToday(5),
      minWords: 45,
    },
    {
      id: 'ww-3',
      title: 'The Water Cycle',
      prompt: 'Explain the main stages of the water cycle and why it matters for life on Earth.',
      dueDate: isoDateFromToday(8),
      minWords: 40,
    },
    {
      id: 'ww-4',
      title: 'Reflection: Your Ideal Weekend',
      prompt: 'Describe your ideal weekend and explain what makes it relaxing for you.',
      dueDate: isoDateFromToday(3),
      minWords: 30,
    },
  ];
  for (const p of prompts) {
    p.status = 'not started';
    p.draft = '';
    p.submission = null;
    p.rejectedAttempts = 0;
  }
  // ww-3 has an unfinished draft saved, so its textarea starts pre-filled.
  // The bot must clear it before typing rather than appending to it.
  prompts[2].status = 'in progress';
  prompts[2].draft = 'The water cycle has a few stages. (draft - finish later)';
  return { prompts };
}

function seed(dbPath = DEFAULT_DB) {
  const db = buildDb();
  createStore(dbPath).save(db);
  return db;
}

if (require.main === module) {
  const db = seed();
  console.log(`WriteWell: seeded ${db.prompts.length} prompts into ${DEFAULT_DB}`);
}

module.exports = { seed, buildDb, DEFAULT_DB };
