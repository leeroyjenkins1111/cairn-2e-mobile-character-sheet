import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScriptFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

const files = [
  ...(await collectJavaScriptFiles('scripts')),
  'service-worker.js'
].sort();

const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    failures.push({ file, output: result.stderr || result.stdout });
  }
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`\nSyntax check failed: ${failure.file}`);
    console.error(failure.output.trim());
  }
  process.exit(1);
}

console.log(`JavaScript syntax is valid in ${files.length} files.`);
