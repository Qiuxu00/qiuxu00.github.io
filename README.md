# 丘序泓的个人学术主页

英文主页 + 中文管理界面。个人信息和论文集中保存在 `data/site.json`，管理后台通过 GitHub 登录后修改这份文件。GitHub Actions 将内容生成静态网页，再发布到 GitHub Pages。

## 当前进度

- 本地页面、移动端布局、浅色 / 深色主题已实现。头像默认为 220px 方形，手机上为 128px；各板块提供轻微悬停放大和光影。
- 已加入用户提供的姓名、学校、研究方向、校内邮箱、Scholar 和 GitHub 链接。
- 已直接核对 Google Scholar 当前列出的两篇论文，并用 arXiv 验证：AGQ（https://arxiv.org/abs/2610.33074 ）与 TernScope（https://arxiv.org/abs/2610.29617 ），均标为预印本。论文列表由后台维护，不会自动同步 Scholar。
- 个人简介由已提供信息整理，可以在后台修改。照片暂用姓名缩写，Gmail 未填写时不显示。
- GitHub Pages 已上线，管理员入口已接入 Cloudflare OAuth Worker，登录配置已存入 Cloudflare Secrets。真实账号登录、在线保存与自动部署已验证。

## 第一步：本地看页面

在 `D:\HomePage` 打开 PowerShell，执行：

```powershell
npm.cmd run dev
```

打开终端显示的 http://127.0.0.1:4173/ 。修改 `data/site.json` 后刷新首页即可看到新内容。用 `Ctrl+C` 停止预览。

本项目无需先安装依赖。使用 `npm.cmd` 是为了兼容 Windows PowerShell 的脚本执行策略；无需修改系统策略。

也可以执行 `npm.cmd run build`，然后双击 `dist/index.html` 查看静态主页。管理后台需要 HTTP / HTTPS 环境，不能通过双击 HTML 文件进行登录。

## 第二步：创建网站仓库

1. 使用 `Qiuxu00` 登录 GitHub，打开 https://github.com/new 。
2. 仓库名填写 **qiuxu00.github.io**，可见性选 **Public**。
3. 保持新仓库为空，不勾选 README、.gitignore 或 License，然后创建。
4. 在 PowerShell 的 `D:\HomePage` 下依次运行以下命令。`git add .` 会遵守已提供的 `.gitignore`，排除本地构建输出、预览工具和密钥文件。

```powershell
git init -b main
git add .
git commit -m "Create academic homepage"
git remote add origin https://github.com/Qiuxu00/qiuxu00.github.io.git
git push -u origin main
```

GitHub 登录请在 Git 自带的浏览器登录窗口完成。如果 Git 提示缺少提交者姓名/邮箱，再按提示配置你的 Git 提交身份。已有本地 Git 仓库或同名远端时不要重复初始化，应保留原有历史。

5. 打开仓库的 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
6. 在 **Actions → Publish academic homepage → Run workflow** 手动运行一次，后续修改 `main` 会自动触发。
7. 构建成功后，主页地址为 https://qiuxu00.github.io/ 。

**这里选择 GitHub Actions。** 本版本新增了可编辑内容文件，需要先生成页面，因此与最初“直接从分支发布 HTML”的入门路线有所不同。不要把仓库根目录或 `data/site.json` 直接当成网页入口。

## 第三步：启用网页版管理

按照 [OAuth 服务说明](oauth/README.md) 完成一次性连接：

1. 部署提供的 Cloudflare Worker。
2. 创建 GitHub OAuth App，回调地址指向 Worker 的 `/callback`。
3. 在 Worker 服务端保存 OAuth 配置；Client Secret 不放在网站仓库和聊天中。
4. 将真实 Worker 域名填入 `admin/settings.json`：

```json
{
  "oauth_base_url": "https://你的登录服务.workers.dev"
}
```

5. 提交这些公开配置，等待网站重新发布。

启用后访问 https://qiuxu00.github.io/admin/ ，通过 GitHub 登录后进入 **学术主页 → 个人资料与学术内容**。编辑“个人简介（英文）”时，右侧会立即预览未保存的内容，使用与公开主页相同的排版；若预览被隐藏，点击编辑器右侧的眼睛图标切换显示。

预览满意后点击“发布”。Decap CMS 会将内容提交到 GitHub，随后触发构建。网站更新需要等待 Actions 成功，并非保存后立即生效。

本地 `/admin/` 显示配置状态，不连接在线编辑器。只有生产域名可登录；如将来绑定自定义域名，要同步修改 `admin/admin.js` 的 origin 限制、CMS 的站点 URL、Worker 的站点 origin 与 GitHub OAuth App 配置。

## 第四步：日常维护

