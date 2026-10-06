// WriteWell editor: live word counter + submit with server-side validation.
const editor = document.querySelector('.editor');
const textarea = document.getElementById('response');
const counter = document.getElementById('word-count');
const errorBox = editor.querySelector('.validation-error');
const confirmation = editor.querySelector('.confirmation');
const submitBtn = document.getElementById('submit-response');

const countWords = (t) => t.trim().split(/\s+/).filter(Boolean).length;
const updateCount = () => { counter.textContent = countWords(textarea.value); };
textarea.addEventListener('input', updateCount);
updateCount();

submitBtn.addEventListener('click', async () => {
  errorBox.hidden = true;
  submitBtn.disabled = true;
  const res = await fetch(`/api/prompts/${editor.dataset.promptId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: textarea.value }),
  });
  const data = await res.json();
  submitBtn.disabled = false;
  if (!res.ok) {
    // Validation failed (e.g. too few words): show the server's message.
    errorBox.textContent = data.error;
    errorBox.hidden = false;
    return;
  }
  textarea.readOnly = true;
  submitBtn.hidden = true;
  confirmation.querySelector('.final-count').textContent = data.wordCount;
  confirmation.hidden = false;
});
