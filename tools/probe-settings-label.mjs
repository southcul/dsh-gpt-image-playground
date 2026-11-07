/**
 * Dump the DOM around the settings "当前配置" label so a hint can be injected
 * next to it.
 *
 *   node tools/probe-settings-label.mjs
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire('C:/Users/Lenovo/.dsh/profiles/desktop/package.json')
const puppeteer = require('puppeteer-core')

const index = process.argv.indexOf('--url')
const url = index > 0 ? process.argv[index + 1] : 'http://127.0.0.1:4518/'

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })

await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 }).catch(() => {})
await page.waitForFunction(() => {
  const frame = document.querySelector('iframe')
  return frame && frame.contentDocument && frame.contentDocument.querySelector('button[aria-label="设置"]')
}, { timeout: 40_000 })
await new Promise((resolve) => setTimeout(resolve, 1200))
await page.evaluate(() => document.querySelector('iframe').contentDocument.querySelector('button[aria-label="设置"]').click())
await new Promise((resolve) => setTimeout(resolve, 1500))

const report = await page.evaluate(() => {
  const doc = document.querySelector('iframe').contentDocument
  const hits = []
  for (const element of doc.querySelectorAll('*')) {
    if (element.children.length > 0) continue
    if ((element.textContent || '').trim() !== '当前配置') continue
    const parent = element.parentElement
    const grand = parent?.parentElement
    hits.push({
      tag: element.tagName.toLowerCase(),
      cls: (element.className || '').toString(),
      parentTag: parent?.tagName.toLowerCase(),
      parentCls: (parent?.className || '').toString(),
      parentText: (parent?.innerText || '').replace(/\s+/g, ' ').slice(0, 60),
      parentHTML: (parent?.outerHTML || '').replace(/\s+/g, ' ').slice(0, 320),
      grandCls: (grand?.className || '').toString().slice(0, 90),
      grandText: (grand?.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
    })
  }
  return hits
})

console.log(JSON.stringify(report, null, 1))
await page.screenshot({ path: join(import.meta.dirname, '..', 'preview', 'shots', 'settings-api.png') })
await browser.close()
