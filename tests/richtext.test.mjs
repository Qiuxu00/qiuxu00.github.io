import test from 'node:test';
import assert from 'node:assert/strict';
import { isRichText, normalizeRichText, renderRichText, textOf, toDelta } from '../src/richtext.mjs';

test('legacy text remains text and preserves the existing paragraph layout', () => {
  const plain = 'First paragraph.\n\n第二段。\nA line break.';
  assert.equal(renderRichText(plain), '<p>First paragraph.</p><p>第二段。<br>A line break.</p>');
  assert.equal(renderRichText('An <em>example</em>', { inline: true }), 'An &lt;em&gt;example&lt;/em&gt;');
  assert.equal(textOf(plain), plain);
  assert.equal(textOf(normalizeRichText(plain)), plain);
  assert.equal(textOf(normalizeRichText('Ending newline.\n')), 'Ending newline.\n');
  assert.equal(toDelta('Name').ops[0].insert, 'Name\n');
});

test('selected text formatting survives normalization and serialized saving', () => {
  const document = normalizeRichText({ ops: [
    { insert: 'Research on ' },
    { insert: '高效 VLA', attributes: { color: 'rgb(178, 34, 34)', bold: true, size: '22px', font: 'georgia' } },
    { insert: ' models.\n' }
  ] });
  assert.equal(isRichText(document), true);
  assert.equal(textOf(document), 'Research on 高效 VLA models.');
  const saved = JSON.parse(JSON.stringify(document));
  assert.deepEqual(normalizeRichText(saved), document);
  const html = renderRichText(saved);
  assert.match(html, /^<p>Research on <span style="/);
  assert.match(html, /font-size:22px/);
  assert.match(html, /font-weight:700/);
  assert.match(html, /color:#b22222/);
  assert.match(html, />高效 VLA<\/span> models\.<\/p>$/);
  assert.equal(textOf({ ...saved, text: '<script>stale cache</script>' }), document.text);
});

test('paragraph alignment and ordered or bullet lists use final-newline attributes', () => {
  const document = { ops: [
    { insert: 'Centered introduction' }, { insert: '\n', attributes: { align: 'center' } },
    { insert: 'First item' }, { insert: '\n', attributes: { list: 'ordered' } },
    { insert: 'Second item' }, { insert: '\n', attributes: { list: 'ordered' } },
    { insert: 'A bullet' }, { insert: '\n', attributes: { list: 'bullet', indent: 1 } },
    { insert: 'Last paragraph\n' }
  ] };
  assert.equal(renderRichText(document), '<p style="text-align:center">Centered introduction</p><ol><li>First item</li><li>Second item</li></ol><ul><li style="margin-inline-start:1.5em">A bullet</li></ul><p>Last paragraph</p>');
  const title = renderRichText({ ops: [{ insert: 'A centered title' }, { insert: '\n', attributes: { align: 'center' } }] }, { inline: true });
  assert.equal(title, '<span style="display:block;text-align:center">A centered title</span>');
  assert.doesNotMatch(title, /<p|<li|<h\d|<br>$/);
  const twoLines = renderRichText({ ops: [{ insert: 'First\nSecond\n', attributes: { align: 'right' } }] }, { inline: true });
  assert.equal(twoLines, '<span style="display:block;text-align:right">First</span><span style="display:block;text-align:right">Second</span>');
});

test('unsafe markup, embeds, attributes, and links never become executable HTML', () => {
  const attack = '</span><script>alert(1)</script>';
  const html = renderRichText({ ops: [
    { insert: attack, attributes: { color: 'red;display:none', background: 'url(javascript:x)', size: '22px;position:fixed', font: 'evil" onmouseover="x', link: 'javascript:alert(1)', align: 'center;display:none' } },
    { insert: { image: 'https://example.org/image.svg' } },
    { retain: 3, attributes: { bold: true } },
    { insert: '\n' }
  ] });
  assert.equal(html, '<p>&lt;/span&gt;&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.doesNotMatch(html, /style=|href=|<script|<img|onmouseover/);
  const valid = { ops: [{ insert: 'Paper', attributes: { link: 'https://example.org/paper' } }, { insert: '\n' }] };
  assert.match(renderRichText(valid, { inline: true }), /href="https:\/\/example\.org\/paper"/);
  assert.equal(renderRichText(valid, { inline: true, allowLinks: false }), 'Paper');
});

test('partial drafts normalize safely and preserve supported typography', () => {
  for (const value of [null, undefined, {}, [], { ops: [null, {}, { insert: 123 }] }]) {
    assert.equal(textOf(value), '');
    assert.equal(renderRichText(value), '');
    assert.deepEqual(toDelta(value), { ops: [{ insert: '\n' }] });
  }
  const document = normalizeRichText({ ops: [
    { insert: 'A', attributes: { weight: 500, italic: true, underline: true, strike: true, background: '#abc', size: 100, font: 'mono' } },
    { insert: '\n', attributes: { align: 'right', indent: 100 } }
  ] });
  assert.equal(document.ops[0].attributes.size, '72px');
  assert.equal(document.ops[0].attributes.background, '#aabbcc');
  assert.equal(document.ops[1].attributes.indent, 6);
  const html = renderRichText(document);
  assert.match(html, /font-weight:500/);
  assert.match(html, /font-style:italic/);
  assert.match(html, /text-decoration:underline line-through/);
  assert.match(html, /font-family:&quot;Cascadia Code&quot;/);
});
