/**
 * Screenshot the preview with the local Chrome, capturing console errors.
 *
 *   node preview/shoot.mjs --out shots/empty.png
 *   node preview/shoot.mjs --out shots/result.png --generate --theme dark
 */
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const require = createRequire('C:/Users/Lenovo/.dsh/profiles/desktop/package.json')
const puppeteer = require('puppeteer-core')

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const value = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : fallback
}

const url = value('url', 'http://127.0.0.1:4517/')
const out = value('out', join(import.meta.dirname, 'shots', 'preview.png'))
const width = Number(value('width', 1440))
const height = Number(value('height', 900))
const theme = value('theme', 'light')
const prompt = value('prompt', '山间清晨的层叠丘陵，暖色逆光，厚涂油画质感')

await mkdir(dirname(out), { recursive: true })

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1'],
})
const page = await browser.newPage()
await page.setViewport({ width, height, deviceScaleFactor: 2 })

const consoleErrors = []
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(`${message.type()}: ${message.text()}`)
})
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`))

await page.goto(url, { waitUntil: 'networkidle0' })
if (theme === 'dark') await page.evaluate(() => document.body.classList.add('dark'))
await new Promise((resolve) => setTimeout(resolve, 400))

if (flag('generate')) {
  await page.evaluate((text) => {
    const area = document.querySelector('textarea')
    if (area) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(area, text)
      area.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('开始生成'))
    if (button) button.click()
  }, prompt)
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const done = await page.evaluate(() => document.querySelectorAll('.gipg-card img').length > 0)
    if (done) break
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  await new Promise((resolve) => setTimeout(resolve, 600))
}

const failures = await page.evaluate(() => window.__failures ?? [])
const stats = await page.evaluate(() => ({
  cards: document.querySelectorAll('.gipg-card').length,
  results: document.querySelectorAll('.gipg-card img').length,
  history: document.querySelectorAll('.gipg-hist').length,
  hasStyle: Boolean(document.querySelector('style[data-plugin="dsh-gpt-image-playground"]')),
  text: (document.querySelector('.gipg-root')?.innerText ?? '').slice(0, 200),
}))

await page.screenshot({ path: out, fullPage: false })
await browser.close()

console.log(JSON.stringify({ out, stats, failures, consoleErrors }, null, 2))
if (failures.length > 0 || consoleErrors.length > 0) process.exitCode = 1
