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
  assert.match(result.children.find(child => child.props?.dangerouslySetInnerHTML).props.dangerouslySetInnerHTML.__html, /class="biography(?:\s[^"]*)?"/);
});

test('saved Unicode photos resolve at the site root before the CMS media cache loads', () => {
  let Preview;
  registerHomepagePreview({
    registerPreviewStyle() {},
    registerPreviewTemplate(name, component) { if (name === 'profile') Preview = component; }
  }, (type, props, ...children) => ({ type, props, children }), new URL('https://qiuxu00.github.io/'));
  const result = Preview({
    entry: { get: () => ({ toJS: () => ({ ...data, photo: '/assets/uploads/头像 #1.jpg' }) }) },
    getAsset: () => undefined
  });
  const html = result.children.find(child => child.props?.dangerouslySetInnerHTML).props.dangerouslySetInnerHTML.__html;
  assert.match(html, /src="https:\/\/qiuxu00\.github\.io\/assets\/uploads\/%E5%A4%B4%E5%83%8F%20%231\.jpg"/);
});

test('legacy root-relative photo values resolve pending uploads through the CMS media key', () => {
  let Preview;
  let requestedPath;
  registerHomepagePreview({
    registerPreviewStyle() {},
    registerPreviewTemplate(name, component) { if (name === 'profile') Preview = component; }
  }, (type, props, ...children) => ({ type, props, children }), new URL('https://qiuxu00.github.io/'));
  const result = Preview({
    entry: { get: () => ({ toJS: () => ({ ...data, photo: '/assets/uploads/你好.jpg' }) }) },
    getAsset: path => { requestedPath = path; return 'blob:https://qiuxu00.github.io/pending-upload'; }
  });
  assert.equal(requestedPath, 'assets/uploads/你好.jpg');
  const html = result.children.find(child => child.props?.dangerouslySetInnerHTML).props.dangerouslySetInnerHTML.__html;
  assert.match(html, /src="blob:https:\/\/qiuxu00\.github\.io\/pending-upload"/);
});

const photoSnapshot = {
  site: { ...data, photo: '/assets/uploads/original.jpg' },
  photoVariants: {
    src: 'assets/generated/photo-960.webp',
    candidates: [
      { src: 'assets/generated/photo-480.webp', width: 480, height: 320, bytes: 1000 },
      { src: 'assets/generated/photo-960.webp', width: 960, height: 640, bytes: 3000 }
    ],
    originalWidth: 1500,
    originalHeight: 1000
  }
};

function previewTemplates(snapshot) {
  const templates = {};
  registerHomepagePreview({
    registerPreviewStyle() {},
    registerPreviewTemplate(name, component) { templates[name] = component; }
  }, (type, props, ...children) => ({ type, props, children }), new URL('https://qiuxu00.github.io/'), snapshot);
  return templates;
}

const previewHTML = result => result.children.find(child => child.props?.dangerouslySetInnerHTML).props.dangerouslySetInnerHTML.__html;

test('appearance preview uses optimized photos without fetching the original from Decap', () => {
  let assetRequests = 0;
  const html = previewHTML(previewTemplates(photoSnapshot).appearance({
    entry: { get: () => ({ toJS: () => ({ settings: {} }) }) },
    getAsset: () => { assetRequests++; return 'assets/uploads/original.jpg'; }
  }));
  assert.equal(assetRequests, 0);
  assert.match(html, /src="https:\/\/qiuxu00\.github\.io\/assets\/generated\/photo-960\.webp"/);
  assert.match(html, /srcset="https:\/\/qiuxu00\.github\.io\/assets\/generated\/photo-480\.webp 480w, https:\/\/qiuxu00\.github\.io\/assets\/generated\/photo-960\.webp 960w"/);
  assert.doesNotMatch(html, /original\.jpg/);
});

test('profile preview keeps a new upload with the same filename ahead of optimized published photos', () => {
  let requestedPath;
  const html = previewHTML(previewTemplates(photoSnapshot).profile({
    entry: { get: () => ({ toJS: () => photoSnapshot.site }) },
    getAsset: path => { requestedPath = path; return 'blob:https://qiuxu00.github.io/replacement'; }
  }));
  assert.equal(requestedPath, 'assets/uploads/original.jpg');
  assert.match(html, /src="blob:https:\/\/qiuxu00\.github\.io\/replacement"/);
  assert.doesNotMatch(html, /srcset=|assets\/generated/);
});

test('appearance preview falls back to the saved photo when optimized metadata is invalid', () => {
  for (const photoVariants of [null, { ...photoSnapshot.photoVariants, src: 'javascript:alert(1)' }, { ...photoSnapshot.photoVariants, candidates: [null] }]) {
    let assetRequests = 0;
    const html = previewHTML(previewTemplates({ ...photoSnapshot, photoVariants }).appearance({
      entry: { get: () => ({ toJS: () => ({ settings: {} }) }) },
      getAsset: () => { assetRequests++; return undefined; }
    }));
    assert.equal(assetRequests, 1);
    assert.match(html, /src="https:\/\/qiuxu00\.github\.io\/assets\/uploads\/original\.jpg"/);
    assert.doesNotMatch(html, /srcset=|javascript:/);
  }
});
