/**
 * Dump the 设置 → 习惯配置 pane so entries can be targeted precisely.
 *
 *   node tools/probe-habits.mjs
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
await page.setViewport({ width: 1440, height: 1400, deviceScaleFactor: 2 })

await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 }).catch(() => {})
await page.waitForFunction(() => {
  const frame = document.querySelector('iframe')
  return frame && frame.contentDocument && frame.contentDocument.querySelector('button[aria-label="设置"]')
}, { timeout: 40_000 })
await new Promise((resolve) => setTimeout(resolve, 1000))
await page.evaluate(() => document.querySelector('iframe').contentDocument.querySelector('button[aria-label="设置"]').click())
await new Promise((resolve) => setTimeout(resolve, 1200))
await page.evaluate(() => {
  const doc = document.querySelector('iframe').contentDocument
  const tab = [...doc.querySelectorAll('nav button')].find((item) => (item.textContent || '').trim() === '习惯配置')
  tab?.click()
})
await new Promise((resolve) => setTimeout(resolve, 1500))

const report = await page.evaluate(() => {
  const doc = document.querySelector('iframe').contentDocument
  const hits = []
  for (const element of doc.querySelectorAll('*')) {
    const text = (element.textContent || '').trim()
    if (!/更新/.test(text) || text.length > 40) continue
    if (element.children.length > 0) continue
    const box = element.getBoundingClientRect()
    if (box.width === 0) continue
    const parents = []
    let node = element
    for (let depth = 0; depth < 4 && node; depth += 1) {
      parents.push({
        tag: node.tagName.toLowerCase(),
        cls: (node.className || '').toString().slice(0, 80),
        text: (node.innerText || '').replace(/\s+/g, ' ').slice(0, 70),
      })
      node = node.parentElement
    }
    hits.push({ text: text.slice(0, 30), tag: element.tagName.toLowerCase(), y: Math.round(box.y), parents })
  }
  return {
    paneText: (doc.querySelector('[role="dialog"]')?.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
    hits,
  }
})

console.log(JSON.stringify(report, null, 1))
await page.screenshot({ path: join(import.meta.dirname, '..', 'preview', 'shots', 'settings-habits.png'), fullPage: false })
await browser.close()
