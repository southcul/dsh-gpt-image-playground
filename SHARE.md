# 分享给你的朋友

产物在 `dist/`：

| 文件 | 大小 | 用途 |
|---|---|---|
| `gpt-image-playground-0.2.1.zip` | ~1.5 MB | 直接发给朋友，解压 + 双击安装 |
| `dsh-gpt-image-playground-0.2.1.tgz` | ~1.5 MB | npm 包，用于 `npm publish` 或 `pnpm add` |

两个包内容一致（91 个文件）：插件代码、上游构建产物（`vendor-app/`）、许可证与第三方声明、安装脚本。不含测试、预览环境、API Key 或你的配置。

---

## 方式零：在 DSH 里直接装（不用脚本，朋友最省事）

DSH 自带的插件管理器接受**包名、GitHub 地址、本地目录**三种输入：

1. 让朋友把 zip 解压到任意目录（记住路径）。
2. DSH 里打开 **插件** 页（侧边栏「插件」，或设置里的插件列表）→ **安装 / 添加插件**。
3. 「包名或地址」里填解压出来的目录**绝对路径**，例如：

   ```
   C:\Users\Alice\Downloads\dsh-gpt-image-playground-0.2.1
   ```

4. 安装完成后在插件列表里**启用**它（`dsh.profile.bundles` 里勾上），刷新页面。

要点：

- 必须填**绝对路径**，且该目录里要有 `package.json`（zip 解压后的顶层目录正好）。
- 装的是包里 `files` 声明的部分，`preview/`、`tools/`、测试不会被复制过去。
- 这种装法会记成 `file:` 依赖，所以那个目录**别删也别移动**；想搬到别处就重新装一次。
- 已发布 npm 之后，这里直接填包名 `dsh-gpt-image-playground` 更省事。
- 推送 GitHub 之后，也能填仓库地址（形如 `https://github.com/你/dsh-gpt-image-playground`）。
- `.tgz` 只支持 **http(s) 直链**；本地 `.tgz` 文件路径不被当作目录，会报「请输入有效的包名或地址」。

> 你这台机器上插件已经装好了（链接模式），在本机再走一次会提示「这个包已经安装」。方式是给朋友用的。

---

## 方式一：发 zip（兜底，适合不想操作的场景）

1. 把 `dist/gpt-image-playground-0.2.1.zip` 发给朋友。
2. 朋友解压到任意目录（**不要**放进 DSH 安装目录）。
3. 右键 `install.ps1` → **使用 PowerShell 运行**（或在 PowerShell 里跑）：

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install.ps1
   ```

   脚本会自动找 DSH 自带的 Node，把插件复制进 profile、写进依赖与启用列表，改文件前先备份。
4. 刷新 DSH 页面，左栏出现「生图工作台」。

**对方需要**：已安装并登录过一次 DSH 桌面端（脚本依赖它的 profile 与 Node 运行时）。不需要自己装 Node。

**卸载**：在解压目录执行 `node install.mjs --uninstall`。

---

## 方式二：发布到 npm（朋友只填一个包名）

你这台机器**没有装 npm 命令**，但有 DSH 自带的 pnpm，够用。仓库里已备好 `publish.ps1`。

### 1. 准备 Token（只需一次）

1. 没有 npm 账号就先在 https://www.npmjs.com/signup 注册。
2. 打开 https://www.npmjs.com/settings/<你的账号>/tokens → **Generate New Token** → 选 **Automation**（这类 Token 发布时不会被要求输入 OTP）。
3. 复制 Token（`npm_` 开头，只显示一次）。

### 2. 写凭证（只需一次）

在插件目录新建 `.npmrc`（已加进 `.gitignore`，不会入库）：

```
//registry.npmjs.org/:_authToken=npm_你的Token
```

### 3. 发布

先把仓库地址补上（npm 页面会显示源码链接，严格校验也要求它）：

```powershell
node tools\set-repo.mjs <你的GitHub用户名> --author "你的名字"
```

然后：

```powershell
powershell -ExecutionPolicy Bypass -File .\publish.ps1
```

脚本依次做：**包内容校验 → 两套自测 → 预演 → 发布**，任一步失败就中止。

不想用脚本就手动跑（本机没有全局 `node`，要先把它加进 PATH，否则 `prepublishOnly` 会失败）：

```powershell
$env:PATH = "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin;$env:PATH"
node "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" publish --no-git-checks
```

- `--no-git-checks` 是因为这个目录可能还不是 git 仓库。
- 账号开了双因素认证且用的是普通 Token：加 `-Otp 123456`（或 `--otp=123456`）。
- 包名想加作用域（`@你/dsh-gpt-image-playground`）：改 `package.json` 的 `name`，发布时加 `--access public`。
- 先预演：`.\publish.ps1 -DryRun`（会跑测试与打包，只是不上传）。
- 单独校验：`node tools/check-package.mjs`；发布后自查：`node tools/test-npm-tarball.mjs`。

包名 `dsh-gpt-image-playground` 目前 **未被占用**（查注册表返回 404），可以直接用。

### 4. 验证

- 浏览器打开 `https://www.npmjs.com/package/dsh-gpt-image-playground`
- 或看注册表：`https://registry.npmjs.org/dsh-gpt-image-playground`

