/**
 * Recon the vendored app's settings dialog: dump the inputs and buttons.
 *
 *   node tools/recon-settings.mjs
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire('C:/Users/Lenovo/.dsh/profiles/desktop/package.json')
const puppeteer = require('puppeteer-core')

const url = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:4518/plugins/dsh-gpt-image-playground/app/index.html'

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 })
page.on('pageerror', (error) => console.log('[pageerror]', error.message))
await page.goto(url, { waitUntil: 'networkidle2' })
await new Promise((resolve) => setTimeout(resolve, 2500))

// open the app's own settings
const opened = await page.evaluate(() => {
  const candidates = [...document.querySelectorAll('button')]
  const gear = candidates.find((item) => (item.getAttribute('aria-label') || '').includes('设置') || (item.title || '').includes('设置'))
  if (!gear) return false
  gear.click()
  return true
})
console.log('settings opened:', opened)
await new Promise((resolve) => setTimeout(resolve, 1200))

const dump = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]') || document.body
  const inputs = [...dialog.querySelectorAll('input, textarea, select')].slice(0, 24).map((item) => ({
    tag: item.tagName.toLowerCase(),
    type: item.type,
    placeholder: item.placeholder,
    value: (item.value || '').slice(0, 60),
    name: item.name,
    aria: item.getAttribute('aria-label'),
  }))
  const buttons = [...dialog.querySelectorAll('button')].slice(0, 30).map((item) => ({
    text: (item.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40),
    aria: item.getAttribute('aria-label'),
  }))
  return { inputs, buttons, text: (dialog.innerText || '').replace(/\s+/g, ' ').slice(0, 500) }
})
console.log(JSON.stringify(dump, null, 2))

const settingsIndex = await page.evaluate(() => localStorage.length)
console.log('localStorage keys:', await page.evaluate(() => Object.keys(localStorage)))
await page.screenshot({ path: join(import.meta.dirname, '..', 'preview', 'shots', 'recon-settings.png') })
await browser.close()
