import { readFile } from 'node:fs/promises';

const expected = '0.30.1';
const files = {
  build: await readFile('scripts/build-info.js', 'utf8'),
  index: await readFile('index.html', 'utf8'),
  worker: await readFile('service-worker.js', 'utf8')
};

const assertions = [
  [files.build.includes(`BUILD_VERSION = '${expected}'`), 'scripts/build-info.js BUILD_VERSION'],
  [files.index.includes(`app.js?v=${expected}`), 'index app.js version'],
  [files.index.includes(`dice-face-v4.js?v=${expected}`), 'index dice-face-v4 version'],
  [files.index.includes(`dice-premium.js?v=${expected}`), 'index dice-premium version'],
  [files.index.includes(`build-info.js?v=${expected}`), 'index build-info version'],
  [files.worker.includes(`cairn-mobile-sheet-v${expected}`), 'service worker cache version'],
  [files.worker.includes(`app.js?v=${expected}`), 'service worker app.js version'],
  [files.worker.includes(`dice-face-v4.js?v=${expected}`), 'service worker dice-face-v4 version'],
  [files.worker.includes(`dice-premium.js?v=${expected}`), 'service worker dice-premium version'],
  [files.worker.includes(`build-info.js?v=${expected}`), 'service worker build-info version']
];

const failures = assertions.filter(([pass]) => !pass).map(([, label]) => label);
if (failures.length) {
  console.error(`Version ${expected} is not synchronized: ${failures.join(', ')}`);
  process.exit(1);
}

console.log(`Version ${expected} is synchronized across visible build metadata, assets and PWA cache.`);
