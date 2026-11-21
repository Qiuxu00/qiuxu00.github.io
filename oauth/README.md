# 网页管理员的 GitHub 登录服务

这一目录只负责登录。主页仍然发布在 GitHub Pages，Decap CMS 将你在表单中的修改保存到 GitHub 仓库，再由主页的发布流程更新网站。

**当前状态：代码、7 项自动化测试和 Wrangler 的 dry-run 打包验证均已完成；服务已部署到 https://xuhong-homepage-auth.192013836.workers.dev ，GitHub OAuth 配置已保存为 Cloudflare Secrets。主页已接入该登录服务，真实账号登录和保存仍需完成验收。**

## 第一步：创建 Worker，取得登录服务网址

在 Cloudflare 账号里创建一个 Worker，建议名称 `xuhong-homepage-auth`。可通过 Cloudflare 网页编辑器，将 `worker.mjs` 的完整内容放入 Worker 后部署。它只有一个文件，没有运行时依赖。

记下 Cloudflare 分配的实际地址，形式为：

```text
https://xuhong-homepage-auth.你的实际子域名.workers.dev
```

这里的“你的实际子域名”是示意文字，必须替换为 Cloudflare 返回的真实值。不要猜这个地址。先访问根路径能看到服务正在运行的文字即可；这一步还不代表登录配置完成。

如果更习惯终端，也可以在 `D:\HomePage\oauth` 内使用：

```powershell
npm.cmd install
npx.cmd wrangler login
npm.cmd run deploy
```

首次运行 `wrangler login` 会打开 Cloudflare 登录页，需要你亲自登录。`wrangler.toml` 已指定 Worker 名称及主页相关的非敏感配置。

## 第二步：创建 GitHub OAuth App

