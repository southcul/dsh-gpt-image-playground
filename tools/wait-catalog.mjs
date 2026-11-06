/**
 * Wait for the market catalog to publish a new build, then report our entry's
 * versions.
 *
 *   node tools/wait-catalog.mjs [--minutes 10] [--baseline 2026.1104.14928]
 */
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index > 0 ? args[index + 1] : fallback
}
const minutes = Number(arg('minutes', '10'))
const baseline = arg('baseline', '2026.1104.14928')
const deadline = Date.now() + minutes * 60_000

const python = joinPython()
function joinPython() {
  const candidates = [
    process.env.DSH_PYTHON,
    `${process.env.USERPROFILE}\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe`,
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['-c', 'print(1)'], { stdio: 'ignore' })
      return candidate
    } catch {
      /* try next */
    }
  }
  return 'python'
}

function readEntry() {
  const script = `
import io, json, tarfile, urllib.request
meta = json.load(urllib.request.urlopen('https://registry.npmjs.org/dsh-plugin-catalog/latest', timeout=90))
raw = urllib.request.urlopen(meta['dist']['tarball'], timeout=240).read()
tar = tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz')
name = [n for n in tar.getnames() if n.endswith('index.json')][0]
doc = json.loads(tar.extractfile(name).read())
hit = [p for p in doc['plugins'] if p.get('name') == 'dsh-gpt-image-playground']
print(json.dumps({'catalog': meta['version'], 'versions': [v['version'] for v in hit[0]['versions']] if hit else []}))
`
  const output = execFileSync(python, ['-c', script], { encoding: 'utf8', timeout: 300_000 })
  return JSON.parse(output.trim().split('\n').pop())
}

while (Date.now() < deadline) {
  let meta
  try {
    const response = await fetch('https://registry.npmjs.org/dsh-plugin-catalog', { signal: AbortSignal.timeout(30_000) })
    meta = await response.json()
  } catch (error) {
    console.log(`registry error: ${error.message}`)
    await new Promise((resolve) => setTimeout(resolve, 60_000))
    continue
  }
  const latest = meta['dist-tags'].latest
  const published = meta.time[latest]
  console.log(`${new Date().toISOString()} catalog latest=${latest} published=${published}`)
  if (latest !== baseline) {
    const entry = readEntry()
    console.log(`new build detected: ${entry.catalog} | our versions: ${entry.versions.join(', ')}`)
    process.exit(0)
  }
  await new Promise((resolve) => setTimeout(resolve, 60_000))
}

console.log(`no new build within ${minutes} minutes`)
process.exit(1)
