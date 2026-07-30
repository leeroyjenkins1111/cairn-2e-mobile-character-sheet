import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const siteFiles = [
  'index.html',
  '.nojekyll',
  'manifest.webmanifest',
  'service-worker.js',
  'icon.svg',
  'styles/app.css',
  'styles/character-redesign.css',
  'styles/screen-unification.css',
  'scripts/app.js',
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

export async function prepareSite(outputDirectory = '_site') {
  const destinationRoot = resolve(repositoryRoot, outputDirectory);
  for (const relativePath of siteFiles) {
    const destination = resolve(destinationRoot, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(repositoryRoot, relativePath), destination);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareSite(process.argv[2]);
}
