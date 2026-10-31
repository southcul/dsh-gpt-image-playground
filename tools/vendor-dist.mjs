/**
 * Vendor the upstream GPT Image Playground build (GitHub Pages) into
 * vendor-app/, resolving asset references relative to the file that mentions
 * them so code-split chunks, fonts and media all come along.
 *
 *   node tools/vendor-dist.mjs [--base URL] [--out DIR]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : fallback
}

const base = arg('base', 'https://cooksleep.github.io/gpt_image_playground/').replace(/\/?$/, '/')
const out = join(import.meta.dirname, '..', arg('out', 'vendor-app'))
const baseUrl = new URL(base)

const seen = new Set()
const queue = ['index.html', 'color-mode.js', 'manifest.webmanifest', 'pwa-icon.svg', 'sw.js']
const textExt = /\.(html|js|mjs|css|json|webmanifest|svg)$/i
const refPattern = /["'(=\s](?:\.\/|\/)?((?:assets\/)?[\w@~.-]+(?:\/[\w@~.-]+)*\.(?:js|mjs|css|png|jpe?g|webp|gif|svg|woff2?|ttf|otf|json|wasm|mp4|webm))["')?#\s]/gi

let total = 0
const failures = []

async function fetchWithRetry(url, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`)
        if (response.status < 500) throw lastError
      } else {
        return Buffer.from(await response.arrayBuffer())
      }
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
  }
  throw lastError ?? new Error('unknown failure')
}

while (queue.length > 0) {
  const path = queue.shift()
  if (seen.has(path)) continue
  seen.add(path)
  const url = new URL(path, baseUrl).href
  let buffer
  try {
    buffer = await fetchWithRetry(url)
  } catch (error) {
    failures.push(`${path}: ${error.message}`)
    continue
  }
  try {
    const target = join(out, decodeURIComponent(path))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, buffer)
  } catch (error) {
    failures.push(`${path}: write ${error.message}`)
    continue
  }
  total += buffer.length
  if (!textExt.test(path)) continue
  const text = buffer.toString('utf8')
  refPattern.lastIndex = 0
  let match
  while ((match = refPattern.exec(text)) !== null) {
    const ref = match[1]
    if (!ref || ref.startsWith('http') || ref.startsWith('data:')) continue
    let resolved
    try {
      resolved = new URL(ref, new URL(path, baseUrl))
    } catch {
      continue
    }
    if (resolved.origin !== baseUrl.origin) continue
    if (!resolved.pathname.startsWith(baseUrl.pathname)) continue
    const next = decodeURIComponent(resolved.pathname.slice(baseUrl.pathname.length))
    if (next.length > 0 && !seen.has(next)) queue.push(next)
  }
  if (seen.size % 25 === 0) console.log(`… ${seen.size} files, ${(total / 1024 / 1024).toFixed(1)} MB`)
}

console.log(`vendored ${seen.size} files, ${(total / 1024 / 1024).toFixed(2)} MB -> ${out}`)
if (failures.length > 0) {
  console.log(`skipped ${failures.length}:`)
  for (const line of failures.slice(0, 15)) console.log('  ' + line)
}
