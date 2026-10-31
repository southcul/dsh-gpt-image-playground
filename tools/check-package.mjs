/**
 * Pre-publish gate: fail before npm ever sees a broken package.
 *
 *   node tools/check-package.mjs            # optional metadata only warns
 *   node tools/check-package.mjs --strict   # placeholders become failures
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const strict = process.argv.includes('--strict')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const errors = []
const warnings = []
const fail = (message) => errors.push(message)
const warn = (message) => (strict ? errors : warnings).push(message)
const read = (relative) => readFileSync(join(root, relative), 'utf8')

// --- identity -------------------------------------------------------------
if (typeof manifest.name !== 'string' || !/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(manifest.name)) fail(`name 不合法：${manifest.name}`)
if (typeof manifest.description !== 'string' || manifest.description.length < 40) fail('description 太短，npm 搜索页会很难看')
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(String(manifest.version))) fail(`version 不是合法 semver：${manifest.version}`)
if (manifest.license !== 'MIT') warn(`license 是 ${manifest.license}，确认与 LICENSE 文件一致`)
if (!existsSync(join(root, 'LICENSE'))) fail('缺少 LICENSE')
if (!Array.isArray(manifest.keywords) || manifest.keywords.length < 5) warn('keywords 少于 5 个，不利于搜索')

// --- repository metadata --------------------------------------------------
const repositoryUrl = String(manifest.repository?.url ?? manifest.repository ?? '')
if (!repositoryUrl) warn('缺 repository（npm 页面不会显示源码链接）')
else if (repositoryUrl.includes('REPLACE_ME')) warn('repository 仍是 REPLACE_ME 占位符，发布前改成真实仓库地址')
if (String(manifest.homepage ?? '').includes('REPLACE_ME')) warn('homepage 仍是 REPLACE_ME 占位符')
if (String(manifest.bugs?.url ?? '').includes('REPLACE_ME')) warn('bugs.url 仍是 REPLACE_ME 占位符')
if (!manifest.author) warn('缺 author（可选，但 npm 页面会显示「未知」）')

// --- DSH manifest ---------------------------------------------------------
const patch = manifest.dsh?.bundle?.patch
if (!patch) fail('dsh.bundle.patch 缺失：DSH 不会把它当作组合包')
else if (!existsSync(join(root, patch))) fail(`dsh.bundle.patch 指向的文件不存在：${patch}`)
if (manifest.dsh?.client?.platform !== 'web') fail('dsh.client.platform 必须是 "web"')
if (!manifest.exports?.['./client']) fail('缺少 exports["./client"]：客户端 bundle 不会被加载')
if (!manifest.exports?.['.']) fail('缺少 exports["."]：宿主半侧无法被 import')

// --- shipped files --------------------------------------------------------
const files = manifest.files ?? []
for (const required of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml', 'README.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md']) {
  if (!files.includes(required)) fail(`files 未包含 ${required}`)
  else if (!existsSync(join(root, required))) fail(`${required} 在 files 里，但磁盘上不存在`)
}
if (!files.some((entry) => entry.startsWith('vendor-app/'))) fail('files 未包含 vendor-app：装上会打不开界面')
if (!existsSync(join(root, 'vendor-app', 'index.html'))) fail('vendor-app/index.html 缺失，先跑 tools/vendor-dist.mjs')
if (!existsSync(join(root, 'vendor-app', 'assets'))) fail('vendor-app/assets 缺失，先跑 tools/vendor-dist.mjs')

// --- vendor sanity --------------------------------------------------------
let vendorFiles = 0
let vendorBytes = 0
const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name)
    if (entry.isDirectory()) walk(target)
    else {
      vendorFiles += 1
      vendorBytes += statSync(target).size
    }
  }
}
walk(join(root, 'vendor-app'))
if (vendorFiles < 20) fail(`vendor-app 只有 ${vendorFiles} 个文件，疑似没抓全`)
if (vendorBytes < 1_000_000) fail(`vendor-app 只有 ${(vendorBytes / 1024).toFixed(0)} KB，疑似没抓全`)

// --- nothing embarrassing ships ------------------------------------------
// `.npmrc` on disk is expected (it carries the publish token); what must never
// happen is it being packaged or left untracked-by-gitignore.
if (files.some((pattern) => pattern === '.npmrc' || pattern.startsWith('.npmrc'))) fail('files 包含 .npmrc：Token 会随包泄露')
if (existsSync(join(root, '.npmrc'))) {
  const gitignore = existsSync(join(root, '.gitignore')) ? read('.gitignore') : ''
  if (!/^\.npmrc\s*$/m.test(gitignore)) warn('.npmrc 存在，但 .gitignore 没有忽略它')
}
for (const relative of ['test-server.mjs', 'client-test.mjs', 'publish.ps1']) {
  if (files.includes(relative)) fail(`files 不应包含开发文件：${relative}`)
}
for (const entry of ['tools', 'preview', 'dist']) {
  if (files.some((pattern) => pattern.startsWith(entry))) fail(`files 不应包含 ${entry}/`)
}

// --- README sanity --------------------------------------------------------
const readme = read('README.md')
if (!/##\s*安装/.test(readme)) warn('README 缺少「安装」小节')
if (!/THIRD-PARTY-NOTICES/.test(readme)) fail('README 未提及 THIRD-PARTY-NOTICES（再分发需保留上游署名）')
for (const match of readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
  const target = match[1]
  if (target.startsWith('http')) continue
  if (!existsSync(join(root, target))) fail(`README 引用的图片不存在：${target}`)
}

// --- report ---------------------------------------------------------------
console.log(`package: ${manifest.name}@${manifest.version}`)
console.log(`files: ${files.length} patterns · vendor-app ${vendorFiles} 个文件 / ${(vendorBytes / 1024 / 1024).toFixed(2)} MB`)
for (const message of warnings) console.log(`  warn  ${message}`)
for (const message of errors) console.log(`  FAIL  ${message}`)
if (errors.length > 0) {
  console.log(`\n${errors.length} 个问题必须修复后才能发布`)
  process.exit(1)
}
console.log(`\n可以发布${warnings.length > 0 ? `（${warnings.length} 条提醒）` : ''}`)
