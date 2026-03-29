import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const c8Bin = resolve(repoRoot, 'node_modules/c8/bin/c8.js')

const result = spawnSync(
  process.execPath,
  [
    c8Bin,
    process.execPath,
    '--test',
    'test/unit/logical-unit.test.js',
    'test/integration/integration.test.js',
  ],
  {
    cwd: repoRoot,
    stdio: 'inherit',
  }
)

process.exit(result.status ?? 1)
