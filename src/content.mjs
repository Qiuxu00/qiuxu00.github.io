import { isRichText, normalizeRichText } from './richtext.mjs';

export const RICH_SITE_FIELDS = ['name', 'chinese_name', 'role', 'affiliation', 'degree', 'about'];
export const RICH_LIST_FIELDS = {
  research: ['title', 'description'],
  publications: ['title', 'authors', 'venue', 'year', 'summary'],
  education: ['institution', 'degree', 'period']
};
export const DEFAULT_TEXTS = {
  nav_about: 'About', nav_research: 'Research', nav_publications: 'Publications',
  about_label: 'About me', hero_title: 'Building toward', hero_accent: 'efficient intelligence.',
  research_title: 'Research interests', publications_title: 'Publications', education_title: 'Education',
  contact_label: 'Contact', contact_title: 'Let’s connect.', contact_intro: 'For research discussions and academic inquiries:',
  sidebar_interests: 'Research interests', contact_cta: 'Get in touch',
  email_label: 'Email', scholar_label: 'Scholar', github_label: 'GitHub',
  scholar_link: 'View Google Scholar profile', paper_label: 'Paper', code_label: 'Code',
  footer_admin: 'Admin', papers_empty: 'My publication record is available on Google Scholar.'
};

// Also used before saving older entries: formatting upgrades never discard existing wording.
export function upgradeTextContent(input) {
  const data = structuredClone(input);
  const upgrade = (value, force = false) => isRichText(value) || force ? normalizeRichText(value ?? '') : value ?? '';
  for (const field of RICH_SITE_FIELDS) data[field] = upgrade(data[field]);
  for (const [list, fields] of Object.entries(RICH_LIST_FIELDS)) {
    data[list] = (data[list] || []).map(item => {
      const entry = { ...item };
      for (const field of fields) entry[field] = upgrade(entry[field], field === 'title' || field === 'institution');
      return entry;
    });
  }
  data.texts = { ...DEFAULT_TEXTS, ...(data.texts || {}) };
  for (const key of Object.keys(DEFAULT_TEXTS)) data.texts[key] = upgrade(data.texts[key]);
  return data;
}
