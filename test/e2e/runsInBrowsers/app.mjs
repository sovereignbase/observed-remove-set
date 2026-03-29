import * as api from '/dist/index.js'
import { printResults, runORSetSuite } from '../shared/suite.mjs'

const results = await runORSetSuite(api, { label: 'browser esm' })
printResults(results)
window.__ORSET_RESULTS__ = results

const status = document.getElementById('status')
if (status) {
  status.textContent = results.ok ? 'ok' : `failed: ${results.errors.length}`
}