### 5. 朋友安装

DSH **插件页 → 安装**，填：

```
dsh-gpt-image-playground
```

或命令行 `dsh plugin --profile desktop add dsh-gpt-image-playground`。

### 6. 以后发新版

1. 改 `package.json` 的 `version`（例如 `0.2.1`）
2. 上游有更新就先 `node tools/vendor-dist.mjs`
3. `python tools/pack.py` 重打 zip/tgz（可选，npm 路线不需要）
4. 再跑一次 `publish.ps1`

朋友那边要先**卸载再安装**（插件管理器对非官方包不做原地升级，会提示「其他插件请先卸载再安装新版」）。

### 可能踩的坑

| 现象 | 原因 / 处理 |
|---|---|
| `EOTP` / 要求一次性密码 | 用 Automation Token，或加 `-Otp` |
| `E403 无法发布` | 包名被占（改名）、Token 无 publish 权限、或账号邮箱未验证 |
| 网络超时 | 你的网络对 npm 有时不稳；重试，或给 pnpm 配代理（`HTTPS_PROXY`） |
| 发布成功但朋友装不到 | 注册表同步有延迟，等一会儿；或确认他填的是包名不是本地路径 |

---

## 方式三：放到 GitHub，并进入 DSH 市场

GitHub 负责**存放与分发**，但要让别人在 DSH 里**搜到**，还需要目录收录——而目录只收 npm 包。所以完整顺序是：**npm 发布 → 推 GitHub → 提交目录**。

### 1. 推到 GitHub

仓库里已经准备好 `.gitignore`、`LICENSE`、`THIRD-PARTY-NOTICES.md`、README 截图、Release 工作流。

```bash
cd dsh-gpt-image-playground
git init
git add .
git commit -m "feat: GPT Image Playground as a DSH plugin"
git branch -M main
git remote add origin https://github.com/southcul/dsh-gpt-image-playground.git
git push -u origin main
```

提交前确认 `dist/`、`.npmrc`、`preview/.data/` 没被带进去（`.gitignore` 已排除）。

### 2. 打标签，自动出 Release

```bash
git tag v0.2.1
git push origin v0.2.1
```

`.github/workflows/release.yml` 会：跑 `tools/pack.py` 打 zip/tgz → 建 Release 并附上两个包。若在仓库 Secrets 里配了 `NPM_TOKEN`，还会顺便 `npm publish`（带 provenance）。

### 3. 让朋友从 GitHub 装

- 下载 Release 里的 zip，解压后在 DSH 插件页填目录路径
- 或 `dsh plugin --profile desktop add https://github.com/southcul/dsh-gpt-image-playground`

### 4. 进 DSH 插件市场（关键一步）

市场的索引是 npm 包 `dsh-plugin-catalog`，由 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 自动构建；索引里每个版本都标着 `"source": { "type": "npm" }`——**没有 npm 包就不会被收录**。

1. 先完成方式二（`publish.ps1`），确认 `https://registry.npmjs.org/dsh-gpt-image-playground` 能打开。
2. 按 [docs/awesome-submission.md](docs/awesome-submission.md) 里给出的条目格式，提交到 awesome-dsh-plugin：
   - 站点 https://awesome-dsh-plugin.com/ 右上角 **Submit**
   - 或仓库 issue / PR，贴上条目 JSON + npm 包名 + 仓库地址 + 两张截图
3. 收录后，DSH → 插件 → 发现 → 搜「Playground」即可一键安装，并能看到更新。

### 5. 以后发新版

```bash
# 改 package.json 的 version
python tools/pack.py
.\publish.ps1
git add -A && git commit -m "chore: release v0.2.1"
git tag v0.2.1 && git push origin v0.2.1
```

---

## 分享前检查清单

- [ ] `package.json` 的 `version` 和 `description` 是你想要的
- [ ] `dsh.upstream.version` 与实际 vendor 的上游版本一致（当前 **0.8.3**）
- [ ] `THIRD-PARTY-NOTICES.md` 在包里（MIT 要求保留上游版权声明）
- [ ] 没有把自己的 `settings.json`（代理目标）、API Key、历史图片打进去
- [ ] 确认 zip 里的 `INSTALL-FIRST.txt` 说明和你的安装方式一致

## 朋友第一次用会遇到的两件事

1. **要配 API**：工作台里点右上角齿轮，填 API URL 与 Key。数据只存在他那台机器的浏览器存储里。
2. **可能跨域**：如果提示「接口不支持浏览器跨域请求」，点工作台**左下角 ⚙**（iframe 外的小按钮），填真实 API 地址，再把面板里显示的代理地址复制到应用的「API URL」。

## 版本与兼容

- 插件面向 DSH 桌面端（0.2.x 运行时）开发，用到 `main` / `shell.overlay` 槽位与 `webServer` 路由。
- 上游构建固定为 v0.8.3；上游更新需要重新 vendor（见 README「更新上游」）。
- 你自己继续开发时用链接模式（`node install.mjs`），分发时用复制模式（zip 里的 `install.ps1`）。
