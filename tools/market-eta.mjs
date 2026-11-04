/**
 * Estimate how long an awesome-dsh-plugin submission takes, from real merges.
 *
 *   node tools/market-eta.mjs
 */
const UA = { 'user-agent': 'dsh-market-eta', accept: 'application/vnd.github+json' }
const REPO = 'awesome-dsh-plugin/awesome-dsh-plugin'

const hours = (from, to) => (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000

const median = (values) => {
  if (values.length === 0) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

const closed = await (await fetch(`https://api.github.com/repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=60`, { headers: UA })).json()
const merged = closed.filter((pr) => pr.merged_at && !pr.user.login.endsWith('[bot]'))
const durations = merged.map((pr) => hours(pr.created_at, pr.merged_at))
const addedFiles = merged.filter((pr) => pr.title.startsWith('Add '))

console.log(`样本：最近关闭的 PR ${closed.length} 个，其中已合并 ${merged.length} 个，标题以 "Add " 开头的 ${addedFiles.length} 个`)
console.log(`从开 PR 到合并（小时）：中位 ${median(durations).toFixed(1)}｜最短 ${Math.min(...durations).toFixed(1)}｜最长 ${Math.max(...durations).toFixed(1)}`)
for (const threshold of [1, 6, 24, 72]) {
  const count = durations.filter((value) => value <= threshold).length
  console.log(`  ≤ ${String(threshold).padStart(2)}h：${count} / ${durations.length}（${((count / durations.length) * 100).toFixed(0)}%）`)
}

console.log('\n最近 8 个已合并的 "Add " PR：')
for (const pr of addedFiles.slice(0, 8)) {
  console.log(`  #${pr.number}  ${hours(pr.created_at, pr.merged_at).toFixed(1)}h  ${pr.title.slice(0, 58)}`)
}

const open = await (await fetch(`https://api.github.com/search/issues?q=repo:${REPO}+is:pr+is:open&per_page=1`, { headers: UA })).json()
console.log(`\n当前排队中的 open PR：${open.total_count}`)

const catalog = await (await fetch('https://registry.npmjs.org/dsh-plugin-catalog', { headers: UA })).json()
const stamps = Object.entries(catalog.time)
  .filter(([version]) => /^\d{4}\./.test(version))
  .sort((a, b) => new Date(b[1]) - new Date(a[1]))
  .slice(0, 8)
console.log('\ndsh-plugin-catalog 最近发布：')
for (const [version, when] of stamps) console.log(`  ${version}  ${when}`)
if (stamps.length > 1) {
  const gaps = stamps.slice(1).map(([, when], index) => hours(when, stamps[index][1]))
  console.log(`  相邻发布间隔中位：${median(gaps).toFixed(1)} 小时`)
}
