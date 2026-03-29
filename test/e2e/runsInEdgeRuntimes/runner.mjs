import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import * as uuid from 'uuid'
import { EdgeRuntime } from 'edge-runtime'
import { ensurePassing, printResults, runORSetSuite } from '../shared/suite.mjs'

const root = process.cwd()
const esmDistPath = resolve(root, 'dist', 'index.js')

function toExecutableEdgeEsm(bundleCode) {
  const importPattern =
    /import\s*\{\s*v7 as uuidv7,\s*version as uuidVersion\s*\}\s*from\s*["']uuid["'];\s*/
  if (!importPattern.test(bundleCode)) {
    throw new Error('edge-runtime esm harness could not find the uuid import')
  }

  const withoutImport = bundleCode.replace(
    importPattern,
    'const { v7: uuidv7, version: uuidVersion } = globalThis.__ORSET_UUID;\n'
  )
  const exportMatch = withoutImport.match(
    /export\s*\{\s*ORSet\s*\};\s*(\/\/# sourceMappingURL=.*)?\s*$/
  )
  if (!exportMatch) {
    throw new Error('edge-runtime esm harness could not find bundle exports')
  }

  const sourceMapComment = exportMatch[1] ? `${exportMatch[1]}\n` : ''
  return (
    withoutImport.slice(0, exportMatch.index) +
    'globalThis.__ORSET_EXPORTS__ = { ORSet };\n' +
    sourceMapComment
  )
}

const runtime = new EdgeRuntime()
runtime.context.__ORSET_UUID = uuid
runtime.evaluate(`
  if (typeof globalThis.CustomEvent === 'undefined') {
    globalThis.CustomEvent = class CustomEvent extends Event {
      constructor(type, init = {}) {
        super(type, init)
        this.detail = init.detail ?? null
      }
    }
  }
`)
const moduleCode = await readFile(esmDistPath, 'utf8')
runtime.evaluate(toExecutableEdgeEsm(moduleCode))

const results = await runORSetSuite(runtime.context.__ORSET_EXPORTS__, {
  label: 'edge-runtime esm',
})
printResults(results)
ensurePassing(results)
