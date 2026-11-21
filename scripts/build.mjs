import { readFile, mkdir, writeFile, cp, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderSite, safeURL } from '../src/render.mjs';
import { optimizePhoto } from './optimize-photo.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));

async function assetVersion(html, sourceRoot) {
  const hash = createHash('sha256').update(html);
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(filename);
      else if (/\.(?:mjs|js|css|html|json)$/.test(entry.name)) hash.update(path.relative(sourceRoot, filename).replaceAll('\\', '/')).update((await readFile(filename, 'utf8')).replace(/\r\n/g, '\n'));
    }
  }
  for (const folder of ['src', 'admin', 'assets']) await visit(path.join(sourceRoot, folder));
  return hash.digest('hex').slice(0, 12);
}

const stampHTML = (html, version) => html.replace(/((?:src|href)=")([^"?]+\.(?:css|js))"/g, `$1$2?v=${version}"`);
const stampModules = (source, version) => source.replace(/(['"])(\.\/[^'"?]+\.mjs)\1/g, `$1$2?v=${version}$1`);

export async function build({ sourceRoot = root, outputDir = path.join(sourceRoot, 'dist') } = {}) {
  const root = path.resolve(sourceRoot);
  const out = path.resolve(outputDir);
  const site = JSON.parse(await readFile(path.join(root, 'data/site.json'), 'utf8'));
  const appearance = JSON.parse(await readFile(path.join(root, 'data/appearance.json'), 'utf8'));
  const photoPath = safeURL(site.photo, { image: true });
  let photoVersion = '';
  let photoBytes;
  if (photoPath.startsWith('assets/')) {
    const photoFile = path.resolve(root, ...photoPath.split('/').map(part => decodeURIComponent(part)));
    const assetRelativePath = path.relative(path.join(root, 'assets'), photoFile);
    if (!assetRelativePath || assetRelativePath === '..' || assetRelativePath.startsWith(`..${path.sep}`) || path.isAbsolute(assetRelativePath)) throw new Error('Photo must stay inside assets/.');
    photoBytes = await readFile(photoFile);
    photoVersion = createHash('sha256').update(photoBytes).digest('hex').slice(0, 12);
  }
  await mkdir(out, { recursive: true });
  await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });
  const photoVariants = photoBytes ? await optimizePhoto(photoBytes, out) : null;
  const html = renderSite(site, { appearance: appearance.settings, photoVersion, photoVariants });
  const version = await assetVersion(html, root);
  await cp(path.join(root, 'admin'), path.join(out, 'admin'), { recursive: true });
  for (const module of ['render.mjs', 'preview.mjs', 'appearance.mjs', 'richtext.mjs', 'content.mjs']) {
    await writeFile(path.join(out, 'admin', module), stampModules(await readFile(path.join(root, 'src', module), 'utf8'), version));
  }
  for (const module of ['appearance-widget.mjs', 'richtext-widget.mjs']) {
    await writeFile(path.join(out, 'admin', module), stampModules(await readFile(path.join(root, 'admin', module), 'utf8'), version));
  }
  const adminScript = stampModules(await readFile(path.join(root, 'admin/admin.js'), 'utf8'), version).replace("'vendor/quill.js'", `'vendor/quill.js?v=${version}'`);
  await writeFile(path.join(out, 'admin/admin.js'), adminScript, 'utf8');
  await writeFile(path.join(out, 'admin/index.html'), stampHTML(await readFile(path.join(root, 'admin/index.html'), 'utf8'), version), 'utf8');
  await writeFile(path.join(out, 'admin/preview-data.json'), JSON.stringify({ site, appearance: appearance.settings, version, photoVersion, photoVariants }), 'utf8');
  await writeFile(path.join(out, 'index.html'), stampHTML(html, version), 'utf8');
  await writeFile(path.join(out, '.nojekyll'), '');
  return out;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
  console.log('Built dist/index.html and the admin interface.');
}
