/**
 * dsh-gpt-image-playground — server half.
 *
 * A Cordis plugin for DeepSeek Harness that owns:
 *   - API profile storage (base URL / model / key) kept on the host, so keys
 *     never travel to the browser after being saved;
 *   - an HTTP surface under /gpt-image-playground/api that the client bundle
 *     calls (CORS-free upstream calls, image bytes, history);
 *   - content-addressed image storage so repeated results cost one file.
 */

import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'gpt-image-playground'

const MANIFEST = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

/** Version the panel shows in its settings header. */
const PLUGIN_VERSION = typeof MANIFEST.version === 'string' ? MANIFEST.version : '0.0.0'

/** Services this plugin needs from the host. */
export const inject = ['webServer']

// Shipped plugins namespace their host routes under /plugins/<package>/ so the
// desktop shell's bridged fetch reaches them the same way it reaches /api.
export const ROUTE_PREFIX = '/plugins/dsh-gpt-image-playground/api'
export const APP_ROUTE = '/plugins/dsh-gpt-image-playground/app'
export const PROXY_ROUTE = '/plugins/dsh-gpt-image-playground/proxy'
export const SETTINGS_ROUTE = '/plugins/dsh-gpt-image-playground/settings'

/** The vendored upstream build that the panel renders in an iframe. */
const APP_DIR = fileURLToPath(new URL('../vendor-app/', import.meta.url))

const DEFAULT_TIMEOUT_MS = 600_000
const MAX_BODY_BYTES = 96 * 1024 * 1024

const MIME_BY_EXTENSION = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
}

function mimeOf(file) {
  return MIME_BY_EXTENSION[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

/** Read a request body as bytes (proxying must not re-encode multipart uploads). */
async function readRawBody(req, limit = MAX_BODY_BYTES) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > limit) throw new Error('request body too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}


/** Common size presets accepted by the upstream APIs. */
const SIZE_PRESETS = new Set(['auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2048x1152', '1152x2048', '3840x2160', '2160x3840', '1792x1024', '1024x1792'])

function dshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv
  return join(homedir(), '.dsh')
}

function dataDirOf(config) {
  const configured = typeof config?.dataDir === 'string' && config.dataDir.length > 0 ? config.dataDir : undefined
  return configured ?? join(dshHome(), 'gpt-image-playground')
}

function nowIso() {
  return new Date().toISOString()
}

async function readJson(file, fallback) {
  try {
    const raw = await readFile(file, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.name === 'SyntaxError')) return fallback
    throw error
  }
}

async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  const { rename } = await import('node:fs/promises')
  await rename(tmp, file)
}

/** Normalize a base URL the way the OpenAI clients do: keep a trailing slash, otherwise append /v1. */
function normalizeBaseUrl(raw) {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (value.length === 0) throw new Error('baseUrl is required')
  if (value.endsWith('/')) return value
  const trimmed = value.replace(/\/+$/, '')
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/`
  return `${trimmed}/v1/`
}

function endpoint(baseUrl, path) {
  const base = normalizeBaseUrl(baseUrl)
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/** Mask a stored key so the UI can show that something is configured. */
function maskKey(key) {
  if (typeof key !== 'string' || key.length === 0) return ''
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 3)}••••${key.slice(-4)}`
}

function publicProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    provider: profile.provider ?? 'openai',
    baseUrl: profile.baseUrl,
    model: profile.model,
    models: Array.isArray(profile.models) ? profile.models : [],
    apiMode: profile.apiMode ?? 'images',
    quality: profile.quality ?? 'high',
    timeout: profile.timeout ?? DEFAULT_TIMEOUT_MS / 1000,
    hasKey: typeof profile.apiKey === 'string' && profile.apiKey.length > 0,
    keyHint: maskKey(profile.apiKey ?? ''),
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

async function readBody(req, limit = MAX_BODY_BYTES) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > limit) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (total === 0) return undefined
  const text = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('request body must be JSON')
  }
}

function sniffImageMime(buffer) {
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png'
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  if (buffer.length > 6 && buffer.toString('ascii', 0, 3) === 'GIF') return 'image/gif'
  return 'application/octet-stream'
}

function extensionFor(mime) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'bin'
}

