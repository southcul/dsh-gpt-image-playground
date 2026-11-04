/**
 * Verify a vendored build end to end: boot, failing requests, font usage, and
 * the injected chrome trims (header buttons, About tab, version badge).
 *
 *   node tools/verify-build.mjs [--url http://127.0.0.1:4518/]
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

const requestFailed = []
const badResponses = []
const fontRequests = []
page.on('requestfailed', (request) => requestFailed.push(`${request.failure()?.errorText} ${request.url()}`))
page.on('response', (response) => {
  if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`)
})
page.on('request', (request) => {
  if (/\.(woff2?|ttf)(\?|$)/.test(request.url())) fontRequests.push(request.url())
})

await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 }).catch((error) => requestFailed.push(`goto: ${error.message}`))
await page.waitForFunction(() => {
  const frame = document.querySelector('iframe')
  return frame && frame.contentDocument && frame.contentDocument.querySelector('button[aria-label="设置"]')
}, { timeout: 40_000 }).catch(() => {})
await new Promise((resolve) => setTimeout(resolve, 2500))

const header = await page.evaluate(() => {
  const doc = document.querySelector('iframe')?.contentDocument
  if (!doc) return { error: 'no frame' }
  const probe = (label) => {
    const element = doc.querySelector(`button[aria-label="${label}"], a[aria-label="${label}"]`)
    if (!element) return 'absent'
    const style = doc.defaultView.getComputedStyle(element)
    return `${style.display}/${Math.round(element.getBoundingClientRect().width)}px`
  }
  return {
    install: probe('安装为应用'),
    download: probe('下载客户端'),
    guide: probe('操作指南'),
    settings: probe('设置'),
  }
})

await page.evaluate(() => document.querySelector('iframe').contentDocument.querySelector('button[aria-label="设置"]').click())
await new Promise((resolve) => setTimeout(resolve, 1500))
const dialog = await page.evaluate(() => {
  const doc = document.querySelector('iframe').contentDocument
  const about = [...doc.querySelectorAll('button')].find((item) => (item.textContent || '').trim() === '关于')
  const badge = [...doc.querySelectorAll('span')].find((item) => /^v\d+\.\d+\.\d+$/.test((item.textContent || '').trim()) && (item.className || '').toString().includes('font-mono'))
  return {
    aboutFound: Boolean(about),
    aboutDisplay: about ? doc.defaultView.getComputedStyle(about).display : 'absent',
    aboutMarked: about ? about.getAttribute('data-dsh-gipg-about') : null,
    badgeText: badge ? badge.textContent.trim() : null,
    badgeTitle: badge ? badge.getAttribute('title') : null,
    nav: [...doc.querySelectorAll('nav button')].map((item) => (item.textContent || '').trim()).filter(Boolean),
  }
})

await page.screenshot({ path: join(import.meta.dirname, '..', 'preview', 'shots', 'build-check.png') })
await browser.close()

console.log(JSON.stringify({ header, dialog, fontRequests: fontRequests.length, requestFailed: requestFailed.slice(0, 8), badResponses: badResponses.slice(0, 8) }, null, 1))
