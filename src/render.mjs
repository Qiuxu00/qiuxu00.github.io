export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function safeURL(value, { image = false } = {}) {
  if (!value) return '';
  if (image && /^\/?assets\/[a-z\d_./% -]+$/i.test(value) && !value.includes('..')) return value.replace(/^\//, '');
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    return url.href;
  } catch { return ''; }
}

export function validateSite(data) {
  for (const key of ['name', 'affiliation', 'role', 'degree', 'about']) {
    if (typeof data[key] !== 'string' || !data[key].trim()) throw new Error(`Missing required text: ${key}`);
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

export function renderSite(input) {
  const s = validateSite(input);
  const e = escapeHTML;
  const emails = [s.email, s.gmail].filter(Boolean);
  const photo = safeURL(s.photo, { image: true });
  const publications = s.publications.map(p => `<article class="publication">
    <div class="publication-year">${e(p.year)}</div><div>
      <h3>${safeURL(p.url) ? external(p.url, e(p.title)) : e(p.title)}</h3>
      ${p.authors ? `<p class="authors">${e(p.authors)}</p>` : ''}
      ${p.venue ? `<p class="venue">${e(p.venue)}</p>` : ''}
      ${p.summary ? `<p>${e(p.summary)}</p>` : ''}
      <div class="publication-links">${external(p.url, 'Paper')}${external(p.code, 'Code')}</div>
    </div></article>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${e(`${s.name}, ${s.role} at ${s.affiliation}. ${s.research.map(r => r.title).join(' and ')}.`)}">
  <meta name="author" content="${e(s.name)}">
  <meta name="color-scheme" content="light dark">
  <meta property="og:title" content="${e(s.name)} · Academic Homepage">
  <meta property="og:description" content="${e(`${s.role} at ${s.affiliation}. ${s.degree}.`)}">
  <meta property="og:type" content="website">
  <title>${e(s.name)} · ${e(s.affiliation)}</title>
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/styles.css">
  <script src="assets/site.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header"><div class="header-inner">
    <a class="wordmark" href="#about" aria-label="${e(s.name)}, home">${e(s.name)}<span class="wordmark-dot">.</span></a>
    <nav aria-label="Main navigation"><a href="#about">About</a><a href="#research">Research</a><a href="#publications">Publications</a><button class="theme-toggle" data-theme-toggle type="button" aria-label="Switch theme" aria-pressed="false">${icon('sun')}</button></nav>
  </div></header>
  <div class="page-layout">
    <aside class="profile" aria-label="Profile"><div class="profile-inner">
      ${photo ? `<img class="portrait" src="${e(photo)}" alt="${e(s.name)}" width="180" height="180">` : `<div class="monogram" aria-hidden="true"><span>XQ</span></div>`}
      <h1>${e(s.name)}</h1>
      ${s.chinese_name ? `<p class="chinese-name" lang="zh-CN">${e(s.chinese_name)}</p>` : ''}
      <p class="profile-role">${e(s.role)}</p><p class="affiliation">${e(s.affiliation)}</p><p class="degree">${e(s.degree)}</p>
      <div class="social-links">${emails[0] ? `<a href="mailto:${e(emails[0])}">${icon('email')}<span>Email</span></a>` : ''}${external(s.scholar_url, `${icon('scholar')}<span>Scholar</span>`)}${external(s.github_url, `${icon('github')}<span>GitHub</span>`)}</div>
      <div class="sidebar-interests"><h2>Research interests</h2><ul>${s.research.map(r => `<li>${e(r.title)}</li>`).join('')}</ul></div>
      <a class="contact-link" href="#contact">Get in touch</a>
    </div></aside>
    <main id="main">
      <section id="about" class="about-section"><p class="eyebrow">About me</p><h2>Building toward<br><span>efficient intelligence.</span></h2>
        <div class="biography">${s.about.split(/\n\s*\n/).filter(p => p.trim()).map(p => `<p>${e(p.trim()).replace(/\n/g, '<br>')}</p>`).join('')}</div>
        <div class="affiliation-note"><span class="note-rule" aria-hidden="true"></span><span>${e(s.degree)}<br><strong>${e(s.affiliation)}</strong></span></div>
      </section>
      <section id="research"><div class="section-heading"><h2>Research interests</h2><span class="section-line" aria-hidden="true"></span></div><div class="research-grid">${s.research.map(r => `<article class="research-item"><h3>${e(r.title)}</h3><p>${e(r.description)}</p></article>`).join('')}</div></section>
      <section id="publications"><div class="section-heading"><h2>Publications</h2><span class="section-line" aria-hidden="true"></span></div>
        ${publications || `<p class="section-intro">My publication record is available on Google Scholar.</p>`}
        ${external(s.scholar_url, `${icon('scholar')}<span>View Google Scholar profile</span>`, 'scholar-link')}
      </section>
      <section id="education"><div class="section-heading"><h2>Education</h2><span class="section-line" aria-hidden="true"></span></div><div class="education-list">${s.education.map(item => `<article class="education-item"><div><h3>${e(item.institution)}</h3><p>${e(item.degree)}</p></div>${item.period ? `<span class="education-period">${e(item.period)}</span>` : ''}</article>`).join('')}</div></section>
      <section id="contact" class="contact-section"><p class="eyebrow">Contact</p><h2>Let’s connect.</h2><p>For research discussions and academic inquiries:</p><div class="contact-emails">${emails.map(email => `<a href="mailto:${e(email)}">${e(email)}</a>`).join('')}</div></section>
    </main>
  </div>
  <footer class="site-footer"><span>© ${new Date().getUTCFullYear()} ${e(s.name)}</span><div>${external(s.github_url, 'GitHub')}<a href="admin/">Admin</a></div></footer>
</body>
</html>`;
}
