// QuizZone quiz page: collect all radio answers and submit them in one request.
const form = document.getElementById('quiz-form');
const flash = form.querySelector('.flash-error');
const panel = document.getElementById('quiz-result');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  flash.hidden = true;
  const answers = {};
  for (const fs of form.querySelectorAll('fieldset.question')) {
    const checked = fs.querySelector('input[type="radio"]:checked');
    answers[fs.dataset.qid] = checked ? checked.value : '';
  }
  const res = await fetch(`/api/quizzes/${form.dataset.quizId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  const data = await res.json();
  if (!res.ok) { flash.textContent = data.error; flash.hidden = false; return; }

  // Show the score, a per-question breakdown, and the raw JSON response.
  form.hidden = true;
  panel.querySelector('.score-value').textContent = `${data.score}/${data.total}`;
  const ol = panel.querySelector('.breakdown');
  for (const item of data.breakdown) {
    const li = document.createElement('li');
    li.dataset.qid = item.questionId;
    li.className = item.correct ? 'correct' : 'incorrect';
    li.textContent = `${item.questionId}: ${item.correct ? 'Correct' : 'Incorrect'}`;
    ol.appendChild(li);
  }
  document.getElementById('result-json').textContent = JSON.stringify(data, null, 2);
  panel.hidden = false;
});
