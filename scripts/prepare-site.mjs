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
  'styles/tokens.css',
  'styles/foundations.css',
  'styles/shell.css',
  'styles/components.css',
  'styles/screens.css',
  'styles/dice.css',
  'styles/dice-screen.css',
  'styles/dice-roll-fixes.css',
  'styles/dice-experience.css',
  'styles/atmosphere.css',
  'styles/combat.css',
  'styles/inventory.css',
  'styles/journal.css',
  'styles/journal-framing.css',
  'scripts/app-core.js',
  'scripts/app-bootstrap.js',
  'scripts/app-entry.js',
  'scripts/app-config.js',
  'scripts/render-hooks.js',
  'scripts/dice-motion.js',
  'scripts/dice-renderer.js',
  'scripts/dice-roll-fixes.js',
  'scripts/dice-experience.js',
  'scripts/inventory-domain.js',
  'scripts/inventory-view.js',
  'scripts/ux-direct-editing.js',
  'scripts/character-redesign.js',
  'scripts/journal-redesign.js',
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
