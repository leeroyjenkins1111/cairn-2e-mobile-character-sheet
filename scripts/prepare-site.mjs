import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const siteFiles = [
  '.nojekyll',
  'manifest.webmanifest',
  'icon.svg',
  'styles/app.css',
  'styles/character-redesign.css',
  'styles/screen-unification.css',
  'styles/runtime-overrides.css',
  'scripts/app-config.js',
  'scripts/dice-motion.js',
  'scripts/dice-feedback.js',
  'scripts/dice-renderer.js',
  'scripts/inventory-view.js',
  'scripts/ux-direct-editing.js',
  'scripts/typography-system.js',
  'scripts/character-redesign.js',
  'scripts/screen-unification.js',
  'scripts/inventory-spacing.js',
  'assets/forest-background.jpg'
];

const DEVELOPER_SECTION = '// ============================================================\n// 18. Developer tests';
const BOOTSTRAP_SECTION = '// ============================================================\n// 19. Events and initialization';

function removeDeveloperHooks(source) {
  return source
    .replace(/\n  if \(isDeveloperMode\(\)\) \{[\s\S]*?\n  \}\n  body\.append\(settingsSection\('Aplikacja'/, "\n  body.append(settingsSection('Aplikacja'")
    .replace(/\n    runTests: runDeveloperTests,/, '')
    .replace(/\n  if \(new URLSearchParams\(location\.search\)\.get\('selftest'\) === '1'\) \{[\s\S]*?\n  \}/, '');
}

function splitProductionRuntime(source) {
  const developerStart = source.indexOf(DEVELOPER_SECTION);
  const bootstrapStart = source.indexOf(BOOTSTRAP_SECTION);
  if (developerStart < 0 || bootstrapStart < 0 || developerStart >= bootstrapStart) {
    throw new Error('Nie znaleziono stabilnych granic sekcji app.js.');
  }

  const core = `${source.slice(0, developerStart).trimEnd()}\n`;
  const bootstrap = `'use strict';\n\n${removeDeveloperHooks(source.slice(bootstrapStart)).trimStart()}`;
  return { core, bootstrap };
}

async function writeProductionRuntime(destinationRoot) {
  const appSource = await readFile(resolve(repositoryRoot, 'scripts/app.js'), 'utf8');
  const { core, bootstrap } = splitProductionRuntime(appSource);
  const scriptsDirectory = resolve(destinationRoot, 'scripts');
  await mkdir(scriptsDirectory, { recursive: true });
  await writeFile(resolve(scriptsDirectory, 'app-core.js'), core);
  await writeFile(resolve(scriptsDirectory, 'app-bootstrap.js'), bootstrap);
}

async function writeProductionIndex(destinationRoot) {
  const packageJson = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8'));
  const version = packageJson.version;
  const source = await readFile(resolve(repositoryRoot, 'index.html'), 'utf8');
  const appTag = `<script src="./scripts/app.js?v=${version}"></script>`;
  const replacement = [
    `<script src="./scripts/app-core.js?v=${version}"></script>`,
    `<script src="./scripts/app-bootstrap.js?v=${version}"></script>`
  ].join('\n  ');
  if (!source.includes(appTag)) throw new Error('index.html nie zawiera oczekiwanego wpisu app.js.');
  await writeFile(resolve(destinationRoot, 'index.html'), source.replace(appTag, replacement));
}

async function writeProductionServiceWorker(destinationRoot) {
  const packageJson = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8'));
  const version = packageJson.version;
  const source = await readFile(resolve(repositoryRoot, 'service-worker.js'), 'utf8');
  const appAsset = `'./scripts/app.js?v=${version}'`;
  const replacement = `'./scripts/app-core.js?v=${version}', './scripts/app-bootstrap.js?v=${version}'`;
  if (!source.includes(appAsset)) throw new Error('Service Worker nie zawiera oczekiwanego wpisu app.js.');
  await writeFile(resolve(destinationRoot, 'service-worker.js'), source.replace(appAsset, replacement));
}

export async function prepareSite(outputDirectory = '_site') {
  const destinationRoot = resolve(repositoryRoot, outputDirectory);
  for (const relativePath of siteFiles) {
    const destination = resolve(destinationRoot, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(repositoryRoot, relativePath), destination);
  }
  await writeProductionRuntime(destinationRoot);
  await writeProductionIndex(destinationRoot);
  await writeProductionServiceWorker(destinationRoot);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareSite(process.argv[2]);
}
