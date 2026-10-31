/**
 * Point the manifest at your GitHub repository in one step:
 *
 *   node tools/set-repo.mjs <github-owner> [repo-name] [--author "Your Name"]
 *
 * Rewrites repository / homepage / bugs and (optionally) author, then runs the
 * publish checks so you immediately see what is still missing.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

// Parse positionals while dropping `--author <value>` (its value is not a positional).
const argv = process.argv.slice(2)
let author
const positionals = []
for (let index = 0; index < argv.length; index += 1) {
  const item = argv[index]
  if (item === '--author') {
    author = argv[index + 1]
    index += 1
    continue
  }
  if (item.startsWith('--author=')) {
    author = item.slice('--author='.length)
    continue
  }
  if (item.startsWith('--')) continue
  positionals.push(item)
}

const owner = positionals[0]
const repo = positionals[1] ?? 'dsh-gpt-image-playground'

if (!owner || !/^[A-Za-z0-9-]+$/.test(owner)) {
  console.error('用法：node tools/set-repo.mjs <github-owner> [repo-name] [--author "Your Name"]')
  process.exit(1)
}

const file = join(root, 'package.json')
const manifest = JSON.parse(readFileSync(file, 'utf8'))
manifest.repository = { type: 'git', url: `git+https://github.com/${owner}/${repo}.git` }
manifest.homepage = `https://github.com/${owner}/${repo}#readme`
manifest.bugs = { url: `https://github.com/${owner}/${repo}/issues` }
if (author) manifest.author = author
writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`repository -> https://github.com/${owner}/${repo}`)
if (author) console.log(`author     -> ${author}`)

try {
  process.stdout.write(execFileSync(process.execPath, [join(import.meta.dirname, 'check-package.mjs'), '--strict'], { encoding: 'utf8' }))
} catch (error) {
  process.stdout.write(String(error.stdout ?? ''))
  process.exitCode = 1
}
