# 丘序泓的个人学术主页

英文主页 + 中文管理界面。个人信息和论文集中保存在 `data/site.json`，管理后台通过 GitHub 登录后修改这份文件。GitHub Actions 将内容生成静态网页，再发布到 GitHub Pages。

## 当前进度

- 本地页面、移动端布局、浅色 / 深色主题已实现。
- 已加入用户提供的姓名、学校、研究方向、校内邮箱、Scholar 和 GitHub 链接。
- 已直接核对 Google Scholar 当前列出的两篇论文，并用 arXiv 验证：AGQ（https://arxiv.org/abs/2610.33074 ）与 TernScope（https://arxiv.org/abs/2610.29617 ），均标为预印本。论文列表由后台维护，不会自动同步 Scholar。
- 个人简介由已提供信息整理，可以在后台修改。照片暂用姓名缩写，Gmail 未填写时不显示。
- GitHub Pages 已上线，管理员入口已接入 Cloudflare OAuth Worker，登录配置已存入 Cloudflare Secrets。真实账号登录与在线保存仍需完成验收。

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

启用后访问 https://qiuxu00.github.io/admin/ ，通过 GitHub 登录后进入 **学术主页 → 个人资料与学术内容**。编辑“个人简介（英文）”，保存 / 发布。Decap CMS 会将内容提交到 GitHub，随后触发构建。网站更新需要等待 Actions 成功，并非保存后立即生效。

本地 `/admin/` 显示配置状态，不连接在线编辑器。只有生产域名可登录；如将来绑定自定义域名，要同步修改 `admin/admin.js` 的 origin 限制、CMS 的站点 URL、Worker 的站点 origin 与 GitHub OAuth App 配置。

## 第四步：日常维护

- 简介、研究方向、论文和教育经历：在管理后台表单中修改。
- 新增 Gmail：填写 Gmail 字段即可；留空时不展示。
- 个人照片：通过“个人照片”字段上传，生成到 `assets/uploads/`。
- 论文：自行核实作者顺序、发表状态与链接，再添加。预印本不要填写成已录用论文。
- 空一行即可将简介分段；简介使用纯文字，不解释 HTML 或 Markdown。
- 编辑历史保留在 GitHub 提交中。需要恢复某次文字时，可从历史版本取回并重新保存。

## 文件说明

| 路径 | 用途 |
| --- | --- |
| `data/site.json` | 所有个人资料、简介和论文 |
| `assets/styles.css` | 页面颜色、排版与移动端样式 |
| `src/render.mjs` | 将资料生成 HTML |
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
