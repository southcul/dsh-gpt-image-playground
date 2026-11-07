# 基线：插件 0.2.7 / 上游 v0.8.9

下次升级请**从这个版本继续**，不要回到 0.2.x 之前的手写 UI 版本。
本文件是维护记录，不在 npm 包内（`files` 只收 `docs/**/*.png`）。

## 〇、发布前必须确认（用户要求，2026-11-07）

**任何版本发布前，先向用户确认，不要自行发布。**

流程：

1. 改完代码、跑完自测，**停下**
2. 给用户一份「本次改动摘要 + 计划发布的版本号 + 是否含上游更新」
3. 等用户明确同意；用户可能还有别的修改要一起发
4. 同意后才执行：`publish.ps1 -Yes`（不带 `-Yes` 时脚本会问一次，无交互输入即视为取消）

> `publish.ps1` 已内置这道闸：没有 `-Yes` 且拿不到 "y" 就中止，绝不静默上传。
> `-DryRun` 不受影响，随时可预演。
> 只提交代码、不发布版本，不需要确认。

## 一、当前基线

| 项 | 值 |
|---|---|
| 插件版本 | `0.2.7` |
| 内嵌上游构建 | **v0.8.9**（GitHub Pages 官方构建，`vendor-app/sw.js` 里 `CACHE_NAME = gpt-image-playground-v0.8.9`） |
| `vendor-app` | 82 个文件 / 3.73 MB |
| npm | `dsh-gpt-image-playground@0.2.7`（latest） |
| GitHub | 提交 `f2af27e`，Release `v0.2.7` |
| 市场目录 | `dsh-plugin-catalog@2026.1105.15517` 收录，版本 `0.2.7`，分类 `vision` |

## 二、对上游构建做的文件级改动（只有 3 条）

上游 `vendor-app/` 的 **JS/CSS 一行未改**，只动了数据与体积：

1. `vendor-app/announcements.json` → `[]`（关闭上游公告卡）
2. 删除两个大字体：`HarmonyOS_Sans_SC_Regular-*.ttf`、`HarmonyOS_Sans_SC_Medium-*.ttf`（约 15.7 MB）
   - 依据：运行时字体请求为 0，界面回退系统字体，观感正常
3. 其余文件原样保留（含 KaTeX 小字体、third-party-notices 等）

## 三、对上游界面的删除 / 改写（运行时注入，改 `lib/client.js`）

全部在 iframe 内完成，上游代码不动：

| 对象 | 做法 | 匹配方式 |
|---|---|---|
| 「安装为应用」按钮 | `display:none` | `button[aria-label="安装为应用"]` |
| 「下载客户端」链接 | `display:none` | `a[aria-label="下载客户端"]` |
| 「操作指南」按钮 | `display:none` | `button[aria-label="操作指南"]` |
| 标题旁红色 NEW 更新角标 | `display:none` | `header button[title^="新版本"]` + 兜底 `header h1 > button[class*="bg-red-500"]` |
| 标题「GPT Image Playground」的链接 | 去掉 `href`/`target`/`rel`，加 `pointer-events:none` | `header h1 a`（href 含 github.com） |
| 设置页「关于」标签 | 打 `data-dsh-gipg-about="1"` 后 `display:none` | MutationObserver 按文本 `关于` 匹配 |
| 设置页版本徽标 | 文本改为插件版本，移除 `title` | `span.font-mono` 且文本匹配 `v\d+.\d+.\d+` |

> 观察器会随 React 重渲染重复执行；所有匹配都写成「幂等」形式，不会死循环。

## 四、插件自身新增的东西

**宿主半侧（`lib/index.js`）**

- 静态托管 `/plugins/dsh-gpt-image-playground/app`：SPA 回退到 `index.html`，带哈希的资源加长缓存
- 同源代理 `/plugins/dsh-gpt-image-playground/proxy`：透传 method/headers/body（multipart 不重编码）、跟随浏览器 abort、失败返回 OpenAI 形状错误体
- 设置读写 `/plugins/dsh-gpt-image-playground/settings`：`proxyTarget` + 版本下发
- 精简原生 API `/plugins/dsh-gpt-image-playground/api`：profiles / generate / history / image / test（给脚本用，界面不走它）

**浏览器半侧（`lib/client.js`）**

- 注册 `main` 占位盒 + `shell.overlay` 常驻 surface：切面板只隐藏 onloading，不销毁 iframe（否则生成请求被掐断）
- surface 用 `position:fixed` 跟随占位盒，并做一次偏移自校正
- 左下角 ⚙ 面板：设置代理目标、复制代理地址

**工具（`tools/`）**

