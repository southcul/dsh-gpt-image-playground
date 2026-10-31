/**
 * Install this plugin into a DSH profile and enable it.
 *
 *   node install.mjs                     # junction into the desktop profile
 *   node install.mjs --copy              # copy the files instead (for a zip)
 *   node install.mjs --profile web       # another profile (desktop | web | ...)
 *   node install.mjs --uninstall
 *
 * `--copy` is what a packaged zip uses: the plugin keeps working even if the
 * extracted folder moves or is deleted. `--link` (default) is for development:
 * edits in this directory are picked up by DSH's HMR.
 *
 * The profile patch layer is watched by the Cordis loader, so enabling the
 * plugin there applies without restarting the app; a page refresh is enough.
 */
import { cpSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PACKAGE = 'dsh-gpt-image-playground'
const here = import.meta.dirname
const argv = process.argv.slice(2)
const has = (flag) => argv.includes(`--${flag}`)
const arg = (name, fallback) => {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback
}

const uninstall = has('uninstall')
const copyMode = has('copy')
const profileName = arg('profile', 'desktop')
const dshHome = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? '', '.dsh')
const profileDir = join(dshHome, 'profiles', profileName)
const nodeModules = join(profileDir, 'node_modules')
const targetPath = join(nodeModules, PACKAGE)
const packageFile = join(profileDir, 'package.json')
const patchFile = join(profileDir, 'cordis.patch.yml')
const SHIPPED = ['lib', 'vendor-app', 'cordis.patch.yml', 'README.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md', 'install.mjs', 'package.json']

function backup(file) {
  if (existsSync(file)) copyFileSync(file, `${file}.bak-${Date.now()}`)
}

if (!existsSync(profileDir)) {
  console.error(`找不到 DSH profile：${profileDir}\n先启动一次 DSH 桌面端，或用 --profile 指定其它 profile。`)
  process.exit(1)
}

const existing = lstatSync(targetPath, { throwIfNoEntry: false })
if (existing) {
  if (existing.isSymbolicLink()) unlinkSync(targetPath)
  else rmSync(targetPath, { recursive: true, force: true })
}

if (!uninstall) {
  mkdirSync(nodeModules, { recursive: true })
  if (copyMode) {
    mkdirSync(targetPath, { recursive: true })
    for (const entry of SHIPPED) {
      const source = join(here, entry)
      if (!existsSync(source)) continue
      cpSync(source, join(targetPath, entry), { recursive: true })
    }
  } else {
    symlinkSync(here, targetPath, 'junction')
  }
}

// package.json: dependency + bundle selection
const pkg = JSON.parse(readFileSync(packageFile, 'utf8'))
backup(packageFile)
pkg.dependencies = pkg.dependencies ?? {}
pkg.dsh = pkg.dsh ?? {}
pkg.dsh.profile = pkg.dsh.profile ?? {}
pkg.dsh.profile.bundles = pkg.dsh.profile.bundles ?? []
if (uninstall) {
  delete pkg.dependencies[PACKAGE]
  pkg.dsh.profile.bundles = pkg.dsh.profile.bundles.filter((name) => name !== PACKAGE)
} else {
  pkg.dependencies[PACKAGE] = copyMode ? 'file:' : `link:${here.replaceAll('\\', '/')}`
  if (!pkg.dsh.profile.bundles.includes(PACKAGE)) pkg.dsh.profile.bundles.push(PACKAGE)
}
writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`)

// profile patch layer: the live-reloadable insertion
const patch = existsSync(patchFile) ? readFileSync(patchFile, 'utf8') : '[]\n'
const marker = 'id: gpt-image-playground'
backup(patchFile)
if (uninstall) {
  if (patch.includes(marker)) {
    writeFileSync(patchFile, patch.replace(/\n- insert:\n {4}- id: gpt-image-playground\n {6}name: dsh-gpt-image-playground\n {6}config: \{\}\n?/g, '\n'))
  }
} else if (!patch.includes(marker)) {
  const entry = `- insert:\n    - id: gpt-image-playground\n      name: ${PACKAGE}\n      config: {}\n`
  writeFileSync(patchFile, `${patch.trimEnd()}\n${entry}`)
}

if (uninstall) {
  console.log(`已卸载 ${PACKAGE}（profile: ${profileName}）`)
} else {
  console.log(`已安装 ${PACKAGE} → ${targetPath}（${copyMode ? '复制模式' : '链接模式'}）`)
  console.log('刷新 DSH 页面（Ctrl+R），左栏会出现「生图工作台」。')
}
