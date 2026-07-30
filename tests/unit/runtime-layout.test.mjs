import test from 'node:test';
import assert from 'node:assert/strict';
import {
  removeDeveloperHooks,
  rewriteProductionIndex,
  rewriteProductionServiceWorker,
  splitProductionRuntime
} from '../../scripts/build/runtime-layout.mjs';

const divider = '// ============================================================';
const fixture = [
  "'use strict';",
  'function feature() { return 1; }',
  divider,
  '// 18. Developer tests',
  'function runDeveloperTests() { return []; }',
  divider,
  '// 19. Events and initialization',
  'function initialize() {',
  '  globalThis.CairnSheetDev = {',
  '    runTests: runDeveloperTests,',
  '  };',
  "  if (new URLSearchParams(location.search).get('selftest') === '1') {",
  '    const marker = createEl(\'div\', { id: \'selftestMarker\' });',
  '    document.body.append(marker);',
  '  }',
  '}',
  'initialize();'
].join('\n');

test('split oddziela core od bootstrapu i usuwa runner deweloperski', () => {
  const { core, bootstrap } = splitProductionRuntime(fixture);
  assert.match(core, /function feature/);
  assert.doesNotMatch(core, /runDeveloperTests/);
  assert.match(bootstrap, /function initialize/);
  assert.doesNotMatch(bootstrap, /runTests: runDeveloperTests/);
  assert.doesNotMatch(bootstrap, /selftestMarker/);
});

test('split odrzuca źródło bez jawnych granic', () => {
  assert.throws(() => splitProductionRuntime('function initialize() {}'), /stabilnych granic/);
});

test('removeDeveloperHooks nie zmienia zwykłego bootstrapu', () => {
  const source = '\nfunction initialize() { return true; }';
  assert.equal(removeDeveloperHooks(source), source);
});

test('index produkcyjny ładuje core i bootstrap zamiast monolitu', () => {
  const source = '<script src="./scripts/app.js?v=1.2.3"></script>';
  const output = rewriteProductionIndex(source, '1.2.3');
  assert.match(output, /app-core\.js\?v=1\.2\.3/);
  assert.match(output, /app-bootstrap\.js\?v=1\.2\.3/);
  assert.doesNotMatch(output, /scripts\/app\.js/);
});

test('Service Worker buforuje obie części runtime', () => {
  const source = "const APP_SHELL = ['./scripts/app.js?v=1.2.3'];";
  const output = rewriteProductionServiceWorker(source, '1.2.3');
  assert.match(output, /app-core\.js\?v=1\.2\.3/);
  assert.match(output, /app-bootstrap\.js\?v=1\.2\.3/);
});
