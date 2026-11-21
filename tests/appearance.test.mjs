import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_APPEARANCE, GROUPS, normalizeAppearance, renderAppearanceCSS } from '../src/appearance.mjs';

test('appearance defaults and saved settings use the same supported editor fields', async () => {
  const saved = JSON.parse(await readFile(new URL('../data/appearance.json', import.meta.url), 'utf8'));
  assert.deepEqual(normalizeAppearance(saved.settings), DEFAULT_APPEARANCE);
  for (const group of GROUPS) {
    for (const field of group.fields) assert.ok(Object.hasOwn(DEFAULT_APPEARANCE[group.id], field.key), `${group.id}.${field.key}`);
  }
  assert.equal(saved.settings.avatar.desktopSize, 220);
  assert.equal(saved.settings.avatar.radius, 0);
});

test('partial and damaged drafts fall back safely and clamp layout bounds', () => {
  const result = normalizeAppearance({
    global: { pageWidth: 100000, sidebarWidth: null, columnGap: -999 },
    avatar: { desktopSize: '256', objectFit: 'stretch', hoverScale: Infinity },
    about: { bodySize: 2, titleSize: '60', lineHeight: '', bodyFont: 'not-a-font', textColor: '#AABBCC' }
  });
  assert.equal(result.global.pageWidth, 1600);
  assert.equal(result.global.sidebarWidth, DEFAULT_APPEARANCE.global.sidebarWidth);
  assert.equal(result.global.columnGap, 24);
  assert.equal(result.avatar.desktopSize, 256);
  assert.equal(result.avatar.objectFit, 'cover');
  assert.equal(result.avatar.hoverScale, DEFAULT_APPEARANCE.avatar.hoverScale);
  assert.equal(result.about.bodySize, 14);
  assert.equal(result.about.titleSize, 60);
  assert.equal(result.about.lineHeight, DEFAULT_APPEARANCE.about.lineHeight);
  assert.equal(result.about.bodyFont, 'system');
  assert.equal(result.about.textColor, '#aabbcc');
  assert.deepEqual(normalizeAppearance(null), DEFAULT_APPEARANCE);
});

test('CSS cannot contain supplied markup, arbitrary declarations, or external font URLs', () => {
  const attack = '</style><script>alert(1)</script><style>body{display:none}';
  const css = renderAppearanceCSS({
    global: { pageBackground: attack, pageWidth: attack },
    about: { bodyFont: 'url(https://evil.example/font)', background: '#fff;display:none', titleColor: attack, titleSize: attack },
    avatar: { objectFit: attack, posX: attack }
  });
  assert.doesNotMatch(css, /<|>|evil\.example|display:none|NaN|undefined/);
});

test('one section can be styled without altering others, and dark colors remain separate', () => {
  const css = renderAppearanceCSS({ about: { bodySize: 24, textColor: '#123456', textColorDark: '#abcdef', paddingX: 40 } });
  const about = css.match(/\[data-section="about"\]\{([^}]*)\}/)[1];
  const research = css.match(/\[data-section="research"\]\{([^}]*)\}/)[1];
  assert.match(about, /font-size:1\.5rem/);
  assert.match(about, /padding:16px 40px/);
  assert.match(about, /--section-text:#123456/);
  assert.match(research, /font-size:1rem/);
  assert.doesNotMatch(research, /#123456|#abcdef|40px/);
  assert.match(css, /:root\[data-theme="dark"\] \[data-section="about"\]\{--section-text:#abcdef/);
  assert.match(css, /@media\(prefers-color-scheme:dark\)/);
  assert.equal(DEFAULT_APPEARANCE.about.bodySize, 17);
});
