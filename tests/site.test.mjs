import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderSite, safeURL } from '../src/render.mjs';
import { site as data } from './fixtures/site.mjs';
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

test('uploaded image paths support Unicode and encoded names without allowing traversal', () => {
  const uploaded = '/assets/uploads/你好-93-120-.jpg';
  const encoded = 'assets/uploads/%E4%BD%A0%E5%A5%BD-93-120-.jpg';
  assert.equal(safeURL(uploaded, { image: true }), encoded);
  assert.equal(safeURL(encoded, { image: true }), encoded);
  assert.equal(safeURL('/assets/uploads/头像 (最终)#1&100%.jpg', { image: true }), 'assets/uploads/%E5%A4%B4%E5%83%8F%20%28%E6%9C%80%E7%BB%88%29%231%26100%25.jpg');
  for (const invalid of ['assets/../secret.jpg', 'assets/%2e%2e/secret.jpg', 'assets/%252e%252e/secret.jpg', 'assets/uploads/a%2fb.jpg', 'assets/uploads/a%5cb.jpg', 'assets/uploads/a\\b.jpg', 'assets/uploads/%00.jpg', '//evil.example/photo.jpg']) {
    assert.equal(safeURL(invalid, { image: true }), '', invalid);
  }
  assert.match(renderSite({ ...data, photo: uploaded }), new RegExp(`src="${encoded}"`));
});
test('optional contacts and publications can be omitted without broken links', () => {
  const html = renderSite({ ...data, gmail: '', publications: [] });
  assert.match(html, /mailto:researcher@example\.edu/);
  assert.doesNotMatch(html, /href=""|mailto:"|undefined/);
  assert.match(html, /View Google Scholar profile/);
});
test('the rendering fixture covers required CMS fields', async () => {
  const config = JSON.parse(await readFile(new URL('../admin/config.json', import.meta.url), 'utf8'));
  const file = config.collections[0].files[0];
  assert.equal(file.file, 'data/site.json');
  assert.equal(config.backend.branch, 'main');
  assert.equal(config.backend.repo, 'Qiuxu00/qiuxu00.github.io');
  for (const field of file.fields.filter(field => field.required !== false)) assert.ok(Object.hasOwn(data, field.name), `${field.name} missing from fixture`);
});

test('normal contact and biography edits remain publishable', () => {
  const changed = { ...data, email: 'updated@example.edu', scholar_url: 'https://scholar.google.com', about: 'I study undefined behavior in programs.' };
  const html = renderSite(changed);
  assert.match(html, /mailto:updated@example\.edu/);
  assert.match(html, /href="https:\/\/scholar\.google\.com\/"/);
  assert.match(html, /undefined behavior/);
  for (const field of ['email', 'gmail', 'scholar_url', 'github_url', 'chinese_name', 'photo']) delete changed[field];
  const withoutContacts = renderSite(changed);
  assert.doesNotMatch(withoutContacts, /mailto:|href=""|View Google Scholar profile/);
});
