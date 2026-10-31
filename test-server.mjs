/**
 * Standalone harness for the server half: mounts the plugin against a fake
 * Cordis context + route table, then exercises the HTTP surface end to end.
 *
 *   node test-server.mjs
 */
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, ROUTE_PREFIX, APP_ROUTE, PROXY_ROUTE, SETTINGS_ROUTE } from './lib/index.js'

const routes = []
const logs = []
const ctx = {
  logger: { info: (m) => logs.push(`info ${m}`), warn: (m) => logs.push(`warn ${m}`), error: (m) => logs.push(`error ${m}`) },
  effect(fn) {
    return fn()
  },
  webServer: {
    register(route) {
      routes.push(route)
      return () => {}
    },
  },
}

// A 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

const upstream = createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    if (req.url.includes('/images/generations') || req.url.includes('/images/edits')) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data: [{ b64_json: PNG.toString('base64'), revised_prompt: 'revised prompt' }] }))
      return
    }
    if (req.url.endsWith('/models')) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data: [] }))
      return
    }
    res.writeHead(404).end()
  })
})
await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
const upstreamPort = upstream.address().port

const dataDir = await mkdtemp(join(tmpdir(), 'gipg-test-'))
apply(ctx, { dataDir })

const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://x').pathname
  let best
  for (const route of routes) {
    if (route.kind === 'exact' && pathname === route.path) best = route
    if (route.kind === 'prefix' && (pathname === route.path || pathname.startsWith(`${route.path}/`))) {
      if (!best || route.path.length > best.path.length) best = route
    }
  }
  if (!best) return res.writeHead(404).end()
  Promise.resolve(best.handler(req, res)).catch((error) => res.writeHead(500).end(String(error)))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const base = `${origin}${ROUTE_PREFIX}`

const failures = []
function check(name, condition, extra = '') {
  if (condition) console.log(`  ok   ${name}`)
  else {
    console.log(`  FAIL ${name} ${extra}`)
    failures.push(name)
  }
}
const get = async (path, init) => {
  const response = await fetch(base + path, init)
  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: response.status, body }
}

console.log('profiles')
const initial = await get('/profiles')
check('GET /profiles -> 200', initial.status === 200)
check('seeded default profile', initial.body.profiles?.length === 1 && initial.body.profiles[0].id === 'default-openai')
check('key never returned', initial.body.profiles[0].apiKey === undefined)

console.log('generate without key')
const noKey = await get('/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'a cat' }) })
check('missing key rejected', noKey.status === 400 && /API Key/.test(noKey.body.error), JSON.stringify(noKey.body))

console.log('save profile pointing at the fake upstream')
const saved = await get('/profiles', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id: 'default-openai', name: '测试配置', baseUrl: `http://127.0.0.1:${upstreamPort}/`, model: 'gpt-image-2.5-sunburst', quality: 'high', apiKey: 'sk-test-123456789' }),
})
check('POST /profiles -> 200', saved.status === 200, JSON.stringify(saved.body))
const hint = saved.body.profile?.keyHint ?? ''
check('key masked in response', hint.startsWith('sk-') && hint.endsWith('6789') && !hint.includes('test'), hint)
check('hasKey true', saved.body.profile.hasKey === true)

console.log('generate')
const generated = await get('/generate', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ profileId: 'default-openai', prompt: 'a cat', size: '1024x1024', quality: 'high', n: 1 }),
})
check('POST /generate -> 200', generated.status === 200, JSON.stringify(generated.body).slice(0, 300))
check('task succeeded', generated.body.task?.status === 'succeeded', generated.body.task?.status)
check('one image stored', generated.body.task?.images?.length === 1)
check('revised prompt captured', generated.body.task?.revisedPrompt === 'revised prompt', generated.body.task?.revisedPrompt)
const image = generated.body.task?.images?.[0]
check('image url shaped', typeof image?.url === 'string' && image.url.startsWith(`${ROUTE_PREFIX}/image/`), image?.url)

