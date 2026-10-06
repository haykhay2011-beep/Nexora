// WriteWell dashboard: fetch prompts and render cards after a 300 ms delay.
// While loading, the grid has aria-busy="true"; it flips to "false" when done.
const RENDER_DELAY_MS = 300;
const STATES = {
  'not started': ['Not started', 'state-new'],
  'in progress': ['Draft saved', 'state-draft'],
  done: ['Submitted', 'state-done'],
};

async function load() {
  const res = await fetch('/api/prompts');
  if (res.status === 401) { window.location.href = '/signin'; return; }
  const prompts = await res.json();
  setTimeout(() => {
    const grid = document.querySelector('.prompt-grid');
    grid.innerHTML = '';
    for (const p of prompts) {
      const card = document.createElement('article');
      card.className = 'prompt-card';
      card.dataset.promptId = p.id;
      const [label, cls] = STATES[p.status];
      // Only a human-readable date is shown, e.g. "Due Oct 8, 2026".
      const due = new Date(p.dueDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      card.innerHTML = `
        <h2 class="card-title"></h2>
        <p class="due"></p>
        <span class="state ${cls}"></span>
        <a class="open-link"></a>`;
      card.querySelector('.card-title').textContent = p.title;
      card.querySelector('.due').textContent = 'Due ' + due;
      card.querySelector('.state').textContent = label;
      const link = card.querySelector('.open-link');
      link.href = p.url;
      link.textContent = p.status === 'done' ? 'View submission' : 'Start writing →';
      grid.appendChild(card);
    }
    grid.setAttribute('aria-busy', 'false');
  }, RENDER_DELAY_MS);
}

load();
