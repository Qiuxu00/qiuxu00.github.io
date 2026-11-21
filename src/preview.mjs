import { renderSite, safeURL } from './render.mjs';
import { renderAppearanceCSS } from './appearance.mjs';
import { isRichText } from './richtext.mjs';

// Drafts may temporarily have blank fields while the author types. Publishing still validates them.
export function normalizeDraft(input = {}) {
  const draft = {};
  for (const field of ['name', 'chinese_name', 'role', 'affiliation', 'degree', 'email', 'gmail', 'scholar_url', 'github_url', 'photo', 'about']) {
    draft[field] = typeof input[field] === 'string' || isRichText(input[field]) ? input[field] : '';
  }
  draft.texts = input.texts && typeof input.texts === 'object' ? input.texts : {};
  for (const field of ['research', 'publications', 'education']) {
    draft[field] = Array.isArray(input[field]) ? input[field].filter(item => item && typeof item === 'object') : [];
  }
  return draft;
}

export function renderDraftBody(input, photoAsset = '', appearance = {}, photoVersion = '', photoVariants = null) {
  const html = renderSite(normalizeDraft(input), { preview: true, photoAsset, appearance, photoVersion, photoVariants });
  return html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
}

function resolvePhotoVariants(variants, siteRoot) {
  const src = safeURL(variants?.src, { image: true });
  if (!src || !Array.isArray(variants.candidates)
    || !Number.isInteger(variants.originalWidth) || variants.originalWidth <= 0
    || !Number.isInteger(variants.originalHeight) || variants.originalHeight <= 0) return null;
  const candidates = variants.candidates.filter(item => item && Number.isInteger(item.width) && item.width > 0
    && Number.isInteger(item.height) && item.height > 0 && safeURL(item.src, { image: true }));
  if (!candidates.length) return null;
  return {
    ...variants,
    src: new URL(src, siteRoot).href,
    candidates: candidates.map(item => ({ ...item, src: new URL(safeURL(item.src, { image: true }), siteRoot).href }))
  };
}

export function registerHomepagePreview(CMS, createElement, siteRoot, snapshot = {}) {
  const stylesheet = new URL('assets/styles.css', siteRoot);
  if (snapshot.version) stylesheet.searchParams.set('v', snapshot.version);
  CMS.registerPreviewStyle(stylesheet.href);
  CMS.registerPreviewStyle('.cms-preview-note{margin:0;padding:12px 64px 12px 24px;border-bottom:1px solid var(--line);background:var(--soft);color:var(--muted);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.cms-preview-page{overflow-wrap:anywhere}.cms-preview-page [data-section="header"] .header-inner{padding-right:64px}', { raw: true });

  let activeDocument;
  let activeTheme = 'light';
  if (typeof window !== 'undefined') {
    window.addEventListener('homepage-preview-focus', event => {
      const { section, theme } = event.detail || {};
      if (theme === 'dark' || theme === 'light') activeTheme = theme;
      if (!activeDocument) return;
      activeDocument.documentElement.dataset.theme = activeTheme;
      const target = section === 'global' ? activeDocument.body
        : section === 'avatar' ? activeDocument.querySelector('[data-avatar]')
          : [...activeDocument.querySelectorAll('[data-section]')].find(el => el.dataset.section === section);
      target?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }

  function renderPreview({ entry, getAsset, document: previewDocument }, design = false) {
    activeDocument = previewDocument;
    if (design && previewDocument) previewDocument.documentElement.dataset.theme = activeTheme;
    const draft = entry.get('data')?.toJS() || {};
    const data = design ? snapshot.site || {} : draft;
    const appearance = design ? draft.settings || {} : snapshot.appearance || {};
    // Appearance edits use the published image; avoid asking Decap to fetch its full-size original.
    // Profile edits still resolve uploads through Decap, including a new file with the same name.
    const photoVariants = design ? resolvePhotoVariants(snapshot.photoVariants, siteRoot) : null;
    let photoAsset = '';
    if (data.photo && !photoVariants) {
      try {
        // Decap keys new uploads by repository path, without a leading slash.
        const assetPath = typeof data.photo === 'string' ? data.photo.replace(/^\/(?=assets\/)/, '') : data.photo;
        const asset = getAsset(assetPath);
        if (asset) {
          const assetURL = String(asset);
          const resolved = /^blob:https?:\/\//.test(assetURL) ? assetURL : safeURL(assetURL, { image: true });
          if (resolved) photoAsset = new URL(resolved, siteRoot).href;
        }
      } catch {
        // A partially typed photo URL must not interrupt the rest of the draft preview.
      }
      if (!photoAsset) {
        const savedPhoto = safeURL(data.photo, { image: true });
        if (savedPhoto) photoAsset = new URL(savedPhoto, siteRoot).href;
      }
    }
    const onClick = event => {
      const link = event.target.closest('a');
      if (link) {
        event.preventDefault();
        const href = link.getAttribute('href');
        if (href?.startsWith('#')) previewDocument?.getElementById(href.slice(1))?.scrollIntoView();
      }
      const toggle = event.target.closest('[data-theme-toggle]');
      if (toggle && previewDocument) {
        const root = previewDocument.documentElement;
        const dark = root.dataset.theme === 'dark';
        root.dataset.theme = dark ? 'light' : 'dark';
        activeTheme = root.dataset.theme;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('homepage-preview-theme', { detail: { theme: activeTheme } }));
        toggle.setAttribute('aria-pressed', String(!dark));
      }
    };
    return createElement('div', {},
      createElement('style', { id: 'site-appearance' }, renderAppearanceCSS(appearance)),
      createElement('p', { className: 'cms-preview-note', lang: 'zh-CN' }, '实时预览 · 修改尚未发布。保存／发布后，访客才能看到更新。'),
      createElement('div', { className: 'cms-preview-page', onClick, dangerouslySetInnerHTML: { __html: renderDraftBody(data, photoAsset, appearance, data.photo === snapshot.site?.photo ? snapshot.photoVersion : '', photoVariants) } })
    );
  }
  // File collections register by file name, not collection name.
  CMS.registerPreviewTemplate('profile', props => renderPreview(props));
  CMS.registerPreviewTemplate('appearance', props => renderPreview(props, true));
}
