import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSite } from '../src/render.mjs';
import { registerHomepagePreview, renderDraftBody } from '../src/preview.mjs';

import { site as data } from './fixtures/site.mjs';

test('an unsaved biography uses exactly the public-page body rendering', () => {
  const draft = { ...data, about: 'Unsaved line.\n\nSecond paragraph.\nA line break.' };
  const page = renderSite(draft);
  assert.equal(renderDraftBody(draft), page.slice(page.indexOf('<body>') + 6, page.lastIndexOf('</body>')));
  assert.match(renderDraftBody(draft), /<p>Second paragraph\.<br>A line break\.<\/p>/);
});

test('preview stays usable while required fields are being cleared', () => {
  assert.doesNotThrow(() => renderDraftBody({ about: '', research: [null] }));
  assert.throws(() => renderSite({ ...data, about: '' }), /Missing required text/);
  assert.doesNotMatch(renderDraftBody({}), /undefined/);
});

test('preview escapes draft HTML and can display a not-yet-published photo', () => {
  const html = renderDraftBody({ ...data, about: '<img src=x onerror=alert(1)>', photo: '/assets/uploads/new.png' }, 'blob:https://qiuxu00.github.io/test-photo');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /src="blob:https:\/\/qiuxu00.github.io\/test-photo"/);
  assert.throws(() => renderSite({ ...data, photo: 'blob:https://qiuxu00.github.io/test-photo' }), /Photo must be/);
});

test('an incomplete photo URL does not break the editor preview', () => {
  let Preview;
  registerHomepagePreview({
    registerPreviewStyle() {},
    registerPreviewTemplate(name, component) { if (name === 'profile') Preview = component; }
  }, (type, props, ...children) => ({ type, props, children }), new URL('https://qiuxu00.github.io/'));
  const result = Preview({
    entry: { get: () => ({ toJS: () => ({ ...data, photo: 'https://[' }) }) },
    getAsset: value => value
  });
  assert.match(result.children.find(child => child.props?.dangerouslySetInnerHTML).props.dangerouslySetInnerHTML.__html, /class="biography"/);
});
