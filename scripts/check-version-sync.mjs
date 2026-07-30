import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const expected = packageJson.version;
const files = {
  config: await readFile('scripts/app-config.js', 'utf8'),
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
  [files.config.includes(`const VERSION = '${expected}'`), 'scripts/app-config.js VERSION'],
  [files.worker.includes(`cairn-mobile-sheet-v${expected}`), 'service worker cache version'],
  [mismatchedAssets.length === 0, `index asset versions: ${mismatchedAssets.join(', ') || 'ok'}`],
  ...versionedAssets.map(({ asset }) => [files.worker.includes(`'./${asset.replace(/^\.\//, '')}'`), `service worker asset ${asset}`])
];

const failures = assertions.filter(([pass]) => !pass).map(([, label]) => label);
if (failures.length) {
  console.error(`Version ${expected} is not synchronized: ${failures.join(', ')}`);
  process.exit(1);
}

console.log(`Version ${expected} from package.json is synchronized across runtime config, versioned assets and the PWA cache.`);