function dataUrlToBuffer(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(typeof dataUrl === 'string' ? dataUrl : '')
  if (!match) throw new Error('reference image must be a data URL')
  const mime = match[1] ?? 'image/png'
  const body = match[3] ?? ''
  const buffer = match[2] === ';base64' ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'utf8')
  return { mime, buffer }
}

/** Coerce user-entered dimensions into values the image APIs accept (multiples of 16). */
function normalizeSize(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return 'auto'
  const value = raw.trim().toLowerCase()
  if (SIZE_PRESETS.has(value)) return value
  const match = /^(\d{2,5})\s*[x×*]\s*(\d{2,5})$/.exec(value)
  if (!match) return 'auto'
  const round = (n) => Math.max(256, Math.min(4096, Math.round(n / 16) * 16))
  return `${round(Number(match[1]))}x${round(Number(match[2]))}`
}

function upstreamError(payload, status) {
  const detail = payload?.error
  const message =
    (typeof detail === 'string' && detail) ||
    (detail && typeof detail.message === 'string' && detail.message) ||
    (typeof payload?.message === 'string' && payload.message) ||
    (typeof payload?.error_msg === 'string' && payload.error_msg) ||
    `upstream responded ${status}`
  return new Error(message)
}

/** Serve-side view of a stored task: image URLs are derived, never persisted. */
function presentTask(task) {
  if (!task || typeof task !== 'object') return task
  const images = Array.isArray(task.images)
    ? task.images.map((image) => ({ ...image, url: image?.hash ? `${ROUTE_PREFIX}/image/${image.hash}.${image.ext ?? 'png'}` : image?.url }))
    : []
  return { ...task, images }
}

class Store {
  constructor(dir) {
    this.dir = dir
    this.profilesFile = join(dir, 'profiles.json')
    this.tasksFile = join(dir, 'tasks.json')
    this.imageDir = join(dir, 'images')
  }

  async init() {
    await mkdir(this.imageDir, { recursive: true })
    const profiles = await readJson(this.profilesFile, [])
    if (!Array.isArray(profiles) || profiles.length === 0) {
      const seeded = [this.seedProfile()]
      await writeJson(this.profilesFile, seeded)
    }
  }

  seedProfile() {
    return {
      id: 'default-openai',
      name: 'OpenAI 兼容',
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-image-2.5-sunburst',
      models: ['gpt-image-2.5-sunburst', 'gpt-image-2'],
      apiMode: 'images',
      quality: 'high',
      timeout: DEFAULT_TIMEOUT_MS / 1000,
      apiKey: '',
      createdAt: nowIso(),
    }
  }

  async listProfiles() {
    const profiles = await readJson(this.profilesFile, [])
    return Array.isArray(profiles) ? profiles : []
  }

  async saveProfile(input) {
    const profiles = await this.listProfiles()
    const id = typeof input?.id === 'string' && input.id.length > 0 ? input.id : randomUUID()
    const index = profiles.findIndex((item) => item.id === id)
    const previous = index >= 0 ? profiles[index] : undefined
    const next = {
      ...(previous ?? { createdAt: nowIso() }),
      id,
      name: typeof input?.name === 'string' && input.name.trim().length > 0 ? input.name.trim() : '未命名配置',
      provider: 'openai',
      baseUrl: normalizeBaseUrl(input?.baseUrl ?? previous?.baseUrl),
      model: typeof input?.model === 'string' ? input.model.trim() : previous?.model ?? '',
      models: Array.isArray(input?.models) ? input.models.filter((item) => typeof item === 'string' && item.length > 0) : previous?.models ?? [],
      apiMode: input?.apiMode === 'responses' ? 'responses' : 'images',
      quality: typeof input?.quality === 'string' && input.quality.length > 0 ? input.quality : previous?.quality ?? 'high',
      timeout: Number(input?.timeout) > 0 ? Number(input.timeout) : previous?.timeout ?? DEFAULT_TIMEOUT_MS / 1000,
      updatedAt: nowIso(),
    }
    // An omitted or empty apiKey keeps the stored one; an explicit null clears it.
    if (typeof input?.apiKey === 'string' && input.apiKey.length > 0) next.apiKey = input.apiKey
    else if (input?.apiKey === null) next.apiKey = ''
    else next.apiKey = previous?.apiKey ?? ''
    if (index >= 0) profiles[index] = next
    else profiles.push(next)
    await writeJson(this.profilesFile, profiles)
    return publicProfile(next)
  }

