/**
 * Regression test for the reported bug: starting a generation and then
 * switching to another shell panel must not destroy the frame or abort the
 * request.
 *
 *   node tools/test-switch.mjs [--url http://127.0.0.1:4518/]
 */
import { createRequire } from 'node:module'

const require = createRequire('C:/Users/Lenovo/.dsh/profiles/desktop/package.json')
const puppeteer = require('puppeteer-core')

const url = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:4518/'
const failures = []
const check = (name, condition, extra = '') => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${name}${condition ? '' : ' ' + extra}`)
  if (!condition) failures.push(name)
}

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))

await page.goto(url, { waitUntil: 'networkidle2' })
await page.waitForSelector('iframe', { timeout: 30_000 })

const appFrame = () => page.frames().find((item) => item.url().includes('/app/index.html'))
await page.waitForFunction(() => {
  const frame = document.querySelector('iframe')
  return Boolean(frame && frame.contentDocument && frame.contentDocument.querySelector('#root'))
}, { timeout: 30_000 })
await new Promise((resolve) => setTimeout(resolve, 1500))

let frame = appFrame()
check('workbench frame is mounted', Boolean(frame))

// Mark the frame document and start a request that outlives the panel switch.
const marker = await frame.evaluate(async () => {
  window.__frameMarker = Math.random().toString(36).slice(2)
  window.__slowState = 'pending'
  fetch('/slow?ms=4000').then((response) => response.json()).then((body) => {
    window.__slowState = `done:${body.waited >= 3900 ? 'waited' : 'early'}`
  }).catch((error) => {
    window.__slowState = `error:${error.message}`
  })
  return window.__frameMarker
})
check('frame marker set', typeof marker === 'string' && marker.length > 0)

const surfaceVisible = async () => page.evaluate(() => {
  const surface = document.querySelector('.gipg-surface')
  if (!surface) return { exists: false }
  const style = getComputedStyle(surface)
  return { exists: true, display: style.display, width: surface.getBoundingClientRect().width }
})
check('surface visible while workbench is selected', (await surfaceVisible()).display !== 'none')

// Switch to the other panel: DSH unmounts the main entry here.
await page.evaluate(() => window.__selectPanel('conversation'))
await new Promise((resolve) => setTimeout(resolve, 600))
const hidden = await surfaceVisible()
check('surface hidden after switching panel', hidden.exists && hidden.display === 'none', JSON.stringify(hidden))
check('frame element still in the DOM', await page.evaluate(() => Boolean(document.querySelector('iframe'))))

// While hidden, the request must keep going and finish.
await new Promise((resolve) => setTimeout(resolve, 4200))
frame = appFrame()
const stateWhileHidden = await frame.evaluate(() => window.__slowState)
check('in-flight request completed while hidden', stateWhileHidden.startsWith('done:'), stateWhileHidden)

// Back to the workbench: same document (no reload), same state.
await page.evaluate(() => window.__selectPanel('workbench'))
await new Promise((resolve) => setTimeout(resolve, 800))
const back = await surfaceVisible()
check('surface visible again', back.exists && back.display !== 'none' && back.width > 400, JSON.stringify(back))
frame = appFrame()
const afterSwitch = await frame.evaluate(() => ({ marker: window.__frameMarker, state: window.__slowState }))
check('frame document survived the round trip', afterSwitch.marker === marker, JSON.stringify(afterSwitch))
check('no page errors', pageErrors.length === 0, pageErrors.join(' | '))

await page.screenshot({ path: 'preview/shots/switch-back.png' })
await browser.close()
console.log(failures.length === 0 ? '\nall checks passed' : `\n${failures.length} failure(s): ${failures.join(', ')}`)
process.exitCode = failures.length === 0 ? 0 : 1
