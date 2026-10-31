/**
 * Verify the distributable zip: extract it into a temp folder, install it into
 * a throwaway DSH profile, and confirm the copied plugin can still mount.
 *
 *   node tools/test-pack.mjs
 */
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const here = import.meta.dirname
const root = join(here, '..')
const dist = join(root, 'dist')
const failures = []
const check = (name, condition, extra = '') => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${name}${condition ? '' : ' ' + extra}`)
  if (!condition) failures.push(name)
}

const archives = readdirSync(dist).filter((name) => name.endsWith('.zip'))
check('zip artifact exists', archives.length > 0, archives.join(','))
const zipPath = join(dist, archives[0])

const workspace = mkdtempSync(join(tmpdir(), 'gipg-pack-'))
const extracted = join(workspace, 'unzipped')
execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${extracted}' -Force`], { stdio: 'inherit' })
const folder = readdirSync(extracted)[0]
const pluginDir = join(extracted, folder)

check('zip contains install.ps1', existsSync(join(pluginDir, 'install.ps1')))
check('zip contains vendor-app', existsSync(join(pluginDir, 'vendor-app', 'index.html')))
check('zip contains the licence notices', existsSync(join(pluginDir, 'THIRD-PARTY-NOTICES.md')))

// A throwaway DSH home with one desktop profile.
const home = join(workspace, 'home')
const profile = join(home, 'profiles', 'desktop')
mkdirSync(profile, { recursive: true })
writeFileSync(join(profile, 'package.json'), JSON.stringify({ name: 'dsh-profile-desktop', private: true, dependencies: {}, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } } }, null, 2))
writeFileSync(join(profile, 'cordis.patch.yml'), '# patch layer\n[]\n')

const output = execFileSync(process.execPath, [join(pluginDir, 'install.mjs'), '--copy'], {
  cwd: pluginDir,
  env: { ...process.env, DSH_HOME: home },
  encoding: 'utf8',
})
console.log('    ' + output.trim().split('\n').join('\n    '))

const installed = join(profile, 'node_modules', 'dsh-gpt-image-playground')
check('plugin copied into node_modules', existsSync(join(installed, 'lib', 'index.js')))
check('vendored app copied too', existsSync(join(installed, 'vendor-app', 'assets')))
const pkg = JSON.parse(readFileSync(join(profile, 'package.json'), 'utf8'))
check('dependency recorded as file:', pkg.dependencies['dsh-gpt-image-playground'] === 'file:')
check('bundle enabled', pkg.dsh.profile.bundles.includes('dsh-gpt-image-playground'))
check('patch entry appended', readFileSync(join(profile, 'cordis.patch.yml'), 'utf8').includes('id: gpt-image-playground'))
check('backups written', readdirSync(profile).some((name) => name.includes('.bak-')))

// The relocated copy must still mount: import its host half and register routes.
const { apply, APP_ROUTE } = await import(pathToFileURL(join(installed, 'lib', 'index.js')).href)
const routes = []
const ctx = {
  logger: { info() {}, warn() {}, error() {} },
  effect: (fn) => fn(),
  webServer: { register: (entry) => (routes.push(entry), () => {}) },
}
apply(ctx, { dataDir: join(workspace, 'data') })
check('installed copy mounts its routes', routes.some((entry) => entry.path === APP_ROUTE), JSON.stringify(routes.map((entry) => entry.path)))
check('vendored index is served from the copy', existsSync(join(installed, 'vendor-app', 'index.html')))

// Uninstall must restore the profile.
const uninstallOutput = execFileSync(process.execPath, [join(pluginDir, 'install.mjs'), '--uninstall'], {
  cwd: pluginDir,
  env: { ...process.env, DSH_HOME: home },
  encoding: 'utf8',
})
console.log('    ' + uninstallOutput.trim())
const after = JSON.parse(readFileSync(join(profile, 'package.json'), 'utf8'))
check('uninstall removes the dependency', !after.dependencies['dsh-gpt-image-playground'])
check('uninstall removes the bundle', !after.dsh.profile.bundles.includes('dsh-gpt-image-playground'))
check('uninstall removes the patch entry', !readFileSync(join(profile, 'cordis.patch.yml'), 'utf8').includes('id: gpt-image-playground'))
check('uninstall removes the files', !existsSync(installed))

console.log(failures.length === 0 ? '\nall checks passed' : `\n${failures.length} failure(s): ${failures.join(', ')}`)
process.exitCode = failures.length === 0 ? 0 : 1
void createServer
