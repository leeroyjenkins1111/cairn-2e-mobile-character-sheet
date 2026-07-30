import { readFile, writeFile } from 'node:fs/promises';
import { splitProductionRuntime } from './build/runtime-layout.mjs';

const source = await readFile(new URL('./app.js', import.meta.url), 'utf8');
const { core, bootstrap } = splitProductionRuntime(source);
await writeFile(new URL('./app-core.js', import.meta.url), core);
await writeFile(new URL('./app-bootstrap.js', import.meta.url), bootstrap);
console.log('Materialized scripts/app-core.js and scripts/app-bootstrap.js');
