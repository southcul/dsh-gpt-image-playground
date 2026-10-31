/**
 * End-to-end check of the vendored app through the plugin's same-origin proxy:
 * boot the app, point profile 1 at the proxy, submit a prompt with Ctrl+Enter,
 * and wait for a rendered image.
 *
 *   node tools/e2e-app.mjs
 */
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { apply, APP_ROUTE, PROXY_ROUTE, SETTINGS_ROUTE } from '../lib/index.js'

const require = createRequire('C:/Users/Lenovo/.dsh/profiles/desktop/package.json')
const puppeteer = require('puppeteer-core')

const here = import.meta.dirname
const sample = (await readFile(join(here, '..', 'preview', 'samples', 'sample-1.jpg'))).toString('base64')

// --- mock image upstream ---
const upstream = createServer((req, res) => {
  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', () => {
    if (req.url.includes('/images/generations') || req.url.includes('/images/edits')) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data: [{ b64_json: sample, revised_prompt: 'mock revised prompt' }] }))
      return
    }
    if (req.url.endsWith('/models')) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data: [{ id: 'gpt-image-2.5-sunburst' }] }))
      return
    }
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: { message: `no mock route for ${req.url}` } }))
  })
})
await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
const upstreamBase = `http://127.0.0.1:${upstream.address().port}/v1`

// --- mount the plugin on a local origin ---
const routes = []
const ctx = {
  logger: { info() {}, warn: console.warn, error: console.error },
  effect(fn) {
    return fn()
  },
  webServer: { register: (entry) => (routes.push(entry), () => {}) },
}
apply(ctx, { dataDir: join(here, '..', 'preview', '.data') })

const server = createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://x').pathname
  let best
  for (const entry of routes) {
    if (entry.kind === 'exact' && entry.path === pathname) best = entry
    if (entry.kind === 'prefix' && (pathname === entry.path || pathname.startsWith(`${entry.path}/`))) {
      if (!best || entry.path.length > best.path.length) best = entry
    }
  }
  if (!best) return res.writeHead(404).end('no route')
  Promise.resolve(best.handler(req, res)).catch((error) => res.writeHead(500).end(String(error)))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`

await fetch(`${origin}${SETTINGS_ROUTE}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ proxyTarget: upstreamBase }),
})

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
const pageErrors = []
const failed = []
page.on('pageerror', (error) => pageErrors.push(error.message))
page.on('response', (response) => {
  if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`)
})

const appUrl = `${origin}${APP_ROUTE}/index.html`
await page.goto(appUrl, { waitUntil: 'networkidle2' })
await new Promise((resolve) => setTimeout(resolve, 1500))

// Point the default profile at the plugin proxy, then reload so the store hydrates from it.
const patched = await page.evaluate((proxyBase) => {
  const raw = localStorage.getItem('gpt-image-playground')
  if (!raw) return 'no state'
  const store = JSON.parse(raw)
  const state = store.state
  const profiles = state.settings?.profiles ?? state.profiles ?? []
  const target = profiles.find((item) => item.isDefault) ?? profiles[0]
  if (!target) return `no profile (keys: ${Object.keys(state).join(',')})`
  target.baseUrl = proxyBase
  target.apiKey = 'sk-e2e-test'
  target.model = 'gpt-image-2.5-sunburst'
  target.apiMode = 'images'
  target.provider = 'openai'
  target.timeout = 120
  if (state.settings) {
    state.settings.baseUrl = proxyBase
    state.settings.apiKey = 'sk-e2e-test'
    state.settings.model = 'gpt-image-2.5-sunburst'
    state.settings.apiMode = 'images'
    state.settings.timeout = 120
  }
  localStorage.setItem('gpt-image-playground', JSON.stringify(store))
  return `patched ${target.id}`
}, `${origin}${PROXY_ROUTE}`)
console.log('state:', patched)

await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch((error) => console.log('reload:', error.message))
await page.waitForSelector('[contenteditable="true"]', { timeout: 30_000 }).catch(() => {})
await new Promise((resolve) => setTimeout(resolve, 2000))

const ready = await page.evaluate(() => ({
  hasTextarea: Boolean(document.querySelector('[contenteditable="true"]')),
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
}))
console.log('after reload:', JSON.stringify(ready))
if (!ready.hasTextarea) {
  console.log('pageErrors:', pageErrors, 'failed:', failed.slice(0, 5))
  await page.screenshot({ path: join(here, '..', 'preview', 'shots', 'e2e-broken.png') })
  await browser.close()
  server.close()
  upstream.close()
  process.exit(1)
}

const configured = await page.evaluate(() => (document.body.innerText || '').includes('请先配置 API'))
console.log('still asking for API config:', configured)

await page.evaluate(() => {
  const el = document.querySelector('[contenteditable="true"]')
  if (el) el.focus()
})
await page.keyboard.type('山间清晨的层叠丘陵，暖色逆光')
await page.keyboard.down('Control')
await page.keyboard.press('Enter')
await page.keyboard.up('Control')
const deadline = Date.now() + 40_000
let images = 0
while (Date.now() < deadline) {
  images = await page.evaluate(() => document.querySelectorAll('img').length)
  const busy = await page.evaluate(() => /生成中|排队中|请求中/.test(document.body.innerText || ''))
  if (images > 0 && !busy) break
  await new Promise((resolve) => setTimeout(resolve, 500))
}

const stats = await page.evaluate(() => ({
  images: document.querySelectorAll('img').length,
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
}))
await page.screenshot({ path: join(here, '..', 'preview', 'shots', 'e2e.png') })
await browser.close()
server.close()
upstream.close()

console.log(JSON.stringify({ images, stats, pageErrors: pageErrors.slice(0, 6), failed: failed.slice(0, 10) }, null, 1))
process.exitCode = stats.images > 0 && pageErrors.length === 0 ? 0 : 1
