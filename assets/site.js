const toggle = document.querySelector('[data-theme-toggle]');
if (toggle) {
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let saved;
  try { saved = localStorage.getItem('academic-theme'); } catch {}
  let dark = saved ? saved === 'dark' : system.matches;
  const apply = () => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  };
  apply();
  toggle.addEventListener('click', () => {
    dark = !dark;
    saved = dark ? 'dark' : 'light';
    try { localStorage.setItem('academic-theme', saved); } catch {}
    apply();
  });
  system.addEventListener('change', event => { if (!saved) { dark = event.matches; apply(); } });
}