| 脚本 | 用途 |
|---|---|
| `vendor-dist.mjs` | 从 GitHub Pages 重抓上游构建 |
| `pack.mjs` / `pack.py` | 打 zip + tgz |
| `check-package.mjs` | 发布前校验（manifest/files/许可证/占位符） |
| `test-pack.mjs` / `test-npm-tarball.mjs` / `mount-check.mjs` | 安装回归 |
| `verify-build.mjs` | 一次跑完：启动、裁剪、版本徽标、字体请求、失败请求 |
| `probe-update.mjs` | 伪造新版本，验证 NEW 角标被隐藏 |
| `probe-app.mjs` / `e2e-app.mjs` / `test-switch.mjs` | 启动探针 / 真实出图 / 切面板不断流 |
| `npm-verify.mjs` / `npm-info.mjs` / `net-check.mjs` | 注册表与网络自检 |
| `set-repo.mjs` | 写 repository/homepage/bugs |
| `fetch-fonts.mjs` | 可选：补回内置字体（+23 MB） |
| `market-check.mjs` / `market-submit.mjs` / `market-status.mjs` / `market-eta.mjs` / `wait-catalog.mjs` | 市场收录 |

## 五、删除过的文档

| 文件 | 状态 |
|---|---|
| `docs/first-publish.md` | 已删除（首次发布教程） |
| `docs/development.md` | 已删除（结构与开发命令） |
| `docs/awesome-submission.md` | 已删除（市场条目说明，现由 `market/*.yml` 承担） |
| `README.md` | 精简为：安装 / 首次使用 / 功能 / 与上游的差异 / 许可 |
| `SHARE.md` | 重写为纯安装指南（不再讲发布） |

`docs/` 现存仅三张截图。

## 六、下次升级 checklist（照做即可）

```powershell
cd C:\Users\Lenovo\Documents\deepseek-harness\default-workspace\plugin-dev\dsh-gpt-image-playground
$env:PATH = "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin;$env:PATH"
```

1. **确认上游**：GitHub release 的最新 tag；再打开 Pages 的 `index.html` 看入口 hash 是否变了。
2. **重抓**：`Rename-Item vendor-app vendor-app.old` → `node tools/vendor-dist.mjs`
   （字体体积大，抓到 js/css 齐全后可中断，不影响）
3. **恢复数据**：`announcements.json` 写 `[]`；删除 `HarmonyOS_Sans_SC_Regular/Medium/Bold-*.ttf` 与 `MapleMono-NF-CN-Regular-*.woff2`
4. **回归**：
   - `node tools/verify-build.mjs` — 三个按钮 / 关于 / 版本徽标 / 字体请求
   - `node tools/probe-update.mjs --url http://127.0.0.1:4518/` — NEW 角标仍隐藏
   - `node tools/e2e-app.mjs` — 真实出图
   - 若选择器失效（上游改版），改 `lib/client.js` 的 `FRAME_TRIM` 与 `apply()`
5. **改版本**：`package.json` 的 `version` +0.0.1、`dsh.upstream.version`、`README`/`THIRD-PARTY-NOTICES.md`/`release.yml` 文案、`market/promo.zh.md`
6. **发布**：
   ```powershell
   node tools\check-package.mjs --strict
   node tools\pack.mjs
   powershell -ExecutionPolicy Bypass -File .\publish.ps1
   git add -A; git commit -m "feat: update the vendored build to upstream vX.Y.Z"
   git tag v0.2.6; git push; git push origin v0.2.6
   ```
7. **市场**：无需任何操作。目录每日 04:24 UTC 重建，自动带上新版本；DSH 索引缓存 10 分钟。
8. **清理**：确认无误后删除 `vendor-app.old`。

## 七、不要做的事

- **不要改 `vendor-app/` 里的 js/css**：下次 vendor 会整体覆盖，改动会丢。所有界面调整放 `lib/client.js`。
- **不要把版本号写进市场条目**：`market/southcul__dsh-gpt-image-playground.yml` 不含版本，目录从 npm 自动取。
- **不要提交** `.npmrc`、`dist/`、`npm-pack/`、`preview/.data/`（`.gitignore` 已覆盖）。
- **不要写 `engines.dsh`**：写了会被市场判定为版本受限。
- **不要把大字体收回包里**，除非明确需要离线内置字体（那时体积 +23 MB）。
- **不要重复提市场 PR**：条目已合并（PR #11077），后续只靠目录自动刷新。

## 八、环境备注（本机）

- 全局没有 `node`/`npm`，用 DSH 自带运行时；`publish.ps1`/`install.ps1` 会自己把 Node 目录加进 PATH。
- `pnpm` 的元数据缓存会滞后，装新版本前先 `node "$env:USERPROFILE\.dsh\...\pnpm.mjs" view dsh-gpt-image-playground versions`。
- GitHub 直连偶发 `Connection was reset`，`git push` 失败时等 30–60 秒重试通常可成。
- DSH 的市场索引源已改为 **unpkg 优先**（jsdelivr 在本机不可达），配置在 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `plugin-market.indexes`。
