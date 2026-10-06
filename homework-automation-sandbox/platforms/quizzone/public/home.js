// QuizZone dashboard: fetch quizzes from the API and render cards after 300 ms.
const RENDER_DELAY_MS = 300;
const STATUS_LABELS = { 'not started': 'Not started', 'in progress': 'In progress', done: 'Completed' };
const STATUS_BADGES = { 'not started': 'badge-todo', 'in progress': 'badge-active', done: 'badge-done' };

function prettyDate(iso) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

async function load() {
  const res = await fetch('/api/quizzes');
  if (res.status === 401) { window.location.href = '/login'; return; }
  const quizzes = await res.json();
  setTimeout(() => {
    const list = document.querySelector('.quiz-list');
    for (const quiz of quizzes) {
      const li = document.createElement('li');
      li.className = 'quiz-card';
      li.dataset.quizId = quiz.id;
      li.innerHTML = `
        <h3 class="quiz-title"><a></a></h3>
        <p class="quiz-meta"><time class="quiz-due"></time> &middot; <span class="quiz-count"></span> questions</p>
        <span class="badge"></span>`;
      const a = li.querySelector('a');
      a.href = quiz.url;
      a.textContent = quiz.title;
      const time = li.querySelector('time');
      time.setAttribute('datetime', quiz.dueDate); // machine-readable date
      time.textContent = 'Due ' + prettyDate(quiz.dueDate); // human-readable date
      li.querySelector('.quiz-count').textContent = quiz.questionCount;
      const badge = li.querySelector('.badge');
      badge.classList.add(STATUS_BADGES[quiz.status]);
      badge.textContent = STATUS_LABELS[quiz.status];
      list.appendChild(li);
    }
    document.getElementById('spinner').remove();
  }, RENDER_DELAY_MS);
}

load();
