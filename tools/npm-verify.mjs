/**
 * Verify what the registry actually serves for this package, bypassing caches.
 *
 *   node tools/npm-verify.mjs [name] [version]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const name = process.argv[2] ?? manifest.name
const version = process.argv[3] ?? manifest.version

let token
try {
  const npmrc = readFileSync(join(root, '.npmrc'), 'utf8')
  token = /_authToken=(\S+)/.exec(npmrc)?.[1]
} catch {
  token = undefined
}

const stamp = Date.now()
const headers = { 'cache-control': 'no-cache', pragma: 'no-cache' }
if (token) headers.authorization = `Bearer ${token}`

const metaUrl = `https://registry.npmjs.org/${encodeURIComponent(name).replace('%40', '@')}?write=true&t=${stamp}`
const response = await fetch(metaUrl, { headers, signal: AbortSignal.timeout(20_000) })
if (response.status === 404) {
  console.log(`${name}: 404 —— 还没有发布`)
  process.exit(1)
}
const meta = await response.json()

const versions = Object.keys(meta.versions ?? {})
const latest = meta['dist-tags']?.latest
console.log(`name:        ${meta.name}`)
console.log(`dist-tags:   ${JSON.stringify(meta['dist-tags'])}`)
console.log(`versions:    ${versions.join(', ')}`)
console.log(`published:   ${meta.time?.[version] ?? '(版本缺失)'}`)

const tarball = meta.versions?.[version]?.dist?.tarball
if (tarball) {
  const head = await fetch(tarball, { method: 'HEAD', signal: AbortSignal.timeout(20_000) })
  const size = Number(head.headers.get('content-length') ?? 0)
  console.log(`tarball:     HTTP ${head.status}, ${size ? `${(size / 1024 / 1024).toFixed(2)} MB` : 'size unknown'}`)
}

const ok = versions.includes(version) && latest === version
console.log('')
console.log(ok ? `✓ ${name}@${version} 已发布且为 latest` : `✗ ${version} 未就绪（latest=${latest}）`)
process.exit(ok ? 0 : 1)
