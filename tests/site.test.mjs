import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderSite, safeURL } from '../src/render.mjs';

const data = JSON.parse(await readFile(new URL('../data/site.json', import.meta.url), 'utf8'));
test('saved biography becomes public HTML and malicious text stays text', () => {
  const edited = { ...data, about: 'Updated biography.\n\n<script>alert(1)</script>' };
  const html = renderSite(edited);
  assert.match(html, /<p>Updated biography\.<\/p>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});
test('only secure external links and local asset paths are accepted', () => {
  assert.equal(safeURL('javascript:alert(1)'), '');
  assert.equal(safeURL('//evil.example'), '');
  assert.equal(safeURL('/assets/uploads/photo.png', { image: true }), 'assets/uploads/photo.png');
  assert.equal(safeURL('assets/../secret', { image: true }), '');
  assert.equal(safeURL(data.scholar_url), data.scholar_url);
});
test('optional contacts and publications can be omitted without broken links', () => {
  const html = renderSite({ ...data, gmail: '', publications: [] });
  assert.match(html, /mailto:qiuxuhong@seu\.edu\.cn/);
  assert.doesNotMatch(html, /href=""|mailto:"|undefined/);
  assert.match(html, /View Google Scholar profile/);
});
test('CMS fields and saved data agree', async () => {
  const config = JSON.parse(await readFile(new URL('../admin/config.json', import.meta.url), 'utf8'));
  const file = config.collections[0].files[0];
  assert.equal(file.file, 'data/site.json');
  assert.equal(config.backend.branch, 'main');
  assert.equal(config.backend.repo, 'Qiuxu00/qiuxu00.github.io');
  for (const field of file.fields) assert.ok(Object.hasOwn(data, field.name), `${field.name} missing from content`);
});
