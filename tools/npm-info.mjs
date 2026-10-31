/**
 * Print what the npm registry thinks about a package name.
 *
 *   node tools/npm-info.mjs [name]
 */
const name = process.argv[2] ?? 'dsh-gpt-image-playground'
const url = `https://registry.npmjs.org/${encodeURIComponent(name).replace('%40', '@')}?t=${Date.now()}`

const response = await fetch(url, {
  headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
  signal: AbortSignal.timeout(20_000),
})

if (response.status === 404) {
  console.log(`${name}: 未发布（404）—— 名字可用`)
  process.exit(0)
}
if (!response.ok) {
  console.log(`${name}: HTTP ${response.status}`)
  process.exit(1)
}

const meta = await response.json()
console.log(`name:        ${meta.name}`)
console.log(`dist-tags:   ${JSON.stringify(meta['dist-tags'])}`)
console.log(`maintainers: ${(meta.maintainers ?? []).map((item) => item.name).join(', ') || '(none)'}`)
console.log(`modified:    ${meta.time?.modified ?? '?'}`)
console.log('versions:')
for (const [version, value] of Object.entries(meta.versions ?? {})) {
  const size = typeof value.dist?.unpackedSize === 'number' ? `${(value.dist.unpackedSize / 1024).toFixed(0)} KB` : '?'
  console.log(`  ${version.padEnd(16)} ${size.padEnd(10)} ${value.dist?.tarball ?? ''}`)
  if (value.repository) console.log(`  ${''.padEnd(16)} repo: ${value.repository.url ?? value.repository}`)
}
