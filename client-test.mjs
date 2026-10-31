/**
 * Standalone harness for the browser half: loads the bundle through a fake
 * module loader, mounts the plugin against a fake Cordis context, and asserts
 * the slot registrations the workbench depends on.
 *
 *   node client-test.mjs
 */
import { readFileSync } from 'node:fs'

const failures = []
function check(name, condition, extra = '') {
  if (condition) console.log(`  ok   ${name}`)
  else {
    console.log(`  FAIL ${name} ${extra}`)
    failures.push(name)
  }
}

// Minimal React stub: enough for module evaluation and a render pass over
// components that do not use hooks.
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children: children.length === 0 ? undefined : children.length === 1 ? children[0] : children } }),
  Fragment: 'Fragment',
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useRef: (value) => ({ current: value }),
}

const styles = []
let plugin
globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      plugin = factory((specifier) => {
        if (specifier === 'react') return React
        throw new Error(`unexpected require: ${specifier}`)
      })
      plugin.__id = id
    },
  },
}
globalThis.document = {
  createElement: () => ({ dataset: {}, appendChild() {}, remove() {}, set textContent(value) { styles.push(value) }, get textContent() { return styles.join('\n') } }),
  head: { appendChild() {} },
}
globalThis.fetch = async () => ({ text: async () => '{}', ok: true, status: 200 })
globalThis.FileReader = class {
  readAsDataURL() {}
}
globalThis.Blob = class {}

const source = readFileSync(new URL('./lib/client.js', import.meta.url), 'utf8')
// The bundle is a classic script that assigns through `window`; evaluate it.
const run = new Function('window', 'document', 'fetch', 'FileReader', 'Blob', 'console', source)
run(globalThis.window, globalThis.document, globalThis.fetch, globalThis.FileReader, globalThis.Blob, console)

console.log('bundle')
check('registers a bundle id', plugin && plugin.__id === 'dsh-gpt-image-playground', plugin && plugin.__id)
check('exports apply', typeof plugin.apply === 'function')
check('exports inject', Array.isArray(plugin.inject) && plugin.inject.includes('slots'), JSON.stringify(plugin.inject))

console.log('apply')
const registrations = []
const disposers = []
const ctx = {
  effect(fn, label) {
    disposers.push(label ?? 'effect')
    return fn()
  },
  slots: {
    inject(name, callback) {
      const dispose = callback()
      registrations.push(name)
      return dispose
    },
    register(spec, component) {
      registrations.push(`${spec.name}:${spec.key ?? spec.id ?? ''}`)
      check(`registers a component for ${spec.name}`, typeof component === 'function', typeof component)
      return () => {}
    },
  },
}
try {
  plugin.apply(ctx)
  check('apply() does not throw', true)
} catch (error) {
  check('apply() does not throw', false, error.message)
}

check('mounts the main page', registrations.includes('main:gpt-image-playground'), registrations.join(','))
check('adds a left-rail entry with the same id', registrations.includes('sidebar.panellist:gpt-image-playground'), registrations.join(','))
check('mounts the persistent overlay surface', registrations.includes('shell.overlay:gpt-image-playground-surface'), registrations.join(','))
check('injects the panel stylesheet', styles.length === 1 && /gipg-surface/.test(styles[0]))

if (failures.length > 0) {
  console.log(`\n${failures.length} failure(s): ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nall checks passed')
