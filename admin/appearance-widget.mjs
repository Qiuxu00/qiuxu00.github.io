import { GROUPS, DEFAULT_APPEARANCE, normalizeAppearance } from './appearance.mjs';

const plain = value => value?.toJS ? value.toJS() : value || {};
const isColor = value => /^#[a-f\d]{6}$/i.test(value);
const category = field => field.category || (field.type === 'color' ? '颜色' : /hover|shadow/.test(field.key) ? '动效' : /Font|Size|Weight|lineHeight|letterSpacing/.test(field.key) && !/desktop|mobile/.test(field.key) ? '文字' : '布局');

export function registerAppearanceWidget(CMS, h, createClass) {
  const Control = createClass({
    getInitialState() {
      return { group: 'global', theme: 'light', history: [], drafts: {}, confirmReset: false, notice: '' };
    },
    componentDidMount() {
      this.onPreviewTheme = event => this.setState({ theme: event.detail.theme, drafts: {} });
      window.addEventListener('homepage-preview-theme', this.onPreviewTheme);
      this.focusPreview();
    },
    componentWillUnmount() { window.removeEventListener('homepage-preview-theme', this.onPreviewTheme); },
    values() { return normalizeAppearance(plain(this.props.value)); },
    focusPreview(group = this.state.group, theme = this.state.theme) {
      window.dispatchEvent(new CustomEvent('homepage-preview-focus', { detail: { section: group, theme } }));
    },
    selectGroup(group) {
      this.setState({ group, drafts: {}, confirmReset: false, notice: '' });
      this.focusPreview(group);
    },
    commit(next, notice = '') {
      const previous = this.values();
      const normalized = normalizeAppearance(next);
      if (JSON.stringify(previous) === JSON.stringify(normalized)) return;
      this.setState(state => ({ history: [...state.history.slice(-29), previous], confirmReset: false, notice }));
      this.props.onChange(normalized);
    },
    change(field, value) {
      const all = this.values();
      this.commit({ ...all, [this.state.group]: { ...all[this.state.group], [field.key]: value } });
    },
    clearDraft(id) {
      this.setState(state => { const drafts = { ...state.drafts }; delete drafts[id]; return { drafts }; });
    },
    undo() {
      const previous = this.state.history.at(-1);
      if (!previous) return;
      this.props.onChange(previous);
      this.setState(state => ({ history: state.history.slice(0, -1), drafts: {}, confirmReset: false, notice: '已撤销上一次调整。' }));
    },
    renderField(field, values) {
      const id = `appearance-${this.state.group}-${field.key}`;
      const value = values[field.key];
      const label = h('label', { htmlFor: id }, field.label);
      let input;
      if (field.type === 'range') {
        const changeDraft = event => {
          const raw = event.target.value;
          this.setState(state => ({ drafts: { ...state.drafts, [id]: raw } }));
          const number = Number(raw);
          if (raw !== '' && Number.isFinite(number) && number >= field.min && number <= field.max) this.change(field, number);
        };
        input = h('div', { className: 'design-range-row' },
          h('input', { type: 'range', min: field.min, max: field.max, step: field.step || 1, value, 'aria-label': `${field.label}滑块`, onChange: event => { this.clearDraft(id); this.change(field, Number(event.target.value)); } }),
          h('input', { id, type: 'number', min: field.min, max: field.max, step: field.step || 1, value: this.state.drafts[id] ?? value, onChange: changeDraft, onBlur: () => {
            const raw = this.state.drafts[id];
            if (raw !== undefined && raw !== '' && Number.isFinite(Number(raw))) this.change(field, Math.max(field.min, Math.min(field.max, Number(raw))));
            this.clearDraft(id);
          } }),
          h('span', { className: 'design-unit' }, field.unit || '')
        );
      } else if (field.type === 'select') {
        input = h('select', { id, value, onChange: event => this.change(field, event.target.value) }, field.options.map(option => h('option', { key: option.value, value: option.value }, option.label)));
      } else if (field.type === 'color') {
        const picked = isColor(value) ? value : this.state.theme === 'dark' ? '#e6ecee' : '#242d34';
        input = h('div', { className: 'design-color-controls' },
          h('div', { className: 'design-color-row' },
            h('input', { type: 'color', value: picked, 'aria-label': `${field.label}取色器`, onChange: event => { this.clearDraft(id); this.change(field, event.target.value); } }),
            h('input', { id, type: 'text', placeholder: '自动配色', spellCheck: false, maxLength: 7, value: this.state.drafts[id] ?? value, onChange: event => {
              const raw = event.target.value;
              this.setState(state => ({ drafts: { ...state.drafts, [id]: raw } }));
              if (raw === '' || isColor(raw)) this.change(field, raw);
            }, onBlur: () => this.clearDraft(id) }),
            h('button', { type: 'button', className: 'design-auto', onClick: () => { this.clearDraft(id); this.change(field, ''); }, disabled: !value && !this.state.drafts[id] }, '自动')
          ),
          h('small', {}, '留空跟随主题；也可输入 #RRGGBB。')
        );
      } else if (field.type === 'boolean') {
        input = h('input', { id, type: 'checkbox', checked: value, onChange: event => this.change(field, event.target.checked) });
      }
      return h('div', { className: `design-field design-field-${field.type}`, key: field.key }, label, input,
        field.help ? h('small', {}, field.help) : null,
        field.type === 'range' ? h('small', { className: 'design-limits' }, `${field.min}–${field.max}${field.unit || ''}`) : null
      );
    },
    render() {
      const all = this.values();
      const group = GROUPS.find(item => item.id === this.state.group) || GROUPS[0];
      const fields = group.fields.filter(field => field.type !== 'color' || (field.key.endsWith('Dark') ? this.state.theme === 'dark' : this.state.theme === 'light'));
      const categories = [...new Set(fields.map(category))];
      return h('div', { className: 'appearance-app', id: this.props.forID },
        h('div', { className: 'design-intro' },
          h('span', { className: 'design-kicker' }, 'DESIGN STUDIO'),
          h('h2', {}, '让主页成为你的样子'),
          h('p', {}, '选择板块，边调边看。满意后点击顶部「发布」，公开主页会自动更新。文字和照片请在「学术主页」中编辑。')
        ),
        h('nav', { className: 'design-tabs', 'aria-label': '选择要调整的板块' }, GROUPS.map(item => h('button', {
          key: item.id, type: 'button', 'aria-pressed': group.id === item.id, onClick: () => this.selectGroup(item.id)
        }, item.label))),
        h('div', { className: 'design-toolbar' },
          h('div', { className: 'design-theme', role: 'group', 'aria-label': '预览配色模式' }, ['light', 'dark'].map(theme => h('button', {
            key: theme, type: 'button', 'aria-pressed': this.state.theme === theme, onClick: () => { this.setState({ theme, drafts: {} }); this.focusPreview(group.id, theme); }
          }, theme === 'light' ? '浅色外观' : '深色外观'))),
          h('button', { type: 'button', className: 'design-locate', onClick: () => this.focusPreview() }, '定位到预览')
        ),
        h('div', { className: 'design-panel', role: 'region', 'aria-label': `${group.label}设置` },
          h('div', { className: 'design-panel-heading' }, h('h3', {}, group.label), h('p', {}, group.description)),
          categories.map(title => h('fieldset', { className: 'design-fieldset', key: title },
            h('legend', {}, title), h('div', { className: 'design-fields' }, fields.filter(field => category(field) === title).map(field => this.renderField(field, all[group.id])))
          ))
        ),
        h('div', { className: 'design-actions' },
          h('button', { type: 'button', disabled: this.state.history.length === 0, onClick: this.undo }, '撤销上次调整'),
          h('button', { type: 'button', onClick: () => { this.setState({ drafts: {} }); this.commit({ ...all, [group.id]: { ...DEFAULT_APPEARANCE[group.id] } }, `已恢复${group.label}的默认样式。`); } }, '恢复本板块默认'),
          h('button', { type: 'button', className: 'design-reset', onClick: () => {
            if (!this.state.confirmReset) { this.setState({ confirmReset: true }); return; }
            this.setState({ drafts: {} }); this.commit(DEFAULT_APPEARANCE, '已恢复全部默认样式，可撤销。');
            this.setState({ confirmReset: false });
          } }, this.state.confirmReset ? '确认恢复全部' : '恢复全部默认')
        ),
        h('p', { className: 'design-status', role: 'status', 'aria-live': 'polite' }, this.state.notice || '当前调整只影响预览；点击顶部「发布」后才会公开。')
      );
    }
  });
  CMS.registerWidget('appearance', Control);
}
