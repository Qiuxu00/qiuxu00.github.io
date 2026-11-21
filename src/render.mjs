import { renderAppearanceCSS } from './appearance.mjs';
import { isRichText, textOf, renderRichText } from './richtext.mjs';
import { DEFAULT_TEXTS } from './content.mjs';

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function safeURL(value, { image = false } = {}) {
  if (typeof value !== 'string' || !value) return '';
  if (image && /^\/?assets\//.test(value)) {
    const parts = value.replace(/^\//, '').split('/');
    const encoded = [];
    for (const part of parts) {
      let decoded;
      try { decoded = decodeURIComponent(part); } catch { decoded = part; }
      // Validate path components before URL parsing can normalize traversal away.
      if (!decoded || decoded === '.' || decoded === '..' || /[\/\\\u0000-\u001f\u007f]/.test(decoded) || /%(?:2e|2f|5c)/i.test(decoded)) return '';
      try { encoded.push(encodeURIComponent(decoded).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)); } catch { return ''; }
    }
    return encoded.join('/');
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    return url.href;
  } catch { return ''; }
}

export function validateSite(data) {
  for (const key of ['name', 'affiliation', 'role', 'degree', 'about']) {
    if ((typeof data[key] !== 'string' && !isRichText(data[key])) || !textOf(data[key]).trim()) throw new Error(`Missing required text: ${key}`);
  }
  for (const key of ['research', 'publications', 'education']) {
    if (!Array.isArray(data[key])) throw new Error(`${key} must be a list.`);
  }
  for (const key of ['email', 'gmail']) {
    if (data[key] && !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(data[key])) throw new Error(`Invalid email: ${key}`);
  }
  for (const key of ['github_url', 'scholar_url']) {
    if (data[key] && !safeURL(data[key])) throw new Error(`${key} must be an HTTPS URL.`);
  }
  if (data.photo && !safeURL(data.photo, { image: true })) throw new Error('Photo must be an HTTPS URL or a path inside assets/.');
  return data;
}

const icons = {
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  scholar: '<path d="m2 9 10-6 10 6-10 6-10-6Z"/><path d="M6 12v5c3 3 9 3 12 0v-5M22 9v8"/>',
  github: '<path d="M9 19c-4 1-4-2-6-2m12 5v-4a3.5 3.5 0 0 0-1-3c3-.4 6-1.5 6-6a5 5 0 0 0-1.4-3.5A4.5 4.5 0 0 0 18.5 2S17.3 1.6 15 3a13 13 0 0 0-6 0C6.7 1.6 5.5 2 5.5 2a4.5 4.5 0 0 0-.1 3.5A5 5 0 0 0 4 9c0 4.5 3 5.6 6 6a3.5 3.5 0 0 0-1 3v4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const external = (url, label, cls = '') => {
  const href = safeURL(url);
  return href ? `<a class="${cls}" href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${label}</a>` : '';
};

