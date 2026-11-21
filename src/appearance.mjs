// Shared by the visual editor, draft preview, and published-page build.
export const FONTS = {
  system: 'Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',
  georgia: 'Georgia,"Times New Roman",serif',
  arial: 'Arial,Helvetica,sans-serif',
  serif: '"Times New Roman","Noto Serif SC",serif',
  mono: '"Cascadia Code",Consolas,"Courier New",monospace'
};

const fontOptions = [
  { value: 'system', label: '系统无衬线 · 清晰现代' },
  { value: 'georgia', label: 'Georgia · 经典衬线' },
  { value: 'arial', label: 'Arial · 简洁通用' },
  { value: 'serif', label: 'Times New Roman · 学术衬线' },
  { value: 'mono', label: '等宽字体 · 代码风格' }
];
const range = (key, label, min, max, step = 1, unit = 'px', category = '布局', help) => ({ key, label, type: 'range', min, max, step, unit, category, ...(help ? { help } : {}) });
const select = (key, label, options, category = '文字') => ({ key, label, type: 'select', options, category });
const color = (key, label) => ({ key, label, type: 'color', category: '颜色', help: '留空使用主题默认色；浅色和深色模式可分别设置。' });
const motionFields = [
  range('hoverScale', '悬停放大倍数', 1, 1.06, 0.005, '×', '动效', '1 表示不放大。建议使用 1.01–1.03，保持阅读稳定。'),
  range('shadowStrength', '悬停光影强度', 0, 40, 1, '%', '动效', '0 表示关闭光影。系统启用减少动态效果时，不执行放大。')
];
const sectionFields = [
  select('bodyFont', '正文字体', fontOptions),
  range('bodySize', '正文字号', 14, 28, 1, 'px', '文字'),
  select('bodyWeight', '正文粗细', [{ value: '400', label: '常规' }, { value: '500', label: '中等' }, { value: '600', label: '较粗' }]),
  select('titleFont', '标题字体', fontOptions),
  range('titleSize', '主标题字号', 16, 72, 1, 'px', '文字'),
  range('subheadingSize', '次级标题字号', 14, 40, 1, 'px', '文字', '论文题目、研究主题、学校名称等。'),
  select('titleWeight', '标题粗细', [{ value: '400', label: '常规' }, { value: '500', label: '中等' }, { value: '600', label: '较粗' }, { value: '700', label: '加粗' }]),
  range('lineHeight', '正文行距', 1.2, 2.4, 0.05, '倍', '文字'),
  range('letterSpacing', '字间距', -0.5, 3, 0.1, 'px', '文字'),
  color('textColor', '正文颜色'), color('textColorDark', '正文颜色 · 深色'),
  color('titleColor', '标题颜色'), color('titleColorDark', '标题颜色 · 深色'),
  color('accentColor', '链接与强调色'), color('accentColorDark', '链接与强调色 · 深色'),
  color('background', '板块背景'), color('backgroundDark', '板块背景 · 深色'),
  range('width', '板块宽度', 60, 100, 1, '%', '布局', '相对于所在栏的宽度；手机上会自动适配屏幕。'),
  range('paddingX', '左右内边距', 0, 64, 2),
  range('paddingY', '上下内边距', 0, 72, 2),
  range('marginBottom', '板块下方间距', 0, 100, 2),
  range('radius', '板块圆角', 0, 32, 1),
  ...motionFields
];