使用 `Qiuxu00` 登录 GitHub，打开 [New OAuth App](https://github.com/settings/applications/new)，填写：

| 字段 | 填什么 |
| --- | --- |
| Application name | `Xuhong Qiu Homepage Admin` |
| Homepage URL | `https://qiuxu00.github.io` |
| Authorization callback URL | 第一步的真实 Worker 网址，加上 `/callback` |
| Enable Device Flow | 不勾选 |
| Expire user access tokens | 若显示该选项，请取消勾选；当前编辑器没有接入令牌刷新流程 |

例如 Worker 网址是 `https://xuhong-homepage-auth.example.workers.dev`，回调就是 `https://xuhong-homepage-auth.example.workers.dev/callback`。示例域名不能直接使用。

注册后找到 Client ID，并生成 Client Secret。**这两项填入 Cloudflare Worker 的服务器端配置；Client Secret 不要发到聊天中、写进网站文件或提交到 GitHub。**

## 第三步：配置 Worker

在该 Worker 的设置里找到 Variables and Secrets，增加下面两项，类型均选择 **Secret**：

| Secret 名称 | 值 |
| --- | --- |
| `GITHUB_OAUTH_ID` | GitHub OAuth App 的 Client ID |
| `GITHUB_OAUTH_SECRET` | GitHub OAuth App 的 Client Secret |

还需要以下三项非敏感变量。如果使用终端部署，它们已写在 `wrangler.toml` 中；如果使用网页编辑器部署，请手工添加：

| 变量 | 值 |
| --- | --- |
| `SITE_ORIGIN` | `https://qiuxu00.github.io`，末尾不带 `/` |
| `ALLOWED_GITHUB_LOGIN` | `Qiuxu00` |
| `CONTENT_REPOSITORY` | `Qiuxu00/qiuxu00.github.io` |

配置后保存并重新部署。管理员账号必须对这个公开仓库拥有写入权限。服务只接受在正式主页发起的登录；本地预览不进行真实登录。

如果使用终端，以下命令会分别通过交互提示让你输入值，不要把真实值加在命令后面：

```powershell
npx.cmd wrangler secret put GITHUB_OAUTH_ID
npx.cmd wrangler secret put GITHUB_OAUTH_SECRET
npm.cmd run deploy
```

## 第四步：将主页连接到 Worker

打开主页项目里的 `admin/settings.json`，只将 `oauth_base_url` 改为第一步的真实 Worker 地址。保留该文件已有的其他设置。例如这一项应为：

```json
"oauth_base_url": "https://实际的Worker地址.workers.dev"
```

只填 origin，不加 `/auth` 或 `/callback`，末尾不带 `/`，也不要把密钥放进这个文件。后台的 `admin/admin.js` 会把该值注入 Decap 的 `backend.base_url`，并使用 `auth_endpoint: auth`。本项目没有需要你另外编辑的 `config.yml`。

保存、提交并等待网站重新发布后，访问 `https://qiuxu00.github.io/admin/`，点击 GitHub 登录，用 `Qiuxu00` 授权。只有登录后的账号与仓库权限均通过检查，编辑器才会获得访问令牌。

## 第五步：确认完整流程

1. 通过正式主页的 `/admin/` 登录。
2. 修改简介中的一个词并保存/发布。
3. 在 GitHub 仓库里确认 `data/site.json` 出现新的提交。
4. 等待主页部署成功，重新打开公开主页，确认内容已改变。

如果后台提示仓库不可访问，检查仓库名称、公开状态和账号写权限。OAuth App 回调地址、Decap 的 `base_url` 和实际 Worker 地址必须对应同一个服务。登录窗口被阻止时，允许当前站点打开弹窗后重试。

## 权限与实现说明

- GitHub 的 OAuth `public_repo` scope 可以访问账号有权限的公开仓库，它不是单仓库令牌。此服务额外验证管理员账号和指定主页仓库的写权限。若以后需要严格的单仓库授权，应升级为 GitHub App 方案。
- 这是 Decap 的浏览器 OAuth 工作方式：令牌通过限定 origin 的 `postMessage` 交给编辑器，编辑器直接请求 GitHub。编辑器会管理自己的登录会话；使用完可退出登录。
- 服务端使用随机 `state`、10 分钟的 `Secure; HttpOnly; SameSite=Lax` cookie 和 PKCE。回调清除 cookie，检查账号和仓库权限后才向正确的窗口返回令牌。
- 未使用 `localStorage` 来伪装管理员权限，也没有公开的“保存文件”接口。
- 当前没有实现 refresh-token 接口。未请求 `offline_access`；若 OAuth App 设置为签发有期限的令牌，到期后重新登录。
- 不要把整个 `oauth` 目录放进主页的静态发布目录。主页构建只需要公开页面和后台静态文件；登录服务单独部署到 Cloudflare。

## 开发验证

```powershell
node --test worker.test.mjs
```

测试覆盖状态校验、PKCE、消息来源/窗口校验、账号与仓库授权拒绝、错误处理。测试使用模拟 GitHub 响应，不能替代第五步的真实登录与发布验收。

Wrangler 固定为 `4.59.1`（Node.js 20+）。安装后可运行 `npm.cmd run check` 验证 Cloudflare 打包；该命令使用 `--dry-run`，不发布服务。

## 实现来源

- [Decap 官方 OAuth 代理协议说明](https://decapcms.org/docs/backends-overview/#using-github-with-an-oauth-proxy)
- [Decap GitHub backend](https://decapcms.org/docs/github-backend/)
- [GitHub OAuth authorization-code flow、state 与 PKCE](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Cloudflare Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

实现前审阅了官方文档链接的 [sterlingwes/decap-proxy](https://github.com/sterlingwes/decap-proxy/tree/9adde7c898ed4675f414f50334c321d6c87751ed) 模板。该快照没有发现许可证文件，且示例未校验 OAuth state、对任意目标发送消息。本目录未复制其源码；采用上述公开协议独立实现，并增加相应校验。
