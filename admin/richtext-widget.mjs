import { normalizeRichText, toDelta, textOf, RICH_FONTS, RICH_SIZES, RICH_WEIGHTS } from './richtext.mjs';

const plain = value => value?.toJS ? value.toJS() : value ?? '';
const signature = value => JSON.stringify(normalizeRichText(plain(value)));
const fontLabels = { system: '系统字体', georgia: 'Georgia', arial: 'Arial', serif: 'Times New Roman', mono: '等宽字体' };
const weightLabels = { 400: '常规', 500: '中等', 600: '半粗', 700: '加粗', 800: '特粗' };
const colorValue = (value, fallback) => typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value) ? value : fallback;
const safeLink = value => {
  const document = normalizeRichText({ ops: [{ insert: 'link', attributes: { link: value.trim() } }] });
  return document.ops[0]?.attributes?.link || '';
};

export function registerRichTextWidget(CMS, h, createClass, Quill) {
  const Font = Quill.import('attributors/class/font');
  Font.whitelist = Object.keys(RICH_FONTS);
  Quill.register(Font, true);
  const Size = Quill.import('attributors/style/size');
  Size.whitelist = RICH_SIZES;
  Quill.register(Size, true);
  const Parchment = Quill.import('parchment');
  Quill.register(new Parchment.StyleAttributor('weight', 'font-weight', { scope: Parchment.Scope.INLINE, whitelist: RICH_WEIGHTS }), true);

  const Control = createClass({
    getInitialState() { return { formats: {}, selected: 0, linkOpen: false, linkValue: '', error: '', canUndo: false, canRedo: false }; },
    setEditorNode(node) { this.editorNode = node; },
    label() { return this.props.field?.get('label') || '文字'; },
    allowsLinks() { return this.props.field?.get('allow_links') !== false; },
    componentDidMount() {
      this.mounted = true;
      this.quill = new Quill(this.editorNode, {
        theme: null,
        placeholder: this.props.field?.get('placeholder') || '在这里输入文字…',
        formats: ['font', 'size', 'weight', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'align', 'list', 'script', ...(this.allowsLinks() ? ['link'] : [])],
        modules: {
          toolbar: false,
          history: { delay: 500, maxStack: 100, userOnly: true },
          keyboard: { bindings: { customBold: { key: 'b', shortKey: true, handler() {
            const active = this.quill.getFormat();
            this.quill.format('weight', false, 'user');
            this.quill.format('bold', !(active.bold || Number(active.weight) >= 700), 'user');
            return false;
          } } } }
        }
      });
      this.quill.root.id = this.props.forID;
      this.quill.root.setAttribute('role', 'textbox');
      this.quill.root.setAttribute('aria-label', this.label());
      this.quill.root.setAttribute('aria-multiline', 'true');
      this.quill.root.setAttribute('aria-required', String(this.props.field?.get('required') !== false));
      this.quill.root.spellcheck = false;
      this.observedProps = signature(this.props.value);
      this.lastPublished = this.observedProps;
      this.quill.setContents(toDelta(plain(this.props.value)), 'silent');
      this.quill.history.clear();
      this.range = { index: 0, length: 0 };
      this.onTextChange = () => {
        if (!this.composing) this.publish();
        this.refreshToolbar();
      };
      this.onSelectionChange = range => {
        if (range) this.range = { index: range.index, length: range.length };
        this.refreshToolbar();
      };
      this.onCompositionStart = () => { this.composing = true; };
      this.onCompositionEnd = () => {
        this.composing = false;
        clearTimeout(this.compositionTimer);
        this.compositionTimer = setTimeout(() => { if (this.mounted) { this.quill.update('user'); this.publish(); this.refreshToolbar(); } }, 0);
      };
      this.onEditorBlur = () => { if (!this.composing) this.publish(); };
      this.onEditorClick = event => { if (event.target.closest('a')) event.preventDefault(); };
      this.quill.on('text-change', this.onTextChange);
      this.quill.on('selection-change', this.onSelectionChange);
      this.quill.root.addEventListener('compositionstart', this.onCompositionStart);
      this.quill.root.addEventListener('compositionend', this.onCompositionEnd);
      this.quill.root.addEventListener('blur', this.onEditorBlur);
      this.quill.root.addEventListener('click', this.onEditorClick);
      this.refreshToolbar();
    },
    componentDidUpdate() {
      if (!this.quill || this.composing) return;
      const incoming = signature(this.props.value);
      // Local toolbar state updates must never put a stale prop value back into the editor.
      if (incoming === this.observedProps) return;
      this.observedProps = incoming;
      this.lastPublished = incoming;
      if (incoming === signature(this.quill.getContents())) return;
      const selection = this.quill.getSelection();
      this.quill.setContents(toDelta(plain(this.props.value)), 'silent');
      this.quill.history.clear();
      if (selection) this.quill.setSelection(Math.min(selection.index, this.quill.getLength() - 1), 0, 'silent');
      this.refreshToolbar();
    },
    componentWillUnmount() {
      this.mounted = false;
      clearTimeout(this.compositionTimer);
      if (!this.quill) return;
      this.quill.off('text-change', this.onTextChange);
      this.quill.off('selection-change', this.onSelectionChange);
      this.quill.root.removeEventListener('compositionstart', this.onCompositionStart);
      this.quill.root.removeEventListener('compositionend', this.onCompositionEnd);
      this.quill.root.removeEventListener('blur', this.onEditorBlur);
      this.quill.root.removeEventListener('click', this.onEditorClick);
    },
    isValid() {
      const value = this.quill ? this.quill.getContents() : plain(this.props.value);
      return this.props.field?.get('required') === false || textOf(value).trim() ? true : '请填写这段文字。';
    },
    publish() {
      if (!this.quill || !this.mounted) return;
      const next = normalizeRichText(this.quill.getContents());
      const key = JSON.stringify(next);
      if (key === this.lastPublished) return;
      this.lastPublished = key;
      this.props.onChange(next);
    },
    refreshToolbar() {
      if (!this.quill || !this.mounted) return;
      const range = this.quill.getSelection() || this.range;
      const formats = range ? this.quill.getFormat(range.index, range.length) : {};
      this.setState({ formats, selected: range?.length || 0, canUndo: !!this.quill.history.stack.undo.length, canRedo: !!this.quill.history.stack.redo.length });
    },
    rememberSelection() {
      const range = this.quill?.getSelection();
      if (range) this.range = { index: range.index, length: range.length };
    },
    restoreSelection() {
      const length = this.quill.getLength() - 1;
      const range = this.range || { index: length, length: 0 };
      const index = Math.min(range.index, length);
      const selection = { index, length: Math.min(range.length, length - index) };
      this.quill.focus({ preventScroll: true });
      this.quill.setSelection(selection.index, selection.length, 'silent');
      return selection;
    },
    apply(name, value) {
      this.restoreSelection();
      this.quill.history.cutoff();
      if (name === 'bold') this.quill.format('weight', false, 'user');
      if (name === 'weight') this.quill.format('bold', false, 'user');
      this.quill.format(name, value || false, 'user');
      this.quill.history.cutoff();
      this.refreshToolbar();
    },
    toggle(name) {
      const active = name === 'bold' ? this.state.formats.bold || Number(this.state.formats.weight) >= 700 : this.state.formats[name];
      this.apply(name, !active);
    },
    historyAction(action) {
      this.restoreSelection();
      this.quill.history[action]();
      this.refreshToolbar();
    },
    clearFormatting() {
      const range = this.restoreSelection();
      this.quill.history.cutoff();
      this.quill.removeFormat(range.length ? range.index : 0, range.length || this.quill.getLength() - 1, 'user');
      this.quill.setSelection(range.index, range.length, 'silent');
      this.quill.history.cutoff();
      this.refreshToolbar();
    },
    openLink() {
      this.rememberSelection();
      this.setState({ linkOpen: !this.state.linkOpen, linkValue: typeof this.state.formats.link === 'string' ? this.state.formats.link : '', error: '' });
    },
    applyLink() {
      const href = safeLink(this.state.linkValue);
      if (!href) { this.setState({ error: '请输入完整的 https:// 网页地址，或 mailto: 邮箱地址。' }); return; }
      const range = this.restoreSelection();
      this.quill.history.cutoff();
      if (!range.length) {
        this.quill.insertText(range.index, href, { link: href }, 'user');
        this.quill.setSelection(range.index + href.length, 0, 'silent');
      } else this.quill.format('link', href, 'user');
      this.quill.history.cutoff();
      this.setState({ linkOpen: false, error: '' });
      this.refreshToolbar();
    },
    renderButton(label, content, onClick, active, disabled = false, extra = {}) {
      return h('button', { type: 'button', title: label, 'aria-label': label, ...(active === undefined ? {} : { 'aria-pressed': !!active }), disabled, onMouseDown: event => { this.rememberSelection(); event.preventDefault(); }, onClick, ...extra }, content);
    },
    renderSelect(label, value, options, format) {
      return h('label', { className: 'rt-select-label' }, h('span', {}, label), h('select', {
        'aria-label': label, value: typeof value === 'string' ? value : '', onMouseDown: this.rememberSelection, onFocus: this.rememberSelection,
        onChange: event => this.apply(format, event.target.value)
      }, options.map(([key, text]) => h('option', { key, value: key }, text))));
    },
    render() {
      const f = this.state.formats;
      const multiline = this.props.field?.get('multiline') !== false;
      const fontOptions = [['', '跟随板块'], ...Object.keys(RICH_FONTS).map(key => [key, fontLabels[key] || key])];
      const sizeOptions = [['', '默认字号'], ...RICH_SIZES.map(size => [size, size])];
      const weight = f.weight || (f.bold ? '700' : '');
      return h('div', { className: `richtext-widget${multiline ? '' : ' rt-compact'}`, 'data-richtext-field': this.props.field?.get('name') },
        h('div', { className: 'rt-toolbar', role: 'group', 'aria-label': `${this.label()}格式工具栏` },
          h('div', { className: 'rt-toolbar-row' },
            this.renderSelect('字体', f.font, fontOptions, 'font'),
            this.renderSelect('字号', f.size, sizeOptions, 'size'),
            this.renderSelect('粗细', weight, [['', '默认粗细'], ...RICH_WEIGHTS.map(value => [value, weightLabels[value]])], 'weight')
          ),
          h('div', { className: 'rt-toolbar-row rt-buttons' },
            this.renderButton('加粗', h('b', {}, 'B'), () => this.toggle('bold'), f.bold || Number(f.weight) >= 700),
            this.renderButton('斜体', h('i', {}, 'I'), () => this.toggle('italic'), f.italic),
            this.renderButton('下划线', h('u', {}, 'U'), () => this.toggle('underline'), f.underline),
            this.renderButton('删除线', h('s', {}, 'S'), () => this.toggle('strike'), f.strike),
            h('label', { className: 'rt-color', title: '选中文字后选择文字颜色' }, h('span', {}, '文字颜色'), h('input', { type: 'color', 'aria-label': '文字颜色', value: colorValue(f.color, '#176b60'), onMouseDown: this.rememberSelection, onFocus: this.rememberSelection, onChange: event => this.apply('color', event.target.value) })),
            h('label', { className: 'rt-color', title: '选中文字后选择高亮颜色' }, h('span', {}, '高亮'), h('input', { type: 'color', 'aria-label': '高亮颜色', value: colorValue(f.background, '#fff2a8'), onMouseDown: this.rememberSelection, onFocus: this.rememberSelection, onChange: event => this.apply('background', event.target.value) })),
            this.renderButton('清除文字颜色', '自动色', () => this.apply('color', false)),
            this.renderButton('清除高亮', '去高亮', () => this.apply('background', false))
          ),
          h('div', { className: 'rt-toolbar-row rt-buttons' },
            this.renderSelect('对齐', f.align, [['', '左对齐'], ['center', '居中'], ['right', '右对齐'], ['justify', '两端对齐']], 'align'),
            ...(multiline ? [
              this.renderButton('项目符号列表', '• 列表', () => this.apply('list', f.list === 'bullet' ? false : 'bullet'), f.list === 'bullet'),
              this.renderButton('编号列表', '1. 列表', () => this.apply('list', f.list === 'ordered' ? false : 'ordered'), f.list === 'ordered')
            ] : []),
            ...(this.allowsLinks() ? [
              this.renderButton('插入或修改链接', '链接', this.openLink, this.state.linkOpen),
              this.renderButton('移除链接', '取消链接', () => this.apply('link', false), undefined, !f.link)
            ] : []),
            this.renderButton('撤销', '撤销', () => this.historyAction('undo'), undefined, !this.state.canUndo),
            this.renderButton('重做', '重做', () => this.historyAction('redo'), undefined, !this.state.canRedo),
            this.renderButton('清除格式：选中时清除选区，否则清除整个字段', '清除格式', this.clearFormatting)
          )
        ),
        this.state.linkOpen ? h('div', { className: 'rt-link-panel' },
          h('label', {}, '链接地址', h('input', { type: 'text', 'aria-label': '链接地址', value: this.state.linkValue, placeholder: 'https://…', autoFocus: true, onChange: event => this.setState({ linkValue: event.target.value, error: '' }), onKeyDown: event => {
            if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); this.applyLink(); }
            if (event.key === 'Escape') { event.preventDefault(); this.setState({ linkOpen: false }); this.restoreSelection(); }
          } })),
          h('button', { type: 'button', onClick: this.applyLink }, '应用链接'),
          h('button', { type: 'button', onClick: () => { this.setState({ linkOpen: false }); this.restoreSelection(); } }, '取消'),
          this.state.error ? h('p', { role: 'alert' }, this.state.error) : null
        ) : null,
        h('div', { className: 'rt-editor-host', ref: this.setEditorNode }),
        h('div', { className: 'rt-help' }, h('span', {}, this.state.selected ? `已选中 ${this.state.selected} 个字符` : '选中文字后调整格式；可用 Ctrl / Cmd + Z 撤销。'), h('span', {}, '局部格式优先于板块默认样式'))
      );
    }
  });
  CMS.registerWidget({ name: 'richtext', controlComponent: Control, allowMapValue: true });
}