- 简介、研究方向、论文和教育经历：在管理后台的文字编辑器中修改，可以选中几个字单独设置格式。
- 页面外观：进入 **外观设计 → 页面样式工作台**，选择要调整的板块，右侧实时预览。
- 新增 Gmail：填写 Gmail 字段即可；留空时不展示。
- 个人照片：通过“个人照片”字段上传，生成到 `assets/uploads/`。
- 论文：自行核实作者顺序、发表状态与链接，再添加。预印本不要填写成已录用论文。
- 输入文字后使用工具栏排版，无需填写 HTML 或 Markdown。原有纯文字内容仍可正常显示。
- 编辑历史保留在 GitHub 提交中。需要恢复某次文字时，可从历史版本取回并重新保存。

### 像文字编辑器一样排版

1. 进入 **学术主页 → 个人资料与学术内容**，在简介或其他文本框中输入文字。
2. 用鼠标选中要调整的几个字，再设置字体、字号、粗细、斜体、下划线、删除线、文字颜色或高亮。工具栏会显示当前选区的格式。
3. 正文还支持段落对齐、有序 / 无序列表和链接。链接使用 HTTPS 地址或 `mailto:` 邮箱地址；论文标题本身的跳转地址仍在“论文地址”字段维护。
4. **清除格式** 会让选中的文字重新跟随板块默认样式；**撤销 / 重做** 用于纠正操作。局部指定的颜色和字号优先于“外观设计”中的默认值，指定颜色在浅色与深色模式中保持一致。
5. 展开 **页面标题、导航与按钮文字**，可编辑原来的简介大标题、板块标题、导航和链接按钮文字，并设置局部格式。
6. 检查右侧预览，点击 **发布 → 立即发布**，等待自动部署完成。刷新后格式会保留。

文字编辑器使用随站点一起发布的 Quill 2.0.3 文件；不需要额外登录或配置服务。文字格式以结构化数据保存，公开主页和预览使用同一个渲染器。新发布的脚本和样式带版本号，以减少浏览器使用旧资源的情况。

### 使用外观设计工作台

1. 选择 **整体布局、头像、顶部导航、个人资料、个人简介、研究方向、论文、教育经历、联系方式或页脚**。
2. 拖动滑块或直接输入数值；字体使用下拉框选择。点击 **定位到预览** 可跳转到对应区域。
3. 切换 **浅色外观 / 深色外观** 后，分别调整正文、标题、强调色和背景。颜色可用取色器或输入 `#RRGGBB`；点击“自动”恢复主题配色。
4. 每个板块可独立调整字体、字号、字重、行距、字间距、宽度、内边距、下方间距、圆角、悬停放大与光影强度。头像还支持桌面 / 手机尺寸、裁切方式和位置。手机会自动限制宽度，避免撑出屏幕。
5. 调整失误可 **撤销上次调整** 或 **恢复本板块默认**。恢复全部默认需要再点一次确认，也可撤销。撤销记录仅保留在本次打开工作台期间。
6. 满意后使用顶部 **发布 → 立即发布**，等待自动部署完成。外观单独保存在 `data/appearance.json`，不会覆盖个人简介和论文。

外观预览使用最近发布的个人资料；若刚修改了文字或照片，先发布内容并等部署完成，再刷新外观工作台。没有照片时，方形头像显示姓名缩写。系统开启“减少动态效果”时，放大动画会自动关闭。

## 文件说明

| 路径 | 用途 |
| --- | --- |
| `data/site.json` | 所有个人资料、简介和论文 |
| `data/appearance.json` | 各板块外观设置，通过后台工作台修改 |
| `assets/styles.css` | 页面颜色、排版与移动端样式 |
| `src/render.mjs` | 将资料生成 HTML |
| `src/preview.mjs` | 在管理后台实时预览未保存的内容 |
| `src/appearance.mjs` | 共用外观设置、输入范围和样式生成 |
| `src/richtext.mjs` | 富文本格式校验和安全渲染 |
| `src/content.mjs` | 旧文字兼容与页面标题默认值 |
| `admin/appearance-widget.mjs` | 外观设计工作台的交互控件 |
| `admin/richtext-widget.mjs` | 可选中文字设置格式的编辑器 |
| `admin/vendor/` | Quill 2.0.3 本地文件与 BSD 许可证 |
| `admin/` | Decap CMS 管理界面与配置 |
| `oauth/` | GitHub 登录服务，单独部署到 Cloudflare |
| `.github/workflows/pages.yml` | 自动生成并发布网站 |
| `dist/` | 构建结果，自动生成，无需手动修改 |

验证命令：`npm.cmd test`、`npm.cmd run build`；OAuth 安全检查见其单独说明。

## 参考文档

- [GitHub Pages 创建站点](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Pages 发布来源与 GitHub Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Decap GitHub backend](https://decapcms.org/docs/github-backend/)
- [Decap 手动初始化](https://decapcms.org/docs/manual-initialization/)

页面布局参考用户提供的 https://ruiyangsi.github.io/ ，本项目重新实现页面代码，未复制对方个人资料、照片或论文内容。
