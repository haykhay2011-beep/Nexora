// Shared by every QuizZone page: the "Sign out" button.
// Logging out calls the API (which deletes the session and clears the
// HTTP-only cookie) and then returns to the sign-in page.
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="logout"]');
  if (!btn) return;
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});
