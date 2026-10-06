/**
 * html.js: helpers for building HTML pages on the server.
 */

/** Escape text so it can be safely placed inside HTML. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wrap body markup in a full HTML document. */
function page({ title, css, body, scripts = [] }) {
  const scriptTags = scripts.map((src) => `<script src="${src}"></script>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${css}">
</head>
<body>
${body}
${scriptTags}
</body>
</html>`;
}

module.exports = { escapeHtml, page };
