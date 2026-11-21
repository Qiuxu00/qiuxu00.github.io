import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { site } from './fixtures/site.mjs';
import { DEFAULT_APPEARANCE } from '../src/appearance.mjs';
import { normalizeRichText } from '../src/richtext.mjs';

test('building a saved custom appearance publishes it without changing the content', async () => {
  const temporaryRoot = path.resolve(tmpdir());
  const workspace = await mkdtemp(path.join(temporaryRoot, 'homepage-build-test-'));
  try {
    for (const directory of ['src', 'scripts', 'assets', 'admin']) {
      await cp(new URL(`../${directory}/`, import.meta.url), path.join(workspace, directory), { recursive: true });
    }
    await mkdir(path.join(workspace, 'data'));
    const settings = structuredClone(DEFAULT_APPEARANCE);
    Object.assign(settings.global, { pageWidth: 1120, sidebarWidth: 340, pageBackground: '#fafffa' });
    Object.assign(settings.avatar, { desktopSize: 304, radius: 24 });
    Object.assign(settings.about, { background: '#f5fff7' });
    const formattedSite = { ...site, about: normalizeRichText({ ops: [
      { insert: 'An editable ' },
      { insert: 'highlight', attributes: { color: '#bd2538', bold: true, size: '24px' } },
      { insert: ' remains formatted after publishing.\n' }
    ] }) };
    const content = JSON.stringify(formattedSite);
    const appearance = JSON.stringify({ settings });
    await writeFile(path.join(workspace, 'data/site.json'), content);
    await writeFile(path.join(workspace, 'data/appearance.json'), appearance);
    const { build } = await import(pathToFileURL(path.join(workspace, 'scripts/build.mjs')).href);
    const out = await build();
    const html = await readFile(path.join(out, 'index.html'), 'utf8');
    assert.match(html, /--page-background:#fafffa/);
    assert.match(html, /width:min\(304px,100%\)/);
    assert.match(html, /border-radius:24px/);
    assert.match(html, /--section-background:#f5fff7/);
    assert.match(html, /font-size:24px;font-weight:700;color:#bd2538/);
    assert.match(html, />highlight<\/span> remains formatted after publishing\./);
    const preview = JSON.parse(await readFile(path.join(out, 'admin/preview-data.json'), 'utf8'));
    assert.deepEqual(preview.appearance, settings);
    assert.deepEqual(preview.site, formattedSite);
    assert.match(html, new RegExp(`assets/styles\\.css\\?v=${preview.version}`));
    const adminHTML = await readFile(path.join(out, 'admin/index.html'), 'utf8');
    const editorModule = await readFile(path.join(out, 'admin/richtext-widget.mjs'), 'utf8');
    assert.match(adminHTML, new RegExp(`admin\\.js\\?v=${preview.version}`));
    assert.match(editorModule, new RegExp(`richtext\\.mjs\\?v=${preview.version}`));
    assert.equal(await readFile(path.join(workspace, 'data/site.json'), 'utf8'), content);
    assert.equal(await readFile(path.join(workspace, 'data/appearance.json'), 'utf8'), appearance);

    // Exercise a real saved CMS image path, then replace the same filename.
    const filename = '你好 头像(1).png';
    const uploadDirectory = path.join(workspace, 'assets/uploads');
    await mkdir(uploadDirectory, { recursive: true });
    const firstImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1kAAAAASUVORK5CYII=', 'base64');
    await writeFile(path.join(uploadDirectory, filename), firstImage);
    await writeFile(path.join(workspace, 'data/site.json'), JSON.stringify({ ...formattedSite, photo: `/assets/uploads/${filename}` }));
    await build();
    const uploadedHTML = await readFile(path.join(out, 'index.html'), 'utf8');
    const uploadedPreview = JSON.parse(await readFile(path.join(out, 'admin/preview-data.json'), 'utf8'));
    assert.match(uploadedHTML, new RegExp(`%E4%BD%A0%E5%A5%BD%20%E5%A4%B4%E5%83%8F%281%29\\.png\\?v=${uploadedPreview.photoVersion}`));
    assert.deepEqual(await readFile(path.join(out, 'assets/uploads', filename)), firstImage);
    const secondImage = Buffer.concat([firstImage, Buffer.from('replacement')]);
    await writeFile(path.join(uploadDirectory, filename), secondImage);
    await build();
    const replacementPreview = JSON.parse(await readFile(path.join(out, 'admin/preview-data.json'), 'utf8'));
    assert.notEqual(replacementPreview.photoVersion, uploadedPreview.photoVersion);
    assert.notEqual(replacementPreview.version, uploadedPreview.version);
    assert.deepEqual(await readFile(path.join(out, 'assets/uploads', filename)), secondImage);
  } finally {
    // Only remove the exact temporary directory created by this test.
    const target = path.resolve(workspace);
    assert.equal(path.dirname(target), temporaryRoot);
    assert.ok(path.basename(target).startsWith('homepage-build-test-'));
    await rm(target, { recursive: true, force: true });
  }
});
