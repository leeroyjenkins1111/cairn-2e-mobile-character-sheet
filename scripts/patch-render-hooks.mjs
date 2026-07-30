import { readFile, writeFile } from 'node:fs/promises';

async function patch(path, transform) {
  const url = new URL(path, import.meta.url);
  const source = await readFile(url, 'utf8');
  const output = transform(source);
  if (output === source) throw new Error(`Brak oczekiwanej zmiany w ${path}`);
  await writeFile(url, output);
}

await patch('./ux-direct-editing.js', source => source.replace(
  `const renderCharacterViewBase = renderCharacterView;\nrenderCharacterView = function renderCharacterViewWithDirectEditing() {\n  renderCharacterViewBase();\n  enhanceCharacterView();\n};\n\nenhanceCharacterView();`,
  `globalThis.CairnRenderHooks.addCharacterHook(enhanceCharacterView);\nenhanceCharacterView();`
));

await patch('./character-redesign.js', source => source
  .replace('  const originalRenderCharacterView = renderCharacterView;\n', '')
  .replace(
    `  renderCharacterView = function renderCharacterViewRedesigned() {\n    originalRenderCharacterView();\n    enhanceCharacterCopy();\n  };\n\n  renderAll();`,
    `  globalThis.CairnRenderHooks.addCharacterHook(enhanceCharacterCopy);\n  renderAll();`
  ));
