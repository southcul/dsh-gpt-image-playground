/**
 * Update the already-merged awesome-dsh-plugin entry (description only).
 *
 *   node tools/market-update.mjs --dry-run
 *   node tools/market-update.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const UPSTREAM = 'awesome-dsh-plugin/awesome-dsh-plugin'
const OWNER = 'southcul'
const FORK = `${OWNER}/awesome-dsh-plugin`
const BRANCH = 'update-gpt-image-playground-intro'
const ENTRY_PATH = 'data/plugins/southcul__dsh-gpt-image-playground.yml'
const dryRun = process.argv.includes('--dry-run')

const raw = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' })
const token = /password=(.+)/.exec(raw)?.[1]?.trim()
if (!token) {
  console.error('没有 GitHub 凭证')
  process.exit(1)
}
const headers = {
  authorization: `token ${token}`,
  'user-agent': 'dsh-market-update',
  accept: 'application/vnd.github+json',
  'content-type': 'application/json',
}

async function api(method, path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  const text = await response.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }
  return { status: response.status, body: json }
}

// Descriptions come from the local entry, which is the source of truth.
const local = readFileSync(join(root, 'market', 'southcul__dsh-gpt-image-playground.yml'), 'utf8')
const localEn = /^\s*en: '(.*)'$/m.exec(local)?.[1]
const localZh = /^\s*zh: '(.*)'$/m.exec(local)?.[1]
if (!localEn || !localZh) {
  console.error('读不到本地描述')
  process.exit(1)
}

const upstreamRepo = await api('GET', `/repos/${UPSTREAM}`)
const base = upstreamRepo.body.default_branch
const current = await api('GET', `/repos/${UPSTREAM}/contents/${ENTRY_PATH}?ref=${base}`)
if (current.status !== 200) {
  console.error(`上游没有这个条目：HTTP ${current.status}`)
  process.exit(1)
}
const currentText = Buffer.from(current.body.content, 'base64').toString('utf8')
const currentEn = /^\s*en: '(.*)'$/m.exec(currentText)?.[1]
const currentZh = /^\s*zh: '(.*)'$/m.exec(currentText)?.[1]
console.log('upstream en:', (currentEn ?? '').slice(0, 70) + '...')
console.log('upstream zh:', (currentZh ?? '').slice(0, 40) + '...')

if (currentEn === localEn && currentZh === localZh) {
  console.log('\n上游条目描述已经是最新的，无需更新')
  process.exit(0)
}

const nextText = currentText
  .replace(/^(\s*en: ).*$/m, `$1'${localEn}'`)
  .replace(/^(\s*zh: ).*$/m, `$1'${localZh}'`)

const existing = await api('GET', `/repos/${UPSTREAM}/pulls?state=open&head=${OWNER}:${BRANCH}`)
if (Array.isArray(existing.body) && existing.body.length > 0) {
  console.log(`\n已有对应 PR：${existing.body[0].html_url}`)
  process.exit(0)
}

if (dryRun) {
  console.log('\n--- 将要写入的内容 ---')
  console.log(nextText.split('\n').slice(-6).join('\n'))
  console.log('\n[dry-run] 未做任何改动')
  process.exit(0)
}

// A fork that lags behind cannot host a branch based on the upstream head.
console.log('\n1) 同步 fork')
const sync = await api('POST', `/repos/${FORK}/merge-upstream`, { branch: base })
console.log(`   merge-upstream: HTTP ${sync.status} ${sync.body.message ?? ''}`.trimEnd())

const forkInfo = await api('GET', `/repos/${FORK}/git/ref/heads/${base}`)
const baseSha = forkInfo.body?.object?.sha
console.log(`   base sha: ${baseSha}`)

console.log(`\n2) 分支 ${BRANCH}`)
const ref = await api('POST', `/repos/${FORK}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: baseSha })
console.log(`   201 expected, got ${ref.status}`)

console.log(`\n3) 更新 ${ENTRY_PATH}`)
const put = await api('PUT', `/repos/${FORK}/contents/${ENTRY_PATH}`, {
  message: 'Update southcul/dsh-gpt-image-playground description',
  content: Buffer.from(nextText, 'utf8').toString('base64'),
  branch: BRANCH,
  sha: current.body.sha,
})
console.log(`   PUT: HTTP ${put.status}`)
if (put.status !== 200) {
  console.error(JSON.stringify(put.body).slice(0, 400))
  process.exit(1)
}

console.log('\n4) 开 PR')
const pr = await api('POST', `/repos/${UPSTREAM}/pulls`, {
  title: 'Update southcul/dsh-gpt-image-playground description',
  head: `${OWNER}:${BRANCH}`,
  base,
  body: [
    'Refreshes the description of an entry that is already listed, to match the current feature set. No other changes.',
    '',
    '- Now mentions the supported models: GPT Image, Gemini (Nano Banana) and Grok.',
    '- Now mentions the provider types: official, OpenAI-compatible, api.toolify-ai.com and custom HTTP.',
    '- Lists the editing capabilities and states that images/history stay local.',
    '',
    '`en` and `zh` only; `url`, `name` and `category` are untouched.',
  ].join('\n'),
})
console.log(`   PR: HTTP ${pr.status}`)
if (pr.status >= 300) {
  console.error(JSON.stringify(pr.body).slice(0, 400))
  process.exit(1)
}
console.log(`\n${pr.body.html_url}`)
