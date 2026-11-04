/**
 * Force the upstream app to think a newer release exists, then report whether
 * the update affordance is visible.
 *
 *   node tools/probe-update.mjs                                   # raw app
 *   node tools/probe-update.mjs --url http://127.0.0.1:4518/      # host page (trims applied)
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire('C:/Users/Lenovo/.dsh/profiles/desktop/package.json')
const puppeteer = require('puppeteer-core')

const index = process.argv.indexOf('--url')
const url = index > 0 ? process.argv[index + 1] : 'http://127.0.0.1:4518/plugins/dsh-gpt-image-playground/app/index.html'

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })

await page.setRequestInterception(true)
page.on('request', (request) => {
  if (/api\.github\.com\/repos\/.*\/releases/.test(request.url())) {
    request.respond({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify([
        {
          tag_name: 'v0.9.9',
          name: 'v0.9.9',
          body: '模拟的新版本说明。',
          published_at: new Date().toISOString(),
          html_url: 'https://github.com/CookSleep/gpt_image_playground/releases/tag/v0.9.9',
        },
      ]),
    })
    return
  }
  request.continue()
})

await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 }).catch(() => {})
await new Promise((resolve) => setTimeout(resolve, 4500))

const report = await page.evaluate(() => {
  const host = document.querySelector('iframe')
  const doc = host?.contentDocument ?? document
  const view = doc.defaultView ?? window
  const candidates = []
  for (const button of doc.querySelectorAll('header button')) {
    const title = button.getAttribute('title') ?? ''
    const cls = (button.className || '').toString()
    if (!/新版本|NEW/i.test(title) && !/bg-red-500/.test(cls)) continue
    const box = button.getBoundingClientRect()
    candidates.push({
      text: (button.textContent || '').trim().slice(0, 12),
      title: title.slice(0, 24),
      display: view.getComputedStyle(button).display,
      width: Math.round(box.width),
    })
  }
  return { inFrame: Boolean(host), candidates }
})

await page.screenshot({ path: join(import.meta.dirname, '..', 'preview', 'shots', 'update-badge.png') })
console.log(JSON.stringify(report, null, 1))
const hidden = report.candidates.every((item) => item.display === 'none' || item.width === 0)
console.log(hidden ? 'update badge: hidden' : 'update badge: STILL VISIBLE')
process.exitCode = hidden ? 0 : 1
await browser.close()
