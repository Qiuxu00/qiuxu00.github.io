import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { site } from './fixtures/site.mjs';
import { DEFAULT_APPEARANCE } from '../src/appearance.mjs';

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
    const content = JSON.stringify(site);
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
    const preview = JSON.parse(await readFile(path.join(out, 'admin/preview-data.json'), 'utf8'));
    assert.deepEqual(preview.appearance, settings);
    assert.deepEqual(preview.site, site);
    assert.equal(await readFile(path.join(workspace, 'data/site.json'), 'utf8'), content);
    assert.equal(await readFile(path.join(workspace, 'data/appearance.json'), 'utf8'), appearance);
  } finally {
    // Only remove the exact temporary directory created by this test.
    const target = path.resolve(workspace);
    assert.equal(path.dirname(target), temporaryRoot);
    assert.ok(path.basename(target).startsWith('homepage-build-test-'));
    await rm(target, { recursive: true, force: true });
  }
});
