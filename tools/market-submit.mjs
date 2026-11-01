/**
 * Submit this plugin to awesome-dsh-plugin: fork, branch, add the entry file,
 * open the pull request.
 *
 *   node tools/market-submit.mjs --dry-run   # check everything, mutate nothing
 *   node tools/market-submit.mjs             # actually fork + open the PR
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const UPSTREAM = 'awesome-dsh-plugin/awesome-dsh-plugin'
const OWNER = 'southcul'
const FORK = `${OWNER}/awesome-dsh-plugin`
const BRANCH = 'add-gpt-image-playground'
const ENTRY_PATH = 'data/plugins/southcul__dsh-gpt-image-playground.yml'
const dryRun = process.argv.includes('--dry-run')

const raw = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' })
const token = /password=(.+)/.exec(raw)?.[1]?.trim()
if (!token) {
  console.error('没有 GitHub 凭证（git credential fill 为空）')
  process.exit(1)
}
const headers = {
  authorization: `token ${token}`,
  'user-agent': 'dsh-market-submit',
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

const entry = readFileSync(join(root, 'market', 'southcul__dsh-gpt-image-playground.yml'), 'utf8')
console.log(`entry: ${ENTRY_PATH} (${entry.length} bytes)`)

const upstream = await api('GET', `/repos/${UPSTREAM}`)
if (upstream.status !== 200) {
  console.error(`读不到上游仓库：HTTP ${upstream.status}`)
  process.exit(1)
}
const upstreamBranch = upstream.body.default_branch

const existingPr = await api('GET', `/repos/${UPSTREAM}/pulls?state=open&head=${OWNER}:${BRANCH}`)
if (Array.isArray(existingPr.body) && existingPr.body.length > 0) {
  console.log(`PR 已存在：${existingPr.body[0].html_url}`)
  process.exit(0)
}
const alreadyListed = await api('GET', `/repos/${UPSTREAM}/contents/${ENTRY_PATH}?ref=${upstreamBranch}`)
if (alreadyListed.status === 200) {
  console.log('该条目已经在上游仓库里，无需提交')
  process.exit(0)
}

console.log(`\n1) fork ${UPSTREAM} -> ${FORK}`)
let fork = await api('GET', `/repos/${FORK}`)
if (fork.status === 404) {
  if (dryRun) {
    console.log('   [dry-run] 会创建 fork')
  } else {
    const created = await api('POST', `/repos/${UPSTREAM}/forks`, { default_branch_only: true })
    console.log(`   fork: HTTP ${created.status}`)
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      fork = await api('GET', `/repos/${FORK}`)
      if (fork.status === 200) break
    }
  }
} else {
  console.log('   fork 已存在')
}

console.log(`\n2) 分支 ${BRANCH}`)
const head = dryRun ? { status: 200, body: { object: { sha: 'dry-run-sha' } } } : await api('GET', `/repos/${FORK}/git/ref/heads/${fork.body?.default_branch ?? 'main'}`)
const baseSha = head.body?.object?.sha
console.log(`   base sha: ${baseSha}`)

if (!dryRun) {
  const branch = await api('POST', `/repos/${FORK}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: baseSha })
  console.log(`   create ref: HTTP ${branch.status}${branch.status === 422 ? '（分支已存在，继续）' : ''}`)

  console.log(`\n3) 写入 ${ENTRY_PATH}`)
  const put = await api('PUT', `/repos/${FORK}/contents/${ENTRY_PATH}`, {
    message: 'Add southcul/dsh-gpt-image-playground',
    content: Buffer.from(entry, 'utf8').toString('base64'),
    branch: BRANCH,
  })
  console.log(`   PUT: HTTP ${put.status}`)
  if (put.status !== 200 && put.status !== 201) {
    console.error(JSON.stringify(put.body).slice(0, 400))
    process.exit(1)
  }

  console.log('\n4) 开 PR')
  const pr = await api('POST', `/repos/${UPSTREAM}/pulls`, {
    title: 'Add southcul/dsh-gpt-image-playground',
    head: `${OWNER}:${BRANCH}`,
    base: upstreamBranch,
    body: [
      'Adds one entry file, as described in contributing.md.',
      '',
      '**What it is** — the GPT Image Playground workbench running inside DeepSeek Harness. The upstream MIT build is vendored and served same-origin by the plugin; an optional API proxy forwards requests when the browser cannot reach the API directly.',
      '',
      '**Manifest** — `package.json` declares `dsh.bundle.patch` (`./cordis.patch.yml`) and `dsh.client.platform: web`; the patch inserts one loader row.',
      '',
      `**npm** — published as \`dsh-gpt-image-playground\` (latest ${JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version}).`,
      '',
      '**Repo** — created 2026-10-31, `dsh-plugin` topic added, MIT licensed, upstream attribution in `THIRD-PARTY-NOTICES.md`.',
      '',
      'Category: `vision` — it is an image generation/editing surface.',
    ].join('\n'),
  })
  console.log(`   PR: HTTP ${pr.status}`)
  if (pr.status >= 300) {
    console.error(JSON.stringify(pr.body).slice(0, 400))
    process.exit(1)
  }
  console.log(`\n${pr.body.html_url}`)
} else {
  console.log('\n[dry-run] 未做任何改动')
}
