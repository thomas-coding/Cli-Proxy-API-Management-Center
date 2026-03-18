import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const sourcePath = path.join(distDir, 'index.html');
const targetPath = path.join(distDir, 'management.html');
const checksumPath = `${targetPath}.sha256`;

async function main() {
  await mkdir(distDir, { recursive: true });

  const html = await readFile(sourcePath);
  await writeFile(targetPath, html);

  const checksum = createHash('sha256').update(html).digest('hex');
  await writeFile(checksumPath, `${checksum}  management.html\n`, 'utf8');

  console.log(`Prepared ${path.relative(rootDir, targetPath)}`);
  console.log(`SHA256 ${checksum}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
