/**
 * `pnpm run pack` wrapper: finds a Python interpreter (DSH ships one) and runs
 * tools/pack.py, so the packaging step works on a machine without Python on
 * PATH.
 *
 *   node tools/pack.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const here = import.meta.dirname
const script = join(here, 'pack.py')

const candidates = [
  process.env.DSH_PYTHON,
  join(process.env.USERPROFILE ?? '', '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python', 'python.exe'),
  'python',
  'python3',
  'py',
].filter(Boolean)

let command
let output
for (const candidate of candidates) {
  if (candidate !== 'python' && candidate !== 'python3' && candidate !== 'py' && !existsSync(candidate)) continue
  try {
    output = execFileSync(candidate, [script], { cwd: join(here, '..'), encoding: 'utf8' })
    command = candidate
    break
  } catch (error) {
    if (candidate === candidates.at(-1)) throw error
  }
}

if (!command) {
  console.error('找不到 Python。请安装 Python 3，或用 DSH 自带的运行时：')
  console.error('  "%USERPROFILE%\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe" tools/pack.py')
  process.exit(1)
}

process.stdout.write(output)
console.error(`(packed with ${command})`)
