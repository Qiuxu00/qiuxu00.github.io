import { readFile, mkdir, writeFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderSite } from '../src/render.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export async function build() {
  const site = JSON.parse(await readFile(path.join(root, 'data/site.json'), 'utf8'));
  const html = renderSite(site);
  const out = path.join(root, 'dist');
  await mkdir(out, { recursive: true });
  await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });
  await cp(path.join(root, 'admin'), path.join(out, 'admin'), { recursive: true });
  await writeFile(path.join(out, 'index.html'), html, 'utf8');
  await writeFile(path.join(out, '.nojekyll'), '');
  return out;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
  console.log('Built dist/index.html and the admin interface.');
}
