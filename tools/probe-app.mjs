/**
 * Boot the vendored upstream app in the local Chrome and report what failed.
 *
 *   node tools/probe-app.mjs [--url ...] [--out ...]
 */
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const require = createRequire('C:/Users/Lenovo/.dsh/profiles/desktop/package.json')
const puppeteer = require('puppeteer-core')

const args = process.argv.slice(2)
const value = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : fallback
}

const url = value('url', 'http://127.0.0.1:4518/plugins/dsh-gpt-image-playground/app/index.html')
const out = value('out', join(import.meta.dirname, '..', 'preview', 'shots', 'app.png'))

await mkdir(dirname(out), { recursive: true })

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })

const failedResponses = []
const pageErrors = []
const consoleErrors = []
page.on('response', (response) => {
  const status = response.status()
  if (status >= 400) failedResponses.push(`${status} ${response.url()}`)
})
page.on('pageerror', (error) => pageErrors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})

await page.goto(url, { waitUntil: 'networkidle2', timeout: 90_000 }).catch((error) => pageErrors.push(`goto: ${error.message}`))
await new Promise((resolve) => setTimeout(resolve, 4000))

const stats = await page.evaluate(() => {
  const root = document.getElementById('root')
  return {
    title: document.title,
    rootChildren: root ? root.children.length : -1,
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
    buttons: [...document.querySelectorAll('button')].slice(0, 12).map((item) => (item.innerText || item.getAttribute('aria-label') || '').trim()).filter(Boolean),
    images: document.querySelectorAll('img').length,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  }
})

await page.screenshot({ path: out })
await browser.close()

console.log(JSON.stringify({ out, stats, failedResponses: failedResponses.slice(0, 20), pageErrors: pageErrors.slice(0, 10), consoleErrors: consoleErrors.slice(0, 10) }, null, 2))
