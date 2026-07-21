import fs from 'node:fs';
import crypto from 'node:crypto';

const required = [
  'index.html',
  'manifest.webmanifest',
  'service-worker.js',
  'icon.svg',
  'styles/app.css',
  'styles/editorial.css',
  'scripts/app.js'
];

for (const path of required) {
  if (!fs.existsSync(path)) throw new Error(`Missing published asset: ${path}`);
}

const index = fs.readFileSync('index.html', 'utf8');
const worker = fs.readFileSync('service-worker.js', 'utf8');
if (!index.includes('./styles/editorial.css')) throw new Error('index.html does not load editorial.css');
if (!worker.includes('./styles/editorial.css')) throw new Error('Service Worker does not cache editorial.css');

const lines = required.map(path => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  return `${hash}  ${path}`;
});
fs.writeFileSync('checksums.sha256', `${lines.join('\n')}\n`);
console.log('Editorial visual system assets verified and checksums regenerated.');
