import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runBrowserMatrix } from './runner.mjs'
import { startServer } from './server.mjs'

const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)))
const server = await startServer(repoRoot)

try {
  await runBrowserMatrix(server.origin)
} finally {
  await server.close()
}
