# GPT Image Playground for DeepSeek Harness

[![npm](https://img.shields.io/npm/v/dsh-gpt-image-playground?label=npm)](https://www.npmjs.com/package/dsh-gpt-image-playground)
[![license](https://img.shields.io/npm/l/dsh-gpt-image-playground)](LICENSE)
[![node](https://img.shields.io/node/v/dsh-gpt-image-playground)](package.json)

支持 **GPT Image**、**Gemini（Nano Banana）** 和 **Grok** 的图片生成与编辑工具，支持官方接口、OpenAI 兼容接口、api.toolify-ai.com 与自定义 HTTP 供应商。支持文本生图、参考图编辑、画板标注、遮罩编辑与 Agent 多轮对话，图片和历史记录保存在本地。

装进 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH）后，左栏多一个「生图工作台」，点开就是完整界面。

界面与功能来自上游官方构建（v0.9.0，原样 vendor），插件自己只负责**同源托管**和**可选的 API 代理**。

![工作台](docs/screenshot-gallery.png)

## 安装

### 用 npm 包名（推荐）

在 DSH 里打开 **插件 → 安装**，填：

```
dsh-gpt-image-playground
```

装完在插件列表里启用，刷新页面（Ctrl+R），左栏出现「相框」图标。

命令行等价：

```bash
dsh plugin --profile desktop add dsh-gpt-image-playground
```

### 从 Release 压缩包

下载 [最新 Release](https://github.com/southcul/dsh-gpt-image-playground/releases/latest) 里的 `gpt-image-playground-<版本>.zip`，解压后二选一：

- DSH 插件页 → 安装 → 填解压目录的**绝对路径**（推荐）
- 或右键 `install.ps1` → 使用 PowerShell 运行

### 从仓库源码

```bash
git clone https://github.com/southcul/dsh-gpt-image-playground
```

DSH → 插件 → 安装 → 填克隆目录的绝对路径。

## 第一次使用

1. 打开工作台 → 右上角齿轮 → **API 配置**，填 API URL 与 Key（存在本机浏览器存储，不上传）。
2. 若提示「接口不支持浏览器跨域请求」：点工作台**左下角 ⚙**（iframe 外的小按钮），填真实 API 地址并保存；再把面板里显示的代理地址复制到应用的「API URL」。

代理地址形如 `http://127.0.0.1:13807/plugins/dsh-gpt-image-playground/proxy`，请求由 DSH 主机转发，`Authorization` 与 multipart 图片体原样透传。

## 功能

完整继承上游：

- 画廊 / Agent 双模式；批量生成、迭代、多提示词提交、流式预览
- 参考图（最多 16 张）、遮罩编辑器、画板标注（画笔/文字/图形/像素橡皮擦）、评论定位
- 多 API 配置与多供应商（OpenAI 兼容 Images/Responses、sub2api 异步、fal.ai、自定义 HTTP 供应商）
- 1K/2K/4K 尺寸预设与规整、真实参数与改写后提示词对比
- 收藏夹、失败重试、框选/侧滑多选、大图预览、ZIP 备份
- 透明背景（原生 / 本地后处理）、Codex CLI 兼容、提示词防改写、外观与习惯配置

## 与上游的差异

界面裁剪与信息改写都在 iframe 内用注入的方式完成，**不改上游构建产物**：

- 隐藏右上角三个按钮：安装为应用 / 下载客户端 / 操作指南
- 隐藏设置页的「关于」标签（上游的更新检查与赞助入口；第三方许可仍随包提供，见 `THIRD-PARTY-NOTICES.md`）
- 设置页右上角的版本徽标改为**本插件版本**（不带提示、不显示上游版本）
- 关闭上游公告卡（`vendor-app/announcements.json` 为 `[]`）
- 工作台运行在常驻 iframe 中，因此 DSH 的窗口级快捷键不穿透到应用内部

![设置页](docs/screenshot-settings.png)

工作台之所以常驻在 `shell.overlay` 而不是 `main` 面板里：DSH 的 `main` 是 keyed 槽，切换面板会卸载工作台，正在跑的生成请求会随 iframe 一起被销毁。现在占位盒只负责定位，iframe 切走时仅隐藏、不卸载。

## 许可与致谢

- 本插件：MIT，见 [LICENSE](LICENSE)
- `vendor-app/` 是 GPT Image Playground 的官方构建，MIT，版权归 **CookSleep**，详见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)
- 上游项目：https://github.com/CookSleep/gpt_image_playground
