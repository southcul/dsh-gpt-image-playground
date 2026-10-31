# 把插件发布到 npm（用 DSH 自带的 pnpm，无需安装 npm/node）
#
#   1. 先在 https://www.npmjs.com/settings/<你的账号>/tokens 生成一个 Token
#   2. 在本目录新建 .npmrc，内容一行：
#        //registry.npmjs.org/:_authToken=npm_你的token
#   3. 运行： powershell -ExecutionPolicy Bypass -File .\publish.ps1
#
# 可选参数： -Otp 123456 （账号开了双因素认证时）
#          -DryRun     （只预演，不真发）

param(
  [string]$Otp = '',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$nodeCandidates = @(
  (Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'),
  'C:\Program Files\nodejs\node.exe'
)
$node = $null
foreach ($candidate in $nodeCandidates) {
  if (Test-Path $candidate) { $node = $candidate; break }
}
if (-not $node) {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) { $node = $command.Source }
}
if (-not $node) { throw '找不到 node.exe，请先启动一次 DSH 桌面端。' }

$pnpm = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
if (-not (Test-Path $pnpm)) { throw "找不到 pnpm：$pnpm" }

if (-not (Test-Path (Join-Path $here '.npmrc'))) {
  Write-Host '缺少 .npmrc（里面放 npm Token）。' -ForegroundColor Yellow
  Write-Host '在 https://www.npmjs.com/settings/<账号>/tokens 生成 Token 后，于本目录新建 .npmrc：' -ForegroundColor Yellow
  Write-Host '  //registry.npmjs.org/:_authToken=npm_你的token'
  Read-Host '按回车退出'
  exit 1
}

$manifest = Get-Content (Join-Path $here 'package.json') -Raw | ConvertFrom-Json
Write-Host "==> 发布 $($manifest.name)@$($manifest.version)"

# npm 脚本（prepublishOnly）里用的是裸 `node`，而本机可能只有 DSH 自带的运行时；
# 不把它的目录放进 PATH，hooks 会以 “'node' is not recognized” 失败。
$nodeDir = Split-Path -Parent $node
$env:PATH = "$nodeDir;$env:PATH"

Write-Host '==> 发布前校验'
& $node (Join-Path $here 'tools\check-package.mjs')
if ($LASTEXITCODE -ne 0) {
  Write-Host '校验未通过，已中止发布。' -ForegroundColor Red
  Read-Host '按回车退出'
  exit 1
}

$arguments = @($pnpm, 'publish', '--no-git-checks', '--reporter=append-only')
if ($DryRun) { $arguments += '--dry-run' }
if ($Otp) { $arguments += "--otp=$Otp" }

Push-Location $here
try {
  & $node @arguments
} finally {
  Pop-Location
}

if ($LASTEXITCODE -ne 0) {
  Write-Host '发布失败。常见原因：Token 无效 / 未登录、包名被占用、需要 OTP、网络或代理不通。' -ForegroundColor Red
  Read-Host '按回车退出'
  exit $LASTEXITCODE
}

if (-not $DryRun) {
  Write-Host ''
  Write-Host "已发布。验证：https://www.npmjs.com/package/$($manifest.name)" -ForegroundColor Green
  Write-Host "朋友在 DSH 插件页填：$($manifest.name)"
}
Read-Host '按回车退出'
