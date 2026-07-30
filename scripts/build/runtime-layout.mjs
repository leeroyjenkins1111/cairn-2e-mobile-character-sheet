const DEVELOPER_SECTION = '// ============================================================\n// 18. Developer tests';
const BOOTSTRAP_SECTION = '// ============================================================\n// 19. Events and initialization';

export function removeDeveloperHooks(source) {
  return source
    .replace(/\n  if \(isDeveloperMode\(\)\) \{[\s\S]*?\n  \}\n  body\.append\(settingsSection\('Aplikacja'/, "\n  body.append(settingsSection('Aplikacja'")
    .replace(/\n    runTests: runDeveloperTests,/, '')
    .replace(/\n  if \(new URLSearchParams\(location\.search\)\.get\('selftest'\) === '1'\) \{[\s\S]*?\n  \}/, '');
}

export function splitProductionRuntime(source) {
  const developerStart = source.indexOf(DEVELOPER_SECTION);
  const bootstrapStart = source.indexOf(BOOTSTRAP_SECTION);
  if (developerStart < 0 || bootstrapStart < 0 || developerStart >= bootstrapStart) {
    throw new Error('Nie znaleziono stabilnych granic sekcji app.js.');
  }

  const core = `${source.slice(0, developerStart).trimEnd()}\n`;
  const bootstrap = `'use strict';\n\n${removeDeveloperHooks(source.slice(bootstrapStart)).trimStart()}`;
  return { core, bootstrap };
}

export function rewriteProductionIndex(source, version) {
  const appTag = `<script src="./scripts/app.js?v=${version}"></script>`;
  const replacement = [
    `<script src="./scripts/app-core.js?v=${version}"></script>`,
    `<script src="./scripts/app-bootstrap.js?v=${version}"></script>`
  ].join('\n  ');
  if (!source.includes(appTag)) throw new Error('index.html nie zawiera oczekiwanego wpisu app.js.');
  return source.replace(appTag, replacement);
}

export function rewriteProductionServiceWorker(source, version) {
  const appAsset = `'./scripts/app.js?v=${version}'`;
  const replacement = `'./scripts/app-core.js?v=${version}', './scripts/app-bootstrap.js?v=${version}'`;
  if (!source.includes(appAsset)) throw new Error('Service Worker nie zawiera oczekiwanego wpisu app.js.');
  return source.replace(appAsset, replacement);
}