  async deleteProfile(id) {
    const profiles = await this.listProfiles()
    const next = profiles.filter((item) => item.id !== id)
    if (next.length === profiles.length) return false
    await writeJson(this.profilesFile, next)
    return true
  }

  async findProfile(id) {
    const profiles = await this.listProfiles()
    if (typeof id === 'string' && id.length > 0) {
      const hit = profiles.find((item) => item.id === id)
      if (hit) return hit
    }
    return profiles[0]
  }

  async listTasks(limit = 200) {
    const tasks = await readJson(this.tasksFile, [])
    if (!Array.isArray(tasks)) return []
    return tasks.slice(0, Math.max(1, Math.min(1000, limit)))
  }

  /** Upsert by id: a task is written once when it starts and again when it settles. */
  async addTask(task) {
    const tasks = await readJson(this.tasksFile, [])
    const list = Array.isArray(tasks) ? tasks : []
    const index = list.findIndex((item) => item?.id === task.id)
    if (index >= 0) list[index] = task
    else list.unshift(task)
    await writeJson(this.tasksFile, list.slice(0, 1000))
    return task
  }

  async deleteTask(id) {
    const tasks = await readJson(this.tasksFile, [])
    const list = Array.isArray(tasks) ? tasks : []
    const next = list.filter((item) => item.id !== id)
    if (next.length === list.length) return false
    await writeJson(this.tasksFile, next)
    return true
  }

  async putImage(buffer) {
    const mime = sniffImageMime(buffer)
    const hash = createHash('sha256').update(buffer).digest('hex')
    const ext = extensionFor(mime)
    const file = join(this.imageDir, `${hash}.${ext}`)
    try {
      await readFile(file)
    } catch {
      await writeFile(file, buffer)
    }
    return { hash, ext, mime, bytes: buffer.length }
  }

  async readImage(name) {
    if (!/^[a-f0-9]{64}\.[a-z0-9]{2,4}$/.test(name)) return undefined
    try {
      const buffer = await readFile(join(this.imageDir, name))
      return { buffer, mime: sniffImageMime(buffer) }
    } catch {
      return undefined
    }
  }

  async pruneOrphanImages() {
    const tasks = await readJson(this.tasksFile, [])
    const keep = new Set()
    for (const task of Array.isArray(tasks) ? tasks : []) {
      for (const image of task?.images ?? []) if (image?.hash) keep.add(`${image.hash}.${image.ext ?? 'png'}`)
    }
    let removed = 0
    let names = []
    try {
      names = await readdir(this.imageDir)
    } catch {
      return 0
    }
    for (const entry of names) {
      if (keep.has(entry)) continue
      await rm(join(this.imageDir, entry), { force: true }).catch(() => {})
      removed += 1
    }
    return removed
  }
}

