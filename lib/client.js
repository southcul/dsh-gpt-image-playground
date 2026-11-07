/**
 * dsh-gpt-image-playground — browser half.
 *
 * The workbench is the upstream GPT Image Playground build, vendored under
 * vendor-app/ and served by this plugin's host half at APP_ROUTE.
 *
 * Why the frame lives in `shell.overlay` and not in the `main` panel: `main`
 * is a keyed slot that renders only the selected key, so switching to another
 * panel unmounts the page — and an iframe destroyed mid-request loses the
 * generation. The overlay entry stays mounted for the whole session; the
 * `main` panel only publishes its box as a placeholder, and the surface
 * follows that box with `position: fixed`, hiding (not unloading) itself while
 * another panel is selected.
 */

window.__ModuleLoader__.load({
  id: 'dsh-gpt-image-playground',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const { useCallback, useEffect, useMemo, useRef, useState } = React
    const h = React.createElement

    const TAB_ID = 'gpt-image-playground'
    const APP_SRC = '/plugins/dsh-gpt-image-playground/app/index.html'
    const PROXY_PATH = '/plugins/dsh-gpt-image-playground/proxy'
    const SETTINGS_PATH = '/plugins/dsh-gpt-image-playground/settings'

    /**
     * Header controls the plugin's host already covers, or that only make sense
     * for the standalone site: "安装为应用" (PWA install), "下载客户端" (desktop
     * download) and "操作指南" (upstream guide). Hidden inside the frame by
     * `aria-label`, so upstream markup changes cannot break the rest of the UI.
     *
     * The red "NEW" badge next to the title announces an upstream release and
     * opens an "update available" dialog — pointless here, since updating means
     * replacing the vendored build. It has no aria-label, so it is matched by
     * its title prefix and, as a fallback, by the badge's red background.
     *
     * The settings "关于" tab is marked by `decorateFrame` (its label is text,
     * which CSS cannot match) and hidden through the `data-dsh-gipg-about` rule.
     */
    const FRAME_TRIM = [
      'button[aria-label="安装为应用"]',
      'a[aria-label="下载客户端"]',
      'button[aria-label="操作指南"]',
      'button[data-dsh-gipg-about="1"]',
      'header button[title^="新版本"]',
      'header h1 > button[class*="bg-red-500"]',
      // 设置 → 习惯配置 → 「更新」分组（自动检查更新），只服务于被隐藏的 NEW 角标。
      'section[data-dsh-gipg-update-section="1"]',
    ]
    const TRIM_STYLE_ID = 'dsh-gipg-trim'
    const ABOUT_LABEL = '关于'
    const UPDATE_SECTION_LABEL = '更新'
    const UPDATE_SECTION_ATTR = 'data-dsh-gipg-update-section'

    /** Provider hint appended to the "当前配置" row of 设置 → API 配置. */
    const CURRENT_PROFILE_LABEL = '当前配置'
    const TIP_ATTR = 'data-dsh-gipg-tip'
    const TIP_TEXT = '建议使用 ToolifyAi API 高效稳定，注册享优惠'
    const TIP_URL = 'https://api.toolify-ai.com'
    const TIP_LOGO = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iX+WbvuWxgl8xIiBkYXRhLW5hbWU9IuWbvuWxgiAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCAyODQgNzMiPgogIDxkZWZzPgogICAgPHN0eWxlPgogICAgICAuY2xzLTEgewogICAgICAgIGNsaXAtcGF0aDogdXJsKCNjbGlwcGF0aCk7CiAgICAgIH0KCiAgICAgIC5jbHMtMiB7CiAgICAgICAgZmlsbDogIzE1MTUxNTsKICAgICAgICBmb250LWZhbWlseTogU291cmNlSGFuU2Fuc0NOLUhlYXZ5LUdCcGMtRVVDLUgsICdTb3VyY2UgSGFuIFNhbnMgQ04nOwogICAgICAgIGZvbnQtd2VpZ2h0OiA4MDA7CiAgICAgIH0KCiAgICAgIC5jbHMtMiwgLmNscy0zIHsKICAgICAgICBpc29sYXRpb246IGlzb2xhdGU7CiAgICAgIH0KCiAgICAgIC5jbHMtNCB7CiAgICAgICAgZmlsbDogbm9uZTsKICAgICAgfQoKICAgICAgLmNscy00LCAuY2xzLTUsIC5jbHMtNiwgLmNscy03IHsKICAgICAgICBzdHJva2Utd2lkdGg6IDBweDsKICAgICAgfQoKICAgICAgLmNscy01IHsKICAgICAgICBmaWxsOiAjMDAwOwogICAgICB9CgogICAgICAuY2xzLTYgewogICAgICAgIGZpbGw6ICMyZTc0ZmY7CiAgICAgICAgZmlsbC1ydWxlOiBldmVub2RkOwogICAgICB9CgogICAgICAuY2xzLTggewogICAgICAgIGZvbnQtc2l6ZTogNDhweDsKICAgICAgfQoKICAgICAgLmNscy05IHsKICAgICAgICBmb250LXNpemU6IDQ0LjhweDsKICAgICAgfQoKICAgICAgLmNscy0xMCB7CiAgICAgICAgZGlzcGxheTogbm9uZTsKICAgICAgfQoKICAgICAgLmNscy03IHsKICAgICAgICBmaWxsOiAjNzE1MGU2OwogICAgICB9CiAgICA8L3N0eWxlPgogICAgPGNsaXBQYXRoIGlkPSJjbGlwcGF0aCI+CiAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy00IiBjeD0iNDMiIGN5PSIzNyIgcj0iMzQuOSIvPgogICAgPC9jbGlwUGF0aD4KICA8L2RlZnM+CiAgPGcgY2xhc3M9ImNscy0xMCI+CiAgICA8cGF0aCBpZD0iX+W5tumbhiIgZGF0YS1uYW1lPSLlubbpm4YiIGNsYXNzPSJjbHMtNiIgZD0iTTY4LDguNWMwLTQuNywzLjgtOC41LDguNS04LjVzOC41LDMuOCw4LjUsOC41LTMuOCw4LjUtOC41LDguNS0yLjItLjItMy4zLS42bC0xNS4xLDEyLjZjMS44LDIuNywyLjgsNiwyLjgsOS42cy0xLjUsOC0zLjksMTFsNS4xLDUuNGMxLjUtMS4yLDMuMy0xLjksNS4zLTEuOSw0LjcsMCw4LjUsMy44LDguNSw4LjVzLTMuOCw4LjUtOC41LDguNS04LjUtMy44LTguNS04LjUuMy0yLjQuNy0zLjRsLTUuNS01LjhjLTMsMi4zLTYuNywzLjctMTAuNywzLjdzLTkuNy0yLjItMTIuOS01LjZsLTguNiw2LjZjLjYsMS40LjksMi45LjksNC41LDAsNi4zLTUuMSwxMS41LTExLjUsMTEuNVMwLDY3LjgsMCw2MS41czUuMi0xMS41LDExLjUtMTEuNSw2LjMsMS40LDguNCwzLjZsOC40LTYuNWMtMS41LTIuNi0yLjMtNS41LTIuMy04LjYsMC05LjcsNy44LTE3LjUsMTcuNS0xNy41czksMS45LDEyLjEsNC45bDE0LjMtMTJjLTEuMi0xLjUtMS45LTMuNC0xLjktNS40Wk0xMCwxNC41YzAtNS4yLDQuMi05LjUsOS41LTkuNXM5LjUsNC4yLDkuNSw5LjUtNC4yLDkuNS05LjUsOS41LTkuNS00LjItOS41LTkuNVoiLz4KICAgIDxhIHhsaW5rOmhyZWY9Imh0dHBzOi8vIj4KICAgICAgPGcgY2xhc3M9ImNscy0zIj4KICAgICAgICA8dGV4dCBjbGFzcz0iY2xzLTIiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDEwNSA1Mi4zKSI+PHRzcGFuIGNsYXNzPSJjbHMtOCIgeD0iMCIgeT0iMCI+57KSPC90c3Bhbj48dHNwYW4gY2xhc3M9ImNscy05IiB4PSI0OCIgeT0iMCI+5a2Q5a+86IiqPC90c3Bhbj48L3RleHQ+CiAgICAgIDwvZz4KICAgIDwvYT4KICA8L2c+CiAgPHBhdGggY2xhc3M9ImNscy03IiBkPSJNNDMuMSw1OC4yYy0xMS43LDAtMjEuMy05LjYtMjEuMy0yMS4zczkuNi0yMS4zLDIxLjMtMjEuMywyMS4zLDkuNiwyMS4zLDIxLjMtOS42LDIxLjMtMjEuMywyMS4zWk00My4xLDI1LjJjLTYuNSwwLTExLjcsNS4zLTExLjcsMTEuN3M1LjMsMTEuNywxMS43LDExLjcsMTEuNy01LjMsMTEuNy0xMS43LTUuMy0xMS43LTExLjctMTEuN1oiLz4KICA8ZyBjbGFzcz0iY2xzLTEiPgogICAgPGc+CiAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy03IiBjeD0iMTEiIGN5PSIyMy42IiByPSI5LjQiLz4KICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTciIGN4PSIxMC44IiBjeT0iNTAuNSIgcj0iOS40Ii8+CiAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy03IiBjeD0iMjkuNiIgY3k9IjY5LjEiIHI9IjkuNCIvPgogICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtNyIgY3g9IjU2LjMiIGN5PSI2OS4xIiByPSI5LjQiLz4KICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTciIGN4PSI3NS40IiBjeT0iNTAuNSIgcj0iOS40Ii8+CiAgICAgIDxjaXJjbGUgY2xhc3M9ImNscy03IiBjeD0iNzUuNCIgY3k9IjIzLjgiIHI9IjkuNCIvPgogICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtNyIgY3g9IjU2LjYiIGN5PSI1IiByPSI5LjQiLz4KICAgICAgPGNpcmNsZSBjbGFzcz0iY2xzLTciIGN4PSIzMC42IiBjeT0iNC45IiByPSI5LjQiLz4KICAgIDwvZz4KICA8L2c+CiAgPGc+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTUiIGQ9Ik0xMTAuNywyMi40bC0uNCwyLjFjLS4xLjYtLjcsMS4xLTEuMywxLjFoLTUuNWMtLjYsMC0xLjIuNS0xLjMsMS4xbC00LjQsMjQuOWMtLjEuNi0uNywxLjEtMS4zLDEuMWgtM2MtLjgsMC0xLjQtLjctMS4zLTEuNmw0LjQtMjRjLjEtLjgtLjUtMS42LTEuMy0xLjZoLTQuN2MtLjgsMC0xLjQtLjctMS4zLTEuNWwuNC0yLjFjLjEtLjYuNy0xLjEsMS4zLTEuMWgxOC41Yy44LDAsMS40LjcsMS4zLDEuNVoiLz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtNSIgZD0iTTExOS4zLDUzYy0yLjcsMC00LjctLjQtNS43LTEuMy0xLjItLjgtMS44LTIuMi0xLjgtNC4zcy4yLTIuNC41LTQuNGwxLjEtNi4yYy4yLTEuNy41LTMuMSwxLTQuMS4zLTEsLjktMS44LDEuNi0yLjUuNi0uNSwxLjQtLjksMi41LTEuMnMuNCwwLC41LS4xYzEuMS0uMiwyLjUtLjMsNC4yLS4zaDIuOGMyLjcsMCw0LjcuNCw1LjksMS4zLDEuMS45LDEuNiwyLjMsMS42LDQuM3MtLjIsMi42LS41LDQuNGwtMS4xLDYuMmMtLjMsMi4xLS43LDMuNi0xLjEsNC40LS40LjktLjksMS42LTEuNSwyLjEtLjcuNS0xLjUuOS0yLjYsMS4xLTEuMi4zLTIuNy41LTQuNi41aC0yLjhaTTEyMC42LDQ4LjhoMmMuOCwwLDEuNCwwLDItLjIuNC0uMS44LS4zLDEtLjcuNS0uNSwxLTEuNiwxLjMtMy4xbDEtNi4yYy4zLTEuNi41LTIuOS41LTMuOHMtLjMtMS4zLS44LTEuNmMtLjUtLjItMS41LS4zLTIuOC0uM2gtMS44czAsMCwwLDBjLTIuMSwwLTMuOCwxLjUtNC4zLDMuNXMwLC4zLDAsLjRsLTEsNi4yYy0uMywxLjgtLjUsMy0uNSwzLjZzLjMsMS40LjgsMS42Yy40LjMsMS40LjUsMi44LjVaIi8+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTUiIGQ9Ik0xNDMuNCw1M2MtMi43LDAtNC42LS40LTUuNy0xLjMtMS4yLS44LTEuOC0yLjItMS44LTQuM3MuMi0yLjQuNS00LjRsMS4xLTYuMmMuMi0xLjcuNS0zLjEsMS00LjEuMy0xLC45LTEuOCwxLjYtMi41LjYtLjUsMS40LS45LDIuNS0xLjJzLjQsMCwuNS0uMWMxLjEtLjIsMi40LS4zLDQuMi0uM2gyLjhjMi43LDAsNC43LjQsNS45LDEuMywxLjEuOSwxLjYsMi4zLDEuNiw0LjNzLS4yLDIuNi0uNSw0LjRsLTEuMSw2LjJjLS4zLDIuMS0uNywzLjYtMS4xLDQuNC0uNC45LS45LDEuNi0xLjUsMi4xLS43LjUtMS41LjktMi42LDEuMS0xLjIuMy0yLjcuNS00LjYuNWgtMi44Wk0xNDQuNyw0OC44aDJjLjgsMCwxLjQsMCwyLS4yLjQtLjEuOC0uMywxLS43LjUtLjUsMS0xLjYsMS4zLTMuMWwxLTYuMmMuMy0xLjYuNS0yLjkuNS0zLjhzLS4zLTEuMy0uOC0xLjZjLS41LS4yLTEuNS0uMy0yLjgtLjNoLTEuOHMwLDAsMCwwYy0yLjEsMC0zLjgsMS41LTQuMywzLjVzMCwuMywwLC40bC0xLDYuMmMtLjMsMS44LS41LDMtLjUsMy42cy4zLDEuNC44LDEuNmMuNC4zLDEuNC41LDIuOC41WiIvPgogICAgPHBhdGggY2xhc3M9ImNscy01IiBkPSJNMTY2LjksNTIuN2MtMi40LDAtNC4xLS4zLTUuMS0xLTEuMS0uNy0xLjYtMS45LTEuNi0zLjZzLjItMi44LjctNS40bDQuMS0yMi40Yy4xLS42LjctMS4xLDEuMy0xLjFoMi40Yy44LDAsMS40LjcsMS4zLDEuNWwtMy44LDIxLjljLS40LDIuMS0uNywzLjQtLjcsNC4xcy4xLjguMywxYy4yLjMuNi41LDEuMS41LjQuMSwxLjMuMiwyLjUuMmguM2MuOSwwLDEuNiwxLDEuMiwxLjhsLS43LDEuNmMtLjIuNS0uNy44LTEuMi44aC0yLjFaIi8+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTUiIGQ9Ik0xNzMuNyw1MS4ybDMuOC0yMS4xYy4xLS42LjctMS4xLDEuMy0xLjFoMi40Yy44LDAsMS40LjcsMS4zLDEuNWwtMy42LDIxLjFjLS4xLjYtLjcsMS4xLTEuMywxLjFoLTIuNmMtLjgsMC0xLjQtLjctMS4zLTEuNlpNMTc4LjUsMjMuNGwuNS0yLjhjLjEtLjYuNy0xLjEsMS4zLTEuMWgyLjdjLjgsMCwxLjQuNywxLjMsMS42bC0uNSwyLjhjLS4xLjYtLjcsMS4xLTEuMywxLjFoLTIuN2MtLjgsMC0xLjQtLjctMS4zLTEuNloiLz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtNSIgZD0iTTE5Ny4xLDI0LjJjLS40LjQtLjgsMS41LTEuMSwzLjNsLS4zLDEuNWg0LjZjLjgsMCwxLjUuOCwxLjMsMS42bC0uMywxLjZjLS4xLjYtLjcsMS4xLTEuMywxLjFoLTMuOWMtLjYsMC0xLjIuNS0xLjMsMS4xbC0zLjEsMTcuM2MtLjEuNi0uNywxLjEtMS4zLDEuMWgtMi42Yy0uOCwwLTEuNC0uNy0xLjMtMS42bDIuOS0xNi40Yy4xLS44LS41LTEuNi0xLjMtMS42aDBjLS44LDAtMS40LS43LTEuMy0xLjVsLjItMS42YzAtLjYuNy0xLjEsMS4zLTEuMWguOWMuNiwwLDEuMi0uNCwxLjMtMXYtLjRjLjUtMi4yLDEtMy43LDEuNC00LjYuMy0uOS44LTEuNiwxLjMtMi4xczEtLjgsMS45LTEuMS4xLDAsLjIsMGMuOC0uMiwyLS4zLDMuNy0uM2gzLjRjLjgsMCwxLjQuNywxLjMsMS41bC0uMiwxLjZjMCwuNi0uNywxLjEtMS4zLDEuMWgtNGMtLjUuMS0uOS4zLTEuMS43WiIvPgogICAgPHBhdGggY2xhc3M9ImNscy01IiBkPSJNMjI0LjQsMjguOWgyLjZjLjgsMCwxLjQuNywxLjMsMS41bC00LDIyLjlzMCwwLDAsMGMtLjMsMS40LS43LDIuNi0xLjEsMy42LS41LDEtMS4zLDEuNy0yLjMsMi4zLTEsLjctMi42LDEtNC45LDFoLTcuOWMtLjcsMC0xLjItLjUtMS4zLTEuMWwtLjItMS42Yy0uMS0uOC41LTEuNSwxLjMtMS41aDdjMS4zLDAsMi4yLS4xLDIuOC0uMy40LS4yLjgtLjYsMS0xLjEuMi0uNC40LTEuMy43LTIuNWgwYy4yLS45LS41LTEuNi0xLjMtMS42aC00LjNjLTIuNywwLTQuNy0uNC01LjctMS4zLTEuMi0uOS0xLjgtMi4zLTEuOC00LjNzLjItMi40LjUtNC40bDEuOC0xMC40Yy4xLS42LjctMS4xLDEuMy0xLjFoMi42Yy44LDAsMS40LjcsMS4zLDEuNWwtMS43LDkuOWMtLjMsMS42LS41LDIuOC0uNSwzLjZzLjMsMS40LjgsMS42Yy40LjMsMS40LjUsMi44LjVoNC4zYy42LDAsMS4yLS41LDEuMy0xLjFsMi42LTE1Yy4xLS42LjctMS4xLDEuMy0xLjFaIi8+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTciIGQ9Ik0yNDguMywyMC43YzMuNCwwLDUuOC41LDcuMiwxLjUsMS4zLDEsMiwyLjcsMiw1LjFzLS4yLDMuMy0uNyw1LjZsLTMuMiwxOC43Yy0uMS43LS43LDEuMi0xLjQsMS4yaC0yLjljLS45LDAtMS41LS44LTEuNC0xLjZsMS41LTcuN2MuMy0xLjUtLjgtMi44LTIuMy0yLjhoLTcuNWMtLjcsMC0xLjMuNS0xLjQsMS4ybC0xLjcsOS44Yy0uMS43LS43LDEuMi0xLjQsMS4yaC0yLjdjLS45LDAtMS41LS44LTEuNC0xLjZsMy44LTIxYy41LTMuMSwxLjItNS4xLDItNi4yLjctMSwxLjUtMS43LDIuNS0yLjEsMS40LS43LDQtMSw3LjctMWgxLjNaTTI0Mi4yLDM2LjFoNy4yYy43LDAsMS4yLS41LDEuNC0xLjFsLjQtMi4yYy40LTIuMi43LTMuOC43LTQuOXMwLDAsMCwwYzAtMS4zLTEtMi4zLTIuMy0yLjVzLTEuMy0uMS0yLjItLjFoLTEuMWMtMi4yLDAtMy43LjMtNC40LDEtLjMuMi0uNi42LS44LDEuMS0uMy43LS43LDEuOS0xLDMuNmwtLjMsMi4xYy0uMywxLjYsMSwzLDIuNSwzWiIvPgogICAgPHBhdGggY2xhc3M9ImNscy03IiBkPSJNMjU5LjQsNTEuMmwzLjctMjAuN2MuMi0uOS45LTEuNSwxLjgtMS41aDEuNWMxLjEsMCwxLjksMSwxLjcsMmwtMy42LDIwLjdjLS4xLjYtLjYsMS4xLTEuMywxLjFoLTIuN2MtLjgsMC0xLjQtLjctMS4zLTEuNVpNMjY0LjEsMjMuNWwuNS0yLjljLjEtLjYuNi0xLDEuMy0xaDIuOGMuOCwwLDEuNC43LDEuMywxLjVsLS41LDIuOWMtLjEuNi0uNiwxLTEuMywxaC0yLjhjLS44LDAtMS40LS43LTEuMy0xLjVaIi8+CiAgPC9nPgo8L3N2Zz4='

    /** What the settings header shows: the plugin's own version, nothing else. */
    function versionLabel(pluginVersion) {
      return pluginVersion ? `v${pluginVersion}` : undefined
    }

    /**
     * Rewrite the frame's chrome: hide the retired header controls and the
     * settings "关于" tab, and replace its version badge with this plugin's.
     * Re-applied on mutations because the SPA re-renders these nodes.
     */
    function decorateFrame(frame, versions) {
      try {
        const doc = frame.contentDocument
        const win = frame.contentWindow
        if (!doc || !doc.head || !win) return
        if (!doc.getElementById(TRIM_STYLE_ID)) {
          const style = doc.createElement('style')
          style.id = TRIM_STYLE_ID
          style.textContent = [
            `${FRAME_TRIM.join(',')}{display:none!important}`,
            // A de-linked title still looks like a link on hover without this.
            'header h1 a[data-dsh-gipg-nolink]{pointer-events:none;cursor:default;text-decoration:none}',
          ].join('\n')
          doc.head.appendChild(style)
        }
        const label = versionLabel(versions && versions.pluginVersion)
        const apply = () => {
          for (const button of doc.querySelectorAll('button')) {
            if ((button.textContent || '').trim() === ABOUT_LABEL) button.setAttribute('data-dsh-gipg-about', '1')
          }
          // 设置 → 习惯配置 → 「更新」分组的标题是文本，CSS 选不到，
          // 所以先给整个 section 打标记，再由样式表整段隐藏。
          for (const heading of doc.querySelectorAll('h4')) {
            if ((heading.textContent || '').trim() !== UPDATE_SECTION_LABEL) continue
            const section = heading.closest('section')
            if (section && !section.hasAttribute(UPDATE_SECTION_ATTR)) section.setAttribute(UPDATE_SECTION_ATTR, '1')
          }
          // The product title is a link to the upstream repository on the
          // standalone site. Inside DSH it should read as a plain label, so the
          // anchor keeps its text and styling but loses every navigational bit.
          for (const anchor of doc.querySelectorAll('header h1 a')) {
            if (!/github\.com/.test(anchor.getAttribute('href') ?? '')) continue
            anchor.removeAttribute('href')
            anchor.removeAttribute('target')
            anchor.removeAttribute('rel')
            anchor.setAttribute('data-dsh-gipg-nolink', '1')
          }
          // A provider recommendation next to the "当前配置" label in
          // 设置 → API 配置. Injected here so the vendored build stays pristine;
          // re-added on every render because React owns that row.
          for (const span of doc.querySelectorAll('span')) {
            if ((span.textContent || '').trim() !== CURRENT_PROFILE_LABEL) continue
            const row = span.parentElement
            if (!row || row.querySelector(`[${TIP_ATTR}]`)) continue
            const tip = doc.createElement('a')
            tip.setAttribute(TIP_ATTR, '1')
            tip.href = TIP_URL
            tip.target = '_blank'
            tip.rel = 'noopener noreferrer'
            tip.title = TIP_URL
            tip.style.cssText = [
              'margin-left:4px',
              'display:inline-flex',
              'align-items:center',
              'gap:5px',
              'font-size:13px',
              'line-height:1.4',
              'color:#ef4444',
              'text-decoration:none',
              'cursor:pointer',
              'flex:none',
            ].join(';')

            const logo = doc.createElement('img')
            logo.src = TIP_LOGO
            logo.alt = ''
            logo.setAttribute('aria-hidden', 'true')
            logo.style.cssText = 'height:18px;width:auto;display:block;flex:none'
            // A blocked CDN must not leave a broken-image icon or shift the row.
            logo.addEventListener('error', () => logo.remove())

            const label = doc.createElement('span')
            label.textContent = TIP_TEXT

            tip.append(logo, label)
            tip.addEventListener('mouseenter', () => {
              label.style.textDecoration = 'underline'
            })
            tip.addEventListener('mouseleave', () => {
              label.style.textDecoration = 'none'
            })
            row.appendChild(tip)
            break
          }
          if (!label) return
          for (const span of doc.querySelectorAll('span')) {
            const text = (span.textContent || '').trim()
            if (!/^v\d+\.\d+\.\d+$/.test(text)) continue
            if (!(span.className || '').toString().includes('font-mono')) continue
            if (text !== label) span.textContent = label
            // No tooltip: the badge carries the plugin version and nothing else.
            if (span.hasAttribute('title')) span.removeAttribute('title')
          }
        }
        apply()
        if (frame.__gipgObserver) frame.__gipgObserver.disconnect()
        const Observer = win.MutationObserver
        if (Observer) {
          let scheduled = false
          const observer = new Observer(() => {
            if (scheduled) return
            scheduled = true
            win.requestAnimationFrame(() => {
              scheduled = false
              apply()
            })
          })
          observer.observe(doc.body, { childList: true, subtree: true, characterData: true })
          frame.__gipgObserver = observer
        }
      } catch {
        /* cross-origin or not ready yet: the load handler retries */
      }
    }

    /**
     * Bridges the `main` placeholder and the persistent overlay surface: the
     * panel publishes its element, the surface measures it and keeps the same
     * rectangle while the panel is selected.
     */
    const dock = {
      placeholder: null,
      listeners: new Set(),
      publish(element) {
        if (this.placeholder === element) return
        this.placeholder = element
        for (const listener of [...this.listeners]) listener()
      },
      subscribe(listener) {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
      },
    }

    const STYLE = `
.gipg-surface{position:fixed;z-index:2;overflow:hidden;background:Canvas;display:flex;flex-direction:column}
.gipg-frame{flex:1 1 auto;width:100%;min-height:0;border:0;display:block;background:Canvas}
.gipg-dock{position:absolute;left:12px;bottom:12px;display:flex;flex-direction:column;align-items:flex-start;gap:8px;z-index:5}
.gipg-gear{width:30px;height:30px;border-radius:50%;border:1px solid color-mix(in srgb,currentColor 22%,transparent);background:color-mix(in srgb,Canvas 82%,CanvasText 18%);color:CanvasText;font-size:14px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:.55;transition:opacity .15s ease;padding:0;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.gipg-gear:hover{opacity:1}
.gipg-pop{width:min(380px,calc(100vw - 40px));display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:10px;background:Canvas;color:CanvasText;border:1px solid color-mix(in srgb,currentColor 20%,transparent);box-shadow:0 12px 32px rgba(0,0,0,.28);font-size:12px;line-height:1.6}
.gipg-pop-title{font-weight:600;font-size:12px}
.gipg-pop-hint{margin:0;opacity:.7}
.gipg-pop-hint code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;background:color-mix(in srgb,currentColor 8%,transparent);border-radius:4px;padding:1px 4px;word-break:break-all}
.gipg-proxy-row{display:flex;align-items:center;gap:6px}
.gipg-proxy-url{flex:1 1 auto;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;background:color-mix(in srgb,currentColor 7%,transparent);border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:6px;padding:5px 7px;word-break:break-all}
.gipg-input{width:100%;box-sizing:border-box;font:inherit;color:inherit;background:color-mix(in srgb,currentColor 5%,transparent);border:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:7px;padding:6px 8px;outline:none}
.gipg-input:focus{border-color:color-mix(in srgb,currentColor 45%,transparent)}
.gipg-pop-actions{display:flex;gap:6px}
.gipg-btn{font:inherit;color:inherit;background:color-mix(in srgb,currentColor 8%,transparent);border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:7px;padding:5px 10px;cursor:pointer}
.gipg-btn.primary{background:#d97757;border-color:#c9663f;color:#fff;font-weight:600}
.gipg-pop-status{opacity:.75;word-break:break-all}
`

    async function readSettings() {
      try {
        const response = await fetch(SETTINGS_PATH, { headers: { accept: 'application/json' } })
        if (!response.ok) return { proxyTarget: '' }
        return await response.json()
      } catch {
        return { proxyTarget: '' }
      }
    }

    /**
     * The always-mounted surface: owns the frame for the whole session so an
     * in-flight generation survives panel switching.
     */
    function PlaygroundSurface() {
      const frameRef = useRef(null)
      const surfaceRef = useRef(null)
      const offsetRef = useRef({ x: 0, y: 0 })
      const versionsRef = useRef({})
      const [rect, setRect] = useState(null)
      const [offset, setOffset] = useState({ x: 0, y: 0 })
      const [everOpened, setEverOpened] = useState(false)
      const [open, setOpen] = useState(false)
      const [target, setTarget] = useState('')
      const [status, setStatus] = useState('')
      const [saving, setSaving] = useState(false)
      const [copied, setCopied] = useState(false)
      const proxyUrl = useMemo(() => `${window.location.origin}${PROXY_PATH}`, [])

      // Follow the placeholder box while the panel is the selected one.
      useEffect(() => {
        let frame = 0
        let observer
        const measure = () => {
          const element = dock.placeholder
          if (!element || !element.isConnected) {
            setRect(null)
            return
          }
          const box = element.getBoundingClientRect()
          if (box.width < 2 || box.height < 2) {
            setRect(null)
            return
          }
          setEverOpened(true)
          setRect((previous) => {
            if (previous && Math.abs(previous.top - box.top) < 0.5 && Math.abs(previous.left - box.left) < 0.5 && Math.abs(previous.width - box.width) < 0.5 && Math.abs(previous.height - box.height) < 0.5) return previous
            return { top: box.top, left: box.left, width: box.width, height: box.height }
          })
        }
        const schedule = () => {
          cancelAnimationFrame(frame)
          frame = requestAnimationFrame(measure)
        }
        const bind = () => {
          observer?.disconnect()
          const element = dock.placeholder
          if (element && element.isConnected) {
            observer = new ResizeObserver(schedule)
            observer.observe(element)
          }
          schedule()
        }
        const unsubscribe = dock.subscribe(bind)
        bind()
        window.addEventListener('resize', schedule)
        window.addEventListener('scroll', schedule, true)
        return () => {
          unsubscribe()
          observer?.disconnect()
          cancelAnimationFrame(frame)
          window.removeEventListener('resize', schedule)
          window.removeEventListener('scroll', schedule, true)
        }
      }, [])

      useEffect(() => {
        let alive = true
        void readSettings().then((settings) => {
          if (!alive) return
          setTarget(settings.proxyTarget || '')
          versionsRef.current = {
            pluginVersion: settings.pluginVersion,
          }
          if (frameRef.current) decorateFrame(frameRef.current, versionsRef.current)
        })
        return () => {
          alive = false
        }
      }, [])

      const reload = useCallback(() => {
        const frame = frameRef.current
        if (!frame) return
        try {
          frame.contentWindow.location.reload()
        } catch {
          frame.src = APP_SRC
        }
      }, [])

      const save = useCallback(async () => {
        setSaving(true)
        setStatus('')
        try {
          const response = await fetch(SETTINGS_PATH, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ proxyTarget: target.trim() }),
          })
          const payload = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(payload.error || `保存失败（${response.status}）`)
          setTarget(payload.proxyTarget || '')
          setStatus(payload.proxyTarget ? '已保存，正在刷新界面…' : '已清除代理目标，正在刷新界面…')
          setTimeout(() => {
            reload()
            setStatus('')
          }, 500)
        } catch (error) {
          setStatus(error.message)
        } finally {
          setSaving(false)
        }
      }, [target, reload])

      // `position: fixed` is viewport-relative unless an ancestor establishes a
      // containing block (transform/filter/contain). Measure once per rect and
      // correct the offset, so the surface lands on the placeholder either way.
      useEffect(() => {
        if (!rect) return
        const element = surfaceRef.current
        if (!element) return
        const box = element.getBoundingClientRect()
        const dx = rect.left - box.left
        const dy = rect.top - box.top
        if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) return
        const next = { x: offsetRef.current.x + dx, y: offsetRef.current.y + dy }
        offsetRef.current = next
        setOffset(next)
      }, [rect])

      if (!everOpened) return null

      const visible = rect !== null
      return h(
        'div',
        {
          ref: surfaceRef,
          className: 'gipg-surface',
          style: visible
            ? { top: rect.top + offset.y, left: rect.left + offset.x, width: rect.width, height: rect.height }
            : { display: 'none' },
        },
        h('iframe', {
          ref: frameRef,
          className: 'gipg-frame',
          src: APP_SRC,
          title: 'GPT Image Playground',
          allow: 'clipboard-write',
          onLoad: (event) => decorateFrame(event.currentTarget, versionsRef.current),
        }),
        h(
          'div',
          { className: 'gipg-dock' },
          open
            ? h(
                'div',
                { className: 'gipg-pop' },
                h('div', { className: 'gipg-pop-title' }, '同源 API 代理'),
                h(
                  'p',
                  { className: 'gipg-pop-hint' },
                  '把真实 API 地址填在下面并保存；然后在应用里把「API URL」改成这个代理地址（必须用完整的 http 地址）：',
                ),
                h(
                  'div',
                  { className: 'gipg-proxy-row' },
                  h('code', { className: 'gipg-proxy-url' }, proxyUrl),
                  h(
                    'button',
                    {
                      className: 'gipg-btn',
                      onClick: async () => {
                        try {
                          await navigator.clipboard.writeText(proxyUrl)
                          setCopied(true)
                          setTimeout(() => setCopied(false), 1600)
                        } catch {
                          setStatus('复制失败，请手动选中地址复制')
                        }
                      },
                    },
                    copied ? '已复制' : '复制',
                  ),
                ),
                h('input', {
                  className: 'gipg-input',
                  placeholder: 'https://api.openai.com/v1',
                  value: target,
                  spellCheck: false,
                  onChange: (event) => setTarget(event.target.value),
                }),
                h(
                  'div',
                  { className: 'gipg-pop-actions' },
                  h('button', { className: 'gipg-btn primary', onClick: save, disabled: saving }, saving ? '保存中…' : '保存并刷新'),
                  h('button', { className: 'gipg-btn', onClick: () => setOpen(false) }, '关闭'),
                ),
                status ? h('div', { className: 'gipg-pop-status' }, status) : null,
              )
            : null,
          h('button', { className: 'gipg-gear', title: '代理与设置', onClick: () => setOpen((value) => !value) }, '⚙'),
        ),
      )
    }

    /** Placeholder published by the `main` panel; the surface aligns to it. */
    function PlaygroundPage() {
      const ref = useRef(null)
      useEffect(() => {
        dock.publish(ref.current)
        return () => dock.publish(null)
      }, [])
      return h('div', { ref, style: { height: '100%', width: '100%' } })
    }

    /** Left-rail glyph: a framed picture. */
    function PlaygroundIcon(props) {
      const size = (props && props.size) || 18
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2.5 }),
        h('circle', { cx: 8.5, cy: 9.5, r: 1.6 }),
        h('path', { d: 'M4 17l4.5-4.2 3.4 3 3.1-2.6L20 17.5' }),
      )
    }

    const inject = ['slots']

    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style')
        style.dataset.plugin = 'dsh-gpt-image-playground'
        style.textContent = STYLE
        document.head.appendChild(style)
        return () => style.remove()
      }, 'dsh-gpt-image-playground: styles')

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: TAB_ID,
          },
          PlaygroundPage,
        ),
      )
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: TAB_ID,
            order: 40,
            label: () => '生图工作台',
          },
          PlaygroundIcon,
        ),
      )
      // Always mounted: the frame must outlive navigation inside the shell.
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'gpt-image-playground-surface',
            order: 20,
          },
          PlaygroundSurface,
        ),
      )
    }

    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
