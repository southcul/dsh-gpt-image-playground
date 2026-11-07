/**
 * Check 设置 → 习惯配置: the 「更新」 section must be hidden, the others visible.
 *
 *   node tools/verify-habits.mjs
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
await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 2 })

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
  const view = doc.defaultView
  const sections = [...doc.querySelectorAll('section')].map((section) => {
    const heading = section.querySelector('h4, h3')
    const style = view.getComputedStyle(section)
    const box = section.getBoundingClientRect()
    return {
      heading: (heading?.textContent || '').trim().slice(0, 20),
      display: style.display,
      height: Math.round(box.height),
      marked: section.getAttribute('data-dsh-gipg-update-section'),
    }
  })
  const visible = [...doc.querySelectorAll('section')].filter((section) => view.getComputedStyle(section).display !== 'none')
  const pane = visible.map((section) => (section.innerText || '').replace(/\s+/g, ' ')).join(' | ')
  return { sections, visibleText: pane.slice(0, 120), mentionsAutoCheck: pane.includes('自动检查更新') }
})

await page.screenshot({ path: join(import.meta.dirname, '..', 'preview', 'shots', 'settings-habits.png') })
console.log(JSON.stringify(report, null, 1))
const hidden = report.sections.some((item) => item.heading === '更新' && (item.display === 'none' || item.height === 0))
console.log(hidden && !report.mentionsAutoCheck ? 'update section: hidden' : 'update section: STILL VISIBLE')
process.exitCode = hidden && !report.mentionsAutoCheck ? 0 : 1
await browser.close()