/** One generation/edit round trip against an OpenAI-compatible endpoint. */
async function callUpstream({ profile, prompt, size, quality, n, background, model, references, format }) {
  const timeoutMs = (Number(profile.timeout) > 0 ? Number(profile.timeout) : DEFAULT_TIMEOUT_MS / 1000) * 1000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const headers = { authorization: `Bearer ${profile.apiKey}` }
  const chosenModel = typeof model === 'string' && model.length > 0 ? model : profile.model
  const count = Math.max(1, Math.min(10, Number(n) || 1))
  try {
    let response
    if (references.length > 0) {
      const form = new FormData()
      form.set('model', chosenModel)
      form.set('prompt', prompt)
      form.set('n', String(count))
      if (size && size !== 'auto') form.set('size', size)
      if (quality) form.set('quality', quality)
      if (background) form.set('background', background)
      if (format) form.set('output_format', format)
      references.slice(0, 16).forEach((reference, index) => {
        const { mime, buffer } = dataUrlToBuffer(reference)
        form.append('image[]', new Blob([buffer], { type: mime }), `reference-${index + 1}.${extensionFor(mime)}`)
      })
      response = await fetch(endpoint(profile.baseUrl, 'images/edits'), { method: 'POST', headers, body: form, signal: controller.signal })
    } else {
      const body = { model: chosenModel, prompt, n: count }
      if (size && size !== 'auto') body.size = size
      if (quality) body.quality = quality
      if (background) body.background = background
      if (format) body.output_format = format
      response = await fetch(endpoint(profile.baseUrl, 'images/generations'), {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    }
    const text = await response.text()
    let payload
    try {
      payload = text.length > 0 ? JSON.parse(text) : {}
    } catch {
      throw new Error(`upstream returned non-JSON (${response.status}): ${text.slice(0, 300)}`)
    }
    if (!response.ok) throw upstreamError(payload, response.status)
    const items = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.images) ? payload.images : []
    if (items.length === 0) throw new Error('upstream returned no images')
    const results = []
    for (const item of items) {
      if (typeof item?.b64_json === 'string' && item.b64_json.length > 0) {
        results.push({ buffer: Buffer.from(item.b64_json, 'base64'), revisedPrompt: item.revised_prompt })
        continue
      }
      const url = typeof item?.url === 'string' ? item.url : typeof item === 'string' ? item : undefined
      if (!url) continue
      const downloaded = await fetch(url, { signal: controller.signal })
      if (!downloaded.ok) throw new Error(`failed to download result image (${downloaded.status})`)
      results.push({ buffer: Buffer.from(await downloaded.arrayBuffer()), revisedPrompt: item?.revised_prompt })
    }
    if (results.length === 0) throw new Error('upstream returned no usable image payload')
    return { results, raw: payload, model: chosenModel }
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`上游请求超时（${Math.round(timeoutMs / 1000)} 秒）`)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Mount the playground: profile CRUD, image generation, and history.
 * @param ctx - host context carrying the web server.
 * @param config - `{ dataDir?: string }`.
 */
export function apply(ctx, config = {}) {
  const store = new Store(dataDirOf(config))
  const ready = store.init().catch((error) => {
    ctx.logger?.warn?.(`gpt-image-playground: cannot prepare data directory: ${error?.message ?? error}`)
  })

  const routes = []
  const route = (kind, path, handler) => routes.push({ kind, path, handler })

  // --- vendored upstream build + same-origin proxy -------------------------
  const settingsFile = join(store.dir, 'settings.json')
  let settings = {
    proxyTarget: typeof config?.proxyTarget === 'string' ? config.proxyTarget : '',
  }
  const settingsReady = readJson(settingsFile, {}).then(
    (stored) => {
      if (stored && typeof stored === 'object') settings = { ...settings, ...stored }
    },
    () => {},
  )
  const saveSettings = async (patch) => {
    settings = { ...settings, ...patch }
    await writeJson(settingsFile, settings)
    return settings
  }

  route('prefix', APP_ROUTE, async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method not allowed' })
    const pathname = new URL(req.url ?? '/', 'http://x').pathname
    let rel = decodeURIComponent(pathname.slice(APP_ROUTE.length))
    if (rel.length === 0 || rel === '/') rel = '/index.html'
    else if (rel.endsWith('/')) rel = `${rel}index.html`
    const safe = rel.replace(/^[/\\]+/, '')
    if (safe.length === 0 || safe.includes('..')) return json(res, 404, { error: 'not found' })
    let file = join(APP_DIR, safe)
    let buffer
    try {
      buffer = await readFile(file)
    } catch {
      // Single-page app: unknown extension-less paths render the shell.
      if (extname(safe).length === 0) {
        file = join(APP_DIR, 'index.html')
        buffer = await readFile(file).catch(() => undefined)
      }
    }
    if (buffer === undefined) return json(res, 404, { error: 'not found' })
    const immutable = /-[A-Za-z0-9_-]{8}\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg)$/.test(safe)
    res.writeHead(200, {
      'content-type': mimeOf(file),
      'content-length': buffer.length,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-store',
    })
    res.end(req.method === 'HEAD' ? undefined : buffer)
  })

  route('prefix', PROXY_ROUTE, async (req, res) => {
    await settingsReady
    const fail = (status, message, extra = {}) => {
      const text = `gpt-image-playground proxy: ${message}`
      if (status >= 500) ctx.logger?.warn?.(text)
      else ctx.logger?.info?.(text)
      // OpenAI-shaped so the vendored app renders the reason instead of a
      // bare "Failed to fetch".
      return json(res, status, { error: { message, type: 'proxy_error', ...extra } })
    }
    if (!settings.proxyTarget) {
      return fail(400, '还没有设置代理目标：点工作台左下角的 ⚙ 填入真实 API 地址（例如 https://api.openai.com/v1）', {
        hint: 'dsh-gpt-image-playground/settings',
      })
    }
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    const suffix = pathname.slice(PROXY_ROUTE.length).replace(/^\/+/, '')
    let upstream
    try {
      upstream = new URL(`${settings.proxyTarget.replace(/\/+$/, '')}/${suffix}`)
      upstream.search = new URL(req.url ?? '/', 'http://x').search
    } catch {
      return fail(500, `代理目标不是合法地址：${settings.proxyTarget}`)
    }
    const headers = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (['host', 'connection', 'content-length', 'accept-encoding', 'origin', 'referer'].includes(key)) continue
      if (typeof value === 'string') headers[key] = value
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 900_000)
    // A browser that leaves (panel closed, page reloaded) should not leave the
    // upstream request running.
    res.on('close', () => {
      if (!res.writableEnded) controller.abort()
    })
    try {
      const hasBody = !['GET', 'HEAD'].includes((req.method ?? 'GET').toUpperCase())
      const body = hasBody ? await readRawBody(req) : undefined
      const response = await fetch(upstream, {
        method: req.method,
        headers,
        body,
        signal: controller.signal,
        redirect: 'follow',
      })
      const buffer = Buffer.from(await response.arrayBuffer())
      const responseHeaders = {}
      for (const [key, value] of response.headers) {
        if (['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key)) continue
        responseHeaders[key] = value
      }
      responseHeaders['content-length'] = String(buffer.length)
      res.writeHead(response.status, responseHeaders)
      res.end(buffer)
    } catch (error) {
      const message = error?.name === 'AbortError' ? '代理请求被取消或超时' : error instanceof Error ? error.message : String(error)
      if (res.writableEnded) return
      return fail(502, `代理失败：${message}`, { upstream: String(upstream) })
    } finally {
      clearTimeout(timer)
    }
  })

  route('prefix', SETTINGS_ROUTE, async (req, res) => {
    await settingsReady
    const method = (req.method ?? 'GET').toUpperCase()
    if (method === 'GET') {
      return json(res, 200, {
        proxyTarget: settings.proxyTarget,
        appRoute: APP_ROUTE,
        proxyRoute: PROXY_ROUTE,
        pluginVersion: PLUGIN_VERSION,
      })
    }
    if (method === 'POST') {
      const body = (await readBody(req)) ?? {}
      const target = typeof body.proxyTarget === 'string' ? body.proxyTarget.trim() : settings.proxyTarget
      if (target.length > 0) {
        try {
          const parsed = new URL(target)
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('protocol')
        } catch {
          return json(res, 400, { error: '代理目标必须是 http(s) 地址' })
        }
      }
      const saved = await saveSettings({ proxyTarget: target })
      return json(res, 200, { proxyTarget: saved.proxyTarget })
    }
    return json(res, 405, { error: 'method not allowed' })
  })

  // Prefix matching compares `pathname.startsWith(prefix + "/")`, so the
  // registered prefix must not carry a trailing slash.
  route('prefix', ROUTE_PREFIX, async (req, res) => {
    await ready
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname.slice(ROUTE_PREFIX.length) || '/'
    const method = (req.method ?? 'GET').toUpperCase()
    try {
      if (path === '/profiles' && method === 'GET') {
        const profiles = await store.listProfiles()
        return json(res, 200, { profiles: profiles.map(publicProfile) })
      }
      if (path === '/profiles' && method === 'POST') {
        const body = await readBody(req)
        const saved = await store.saveProfile(body ?? {})
        return json(res, 200, { profile: saved })
      }
      if (path.startsWith('/profiles/') && method === 'DELETE') {
        const id = decodeURIComponent(path.slice('/profiles/'.length))
        const removed = await store.deleteProfile(id)
        return json(res, removed ? 200 : 404, { ok: removed })
      }
      if (path === '/generate' && method === 'POST') {
        const body = (await readBody(req)) ?? {}
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
        if (prompt.length === 0) return json(res, 400, { error: '提示词不能为空' })
        const profile = await store.findProfile(body.profileId)
        if (!profile) return json(res, 400, { error: '没有可用的 API 配置' })
        if (!profile.apiKey) return json(res, 400, { error: '该配置还没有填写 API Key' })
        const references = Array.isArray(body.references) ? body.references.filter((item) => typeof item === 'string') : []
        const size = normalizeSize(body.size)
        const quality = typeof body.quality === 'string' && body.quality.length > 0 ? body.quality : profile.quality
        const format = body.format === 'jpeg' ? 'jpeg' : body.format === 'webp' ? 'webp' : 'png'
        const task = {
          id: randomUUID(),
          createdAt: nowIso(),
          profileId: profile.id,
          profileName: profile.name,
          model: typeof body.model === 'string' && body.model.length > 0 ? body.model : profile.model,
          prompt,
          revisedPrompt: undefined,
          params: { size, quality, n: Number(body.n) || 1, background: body.background ?? 'opaque', format, references: references.length },
          status: 'running',
          images: [],
          durationMs: 0,
        }
        const startedAt = Date.now()
        await store.addTask(task)
        try {
          const { results, revisedPrompt, model } = await callUpstream({
            profile,
            prompt,
            size,
            quality,
            n: body.n,
            background: body.background === 'transparent' ? 'transparent' : undefined,
            model: task.model,
            references,
            format,
          })
          const images = []
          for (const item of results) {
            const stored = await store.putImage(item.buffer)
            images.push(stored)
            if (item.revisedPrompt && !revisedPrompt) task.revisedPrompt = item.revisedPrompt
          }
          Object.assign(task, {
            status: 'succeeded',
            images,
            model,
            durationMs: Date.now() - startedAt,
          })
          await store.addTask(task)
          return json(res, 200, { task: presentTask(task) })
        } catch (error) {
          Object.assign(task, {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startedAt,
          })
          await store.addTask(task)
          return json(res, 502, { task: presentTask(task), error: task.error })
        }
      }
      if (path === '/history' && method === 'GET') {
        const limit = Number(url.searchParams.get('limit')) || 100
        const tasks = await store.listTasks(limit)
        return json(res, 200, { tasks: tasks.map(presentTask) })
      }
      if (path.startsWith('/history/') && method === 'DELETE') {
        const id = decodeURIComponent(path.slice('/history/'.length))
        const removed = await store.deleteTask(id)
        return json(res, removed ? 200 : 404, { ok: removed })
      }
      if (path === '/history' && method === 'DELETE') {
        await writeJson(store.tasksFile, [])
        const pruned = await store.pruneOrphanImages()
        return json(res, 200, { ok: true, pruned })
      }
      if (path.startsWith('/image/') && (method === 'GET' || method === 'HEAD')) {
        const name = path.slice('/image/'.length)
        const hit = await store.readImage(name)
        if (!hit) return json(res, 404, { error: 'image not found' })
        res.writeHead(200, {
          'content-type': hit.mime,
          'content-length': hit.buffer.length,
          'cache-control': 'public, max-age=31536000, immutable',
        })
        res.end(method === 'HEAD' ? undefined : hit.buffer)
        return
      }
      if (path === '/test' && method === 'POST') {
        const body = (await readBody(req)) ?? {}
        const profile = await store.findProfile(body.profileId)
        if (!profile) return json(res, 404, { error: '配置不存在' })
        const startedAt = Date.now()
        try {
          const response = await fetch(endpoint(profile.baseUrl, 'models'), {
            headers: { authorization: `Bearer ${profile.apiKey}` },
            signal: AbortSignal.timeout(20_000),
          })
          return json(res, 200, {
            ok: response.ok,
            status: response.status,
            latencyMs: Date.now() - startedAt,
            detail: response.ok ? '接口可达' : `接口返回 ${response.status}`,
          })
        } catch (error) {
          return json(res, 200, { ok: false, latencyMs: Date.now() - startedAt, detail: error instanceof Error ? error.message : String(error) })
        }
      }
      return json(res, 404, { error: `unknown endpoint: ${method} ${path}` })
    } catch (error) {
      return json(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  ctx.effect(() => {
    const disposers = routes.map((entry) => ctx.webServer.register(entry))
    return () => {
      for (const dispose of disposers) dispose()
    }
  })

  ctx.logger?.info?.(`gpt-image-playground: mounted ${ROUTE_PREFIX} (data: ${store.dir})`)
}