export function renderSite(input, { preview = false, photoAsset = '', photoVersion = '', appearance = {} } = {}) {
  const s = preview ? input : validateSite(input);
  const e = escapeHTML;
  const inline = value => renderRichText(value, { inline: true });
  const linkedText = value => renderRichText(value, { inline: true, allowLinks: false });
  const label = key => linkedText(s.texts?.[key] ?? DEFAULT_TEXTS[key]);
  const name = textOf(s.name);
  const emails = [s.email, s.gmail].filter(Boolean);
  // Only the editor can supply an in-memory upload; published pages retain strict URL validation.
  let photo = preview && /^blob:https?:\/\//.test(photoAsset)
    ? photoAsset : safeURL(photoAsset || s.photo, { image: true });
  if (photo && !photo.startsWith('blob:') && /^[a-f\d]{12}$/.test(photoVersion)) {
    const url = new URL(photo, 'https://homepage.invalid/');
    url.searchParams.set('v', photoVersion);
    photo = photo.startsWith('assets/') ? `${url.pathname.slice(1)}${url.search}` : url.href;
  }
  const publications = s.publications.map(p => `<article class="publication">
    <div class="publication-year">${inline(p.year)}</div><div>
      <h3>${safeURL(p.url) ? external(p.url, linkedText(p.title)) : inline(p.title)}</h3>
      ${textOf(p.authors) ? `<p class="authors">${inline(p.authors)}</p>` : ''}
      ${textOf(p.venue) ? `<p class="venue">${inline(p.venue)}</p>` : ''}
      ${textOf(p.summary) ? `<div class="publication-summary rich-block">${renderRichText(p.summary)}</div>` : ''}
      <div class="publication-links">${external(p.url, label('paper_label'))}${external(p.code, label('code_label'))}</div>
    </div></article>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${e(`${name}, ${textOf(s.role)} at ${textOf(s.affiliation)}. ${s.research.map(r => textOf(r.title)).join(' and ')}.`)}">
  <meta name="author" content="${e(name)}">
  <meta name="color-scheme" content="light dark">
  <meta property="og:title" content="${e(name)} · Academic Homepage">
  <meta property="og:description" content="${e(`${textOf(s.role)} at ${textOf(s.affiliation)}. ${textOf(s.degree)}.`)}">
  <meta property="og:type" content="website">
  <title>${e(name)} · ${e(textOf(s.affiliation))}</title>
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/styles.css">
  <style id="site-appearance">${renderAppearanceCSS(appearance)}</style>
  <script src="assets/site.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" data-section="header"><div class="header-inner">
    <a class="wordmark" href="#about" aria-label="${e(name)}, home">${linkedText(s.name)}<span class="wordmark-dot">.</span></a>
    <nav aria-label="Main navigation"><a href="#about">${label('nav_about')}</a><a href="#research">${label('nav_research')}</a><a href="#publications">${label('nav_publications')}</a><button class="theme-toggle" data-theme-toggle type="button" aria-label="Switch theme" aria-pressed="false">${icon('sun')}</button></nav>
  </div></header>
  <div class="page-layout">
    <aside class="profile" aria-label="Profile"><div class="profile-inner" data-section="profile">
      ${photo ? `<img class="portrait" data-avatar src="${e(photo)}" alt="${e(name)}" width="220" height="220">` : `<div class="monogram" data-avatar aria-hidden="true"><span>XQ</span></div>`}
      <h1>${inline(s.name)}</h1>
      ${textOf(s.chinese_name) ? `<p class="chinese-name" lang="zh-CN">${inline(s.chinese_name)}</p>` : ''}
      <p class="profile-role">${inline(s.role)}</p><p class="affiliation">${inline(s.affiliation)}</p><p class="degree">${inline(s.degree)}</p>
      <div class="social-links">${emails[0] ? `<a href="mailto:${e(emails[0])}">${icon('email')}<span>${label('email_label')}</span></a>` : ''}${external(s.scholar_url, `${icon('scholar')}<span>${label('scholar_label')}</span>`)}${external(s.github_url, `${icon('github')}<span>${label('github_label')}</span>`)}</div>
      <div class="sidebar-interests"><h2>${label('sidebar_interests')}</h2><ul>${s.research.map(r => `<li>${inline(r.title)}</li>`).join('')}</ul></div>
      <a class="contact-link" href="#contact">${label('contact_cta')}</a>
    </div></aside>
    <main id="main">
      <section id="about" class="about-section" data-section="about"><p class="eyebrow">${label('about_label')}</p><h2>${label('hero_title')}<br><span class="hero-accent">${label('hero_accent')}</span></h2>
        <div class="biography rich-block">${renderRichText(s.about)}</div>
        <div class="affiliation-note"><span class="note-rule" aria-hidden="true"></span><span>${inline(s.degree)}<br><strong>${inline(s.affiliation)}</strong></span></div>
      </section>
      <section id="research" data-section="research"><div class="section-heading"><h2>${label('research_title')}</h2><span class="section-line" aria-hidden="true"></span></div><div class="research-grid">${s.research.map(r => `<article class="research-item"><h3>${inline(r.title)}</h3><div class="rich-block">${renderRichText(r.description)}</div></article>`).join('')}</div></section>
      <section id="publications" data-section="publications"><div class="section-heading"><h2>${label('publications_title')}</h2><span class="section-line" aria-hidden="true"></span></div>
        ${publications || `<p class="section-intro">${label('papers_empty')}</p>`}
        ${external(s.scholar_url, `${icon('scholar')}<span>${label('scholar_link')}</span>`, 'scholar-link')}
      </section>
      <section id="education" data-section="education"><div class="section-heading"><h2>${label('education_title')}</h2><span class="section-line" aria-hidden="true"></span></div><div class="education-list">${s.education.map(item => `<article class="education-item"><div><h3>${inline(item.institution)}</h3><p>${inline(item.degree)}</p></div>${textOf(item.period) ? `<span class="education-period">${inline(item.period)}</span>` : ''}</article>`).join('')}</div></section>
      <section id="contact" class="contact-section" data-section="contact"><p class="eyebrow">${label('contact_label')}</p><h2>${label('contact_title')}</h2><div class="contact-intro rich-block">${renderRichText(s.texts?.contact_intro ?? DEFAULT_TEXTS.contact_intro)}</div><div class="contact-emails">${emails.map(email => `<a href="mailto:${e(email)}">${e(email)}</a>`).join('')}</div></section>
    </main>
  </div>
  <footer class="site-footer" data-section="footer"><span>© ${new Date().getUTCFullYear()} ${e(name)}</span><div>${external(s.github_url, label('github_label'))}<a href="admin/">${label('footer_admin')}</a></div></footer>
</body>
</html>`;
}
