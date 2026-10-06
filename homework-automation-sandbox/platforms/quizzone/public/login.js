// QuizZone sign-in: the form is submitted with fetch() as JSON, not by the browser.
const form = document.getElementById('signin-form');
const flash = form.querySelector('.flash-error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  flash.hidden = true;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: form.email.value.trim(), pw: form.pw.value }),
  });
  const data = await res.json();
  if (res.ok) {
    window.location.href = data.redirect;
  } else {
    flash.textContent = data.error;
    flash.hidden = false;
  }
});