export const GROUPS = [
  { id: 'global', label: '整体布局', description: '设置整页宽度和两栏比例；窄屏会自动变成单栏。', fields: [
    range('pageWidth', '页面最大宽度', 960, 1600, 20),
    range('sidebarWidth', '个人资料栏宽度', 220, 360, 10),
    range('columnGap', '两栏间距', 24, 120, 4),
    color('pageBackground', '页面背景'), color('pageBackgroundDark', '页面背景 · 深色')
  ] },
  { id: 'avatar', label: '头像', description: '默认是更大的方形头像。上传照片请前往“个人资料与学术内容”。', fields: [
    range('desktopSize', '桌面头像尺寸', 160, 320, 4, 'px', '布局', '保持正方形；若资料栏较窄，会自动缩小以适配。'),
    range('mobileSize', '手机头像尺寸', 88, 160, 4),
    range('radius', '头像圆角', 0, 80, 2, 'px', '布局', '0 为直角方形。'),
    select('objectFit', '照片填充方式', [{ value: 'cover', label: '填满方形 · 可裁剪' }, { value: 'contain', label: '完整显示 · 可能留边' }], '布局'),
    range('posX', '照片水平位置', 0, 100, 1, '%'),
    range('posY', '照片垂直位置', 0, 100, 1, '%'),
    ...motionFields
  ] },
  ...[
    ['header', '顶部导航', '调整姓名标识、导航文字和导航区域。'],
    ['profile', '个人资料', '调整姓名、身份、学校和侧栏信息。'],
    ['about', '个人简介', '调整 About me 的标题和正文。'],
    ['research', '研究方向', '调整研究主题、说明与板块范围。'],
    ['publications', '论文', '调整论文题目、作者、摘要与链接。'],
    ['education', '教育经历', '调整学校名称、专业和时间。'],
    ['contact', '联系方式', '调整联系标题、邮箱与背景。'],
    ['footer', '页脚', '调整版权文字和底部链接。']
  ].map(([id, label, description]) => ({ id, label, description, fields: sectionFields.filter(field => {
    if (id === 'footer') return !['titleFont', 'titleSize', 'subheadingSize', 'titleWeight', 'titleColor', 'titleColorDark'].includes(field.key);
    if (id === 'header') return field.key !== 'subheadingSize';
    return true;
  }) }))
];

const sectionDefault = {
  bodyFont: 'system', titleFont: 'system', bodySize: 16, titleSize: 22, subheadingSize: 18,
  bodyWeight: '400', titleWeight: '600', lineHeight: 1.75, letterSpacing: 0,
  textColor: '', textColorDark: '', titleColor: '', titleColorDark: '', accentColor: '', accentColorDark: '', background: '', backgroundDark: '',
  width: 100, paddingX: 16, paddingY: 16, marginBottom: 32, radius: 10, hoverScale: 1.015, shadowStrength: 14
};
export const DEFAULT_APPEARANCE = {
  global: { pageWidth: 1180, sidebarWidth: 270, columnGap: 56, pageBackground: '', pageBackgroundDark: '' },
  avatar: { desktopSize: 220, mobileSize: 128, radius: 0, objectFit: 'cover', posX: 50, posY: 50, hoverScale: 1.035, shadowStrength: 20 },
  header: { ...sectionDefault, bodySize: 15, titleSize: 18, paddingX: 0, paddingY: 0, marginBottom: 0, radius: 0, hoverScale: 1.005 },
  profile: { ...sectionDefault, titleSize: 30, subheadingSize: 16, marginBottom: 0 },
  about: { ...sectionDefault, bodySize: 17, titleFont: 'georgia', titleSize: 44, titleWeight: '400', lineHeight: 1.85 },
  research: { ...sectionDefault }, publications: { ...sectionDefault }, education: { ...sectionDefault },
  contact: { ...sectionDefault, titleFont: 'georgia', titleSize: 30, titleWeight: '400', paddingX: 24, paddingY: 24 },
  footer: { ...sectionDefault, bodySize: 14, paddingX: 16, paddingY: 24, marginBottom: 0, radius: 0, hoverScale: 1.005 }
};

