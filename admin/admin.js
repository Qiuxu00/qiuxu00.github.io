async function start() {
  const status = document.getElementById('status');
  const instructions = document.getElementById('instructions');
  try {
    const settingsResponse = await fetch('settings.json', { cache: 'no-store' });
    if (!settingsResponse.ok) throw new Error('无法读取登录配置。');
    const settings = await settingsResponse.json();
    if (!settings.oauth_base_url) {
      status.textContent = '待配置：GitHub 登录尚未启用。';
      instructions.hidden = false;
      return;
    }
    const base = new URL(settings.oauth_base_url);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
      throw new Error('登录服务应填写纯 HTTPS 域名，例如 https://your-worker.workers.dev。');
    }
    // The login service restricts the production origin. A local preview never logs into the live editor.
    if (window.location.origin !== 'https://qiuxu00.github.io') {
      status.textContent = '本地预览不连接线上管理后台。请在 https://qiuxu00.github.io/admin/ 登录并发布修改。';
      return;
    }
    const response = await fetch('config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('无法读取编辑表单配置。');
    const config = await response.json();
    config.backend.base_url = base.origin;
    config.load_config_file = false;
    window.CMS_MANUAL_INIT = true;
    status.textContent = '正在加载编辑器…';
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/decap-cms@3.18.0/dist/decap-cms.js';
    script.referrerPolicy = 'no-referrer';
    const loaded = new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject(new Error('编辑器加载失败，请检查网络后刷新。'));
    });
    document.head.append(script);
    const richScript = document.createElement('script');
    richScript.src = 'vendor/quill.js';
    const richLoaded = new Promise((resolve, reject) => {
      richScript.onload = resolve;
      richScript.onerror = () => reject(new Error('文字编辑器加载失败，请刷新后重试。'));
    });
    document.head.append(richScript);
    await Promise.all([loaded, richLoaded]);
    const snapshotResponse = await fetch('preview-data.json', { cache: 'no-store' });
    if (!snapshotResponse.ok) throw new Error('无法读取预览资料，请刷新重试。');
    const snapshot = await snapshotResponse.json();
    const { registerHomepagePreview } = await import('./preview.mjs');
    const { registerAppearanceWidget } = await import('./appearance-widget.mjs');
    const { registerRichTextWidget } = await import('./richtext-widget.mjs');
    const { upgradeTextContent } = await import('./content.mjs');
    registerAppearanceWidget(window.CMS, window.h, window.createClass);
    registerRichTextWidget(window.CMS, window.h, window.createClass, window.Quill);
    registerHomepagePreview(window.CMS, window.h, new URL('../', window.location.href), snapshot);
    window.CMS.registerEventListener({ name: 'preSave', handler: ({ entry }) => {
      if (entry.get('collection') !== 'homepage') return;
      return Object.entries(upgradeTextContent(entry.get('data').toJS())).reduce((data, [key, value]) => data.set(key, value), entry.get('data'));
    } });
    window.CMS.init({ config });
    document.getElementById('setup').hidden = true;
  } catch (error) {
    status.textContent = error.message || '管理界面加载失败，请刷新重试。';
    instructions.hidden = false;
  }
}
start();
