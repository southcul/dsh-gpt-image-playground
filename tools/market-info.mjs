/**
 * Read the market's contributing guide and data layout.
 *
 *   node tools/market-info.mjs
 */
const UA = { 'user-agent': 'dsh-plugin-market-research', accept: 'application/vnd.github+json' }
const API = 'https://api.github.com/repos/awesome-dsh-plugin/awesome-dsh-plugin/contents'

async function apiJson(url, attempts = 3) {
  let last
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20_000) })
      if (response.status === 404) return { status: 404 }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return { status: response.status, body: await response.json() }
    } catch (error) {
      last = error
      await new Promise((resolve) => setTimeout(resolve, 1200 * attempt))
    }
  }
  throw last
}

function decode(file) {
  return Buffer.from(file.content, 'base64').toString('utf8')
}

const guide = await apiJson(`${API}/contributing.md`)
console.log('=== contributing.md ===')
console.log(decode(guide.body))

for (const dir of ['data', 'scripts', '.github']) {
  const listing = await apiJson(`${API}/${dir}`)
  console.log(`\n=== ${dir}/ ===`)
  if (listing.status === 404) {
    console.log('  (不存在)')
    continue
  }
  for (const item of listing.body) console.log(`  ${item.type.padEnd(4)} ${item.name}  ${item.size ?? ''}`)
}
