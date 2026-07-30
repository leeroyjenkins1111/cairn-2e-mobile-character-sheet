import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('./app-core.js', import.meta.url);
const source = await readFile(path, 'utf8');
const expected = "const APP_VERSION = '0.23.0';";
const replacement = "const APP_VERSION = globalThis.CAIRN_APP_CONFIG?.version || '0.30.1';";
if (!source.includes(expected)) throw new Error('Nie znaleziono starej stałej APP_VERSION.');
await writeFile(path, source.replace(expected, replacement));
