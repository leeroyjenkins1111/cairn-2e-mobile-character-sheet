import { readFile } from 'node:fs/promises';

const [index, core, bootstrap, worker] = await Promise.all([
  readFile('_site/index.html', 'utf8'),
  readFile('_site/scripts/app-core.js', 'utf8'),
  readFile('_site/scripts/app-bootstrap.js', 'utf8'),
  readFile('_site/service-worker.js', 'utf8')
]);

const productionSource = `${core}\n${bootstrap}`;
const assertions = [
  [index.includes('scripts/app-core.js?v='), 'index loads app-core.js'],
  [index.includes('scripts/app-bootstrap.js?v='), 'index loads app-bootstrap.js'],
  [!index.includes('scripts/app.js?v='), 'index no longer loads monolithic app.js'],
  [worker.includes('scripts/app-core.js?v='), 'service worker caches app-core.js'],
  [worker.includes('scripts/app-bootstrap.js?v='), 'service worker caches app-bootstrap.js'],
  [index.includes('scripts/app-entry.js?v='), 'index loads app-entry.js'],
  [worker.includes('scripts/app-entry.js?v='), 'service worker caches app-entry.js'],
  [!bootstrap.trimEnd().endsWith('initialize();'), 'bootstrap does not initialize itself'],
  [!productionSource.includes('function runDeveloperTests'), 'developer test runner excluded'],
  [!productionSource.includes('runTests: runDeveloperTests'), 'developer API hook excluded'],
  [!productionSource.includes('selftestMarker'), 'self-test DOM hook excluded'],
  [!productionSource.includes('Testy deweloperskie'), 'developer settings row excluded'],
  [!productionSource.includes('renderCharacterView = function'), 'character renderer is not monkey patched'],
  [!productionSource.includes("document.createElement('style')"), 'runtime does not create style elements'],
  [!productionSource.includes('insertRule'), 'runtime does not insert CSS rules'],
  [core.includes('function openResetSheet'), 'core retains application features'],
  [bootstrap.includes('function initialize'), 'bootstrap retains initialization']
];

const failures = assertions.filter(([pass]) => !pass).map(([, label]) => label);
if (failures.length) {
  console.error(`Production runtime validation failed: ${failures.join(', ')}`);
  process.exit(1);
}

console.log('Production runtime is split and does not contain the embedded developer test runner.');
