# 开发与发布

面向维护者。使用者请回到 [README](../README.md)。

## 结构

```
lib/index.js            宿主半侧：静态托管、同源代理、设置读写、精简原生 API
lib/client.js           浏览器半侧：槽位注册、常驻 surface、代理面板、界面裁剪
vendor-app/             上游构建产物（index.html / assets）
cordis.patch.yml        组合包 patch（insert 自身一条 Loader 行）
install.mjs             安装/卸载（--link 开发、--copy 分发）
install.ps1             Windows 一键安装（包装 install.mjs --copy）
publish.ps1             npm 发布（用 DSH 自带的 pnpm）
test-server.mjs         宿主半侧自测（原生 API + 静态托管 + 代理透传）
client-test.mjs         浏览器半侧自测（槽位注册 + 样式）
tools/vendor-dist.mjs   重新抓取上游构建
tools/pack.mjs          打 zip / tgz（内部调用 tools/pack.py）
tools/check-package.mjs 发布前校验（manifest / files / 许可证 / 占位符）
tools/test-pack.mjs     分发包回归：解压安装、卸载、复制后仍可挂载
tools/test-npm-tarball.mjs  npm tarball 安装回归
tools/mount-check.mjs   对任意目录做一次挂载检查
tools/npm-verify.mjs    查注册表：latest、版本、tarball 可达性
tools/npm-info.mjs      查任意包名的归属与版本
tools/net-check.mjs     GitHub / npm 连通性自检
tools/set-repo.mjs      一键写入 repository / homepage / bugs
tools/fetch-fonts.mjs   可选：下载上游内置字体（约 23 MB）
docs/first-publish.md   第一次发布的逐步教程
docs/awesome-submission.md  插件市场收录条目
```

## 开发

```bash
node test-server.mjs        # 宿主半侧
node client-test.mjs        # 浏览器半侧
node tools/pack.mjs         # 重新打 dist/（zip + tgz）
node tools/test-pack.mjs    # 分发包回归
node preview/serve.mjs --port 4518
node tools/test-switch.mjs  # 切换面板不中断生成的回归测试
```

开发时用链接模式安装，改完代码由 DSH 的 HMR 热加载：

```bash
node install.mjs             # junction 到桌面 profile
node install.mjs --uninstall # 卸载
```

## 更新上游

```bash
node tools/vendor-dist.mjs  # 从 GitHub Pages 抓官方构建
node tools/pack.mjs
```

同时把 `package.json` 的 `dsh.upstream.version` 改成新版本号。

内置字体默认**不随包分发**（HarmonyOS Sans SC 三个字重 + Maple Mono，约 23 MB）：界面会回退到系统字体，显示正常。需要离线内置字体时：

```bash
node tools/fetch-fonts.mjs  # 下载到 vendor-app/assets，然后重新打包
```

## 发布

```bash
node tools/check-package.mjs --strict                    # 校验
powershell -ExecutionPolicy Bypass -File .\publish.ps1   # npm
git tag v0.2.1 && git push origin v0.2.1                 # GitHub Release（Actions 打包含附件）
```

第一次发布请对照 [first-publish.md](first-publish.md)。

发布前会自动执行 `prepublishOnly`：两套自测 + `check-package`，任一失败就中止。

## 发布前自查

```bash
node tools/npm-verify.mjs        # 注册表：latest 是否指向新版本
node tools/test-npm-tarball.mjs  # tarball 装进临时目录并挂载
```
