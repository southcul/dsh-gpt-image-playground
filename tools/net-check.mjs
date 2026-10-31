/**
 * 发布前的网络自检：GitHub / npm 注册表 / git 推送通道是否可用。
 *
 *   node tools/net-check.mjs
 */
const targets = [
  { name: 'GitHub 网页', url: 'https://github.com', need: '建仓库、看 Actions' },
  { name: 'GitHub API', url: 'https://api.github.com', need: '部分工具依赖' },
  { name: 'npm 注册表', url: 'https://registry.npmjs.org', need: '发布与查询' },
  { name: 'npm 上传端点', url: 'https://registry.npmjs.org/-/whoami', need: 'publish 走这里（401 也算通）' },
  { name: 'GitHub Pages', url: 'https://cooksleep.github.io/gpt_image_playground/', need: '上游构建来源（仅重新 vendor 时需要）' },
]

const results = []
for (const target of targets) {
  const started = Date.now()
  try {
    const response = await fetch(target.url, { signal: AbortSignal.timeout(12_000) })
    results.push({ ...target, status: response.status, ms: Date.now() - started, ok: true })
  } catch (error) {
    results.push({ ...target, status: error.name, ms: Date.now() - started, ok: false })
  }
}

console.log('目标                 状态        耗时     说明')
for (const item of results) {
  const status = String(item.status).padEnd(10)
  const ms = `${item.ms}ms`.padEnd(8)
  console.log(`${item.name.padEnd(18)} ${status} ${ms} ${item.need}`)
}

const github = results.find((item) => item.name === 'GitHub 网页')
const npm = results.find((item) => item.name === 'npm 注册表')
console.log('')
if (!github.ok) {
  console.log('⚠ github.com 不可达：git push 大概率会卡住。可选方案：')
  console.log('  - 给 Git 配代理： git config --global http.proxy http://127.0.0.1:7890')
  console.log('  - 或改用 SSH：   ssh -T git@github.com   （端口 22 / 443）')
  console.log('  - 或先只发 npm（npm 通道可用时），GitHub 稍后补')
} else {
  console.log('✓ GitHub 网页可达')
}
if (!npm.ok) console.log('⚠ npm 注册表不可达：无法发布，需先解决网络或代理')
else console.log('✓ npm 注册表可达')
