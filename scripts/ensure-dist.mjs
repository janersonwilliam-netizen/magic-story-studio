import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = join(root, 'dist', 'index.html');

if (!existsSync(indexHtml)) {
  console.warn('[dev] Pasta dist/ ausente — executando npm run build uma vez...');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
}
