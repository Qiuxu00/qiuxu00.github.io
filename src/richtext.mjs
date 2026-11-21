import { FONTS } from './appearance.mjs';

// The public renderer accepts data, never editor-generated HTML.
export const RICH_FONTS = FONTS;
export const RICH_SIZES = ['14px', '16px', '18px', '20px', '22px', '24px', '28px', '32px', '36px', '40px', '48px', '56px', '64px', '72px'];
export const RICH_WEIGHTS = ['400', '500', '600', '700', '800'];

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const inlineKeys = new Set(['bold', 'italic', 'underline', 'strike', 'color', 'background', 'font', 'size', 'weight', 'script', 'link']);
const blockKeys = new Set(['align', 'list', 'indent']);
const object = value => value && typeof value === 'object' && !Array.isArray(value);

export function isRichText(value) {
  return Boolean(object(value) && value.format === 'richtext' && Array.isArray(value.ops));
}

function color(value) {
  if (typeof value !== 'string') return '';
  const input = value.trim().toLowerCase();
  if (/^#[a-f\d]{6}$/.test(input)) return input;
  if (/^#[a-f\d]{3}$/.test(input)) return `#${[...input.slice(1)].map(char => char.repeat(2)).join('')}`;
  const rgb = input.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(1(?:\.0+)?))?\s*\)$/);
  if (rgb && rgb.slice(1, 4).every(channel => Number(channel) <= 255)) {
    return `#${rgb.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, '0')).join('')}`;
  }
  return '';
}

function link(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020<>]/.test(value)) return '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return parsed.href;
    if (parsed.protocol === 'mailto:' && /^mailto:[^\s<>@?]+@[^\s<>@?]+\.[^\s<>@?]+$/i.test(value)) return parsed.href;
  } catch {}
  return '';
}

function normalizeAttributes(input) {
  const attributes = {};
  if (!object(input)) return attributes;
  for (const key of ['bold', 'italic', 'underline', 'strike']) if (input[key] === true) attributes[key] = true;
  for (const key of ['color', 'background']) {
    const clean = color(input[key]);
    if (clean) attributes[key] = clean;
  }
  if (typeof input.font === 'string' && Object.hasOwn(RICH_FONTS, input.font)) attributes.font = input.font;
  const sizeText = typeof input.size === 'number' ? String(input.size) : typeof input.size === 'string' ? input.size : '';
  if (/^\d+(?:\.\d+)?(?:px)?$/.test(sizeText)) {
    const size = Number(sizeText.replace(/px$/, ''));
    if (Number.isFinite(size)) attributes.size = `${Math.round(Math.max(14, Math.min(72, size)) * 100) / 100}px`;
  }
  if (RICH_WEIGHTS.includes(String(input.weight))) attributes.weight = String(input.weight);
  if (input.script === 'sub' || input.script === 'super') attributes.script = input.script;
  const safeLink = link(input.link);
  if (safeLink) attributes.link = safeLink;
  if (['center', 'right', 'justify'].includes(input.align)) attributes.align = input.align;
  if (['ordered', 'bullet'].includes(input.list)) attributes.list = input.list;
  if (Number.isInteger(input.indent) && input.indent > 0) attributes.indent = Math.min(6, input.indent);
  return attributes;
}

function scopedAttributes(attributes, keys) {
  return Object.fromEntries(Object.entries(attributes).filter(([key]) => keys.has(key)));
}

function append(ops, insert, attributes = {}) {
  if (!insert) return;
  const operation = { insert, ...(Object.keys(attributes).length ? { attributes } : {}) };
  const previous = ops.at(-1);
  if (previous && JSON.stringify(previous.attributes) === JSON.stringify(operation.attributes)) previous.insert += insert;
  else ops.push(operation);
}

export function normalizeRichText(value) {
  // A string remains text even if it happens to contain HTML or serialized JSON.
  const input = typeof value === 'string'
    ? [{ insert: `${value.replace(/\r\n?/g, '\n')}\n` }]
    : object(value) && Array.isArray(value.ops) ? value.ops : [];
  const ops = [];
  for (const operation of input) {
    if (!object(operation) || typeof operation.insert !== 'string') continue;
    const attributes = normalizeAttributes(operation.attributes);
    const inlineAttributes = scopedAttributes(attributes, inlineKeys);
    const blockAttributes = scopedAttributes(attributes, blockKeys);
    const chunks = operation.insert.replace(/\r\n?/g, '\n').split('\n');
    chunks.forEach((chunk, index) => {
      append(ops, chunk, inlineAttributes);
      if (index < chunks.length - 1) append(ops, '\n', blockAttributes);
    });
  }
  if (!ops.length || !ops.at(-1).insert.endsWith('\n')) append(ops, '\n');
  const text = ops.map(operation => operation.insert).join('').slice(0, -1);
  return { format: 'richtext', text, ops };
}

