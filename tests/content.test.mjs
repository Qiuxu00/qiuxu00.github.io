import test from 'node:test';
import assert from 'node:assert/strict';
import { site } from './fixtures/site.mjs';
import { upgradeTextContent, RICH_SITE_FIELDS, RICH_LIST_FIELDS, DEFAULT_TEXTS } from '../src/content.mjs';
import { textOf, normalizeRichText } from '../src/richtext.mjs';
import { renderSite } from '../src/render.mjs';

test('opening old content in the text editor preserves wording, line breaks, and links', () => {
  const old = { ...site, about: 'First paragraph.\n\nSecond paragraph.\nNew line.' };
  const upgraded = upgradeTextContent(old);
  for (const key of RICH_SITE_FIELDS) assert.equal(textOf(upgraded[key]), textOf(old[key]));
  for (const [key, fields] of Object.entries(RICH_LIST_FIELDS)) old[key].forEach((item, index) => {
    for (const field of fields) assert.equal(textOf(upgraded[key][index][field]), textOf(item[field]));
  });
  assert.equal(upgraded.about, old.about);
  assert.equal(upgraded.scholar_url, old.scholar_url);
  assert.equal(upgraded.publications[0].url, old.publications[0].url);
  assert.equal(upgraded.publications[0].title.text, old.publications[0].title);
});

test('formatted names and headings keep metadata plain and respect local styling', () => {
  const data = upgradeTextContent(site);
  data.name = normalizeRichText({ ops: [{ insert: 'Example Researcher', attributes: { bold: true, color: '#234567' } }] });
  data.texts.hero_title = normalizeRichText({ ops: [{ insert: 'My research', attributes: { color: '#aa3344' } }] });
  const html = renderSite(data);
  assert.match(html, /<title>Example Researcher · Example University<\/title>/);
  assert.match(html, /<meta name="author" content="Example Researcher">/);
  assert.match(html, /color:#aa3344[^>]*>My research<\/span>/);
  assert.doesNotMatch(html, /\[object Object\]/);
  assert.equal(textOf(data.texts.publications_title), DEFAULT_TEXTS.publications_title);
});
