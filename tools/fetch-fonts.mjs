/**
 * Optional: download the upstream builtin UI fonts that are not shipped by
 * default, because they add ~23 MB.
 *
 *   node tools/fetch-fonts.mjs
 *
 * Without them the app still renders — it falls back to the system UI font.
 * With them, the "内置字体" option in 外观配置 works offline.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const base = 'https://cooksleep.github.io/gpt_image_playground/assets/'
const target = join(import.meta.dirname, '..', 'vendor-app', 'assets')

const fonts = [
  'HarmonyOS_Sans_SC_Regular-DdsgBYS9.ttf',
  'HarmonyOS_Sans_SC_Medium-C0JYcCxp.ttf',
  'HarmonyOS_Sans_SC_Bold-DTtO5jJ5.ttf',
  'MapleMono-NF-CN-Regular-wcRV-Wku.woff2',
]

await mkdir(target, { recursive: true })
let total = 0
for (const name of fonts) {
  const response = await fetch(base + name, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok) {
    console.error(`skip ${name}: HTTP ${response.status}`)
    continue
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(join(target, name), buffer)
  total += buffer.length
  console.log(`${name}: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)
}
console.log(`done, ${(total / 1024 / 1024).toFixed(2)} MB added to vendor-app/assets`)
console.log('重新打包：node tools/pack.mjs')
