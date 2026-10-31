# 第一次发布：从零到装上

目标：把插件推到 GitHub，发布到 npm，并让别人能用一行包名装进 DSH。

下面每一步都可以直接复制。先在 **PowerShell** 里进到插件目录，并让 `node` 可用（只需在**当前窗口**执行一次，关掉窗口就失效）：

```powershell
cd C:\Users\Lenovo\Documents\deepseek-harness\default-workspace\plugin-dev\dsh-gpt-image-playground
$env:PATH = "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin;$env:PATH"
node -v        # 能打印版本号就对了
```

> 这台机器的特殊之处，教程里已经替你处理：
> - **没有全局 `node` / `npm`**：上面那条 PATH 解决了；`publish.ps1` 也会自己加
> - `git` 的 `user.name` / `user.email` 还没设置（首次提交会报错，见第 2 步）
> - PowerShell 5.1 对无 BOM 的 UTF-8 脚本有兼容问题：仓库里的 `.ps1` 已带 BOM

---

## 第 0 步：先跑一次网络自检

```powershell
node tools\net-check.mjs
```

期望看到 GitHub 与 npm 都可达。若 GitHub 不通，先按输出里的提示配代理，否则 `git push` 会卡住。

---

## 第 1 步：建 GitHub 仓库

1. 浏览器打开 https://github.com/new
2. **Repository name** 填 `dsh-gpt-image-playground`
3. 可见性选 **Public**（私有仓库别人装不了，也进不了插件市场）
4. **不要**勾选 “Add a README file” / “Add .gitignore” / “Choose a license”——本地已经有内容，勾了会冲突
5. 点 **Create repository**

建好后页面会显示仓库地址：`https://github.com/southcul/dsh-gpt-image-playground`。

---

## 第 2 步：设置 Git 身份（只需一次）

当前是空的，不设置的话 `git commit` 会失败：

```powershell
git config --global user.name "southcul"
git config --global user.email "你的GitHub邮箱"
```

检查：

```powershell
git config --global --list
```

---

## 第 3 步：提交并推送

```powershell
git init
git add .
git status --short          # 看一眼将要提交的文件
git commit -m "feat: GPT Image Playground as a DSH plugin"
git branch -M main
git remote add origin https://github.com/southcul/dsh-gpt-image-playground.git
git push -u origin main
```

`git status` 里**不应该**出现：`dist/`、`npm-pack/`、`node_modules/`、`.npmrc`、`preview/.data/`。它们都在 `.gitignore` 里；若出现了，先停下检查。

### 推送时要求认证

GitHub 不接受账号密码，两种方式任选：

**方式 A：Personal Access Token（推荐）**

1. 打开 https://github.com/settings/tokens → **Generate new token (classic)**
2. Note 填 `dsh-plugin-push`，Expiration 选 90 天，勾选 **`repo`** 权限
3. 生成后复制（`ghp_` 开头，只显示一次）
4. `git push` 提示密码时，用户名填 `southcul`，**密码粘贴这个 Token**

Windows 上 Git 会把凭据存进“凭据管理器”，下次不用再输。

**方式 B：SSH**

```powershell
ssh-keygen -t ed25519 -C "你的邮箱"      # 一路回车
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"
```

把公钥贴到 https://github.com/settings/keys → New SSH key，然后：

```powershell
git remote set-url origin git@github.com:southcul/dsh-gpt-image-playground.git
ssh -T git@github.com     # 看到 successfully authenticated 即可
git push -u origin main
```

---

## 第 4 步：注册 npm 并生成 Token

1. 注册：https://www.npmjs.com/signup（用户名、邮箱、密码）
2. **验证邮箱**：不验证的话发布会被拒绝（`E403`）。查收邮件点确认链接。
3. 建议顺手开双因素认证（不是必须，但更安全）
4. 生成发布用 Token：https://www.npmjs.com/settings/southcul/tokens → **Generate New Token**
   - 类型选 **Automation**（发布时不会弹 OTP 提示）
   - 复制 `npm_` 开头的字符串（只显示一次）

---

## 第 5 步：写入凭证

在插件目录新建 `.npmrc`（**只在本机，已在 `.gitignore` 里，不会上传**）：

