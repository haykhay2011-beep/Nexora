// WriteWell multi-step sign-in.
// Step 1: type a username and click Continue. We ask the server whether the
// account exists, wait a moment (like a real site), then reveal step 2 with
// the password field. An automation bot can't type the password until the
// field is actually VISIBLE, so it has to wait for step 2.
const CONTINUE_DELAY_MS = 250;

const form = document.getElementById('signin');
const step1 = form.querySelector('.step-1');
const step2 = form.querySelector('.step-2');
const userInput = document.getElementById('ww-user');
const stepError = form.querySelector('.step-error');

async function next() {
  stepError.hidden = true;
  const res = await fetch('/api/signin/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: userInput.value }),
  });
  const data = await res.json();
  if (!res.ok) { stepError.textContent = data.error; stepError.hidden = false; return; }
  setTimeout(() => {
    form.querySelector('.who-name').textContent = data.user;
    step1.hidden = true;
    step2.hidden = false;
    document.getElementById('ww-pass').focus();
  }, CONTINUE_DELAY_MS);
}

document.getElementById('continue-btn').addEventListener('click', next);
// Pressing Enter in the username box should mean "Continue", not "submit the form".
userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } });
