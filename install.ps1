# 一键安装：把本目录的插件装进 DSH 桌面端（复制模式）
#
#   右键「使用 PowerShell 运行」，或：
#   powershell -ExecutionPolicy Bypass -File .\install.ps1
#
# 会做三件事：复制插件到 profile 的 node_modules、把包加进依赖与
# dsh.profile.bundles、在 cordis.patch.yml 追加一条启用项。改动前会备份原文件。

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host '==> 查找 DSH 自带的 Node'
$candidates = @(
  (Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'),
  'C:\Program Files\nodejs\node.exe'
)
$node = $null
foreach ($candidate in $candidates) {
  if (Test-Path $candidate) { $node = $candidate; break }
}
if (-not $node) {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) { $node = $command.Source }
}
if (-not $node) {
  Write-Host '找不到 node.exe。请先启动一次 DSH 桌面端（它会带上运行时），或安装 Node.js 后重试。' -ForegroundColor Red
  Read-Host '按回车退出'
  exit 1
}
Write-Host "    使用：$node"

$profileDir = if ($env:DSH_HOME) {
  Join-Path $env:DSH_HOME 'profiles\desktop'
} else {
  Join-Path $env:USERPROFILE '.dsh\profiles\desktop'
}
if (-not (Test-Path $profileDir)) {
  Write-Host "找不到桌面端 profile：$profileDir" -ForegroundColor Red
  Write-Host '请先启动并登录一次 DSH 桌面端，再运行本脚本。' -ForegroundColor Yellow
  Read-Host '按回车退出'
  exit 1
}

Write-Host '==> 安装插件'
Push-Location $here
try {
  & $node 'install.mjs' '--copy'
} finally {
  Pop-Location
}

Write-Host ''
Write-Host '完成。打开（或刷新）DSH：左栏会多出一个「生图工作台」图标。' -ForegroundColor Green
Write-Host '第一次进去先点右上角齿轮配置 API URL 与 Key；若提示跨域，用工作台左下角 ⚙ 配代理。'
Read-Host '按回车退出'
