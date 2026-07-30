import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const [index, core, bootstrap, worker, directEditing, characterRedesign, renderHooks, diceMotion, diceRenderer] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('scripts/app-core.js', 'utf8'),
  readFile('scripts/app-bootstrap.js', 'utf8'),
  readFile('service-worker.js', 'utf8'),
  readFile('scripts/ux-direct-editing.js', 'utf8'),
  readFile('scripts/character-redesign.js', 'utf8'),
  readFile('scripts/render-hooks.js', 'utf8'),
  readFile('scripts/dice-motion.js', 'utf8'),
  readFile('scripts/dice-renderer.js', 'utf8')
]);

const sourceRuntime = `${core}\n${bootstrap}`;

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
  assert.match(diceRenderer, /CairnDiceRenderer\.register/);
  assert.match(core, /getAdapter\?\.\('finalDieRotation'\)/);
  assert.match(diceRenderer, /finalDieRotation:\s*sides/);
});

test('runtime nie tworzy ani nie wstrzykuje arkuszy CSS', () => {
  const runtime = [core, bootstrap, directEditing, characterRedesign, renderHooks, diceMotion, diceRenderer].join('\n');
  assert.doesNotMatch(runtime, /insertRule|document\.createElement\(['"]style['"]\)|style\.textContent/);
});
