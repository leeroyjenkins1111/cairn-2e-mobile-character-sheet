import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  rewriteProductionIndex,
  rewriteProductionServiceWorker,
  splitProductionRuntime
} from './build/runtime-layout.mjs';

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
  'scripts/inventory-spacing.js',
  'assets/forest-background.jpg'
];

async function packageVersion() {
  return JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')).version;
}

async function writeProductionRuntime(destinationRoot) {
  const appSource = await readFile(resolve(repositoryRoot, 'scripts/app.js'), 'utf8');
  const { core, bootstrap } = splitProductionRuntime(appSource);
  const scriptsDirectory = resolve(destinationRoot, 'scripts');
  await mkdir(scriptsDirectory, { recursive: true });
  await writeFile(resolve(scriptsDirectory, 'app-core.js'), core);
  await writeFile(resolve(scriptsDirectory, 'app-bootstrap.js'), bootstrap);
}

async function writeProductionIndex(destinationRoot, version) {
  const source = await readFile(resolve(repositoryRoot, 'index.html'), 'utf8');
  await writeFile(resolve(destinationRoot, 'index.html'), rewriteProductionIndex(source, version));
}

async function writeProductionServiceWorker(destinationRoot, version) {
  const source = await readFile(resolve(repositoryRoot, 'service-worker.js'), 'utf8');
  await writeFile(resolve(destinationRoot, 'service-worker.js'), rewriteProductionServiceWorker(source, version));
}

export async function prepareSite(outputDirectory = '_site') {
  const destinationRoot = resolve(repositoryRoot, outputDirectory);
  const version = await packageVersion();
  for (const relativePath of siteFiles) {
    const destination = resolve(destinationRoot, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(repositoryRoot, relativePath), destination);
  }
  await writeProductionRuntime(destinationRoot);
  await writeProductionIndex(destinationRoot, version);
  await writeProductionServiceWorker(destinationRoot, version);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareSite(process.argv[2]);
}
