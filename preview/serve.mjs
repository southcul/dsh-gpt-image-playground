/**
 * Preview host: mounts the browser half against the real server half and a
 * mock upstream, so the workbench can be rendered and screenshotted outside
 * DSH.
 *
 *   node preview/serve.mjs --port 4517
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { readdirSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { apply, ROUTE_PREFIX } from '../lib/index.js'

const here = import.meta.dirname
const root = join(here, '..')

const samples = readdirSync(join(here, 'samples')).filter((name) => name.endsWith('.jpg'))
const payloads = await Promise.all(samples.map(async (name) => (await readFile(join(here, 'samples', name))).toString('base64')))

const upstream = createServer((req, res) => {
  if (req.url.includes('/images/')) {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      let count = 1
      if (req.url.includes('/generations') && body.trim().startsWith('{')) {
        try {
          count = Math.max(1, Math.min(4, JSON.parse(body).n || 1))
        } catch {
          count = 1
        }
      }
      const data = Array.from({ length: count }, (_, index) => ({
        b64_json: payloads[index % payloads.length],
        revised_prompt: 'a painterly sunrise over layered hills, warm rim light',
      }))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data }))
    })
    return
  }
  if (req.url.endsWith('/models')) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ data: [{ id: 'gpt-image-2.5-sunburst' }] }))
    return
  }
  res.writeHead(404).end()
})
await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
const upstreamBase = `http://127.0.0.1:${upstream.address().port}/v1`

// --- the plugin's own route table ---
const routes = []
const ctx = {
  logger: { info() {}, warn: console.warn, error: console.error },
  effect(fn) {
    return fn()
  },
  webServer: {
    register(entry) {
      routes.push(entry)
      return () => {}
    },
  },
}
apply(ctx, { dataDir: join(here, '.data') })

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

function serveFile(res, file) {
  return readFile(file).then(
    (buffer) => {
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
      res.end(buffer)
    },
    () => res.writeHead(404).end('not found'),
  )
}

const portArgIndex = process.argv.indexOf('--port')
const port = portArgIndex > 0 ? Number(process.argv[portArgIndex + 1]) : 4517

const server = createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://x').pathname
  let best
  for (const entry of routes) {
    if (entry.kind === 'exact' && entry.path === pathname) best = entry
    if (entry.kind === 'prefix' && (pathname === entry.path || pathname.startsWith(`${entry.path}/`))) {
      if (!best || entry.path.length > best.path.length) best = entry
    }
  }
  if (best) {
    Promise.resolve(best.handler(req, res)).catch((error) => {
      res.writeHead(500).end(String(error))
    })
    return
  }
  if (pathname === '/' || pathname === '/index.html') return serveFile(res, join(here, 'index.html'))
  if (pathname === '/client.js') return serveFile(res, join(root, 'lib', 'client.js'))
  if (pathname === '/favicon.ico') return res.writeHead(204).end()
  if (pathname === '/slow') {
    const ms = Math.max(0, Math.min(30_000, Number(new URL(req.url ?? '/', 'http://x').searchParams.get('ms')) || 1_000))
    const started = Date.now()
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    setTimeout(() => res.end(JSON.stringify({ ok: true, waited: Date.now() - started })), ms)
    return
  }
  if (pathname.startsWith('/vendor/')) {
    const name = normalize(pathname.slice('/vendor/'.length))
    if (!name.includes('..')) return serveFile(res, join(here, 'vendor', name))
  }
  res.writeHead(404).end('not found')
})

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))

// Point the seeded profile at the mock upstream so "生成" works offline.
await fetch(`http://127.0.0.1:${port}${ROUTE_PREFIX}/profiles`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    id: 'default-openai',
    name: '本地预览（mock）',
    baseUrl: upstreamBase,
    model: 'gpt-image-2.5-sunburst',
    models: ['gpt-image-2.5-sunburst', 'gpt-image-2'],
    quality: 'high',
    apiKey: 'sk-preview-0000',
  }),
})

console.log(`preview: http://127.0.0.1:${port}/  (${samples.length} sample images)`)
