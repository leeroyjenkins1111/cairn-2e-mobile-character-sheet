import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const expected = packageJson.version;
const files = {
  build: await readFile('scripts/build-info.js', 'utf8'),
  index: await readFile('index.html', 'utf8'),
  worker: await readFile('service-worker.js', 'utf8')
};

const versionedAssets = [...files.index.matchAll(/(?:src|href)="([^"]+\?v=([^"]+))"/g)]
  .map(([, asset, version]) => ({ asset, version }));

const mismatchedAssets = versionedAssets
  .filter(({ version }) => version !== expected)
  .map(({ asset }) => asset);

const assertions = [
  [typeof expected === 'string' && /^\d+\.\d+\.\d+$/.test(expected), 'package.json semantic version'],
  [files.build.includes(`BUILD_VERSION = '${expected}'`), 'scripts/build-info.js BUILD_VERSION'],
  [files.worker.includes(`cairn-mobile-sheet-v${expected}`), 'service worker cache version'],
  [mismatchedAssets.length === 0, `index asset versions: ${mismatchedAssets.join(', ') || 'ok'}`],
  ...versionedAssets.map(({ asset }) => [files.worker.includes(`'./${asset.replace(/^\.\//, '')}'`), `service worker asset ${asset}`])
];

const failures = assertions.filter(([pass]) => !pass).map(([, label]) => label);
if (failures.length) {
  console.error(`Version ${expected} is not synchronized: ${failures.join(', ')}`);
  process.exit(1);
}

console.log(`Version ${expected} from package.json is synchronized across build metadata, versioned assets and the PWA cache.`);
