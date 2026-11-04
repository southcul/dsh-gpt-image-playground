# Third-party notices

This package redistributes a build of another project. Read this before
publishing or shipping it.

## GPT Image Playground (vendored build)

- Project: GPT Image Playground
- Author: CookSleep
- Source: https://github.com/CookSleep/gpt_image_playground
- Build redistributed: `vendor-app/` — the official production build published
  at https://cooksleep.github.io/gpt_image_playground/ (application version
  **v0.8.4**, per the build's own service-worker cache tag)
- License: MIT

Changes made to the redistributed build:

1. `vendor-app/announcements.json` is replaced with `[]`, which turns off the
   upstream announcement cards. No code was modified for this.
2. Two oversized UI fonts (`HarmonyOS_Sans_SC_Regular`, `HarmonyOS_Sans_SC_Medium`,
   ~15.7 MB total) are removed to keep the package small. The app makes no font
   requests in its default configuration and falls back to the system font.
3. Interface elements that only apply to the standalone site are hidden at
   runtime by CSS injected into the frame by `lib/client.js`. The shipped
   JavaScript is untouched:
   - header controls "安装为应用", "下载客户端", "操作指南"
   - the red "NEW" update badge next to the title (and the update dialog it opens)
   - the settings "关于" tab
   - the settings header's upstream version, replaced with this plugin's version

No other files of the build were edited.

### MIT License (GPT Image Playground)

```
MIT License

Copyright (c) 2026 CookSleep

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## KaTeX fonts (inside `vendor-app/assets/`)

Part of the upstream build, used by its math rendering.

- Project: KaTeX — https://github.com/KaTeX/KaTeX
- License: MIT

## Fonts loaded at runtime, not bundled

The upstream app can load HarmonyOS Sans SC and Maple Mono from a public CDN
depending on its build settings; those files are **not** part of this package.
Their licenses (HarmonyOS Sans Fonts License Agreement, SIL OFL 1.1) are
documented in the upstream repository under `third-party-licenses/`.

## Development-only dependencies

`preview/vendor/react*.js` (React 18.3.1 UMD, MIT) and `puppeteer-core` (Apache
2.0) are used by the local preview and test harness only. Neither is part of
the published `files` list.
