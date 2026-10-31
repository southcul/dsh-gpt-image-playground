/**
 * Ensure the Windows PowerShell helpers carry a UTF-8 BOM: Windows PowerShell
 * 5.1 decodes files without one as ANSI and fails on the Chinese messages.
 *
 *   node tools/fix-bom.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const BOM = '\uFEFF'
for (const name of ['install.ps1', 'publish.ps1']) {
  const file = join(root, name)
  const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  writeFileSync(file, BOM + text, 'utf8')
  const bytes = readFileSync(file)
  console.log(`${name}: BOM=${bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf}, ${bytes.length} bytes`)
}
