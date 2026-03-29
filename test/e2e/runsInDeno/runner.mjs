import * as api from '../../../dist/index.js'
import { ensurePassing, printResults, runORSetSuite } from '../shared/suite.mjs'

const results = await runORSetSuite(api, { label: 'deno esm' })
printResults(results)
ensurePassing(results)
