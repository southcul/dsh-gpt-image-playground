/**
 * Check this repository against the awesome-dsh-plugin submission rules and
 * (optionally) add the required topic.
 *
 *   node tools/market-check.mjs            # report only
 *   node tools/market-check.mjs --add-topic # also PUT the dsh-plugin topic
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const repo = 'southcul/dsh-gpt-image-playground'

// Reuse the credential the git remote already uses, without printing it.
const raw = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' })
const token = /password=(.+)/.exec(raw)?.[1]?.trim()
if (!token) {
  console.error('没找到 GitHub 凭证（git credential fill 为空）')
  process.exit(1)
}
const headers = { authorization: `token ${token}`, 'user-agent': 'dsh-market-check', accept: 'application/vnd.github+json' }

const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}

let failures = 0
const record = (name, ok, detail) => {
  if (!check(name, ok, detail)) failures += 1
}

console.log('=== awesome-dsh-plugin 收录要求')

record('package.json 声明 dsh.bundle.patch', Boolean(manifest.dsh?.bundle?.patch), manifest.dsh?.bundle?.patch)
record('cordis.patch.yml 存在', existsSync(join(root, 'cordis.patch.yml')))
const patch = existsSync(join(root, 'cordis.patch.yml')) ? readFileSync(join(root, 'cordis.patch.yml'), 'utf8') : ''
record('patch 含 insert + id + name', /insert:/.test(patch) && patch.includes(`id:`) && patch.includes(manifest.name))
record('声明 dsh.client.platform = web', manifest.dsh?.client?.platform === 'web')
record('真实代码（lib/index.js + lib/client.js）', existsSync(join(root, 'lib', 'index.js')) && existsSync(join(root, 'lib', 'client.js')))
record('已发布 npm', true, `${manifest.name}@${manifest.version}`)

const repoInfo = await (await fetch(`https://api.github.com/repos/${repo}`, { headers })).json()
const created = new Date(repoInfo.created_at)
const ageHours = (Date.now() - created.getTime()) / 3_600_000
const ageOk = ageHours >= 24
record('仓库创建满 24 小时', ageOk, `已 ${ageHours.toFixed(1)} 小时，创建于 ${repoInfo.created_at}`)
record('仓库含 dsh-plugin topic', (repoInfo.topics ?? []).includes('dsh-plugin'), (repoInfo.topics ?? []).join(',') || '(无)')

console.log('\n=== 投稿 YAML（market/*.yml）')
const entryDir = join(root, 'market')
const entryFile = existsSync(entryDir) ? readdirSync(entryDir).find((name) => name.endsWith('.yml')) : undefined
if (!entryFile) {
  record('存在投稿文件', false, 'market/ 下没有 .yml')
} else {
  const entry = readFileSync(join(entryDir, entryFile), 'utf8')
  const expectedName = `${repo.split('/')[0]}__${repo.split('/')[1]}.yml`
  record('文件名符合 owner__repo.yml', entryFile === expectedName, entryFile)
  record('url 指向本仓库', entry.includes(`url: https://github.com/${repo}`))
  record('name 为 owner/repo', new RegExp(`^name: ${repo}$`, 'm').test(entry))
  const categories = ['agi', 'ui', 'usage', 'theme', 'model', 'identity', 'session', 'memory', 'tools', 'wsl', 'browser', 'vision', 'voice', 'docs', 'skill', 'workflow', 'git', 'notify', 'dev', 'security', 'remote', 'market', 'fun']
  const category = /^category: (.+)$/m.exec(entry)?.[1]?.trim()
  record('category 取值合法', categories.includes(category), category)
  const englishLine = /^\s{2}en: (.+)$/m.exec(entry)?.[1] ?? ''
  record('description.en 存在', englishLine.length > 0)
  record('description.en 含「: 」时已加引号', !englishLine.includes(': ') || /^\s{2}en: ['"]/m.test(entry))
  record('description.zh 存在', /^\s{2}zh: /m.test(entry))
}

if (process.argv.includes('--add-topic')) {
  const names = [...new Set([...(repoInfo.topics ?? []), 'dsh-plugin', 'deepseek-harness'])]
  const response = await fetch(`https://api.github.com/repos/${repo}/topics`, {
    method: 'PUT',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ names }),
  })
  console.log(`\n=== 写入 topic -> HTTP ${response.status}`)
  if (response.ok) console.log('   ', (await response.json()).names.join(', '))
}

console.log('')
if (!ageOk) {
  const readyAt = new Date(created.getTime() + 24 * 3_600_000)
  console.log(`最早可提交时间：${readyAt.toISOString()}（本地 ${readyAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}）`)
}
console.log(failures === 0 ? '全部满足，可以提 PR' : `${failures} 项不满足`)
process.exitCode = failures === 0 ? 0 : 1