console.log('image bytes')
if (image) {
  const response = await fetch(`${origin}${image.url}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  check('GET image -> 200 png', response.status === 200 && response.headers.get('content-type') === 'image/png')
  check('image bytes match', buffer.equals(PNG))
  const missing = await fetch(`${origin}${ROUTE_PREFIX}/image/${'0'.repeat(64)}.png`)
  check('unknown image -> 404', missing.status === 404)
  const traversal = await fetch(`${origin}${ROUTE_PREFIX}/image/..%2Fprofiles.json`)
  check('path traversal rejected', traversal.status === 404)
}

console.log('history')
const history = await get('/history')
check('history has the task', history.body.tasks?.length === 1)
check('history keeps images', history.body.tasks[0].images?.length === 1)
const removed = await get(`/history/${generated.body.task.id}`, { method: 'DELETE' })
check('DELETE /history/:id -> 200', removed.status === 200 && removed.body.ok === true)
const afterRemove = await get('/history')
check('history emptied', afterRemove.body.tasks?.length === 0)

console.log('test connection')
const tested = await get('/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profileId: 'default-openai' }) })
check('POST /test -> ok', tested.body.ok === true, JSON.stringify(tested.body))

console.log('failing upstream')
const broken = createServer((req, res) => {
  res.writeHead(500, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: { message: 'upstream exploded' } }))
})
await new Promise((resolve) => broken.listen(0, '127.0.0.1', resolve))
await get('/profiles', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id: 'default-openai', baseUrl: `http://127.0.0.1:${broken.address().port}/` }),
})
const failed = await get('/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'a cat' }) })
check('upstream error surfaces', failed.status === 502 && /upstream exploded/.test(failed.body.error), JSON.stringify(failed.body).slice(0, 200))
check('failure recorded in history', (await get('/history')).body.tasks[0]?.status === 'failed')

console.log('vendored app + proxy')
const echo = createServer((req, res) => {
  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', () => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(
      JSON.stringify({
        method: req.method,
        path: req.url,
        authorization: req.headers.authorization ?? null,
        contentType: req.headers['content-type'] ?? null,
        body: Buffer.concat(chunks).toString('utf8'),
      }),
    )
  })
})
await new Promise((resolve) => echo.listen(0, '127.0.0.1', resolve))
const echoBase = `http://127.0.0.1:${echo.address().port}/v1`

const appIndex = await fetch(`${origin}${APP_ROUTE}/index.html`).catch(() => null)
check('vendored app index served', appIndex?.status === 200 && (appIndex.headers.get('content-type') ?? '').includes('text/html'), appIndex?.status)
const appMissing = await fetch(`${origin}${APP_ROUTE}/assets/does-not-exist.js`)
check('missing app asset -> 404', appMissing.status === 404)

const settingsBefore = await fetch(`${origin}${SETTINGS_ROUTE}`).then((response) => response.json())
check('settings read -> empty proxy target', settingsBefore.proxyTarget === '')
const proxyUnset = await fetch(`${origin}${PROXY_ROUTE}/models`)
check('proxy without target -> 400', proxyUnset.status === 400)

const settingsSaved = await fetch(`${origin}${SETTINGS_ROUTE}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ proxyTarget: echoBase }),
}).then((response) => response.json())
check('settings write -> target stored', settingsSaved.proxyTarget === echoBase, settingsSaved.proxyTarget)
const badTarget = await fetch(`${origin}${SETTINGS_ROUTE}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ proxyTarget: 'ftp://example.com' }),
})
check('settings reject non-http target', badTarget.status === 400)

const forwarded = await fetch(`${origin}${PROXY_ROUTE}/images/generations?x=1`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer sk-proxy' },
  body: JSON.stringify({ prompt: 'hello', n: 2 }),
}).then((response) => response.json())
check('proxy forwards method + path', forwarded.method === 'POST' && forwarded.path === '/v1/images/generations?x=1', JSON.stringify(forwarded).slice(0, 120))
check('proxy forwards auth header', forwarded.authorization === 'Bearer sk-proxy')
check('proxy keeps content type', forwarded.contentType === 'application/json')
check('proxy forwards body verbatim', forwarded.body === JSON.stringify({ prompt: 'hello', n: 2 }), forwarded.body)
echo.close()

console.log('logs')
check('plugin logged its mount point', logs.some((line) => line.startsWith('info')), logs.join(' | '))

server.close()
upstream.close()
broken.close()
await rm(dataDir, { recursive: true, force: true })

if (failures.length > 0) {
  console.log(`\n${failures.length} failure(s): ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nall checks passed')
