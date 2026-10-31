# 收录到 DSH 插件市场

DSH 的「发现」页读的是社区维护的目录索引：

```
https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json
```

这个索引来自 **npm 包 `dsh-plugin-catalog`**，而该包由 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 仓库通过 GitHub Actions 自动构建发布。所以收录顺序是：

```
npm 发布 → 目录仓库提交条目 → 目录重新发布 → DSH 市场可见
```

> GitHub 仓库本身不进这个索引；索引里的每个版本都带 `"source": { "type": "npm" }`。**没有 npm 包就不会被收录**，这也是建议先做 `publish.ps1` 的原因。

## 条目长什么样

从线上索引取的真实结构：

```json
{
  "name": "dsh-image2-tool",
  "title": "544244857/dsh-image2-plugin",
  "description": {
    "en": "Registers an `image2_generate` tool …",
    "zh": "注册 `image2_generate` 工具：…"
  },
  "homepage": "https://awesome-dsh-plugin.com/p/544244857/dsh-image2-plugin/",
  "repository": { "url": "https://github.com/544244857/dsh-image2-plugin" },
  "metadata": {
    "category": "vision",
    "keywords": [],
    "labels": [],
    "sortKeys": {}
  },
  "versions": [
    { "version": "0.4.1", "publishTimestamp": 1792400563, "source": { "type": "npm" }, "engines": {} }
  ]
}
```

可用的分类 id（一部分）：`vision`、`ui`、`tools`、`theme`、`model`、`session`、`memory`、`docs`、`workflow`、`skill`… 图像工作台属于 **`vision`**。

## 提交这个条目

时间以你发布后为准；`name` 必须等于 npm 包名。

```json
{
  "name": "dsh-gpt-image-playground",
  "title": "southcul/dsh-gpt-image-playground",
  "description": {
    "en": "The full GPT Image Playground workbench inside DeepSeek Harness: gallery and agent modes, reference images with a mask/canvas editor, multi-provider API profiles, favorites and history — vendored from the upstream MIT build and served same-origin with an optional API proxy.",
    "zh": "把 GPT Image Playground 完整工作台装进 DeepSeek Harness：画廊与 Agent 双模式、参考图与遮罩/画板编辑、多供应商 API 配置、收藏夹与历史管理；界面为上游 MIT 构建原样托管，并提供可选的同源 API 代理。"
  },
  "repository": { "url": "https://github.com/southcul/dsh-gpt-image-playground" },
  "metadata": { "category": "vision", "keywords": ["image", "gpt-image", "playground", "openai", "workflow"], "labels": [], "sortKeys": {} }
}
```

提交入口：

1. 打开 https://awesome-dsh-plugin.com/ → 右上角 **Submit**（指向 GitHub 的提交入口）
2. 或到 https://github.com/awesome-dsh-plugin/awesome-dsh-plugin 开 issue / PR，贴上上面的条目加上：
   - npm 包名与版本
   - 仓库地址
   - 一句话说明 + 两张截图
   - 确认插件声明了 `dsh.bundle.patch` 与 `dsh.client`（本插件已声明）

## 收录前的自检

```bash
node tools/test-pack.mjs           # 分发包可装、可卸
pnpm view dsh-gpt-image-playground  # npm 上能查到（用 DSH 自带 pnpm）
```

另外确认 `package.json` 里：

- `engines.dsh` 未写死（写了就必须与用户 DSH 版本匹配，否则市场会显示不兼容）
- `dsh.bundle.patch` 指向存在的 `cordis.patch.yml`
- `files` 包含 `vendor-app/**/*`（否则装上也打不开界面）

## 被收录之后

- 朋友在 DSH → 插件 → 发现 → 搜索「Playground」，一条命令装好，后续还能看到「更新」。
- 发新版只需再 `publish.ps1` 一次；目录侧通常按 npm 版本自动更新（以目录维护者的流程为准）。
