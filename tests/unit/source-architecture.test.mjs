import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const designStylePaths = [
  'styles/tokens.css',
  'styles/foundations.css',
  'styles/shell.css',
  'styles/components.css',
  'styles/screens.css',
  'styles/dice.css',
  'styles/atmosphere.css'
];

const [index, core, bootstrap, worker, directEditing, characterRedesign, renderHooks, diceMotion, diceRenderer, appStyles, ...designStyles] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('scripts/app-core.js', 'utf8'),
  readFile('scripts/app-bootstrap.js', 'utf8'),
  readFile('service-worker.js', 'utf8'),
  readFile('scripts/ux-direct-editing.js', 'utf8'),
  readFile('scripts/character-redesign.js', 'utf8'),
  readFile('scripts/render-hooks.js', 'utf8'),
  readFile('scripts/dice-motion.js', 'utf8'),
  readFile('scripts/dice-renderer.js', 'utf8'),
  readFile('styles/app.css', 'utf8'),
  ...designStylePaths.map(path => readFile(path, 'utf8'))
]);

const sourceRuntime = `${core}\n${bootstrap}`;
const designSource = designStyles.join('\n');

test('repozytorium przechowuje fizyczny core i bootstrap', async () => {
  await assert.doesNotReject(() => access('scripts/app-core.js'));
  await assert.doesNotReject(() => access('scripts/app-bootstrap.js'));
  await assert.rejects(() => access('scripts/app.js'));
  assert.match(core, /function openResetSheet/);
  assert.match(bootstrap, /function initialize/);
});

test('dokument i Service Worker używają tego samego runtime', () => {
  assert.match(index, /scripts\/app-core\.js\?v=/);
  assert.match(index, /scripts\/app-bootstrap\.js\?v=/);
  assert.doesNotMatch(index, /scripts\/app\.js\?v=/);
  assert.match(worker, /scripts\/app-core\.js\?v=/);
  assert.match(worker, /scripts\/app-bootstrap\.js\?v=/);
  assert.doesNotMatch(worker, /scripts\/app\.js\?v=/);
});

test('test runner deweloperski nie znajduje się w źródłowym runtime', () => {
  assert.doesNotMatch(sourceRuntime, /function runDeveloperTests/);
  assert.doesNotMatch(sourceRuntime, /runTests:\s*runDeveloperTests/);
  assert.doesNotMatch(sourceRuntime, /selftestMarker/);
  assert.doesNotMatch(sourceRuntime, /Testy deweloperskie/);
});

test('style nie są kopiowane do arkusza w runtime', () => {
  assert.doesNotMatch(directEditing, /insertRule|DIRECT_EDITING_RULES|installDirectEditingStyles/);
  assert.doesNotMatch(characterRedesign, /insertRule|installCharacterRedesignStyles|document\.createElement\(['"]link['"]\)/);
});

test('widok ekwipunku nie jest ponownie opakowywany przez direct editing', () => {
  assert.doesNotMatch(directEditing, /renderInventoryViewBase|renderInventoryViewWithDirectActions|enhanceInventoryActions/);
});

test('runtime inicjalizuje się przez końcowy entrypoint', async () => {
  const entry = await readFile('scripts/app-entry.js', 'utf8');
  assert.doesNotMatch(bootstrap, /initialize\(\);\s*$/);
  assert.match(entry, /initialize\(\);/);
  assert.match(index, /scripts\/app-entry\.js\?v=/);
  assert.match(worker, /scripts\/app-entry\.js\?v=/);
});

test('renderery używają jawnych rejestrów zamiast globalnych nadpisań', () => {
  assert.match(core, /registerRuntimeRenderer/);
  assert.doesNotMatch(renderHooks, /renderCharacterView\s*=/);
  assert.doesNotMatch(characterRedesign, /renderCombatLauncher\s*=/);
  assert.match(characterRedesign, /registerRenderer\('combatLauncher'/);
  assert.match(diceMotion, /CairnDiceRenderer/);
  assert.match(diceMotion, /dataset\.physicalDice = 'true'/);
  assert.match(diceRenderer, /CairnDiceRenderer\.register/);
  assert.match(core, /getAdapter\?\.\('finalDieRotation'\)/);
  assert.match(diceRenderer, /finalDieRotation:\s*sides/);
});

test('runtime nie tworzy ani nie wstrzykuje arkuszy CSS', () => {
  const runtime = [core, bootstrap, directEditing, characterRedesign, renderHooks, diceMotion, diceRenderer].join('\n');
  assert.doesNotMatch(runtime, /insertRule|document\.createElement\(['"]style['"]\)|style\.textContent/);
});

test('Wędrowny Dziennik jest jedynym statycznym systemem CSS', async () => {
  await assert.doesNotReject(() => access('styles/app.css'));
  assert.match(index, /href="\.\/styles\/app\.css"/);
  assert.match(worker, /'\.\/styles\/app\.css'/);
  assert.doesNotMatch(appStyles, /{/);

  for (const path of designStylePaths) {
    const filename = path.split('/').pop();
    await assert.doesNotReject(() => access(path));
    assert.match(appStyles, new RegExp(`\\./${filename.replace('.', '\\.')}\\?v=`));
    assert.match(worker, new RegExp(path.replace('.', '\\.') + '\\?v='));
  }

  for (const legacyPath of [
    'styles/character-redesign.css',
    'styles/screen-unification.css',
    'styles/runtime-overrides.css',
    'styles/dice-runtime.css',
    'scripts/typography-system.js',
    'scripts/inventory-spacing.js'
  ]) {
    await assert.rejects(() => access(legacyPath));
    assert.doesNotMatch(index, new RegExp(legacyPath.replace('.', '\\.')));
    assert.doesNotMatch(worker, new RegExp(legacyPath.replace('.', '\\.')));
  }

  assert.match(designSource, /--color-surface-page/);
  assert.match(designSource, /:root\[data-theme="light"\]/);
  assert.match(designSource, /@media \(forced-colors: active\)/);
  assert.match(designSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(designSource, /The forest illustration is the visual anchor/);
  assert.doesNotMatch(designSource, /--character-(gold|rose|olive|glass)/);
  assert.doesNotMatch(directEditing, /direct-save-shortcut/);
});
