// Builds the game, then inlines the JS and CSS into one self-contained HTML file.
//   node scripts/build-single.mjs [artifactFragmentPath]
// Output: car-rider.html (full page). With an argument, also writes a body-only
// fragment (title + style + markup + script) for hosts that supply the document shell.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

execSync('npx vite build', { stdio: 'inherit' });
const assets = readdirSync('dist/assets');
const js = readFileSync('dist/assets/' + assets.find((f) => f.endsWith('.js')), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync('dist/assets/' + assets.find((f) => f.endsWith('.css')), 'utf8');
const html = readFileSync('dist/index.html', 'utf8');

const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<link rel="stylesheet"[^>]*>|<script[^>]*><\/script>/g, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(/<script[^>]*><\/script>/g, "");

const full = `<!doctype html>\n<html lang="en">\n<head>${head}<style>${css}</style>\n</head>\n<body>${body}<script type="module">${js}</script>\n</body>\n</html>\n`;
writeFileSync('car-rider.html', full);
console.log('car-rider.html', (full.length / 1024).toFixed(0) + ' KB');

if (process.argv[2]) {
  const title = '<title>Car Rider</title>';
  const frag = `${title}\n<style>${css}</style>\n${body}<script type="module">${js}</script>\n`;
  writeFileSync(process.argv[2], frag);
  console.log(process.argv[2], (frag.length / 1024).toFixed(0) + ' KB');
}