// Only known fields, finite bounded numbers, palette colors, and font identifiers enter CSS.
export function normalizeAppearance(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const output = {};
  for (const group of GROUPS) {
    const defaults = DEFAULT_APPEARANCE[group.id];
    const candidate = source[group.id] && typeof source[group.id] === 'object' ? source[group.id] : {};
    output[group.id] = { ...defaults };
    for (const field of group.fields) {
      const value = candidate[field.key];
      if (field.type === 'range') {
        const n = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
        if (Number.isFinite(n)) output[group.id][field.key] = Math.round(Math.min(field.max, Math.max(field.min, n)) * 1000) / 1000;
      } else if (field.type === 'color') {
        if (typeof value === 'string' && /^(?:#[\da-f]{3}|#[\da-f]{6})?$/i.test(value.trim())) output[group.id][field.key] = value.trim().toLowerCase();
      } else if (field.type === 'select') {
        if (field.options.some(option => option.value === String(value))) output[group.id][field.key] = String(value);
      }
    }
  }
  return output;
}

const rem = value => `${Math.round(value / 16 * 10000) / 10000}rem`;
const cssBlock = (selector, declarations) => `${selector}{${declarations.join(';')}}`;
const sectionSelector = id => `[data-section="${id}"]`;

function colorVariables(section, id, dark = false) {
  const suffix = dark ? 'Dark' : '';
  const fallbackBackground = id === 'contact' ? 'var(--soft)' : id === 'header' ? 'var(--header)' : 'transparent';
  return [
    `--section-text:${section[`textColor${suffix}`] || 'var(--ink)'}`,
    `--section-title:${section[`titleColor${suffix}`] || 'var(--ink)'}`,
    `--section-title-detail:${section[`titleColor${suffix}`] || section[`accentColor${suffix}`] || 'var(--accent-ink)'}`,
    `--section-accent:${section[`accentColor${suffix}`] || 'var(--accent)'}`,
    `--section-background:${section[`background${suffix}`] || fallbackBackground}`,
    '--effect-color:var(--section-accent)'
  ];
}

export function renderAppearanceCSS(raw) {
  const settings = normalizeAppearance(raw);
  const { global, avatar } = settings;
  const rules = [
    cssBlock(':root', [`--page-width:${global.pageWidth}px`, `--sidebar-width:${global.sidebarWidth}px`, `--column-gap:${global.columnGap}px`, `--page-background:${global.pageBackground || 'var(--bg)'}`]),
    'body{background:var(--page-background)}',
    '.page-layout{max-width:var(--page-width);grid-template-columns:var(--sidebar-width) minmax(0,1fr);gap:var(--column-gap)}',
    '.header-inner{max-width:var(--page-width)}',
    '.site-footer{max-width:calc(var(--page-width) - 64px)}',
    cssBlock('[data-avatar]', [`width:min(${avatar.desktopSize}px,100%)`, 'max-width:100%', 'height:auto', 'aspect-ratio:1', `border-radius:${avatar.radius}px`, `object-fit:${avatar.objectFit}`, `object-position:${avatar.posX}% ${avatar.posY}%`, `--hover-scale:${avatar.hoverScale}`, `--shadow-strength:${avatar.shadowStrength}`, '--effect-color:var(--section-accent,var(--accent))']),
    `[data-avatar].monogram:after{border-radius:max(0px,${avatar.radius - 8}px)}`
  ];
  const darkRules = [cssBlock(':root[data-theme="dark"]', [`--page-background:${global.pageBackgroundDark || 'var(--bg)'}`])];
  const autoDarkRules = [cssBlock(':root:not([data-theme])', [`--page-background:${global.pageBackgroundDark || 'var(--bg)'}`])];

  for (const group of GROUPS.filter(group => !['global', 'avatar'].includes(group.id))) {
    const id = group.id;
    const s = settings[id];
    const selector = sectionSelector(id);
    const textTargets = `:root ${selector} :is(p,li,.biography,.affiliation-note,.publication-year,.publication-links,.education-period,.sidebar-interests ul,.contact-emails,.social-links)`;
    rules.push(cssBlock(selector, [
      ...colorVariables(s, id), `font-family:${FONTS[s.bodyFont]}`, `font-size:${rem(s.bodySize)}`, `font-weight:${s.bodyWeight}`,
      `line-height:${s.lineHeight}`, `letter-spacing:${s.letterSpacing}px`, 'color:var(--section-text)', 'background:var(--section-background)',
      `width:${s.width}%`, 'max-width:100%', `padding:${s.paddingY}px ${s.paddingX}px`, `margin-bottom:${s.marginBottom}px`,
      `border-radius:${s.radius}px`, `--hover-scale:${s.hoverScale}`, `--shadow-strength:${s.shadowStrength}`, 'overflow-wrap:anywhere'
    ]));
    rules.push(cssBlock(textTargets, ['font-family:inherit', `font-size:${rem(s.bodySize)}`, `font-weight:${s.bodyWeight}`, `line-height:${s.lineHeight}`, 'letter-spacing:inherit', 'color:var(--section-text)']));
    rules.push(cssBlock(`${selector} a`, ['color:var(--section-accent)', 'font-family:inherit', 'font-size:inherit']));
    rules.push(cssBlock(`${selector} :is(h1,h2,h3)`, [`font-family:${FONTS[s.titleFont]}`, `font-weight:${s.titleWeight}`, 'color:var(--section-title)', 'letter-spacing:inherit']));
    rules.push(cssBlock(`${selector} :is(h1,h2)`, [`font-size:${rem(s.titleSize)}`]));
    rules.push(cssBlock(`${selector} h3`, [`font-size:${rem(s.subheadingSize)}`]));
    rules.push(cssBlock(`${selector} :is(h1,h2,h3) :is(a,span)`, ['color:inherit', 'font-family:inherit', 'font-size:inherit']));
    if (id === 'about') rules.push(`${selector} h2 .hero-accent{color:var(--section-title-detail)}`);
    rules.push(cssBlock(`:root ${selector} .eyebrow`, ['color:var(--section-accent)']));
    rules.push(cssBlock(`${selector} .affiliation-note strong`, ['color:inherit']));
    rules.push(cssBlock(`${selector} .note-rule`, ['background:var(--section-accent)']));
    if (id === 'profile') {
      rules.push(`${selector} .sidebar-interests h2{font-size:${rem(s.subheadingSize)}}`);
      rules.push(`${selector} .degree{max-width:none}`);
    }
    if (id === 'header') {
      rules.push(`${selector}{margin-left:auto;margin-right:auto}`);
      rules.push(`${selector} .wordmark{font-family:${FONTS[s.titleFont]};font-size:${rem(s.titleSize)};font-weight:${s.titleWeight};color:var(--section-title)}`);
      rules.push(`${selector} .header-inner nav a{font-size:inherit;color:var(--section-accent)}`);
    }
    if (id === 'footer') rules.push(`${selector}{width:min(${s.width}%,calc((var(--page-width) - 64px) * ${s.width / 100}));margin-left:auto;margin-right:auto}`);
    darkRules.push(cssBlock(`:root[data-theme="dark"] ${selector}`, colorVariables(s, id, true)));
    autoDarkRules.push(cssBlock(`:root:not([data-theme]) ${selector}`, colorVariables(s, id, true)));
  }
  rules.push(...darkRules);
  rules.push(`@media(prefers-color-scheme:dark){${autoDarkRules.join('')}}`);
  rules.push('@media(min-width:641px) and (max-width:850px){.page-layout{grid-template-columns:minmax(0,min(var(--sidebar-width),34%)) minmax(0,1fr);gap:min(var(--column-gap),32px)}}');
  rules.push(`@media(max-width:640px){
    .page-layout{display:block;padding-left:16px;padding-right:16px}
    .profile-inner{grid-template-columns:minmax(0,${avatar.mobileSize}px) minmax(0,1fr);column-gap:18px}
    [data-avatar]{width:min(${avatar.mobileSize}px,100%);height:auto;aspect-ratio:1}
    [data-section]{width:100%;padding-left:min(6vw,var(--mobile-padding,16px));padding-right:min(6vw,var(--mobile-padding,16px))}
    ${GROUPS.filter(group => !['global', 'avatar'].includes(group.id)).map(group => {
      const s = settings[group.id];
      const selector = sectionSelector(group.id);
      return `${selector}{--mobile-padding:${s.paddingX}px}${selector} :is(h1,h2){font-size:min(${rem(s.titleSize)},10vw)}${selector} h3{font-size:min(${rem(s.subheadingSize)},7vw)}`;
    }).join('')}
    [data-section="header"] .header-inner{padding-left:16px;padding-right:16px;gap:12px;flex-wrap:wrap}
    [data-section="header"] nav{flex-wrap:wrap;gap:14px}
    [data-section="footer"]{width:calc(100% - 32px);margin-left:16px;margin-right:16px;flex-wrap:wrap}
  }`);
  return rules.join('\n');
}