export function textOf(value) {
  if (typeof value === 'string') return value;
  if (object(value) && Array.isArray(value.ops)) return normalizeRichText(value).text;
  return '';
}

export function toDelta(value) {
  return { ops: normalizeRichText(value).ops };
}

function spanHTML(text, attributes, allowLinks) {
  if (!text) return '';
  const styles = [];
  if (attributes.font) styles.push(`font-family:${RICH_FONTS[attributes.font]}`);
  if (attributes.size) styles.push(`font-size:${attributes.size}`);
  if (attributes.weight || attributes.bold) styles.push(`font-weight:${attributes.weight || '700'}`);
  if (attributes.italic) styles.push('font-style:italic');
  if (attributes.color) styles.push(`color:${attributes.color}`);
  if (attributes.background) styles.push(`background-color:${attributes.background}`);
  const decorations = [attributes.underline ? 'underline' : '', attributes.strike ? 'line-through' : ''].filter(Boolean);
  if (decorations.length) styles.push(`text-decoration:${decorations.join(' ')}`);
  if (attributes.script) styles.push(`vertical-align:${attributes.script === 'super' ? 'super' : 'sub'}`, 'font-size:.75em');
  let html = escapeHTML(text);
  if (styles.length) html = `<span style="${escapeHTML(styles.join(';'))}">${html}</span>`;
  if (allowLinks && attributes.link) html = `<a href="${escapeHTML(attributes.link)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
  return html;
}

function linesOf(value, allowLinks) {
  const lines = [];
  let html = '';
  for (const operation of normalizeRichText(value).ops) {
    const attributes = operation.attributes || {};
    const chunks = operation.insert.split('\n');
    chunks.forEach((chunk, index) => {
      html += spanHTML(chunk, attributes, allowLinks);
      if (index < chunks.length - 1) {
        lines.push({ html, attributes });
        html = '';
      }
    });
  }
  return lines;
}

function lineStyle(attributes) {
  const rules = [];
  if (attributes.align) rules.push(`text-align:${attributes.align}`);
  if (attributes.indent) rules.push(`margin-inline-start:${attributes.indent * 1.5}em`);
  return rules;
}

export function renderRichText(value, { inline = false, allowLinks = true } = {}) {
  // Preserve the original plain-text renderer's paragraph and line-break behavior.
  if (typeof value === 'string') {
    if (inline) return escapeHTML(value).replace(/\r?\n/g, '<br>');
    return value.split(/\n\s*\n/).filter(paragraph => paragraph.trim()).map(paragraph => `<p>${escapeHTML(paragraph.trim()).replace(/\n/g, '<br>')}</p>`).join('');
  }
  const lines = linesOf(value, allowLinks);
  if (!lines.some(line => line.html)) return '';
  if (inline) {
    const displayLines = lines.some(line => lineStyle(line.attributes).length);
    return lines.map(line => {
      const styles = lineStyle(line.attributes);
      return displayLines ? `<span style="display:block${styles.length ? `;${escapeHTML(styles.join(';'))}` : ''}">${line.html || '<br>'}</span>` : line.html;
    }).join(displayLines ? '' : '<br>');
  }
  let html = '';
  let openList = '';
  for (const line of lines) {
    const list = line.attributes.list === 'ordered' ? 'ol' : line.attributes.list === 'bullet' ? 'ul' : '';
    if (openList !== list) {
      if (openList) html += `</${openList}>`;
      if (list) html += `<${list}>`;
      openList = list;
    }
    const tag = list ? 'li' : 'p';
    const styles = lineStyle(line.attributes);
    html += `<${tag}${styles.length ? ` style="${escapeHTML(styles.join(';'))}"` : ''}>${line.html || '<br>'}</${tag}>`;
  }
  if (openList) html += `</${openList}>`;
  return html;
}
