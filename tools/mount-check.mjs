/**
 * Mount a copy of the plugin from an arbitrary directory and report its routes.
 *
 *   node tools/mount-check.mjs <path-to-plugin-dir>
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const target = process.argv[2]
if (!target) {
  console.error('用法：node tools/mount-check.mjs <插件目录>')
  process.exit(1)
}

const checks = {
  'package.json': existsSync(join(target, 'package.json')),
  'lib/index.js': existsSync(join(target, 'lib', 'index.js')),
  'lib/client.js': existsSync(join(target, 'lib', 'client.js')),
  'vendor-app/index.html': existsSync(join(target, 'vendor-app', 'index.html')),
  'vendor-app/assets': existsSync(join(target, 'vendor-app', 'assets')),
  'cordis.patch.yml': existsSync(join(target, 'cordis.patch.yml')),
  'THIRD-PARTY-NOTICES.md': existsSync(join(target, 'THIRD-PARTY-NOTICES.md')),
  'no tools/': !existsSync(join(target, 'tools')),
  'no preview/': !existsSync(join(target, 'preview')),
}

let failed = false
for (const [name, ok] of Object.entries(checks)) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`)
  if (!ok) failed = true
}

const { apply, name: pluginName } = await import(pathToFileURL(join(target, 'lib', 'index.js')).href)
const routes = []
apply(
  {
    logger: { info() {}, warn() {}, error() {} },
    effect: (fn) => fn(),
    webServer: { register: (entry) => (routes.push(entry), () => {}) },
  },
  { dataDir: join(process.env.TEMP ?? '/tmp', 'gipg-mount-check') },
)

console.log(`  plugin: ${pluginName}`)
console.log(`  routes: ${routes.map((entry) => `${entry.kind} ${entry.path}`).join(', ')}`)
const mounted = routes.length === 4
console.log(`  ${mounted ? 'ok  ' : 'FAIL'} mounts all routes`)
process.exitCode = failed || !mounted ? 1 : 0
