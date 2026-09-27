// Builds dist/armguesser.html: one self-contained page for publishing as a claude.ai artifact.
// Run: node armguesser/artifact/build.js
const fs = require('fs');
const path = require('path');
const here = (...p) => path.join(__dirname, ...p);
const read = (p) => fs.readFileSync(p, 'utf8');

// Guard against "</script>" or "</style>" inside inlined sources ending a tag early.
const safe = (s, tag) => s.replace(new RegExp('</' + tag, 'gi'), '<\\/' + tag);

const parts = {
  '/*LEAFLET_CSS*/': safe(read(here('vendor', 'leaflet-1.9.4.css')), 'style'),
  '/*STYLES*/': safe(read(here('src', 'styles.css')), 'style'),
  '/*GEO*/': read(here('src', 'geo.json')).trim(),
  '/*LOCATIONS*/': safe(read(here('..', 'js', 'locations.js')), 'script'),
  '/*CORE*/': safe(read(here('..', 'js', 'core.js')), 'script'),
  '/*APP*/': safe(read(here('src', 'app.js')), 'script')
};

let html = read(here('src', 'template.html'));
for (const [marker, content] of Object.entries(parts)) {
  if (!html.includes(marker)) throw new Error('missing marker ' + marker);
  html = html.split(marker).join(content);
}
fs.mkdirSync(here('dist'), { recursive: true });
fs.writeFileSync(here('dist', 'armguesser.html'), html);
console.log('wrote dist/armguesser.html', (html.length / 1024).toFixed(1) + ' KB');
