# 分享给你的朋友

插件已经在 npm 上，所以**最省事的方式只需要一句话**：

> DSH → 插件 → 安装 → 填 `dsh-gpt-image-playground`

装完在插件列表里启用，刷新页面（Ctrl+R），左栏出现「相框」图标。

---

## 方式一：让朋友直接装（推荐）

DSH 里打开 **插件** 页 → **安装 / 添加插件** → 「包名或地址」填：

```
dsh-gpt-image-playground
```

安装后**启用**它，刷新页面即可。

**对方需要**：DSH 桌面端（能打开插件页），以及自己的图片 API（工作台里配置）。

---

## 方式二：发 Release 压缩包（对方网络不便时）

1. 从 [Releases](https://github.com/southcul/dsh-gpt-image-playground/releases) 下载 `gpt-image-playground-<版本>.zip` 发给对方。
2. 对方解压到任意目录（**不要**放进 DSH 安装目录）。
3. 二选一：
   - DSH 插件页 → 安装 → 填解压目录的**绝对路径**（推荐）
   - 或右键 `install.ps1` → **使用 PowerShell 运行**

**对方需要**：已安装并登录过一次 DSH 桌面端；不需要自己装 Node。

**卸载**：在解压目录执行 `node install.mjs --uninstall`。

---

## 方式三：从 GitHub 装

让对方在 DSH 插件页填仓库地址：

```
https://github.com/southcul/dsh-gpt-image-playground
```

或先 `git clone` 下来，再填本地目录的绝对路径。

---

## 朋友第一次用会遇到的两件事

1. **要配 API**：工作台里点右上角齿轮，填 API URL 与 Key。数据只存在他那台机器的浏览器存储里。
2. **可能跨域**：如果提示「接口不支持浏览器跨域请求」，点工作台**左下角 ⚙**（iframe 外的小按钮），填真实 API 地址，再把面板里显示的代理地址复制到应用的「API URL」。

---

## 安装小贴士

- 填本地目录时必须是**绝对路径**，且目录里有 `package.json`（zip 解压后的顶层目录正好）。
- 这种装法会记成 `file:` 依赖，那个目录**别删也别移动**；要挪就重装一次。
- 插件提供方更新后，非官方包需要先**卸载再安装**（插件管理器会提示）。

## 许可

MIT；界面来自上游 GPT Image Playground（作者 CookSleep，同为 MIT），详见包内 `THIRD-PARTY-NOTICES.md`。