```powershell
Set-Content -Path .npmrc -Value '//registry.npmjs.org/:_authToken=npm_你的Token' -Encoding ascii
```

确认它没被 git 跟踪：

```powershell
git status --short        # 不应出现 .npmrc
```

---

## 第 6 步：先预演，再真发

```powershell
.\publish.ps1 -DryRun
```

会依次：**校验包内容 → 跑两套自测 → 打包预演**（不上传）。看到 `Skip publishing ... (dry run)` 就说明一切就绪。

然后正式发布：

```powershell
.\publish.ps1
```

> 如果提示 “无法加载文件 … 因为在此系统上禁止运行脚本”，改用：
> `powershell -ExecutionPolicy Bypass -File .\publish.ps1`

成功会打印 `+ dsh-gpt-image-playground@0.2.1`。包名已被占用会报 `E403`，此时改 `package.json` 的 `name`（例如加前缀 `southcul-`）。

---

## 第 7 步：验证发布成功

```powershell
# 注册表能查到
node -e "fetch('https://registry.npmjs.org/dsh-gpt-image-playground').then(r=>r.json()).then(j=>console.log(j['dist-tags']))"
```

浏览器也应该能打开 https://www.npmjs.com/package/dsh-gpt-image-playground

再自查 tarball 装得上、能挂载：

```powershell
node tools\test-npm-tarball.mjs
```

---

## 第 8 步：让别人装进 DSH

对方只需要：DSH → **插件 → 安装** → 填

```
dsh-gpt-image-playground
```

装完在插件列表里启用，刷新页面，左栏出现「生图工作台」。

---

## 第 9 步：发 GitHub Release（可选但建议）

推一个标签，Actions 会自动打 zip/tgz 并建 Release：

```powershell
git tag v0.2.1
git push origin v0.2.1
```

到 https://github.com/southcul/dsh-gpt-image-playground/actions 看进度。Release 里会挂两个附件，适合发给不走 npm 的朋友。

---

## 第 10 步：进 DSH 插件市场（可选）

市场索引只收 npm 包，你已经发布了，接下来提交条目：

1. 打开 https://awesome-dsh-plugin.com/ → 右上角 **Submit**
2. 条目内容直接用 `docs/awesome-submission.md` 里那份 JSON（已填好 southcul）
3. 收录后别人在 DSH → 插件 → 发现 就能搜到

---

## 以后发新版

```powershell
# 1. 改 package.json 的 version（例如 0.2.2）
node tools\check-package.mjs --strict
.\publish.ps1
git add -A; git commit -m "chore: release v0.2.2"
git tag v0.2.2; git push origin v0.2.2
```

npm 上旧版本不能覆盖，必须换版本号。朋友那边要先卸载再安装（插件管理器对非官方包不做原地升级）。

---

## 出错对照表

| 现象 | 原因 / 处理 |
|---|---|
| `fatal: unable to auto-detect email address` | 第 2 步没做，补 `git config --global user.email` |
| `git push` 一直卡住 | GitHub 网络问题：`git config --global http.proxy http://127.0.0.1:7890`（端口按你的代理改） |
| `remote: Support for password authentication was removed` | 用了密码而不是 Token，见第 3 步方式 A |
| `E403 Forbidden` | 邮箱未验证 / Token 无 publish 权限 / 包名被占 |
| `EOTP` / 要求一次性密码 | 用 Automation Token，或 `.\publish.ps1 -Otp 123456` |
| `'node' is not recognized` | 用了裸 `node` 手动跑；用 `publish.ps1`，或先把自带 Node 目录加进 PATH |
| `prepublishOnly` 失败 | 自测或校验没过，按输出修；这一步正是拦“坏包”的 |
| 发布成功但朋友搜不到 | 注册表同步延迟；或他填的是本地路径而不是包名 |
| `git push` 报 `non-fast-forward` | 远端有本地没有的提交（比如建仓库时勾了 README），先 `git pull --rebase` |

---

## 安全清单

- `.npmrc` 只在本机，已在 `.gitignore`；**永远不要**提交
- Token 泄露立即到 https://www.npmjs.com/settings/southcul/tokens 撤销并重建
- GitHub Token 用完可删；泄漏到 90 天后会自动过期
- 发布前 `git status` 与 `node tools\check-package.mjs --strict` 都过一遍
