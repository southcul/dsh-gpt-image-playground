/**
 * Is this plugin in the published DSH market catalog yet?
 *
 *   node tools/market-status.mjs
 */
const NAMES = ['dsh-gpt-image-playground']
const SOURCES = [
  'https://unpkg.com/dsh-plugin-catalog@latest/index.json',
  'https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json',
]

let doc
let source
for (const url of SOURCES) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    doc = await response.json()
    source = url
    break
  } catch (error) {
    console.log(`skip ${url}: ${error.message}`)
  }
}
if (!doc) {
  console.error('取不到目录索引')
  process.exit(1)
}

console.log(`catalog: ${source}`)
console.log(`format: ${doc.format} | plugins: ${doc.plugins.length}`)

const meta = await (await fetch('https://registry.npmjs.org/dsh-plugin-catalog/latest', { signal: AbortSignal.timeout(20_000) })).json()
console.log(`catalog package: ${meta.version} (published ${meta.dist?.fileCount ? '' : ''})`)

for (const name of NAMES) {
  const entry = doc.plugins.find((plugin) => plugin.name === name)
  console.log('')
  if (!entry) {
    console.log(`${name}: 尚未出现在目录中`)
    continue
  }
  console.log(`${name}: 已收录`)
  console.log(`  title:      ${entry.title}`)
  console.log(`  category:   ${entry.metadata?.category}`)
  console.log(`  homepage:   ${entry.homepage}`)
  console.log(`  repository: ${entry.repository?.url}`)
  console.log(`  versions:   ${(entry.versions ?? []).map((version) => `${version.version} (${version.source?.type})`).join(', ')}`)
  console.log(`  description.zh: ${(entry.description?.zh ?? '').slice(0, 80)}`)
}
