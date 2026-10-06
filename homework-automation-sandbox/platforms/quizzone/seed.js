/**
 * QuizZone seed script: writes four multiple-choice quizzes to data/db.json.
 *
 * Run:  node platforms/quizzone/seed.js   (or `npm run seed`)
 *
 * Each quiz has 5 questions with 4 options. `correctIndex` is the index of the
 * right option in the ORIGINAL options array; the page shuffles the options
 * every time it loads, so the position on screen tells the bot nothing.
 *
 * One question per quiz is marked `review: true`. The server still grades it,
 * but the test-only answer source (/debug/answers) leaves it out, so the bot
 * has no key for it and must fall back to a documented guessing strategy.
 */
const path = require('node:path');
const { createStore, isoDateFromToday } = require('../shared/store');

const DEFAULT_DB = path.join(__dirname, 'data', 'db.json');

// Helper: q(id, text, [options...], correctIndex, review?)
const q = (id, text, options, correctIndex, review = false) => ({ id, text, options, correctIndex, review });

function buildDb() {
  const quizzes = [
    {
      id: 'qz-1',
      title: 'Java Basics Quiz',
      dueDate: isoDateFromToday(3),
      questions: [
        q('q1', 'Which keyword creates a new object in Java?', ['new', 'make', 'create', 'object'], 0),
        q('q2', 'What is the index of the first element in a Java array?', ['1', '0', '-1', 'It depends on the array'], 1),
        q('q3', 'Which primitive type stores true or false?', ['int', 'String', 'boolean', 'char'], 2),
        q('q4', 'What does the statement x++ do?', ['Doubles x', 'Sets x to 0', 'Prints x', 'Adds 1 to x'], 3),
        q('q5', 'Which loop is guaranteed to run its body at least once?', ['for loop', 'do-while loop', 'while loop', 'enhanced for loop'], 1, true),
      ],
    },
    {
      id: 'qz-2',
      title: 'World Geography',
      dueDate: isoDateFromToday(6),
      questions: [
        q('q1', 'What is the largest ocean on Earth?', ['Atlantic', 'Indian', 'Pacific', 'Arctic'], 2),
        q('q2', 'On which continent is Egypt located?', ['Asia', 'Africa', 'Europe', 'South America'], 1),
        q('q3', 'What is the capital of Canada?', ['Toronto', 'Vancouver', 'Montreal', 'Ottawa'], 3),
        q('q4', 'How many continents are there?', ['7', '5', '6', '8'], 0),
        q('q5', 'Which country spans the most time zones (including overseas territories)?', ['Russia', 'United States', 'France', 'China'], 2, true),
      ],
    },
    {
      id: 'qz-3',
      title: 'Cell Biology Check',
      dueDate: isoDateFromToday(1),
      questions: [
        q('q1', 'Which organelle is known as the powerhouse of the cell?', ['Nucleus', 'Mitochondria', 'Ribosome', 'Cell wall'], 1),
        q('q2', 'Which molecule carries genetic information?', ['ATP', 'Glucose', 'DNA', 'Water'], 2),
        q('q3', 'How do plants make their own food?', ['Photosynthesis', 'Respiration', 'Digestion', 'Fermentation'], 0),
        q('q4', 'Which structure controls what enters and leaves a cell?', ['Chloroplast', 'Vacuole', 'Golgi apparatus', 'Cell membrane'], 3),
        q('q5', 'Approximately how many cells are in the human body?', ['About 1 million', 'About 500 billion', 'About 37 trillion', 'About 10 thousand'], 2, true),
      ],
    },
    {
      id: 'qz-4',
      title: 'Computer Science History',
      dueDate: isoDateFromToday(12),
      questions: [
        q('q1', 'Who is often called the first computer programmer?', ['Alan Turing', 'Ada Lovelace', 'Grace Hopper', 'Charles Babbage'], 1),
        q('q2', 'What does CPU stand for?', ['Computer Personal Unit', 'Central Program Utility', 'Central Processing Unit', 'Core Processing Unit'], 2),
        q('q3', 'Which company originally created Java?', ['Microsoft', 'Sun Microsystems', 'Apple', 'IBM'], 1),
        q('q4', 'Which digits does the binary number system use?', ['0 and 1', '1 and 2', '0 through 9', 'A through F'], 0),
        q('q5', 'Grace Hopper popularized which word for a computer error?', ['glitch', 'crash', 'fault', 'bug'], 3, true),
      ],
    },
  ];
  for (const quiz of quizzes) {
    quiz.status = 'not started';
    quiz.lastResult = null;
  }
  return { quizzes };
}

function seed(dbPath = DEFAULT_DB) {
  const db = buildDb();
  createStore(dbPath).save(db);
  return db;
}

if (require.main === module) {
  const db = seed();
  console.log(`QuizZone: seeded ${db.quizzes.length} quizzes into ${DEFAULT_DB}`);
}

module.exports = { seed, buildDb, DEFAULT_DB };
