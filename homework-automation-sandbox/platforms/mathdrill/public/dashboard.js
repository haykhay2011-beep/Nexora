// MathDrill dashboard: the assignment list is NOT in the initial HTML.
// We fetch it from /api/assignments and render it after an artificial 300 ms
// delay, like a real single-page app. An automation bot therefore has to
// WAIT for the rows to appear instead of reading them straight away.
const RENDER_DELAY_MS = 300;

async function loadAssignments() {
  const table = document.getElementById('assignment-table');
  if (!table) return;
  const res = await fetch('/api/assignments');
  if (res.status === 401) { window.location.href = '/login'; return; }
  const assignments = await res.json();

  setTimeout(() => {
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';
    for (const a of assignments) {
      const tr = document.createElement('tr');
      tr.className = 'assignment-row';
      tr.dataset.id = a.id;
      const statusClass = 'status-' + a.status.replace(/\s+/g, '-');
      tr.innerHTML = `
        <td class="title"><a href="${a.url}"></a></td>
        <td class="due"></td>
        <td class="count"></td>
        <td class="status"><span class="status-pill ${statusClass}"></span></td>`;
      tr.querySelector('.title a').textContent = a.title;
      tr.querySelector('.due').textContent = a.dueDate; // ISO format, e.g. 2026-10-08
      tr.querySelector('.count').textContent = a.problemCount;
      tr.querySelector('.status-pill').textContent = a.status;
      tbody.appendChild(tr);
    }
    document.getElementById('loading-msg').hidden = true;
    table.hidden = false;
  }, RENDER_DELAY_MS);
}

loadAssignments();
