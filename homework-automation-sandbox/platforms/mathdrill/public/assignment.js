// MathDrill assignment page: shows one problem at a time.
//
// Flow: load current problem -> student types an answer -> Next -> the answer
// is POSTed to the server -> after a 200 ms "loading" pause the next problem
// appears. On the last problem the Next button is replaced by Submit, and when
// it's done the results panel shows the score.
const NEXT_PROBLEM_DELAY_MS = 200;

const section = document.querySelector('.drill');
const assignmentId = section.dataset.assignmentId;
const loading = document.getElementById('loading');
const area = document.getElementById('problem-area');
const problemDiv = area.querySelector('.problem');
const input = area.querySelector('input[name="answer"]');
const nextBtn = document.getElementById('next-btn');
const submitBtn = document.getElementById('submit-btn');
const errorText = document.getElementById('error-text');
const progress = document.getElementById('progress');
const resultsPanel = document.getElementById('results');

let currentIndex = null;

function showResults(r) {
  area.hidden = true;
  loading.hidden = true;
  progress.textContent = 'Finished';
  document.getElementById('score').textContent = r.score;
  document.getElementById('total').textContent = r.total;
  const tbody = resultsPanel.querySelector('tbody');
  tbody.innerHTML = '';
  for (const [type, t] of Object.entries(r.byType)) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="type"></td><td class="type-score"></td>`;
    tr.querySelector('.type').textContent = type;
    tr.querySelector('.type-score').textContent = `${t.correct} / ${t.total}`;
    tbody.appendChild(tr);
  }
  resultsPanel.hidden = false;
}

async function loadCurrent() {
  // Hide the old problem and show "Loading..." for a moment.
  area.hidden = true;
  loading.hidden = false;
  await new Promise((r) => setTimeout(r, NEXT_PROBLEM_DELAY_MS));

  const res = await fetch(`/api/assignments/${assignmentId}/current`);
  if (res.status === 401) { window.location.href = '/login'; return; }
  const data = await res.json();
  if (data.done) { showResults(data); return; }

  currentIndex = data.index;
  progress.textContent = `Problem ${data.index + 1} of ${data.total}`;
  problemDiv.textContent = data.text;
  problemDiv.dataset.index = data.index; // lets a test (or bot) tell problems apart
  input.value = '';
  errorText.textContent = '';
  nextBtn.hidden = data.isLast;
  submitBtn.hidden = !data.isLast;
  loading.hidden = true;
  area.hidden = false;
  input.focus();
}

async function sendAnswer() {
  const res = await fetch(`/api/assignments/${assignmentId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index: currentIndex, answer: input.value }),
  });
  const data = await res.json();
  if (!res.ok) { errorText.textContent = data.error || 'Something went wrong.'; return; }
  if (data.done) {
    area.hidden = true;
    loading.hidden = false;
    setTimeout(() => showResults(data), NEXT_PROBLEM_DELAY_MS);
  } else {
    loadCurrent();
  }
}

nextBtn.addEventListener('click', sendAnswer);
submitBtn.addEventListener('click', sendAnswer);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendAnswer(); });

loadCurrent();
