/**
 * Install the packed npm tarball the way a user would (pnpm add file:…tgz) and
 * check the installed copy still mounts.
 *
 *   node tools/test-npm-tarball.mjs [path/to/package.tgz]
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const here = import.meta.dirname
const root = join(here, '..')
const failures = []
const check = (name, condition, extra = '') => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${name}${condition ? '' : ' ' + extra}`)
  if (!condition) failures.push(name)
}

const explicit = process.argv[2]
const packDir = join(root, 'npm-pack')
const candidate = explicit ?? (existsSync(packDir) ? readdirSync(packDir).find((name) => name.endsWith('.tgz')) : undefined)
if (!candidate) {
  console.error('找不到 tarball：先运行 `node tools/pack.mjs` 或 `pnpm pack --pack-destination npm-pack`')
  process.exit(1)
}
const tarball = explicit ? join(process.cwd(), explicit) : join(packDir, candidate)
check('tarball exists', existsSync(tarball), tarball)

const pnpm = join(process.env.USERPROFILE ?? '', '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'pnpm', 'bin', 'pnpm.mjs')
check('bundled pnpm found', existsSync(pnpm), pnpm)

const workspace = mkdtempSync(join(tmpdir(), 'gipg-npm-'))
writeFileSync(join(workspace, 'package.json'), JSON.stringify({ name: 'probe', private: true }, null, 2))
mkdirSync(join(workspace, 'node_modules'), { recursive: true })

execFileSync(process.execPath, [pnpm, 'add', `file:${tarball}`, '--ignore-scripts', '--reporter=append-only'], {
  cwd: workspace,
  stdio: 'inherit',
})

const installed = join(workspace, 'node_modules', 'dsh-gpt-image-playground')
check('package installed', existsSync(join(installed, 'package.json')), installed)
check('host half present', existsSync(join(installed, 'lib', 'index.js')))
check('client half present', existsSync(join(installed, 'lib', 'client.js')))
check('vendored app present', existsSync(join(installed, 'vendor-app', 'index.html')))
check('patch file present', existsSync(join(installed, 'cordis.patch.yml')))
check('licence notices present', existsSync(join(installed, 'THIRD-PARTY-NOTICES.md')))
check('no dev files shipped', !existsSync(join(installed, 'tools')) && !existsSync(join(installed, 'preview')))

const { apply, APP_ROUTE, PROXY_ROUTE, SETTINGS_ROUTE } = await import(pathToFileURL(join(installed, 'lib', 'index.js')).href)
const routes = []
const ctx = {
  logger: { info() {}, warn() {}, error() {} },
  effect: (fn) => fn(),
  webServer: { register: (entry) => (routes.push(entry), () => {}) },
}
apply(ctx, { dataDir: join(workspace, 'data') })
const paths = routes.map((entry) => entry.path)
check('mounts the app route', paths.includes(APP_ROUTE), paths.join(','))
check('mounts the proxy route', paths.includes(PROXY_ROUTE))
check('mounts the settings route', paths.includes(SETTINGS_ROUTE))

console.log(failures.length === 0 ? '\nall checks passed' : `\n${failures.length} failure(s): ${failures.join(', ')}`)
process.exitCode = failures.length === 0 ? 0 : 1
