import { performance } from 'node:perf_hooks'
import { v7 as uuidv7 } from 'uuid'
import { ORSet } from '../dist/index.js'

function formatOps(iterations, durationMs) {
  const opsPerSec = Math.round((iterations / durationMs) * 1000)
  const ms = durationMs.toFixed(1)
  return `${opsPerSec.toLocaleString()} ops/s (${ms} ms)`
}

function section(name) {
  console.log(`\n${name}`)
}

function bench(name, iterations, fn) {
  const warmupIterations = Math.min(
    200,
    Math.max(10, Math.ceil(iterations / 20))
  )

  for (let index = 0; index < warmupIterations; index++) fn()

  const start = performance.now()
  for (let index = 0; index < iterations; index++) fn()
  const duration = performance.now() - start

  console.log(`${name.padEnd(28)} ${formatOps(iterations, duration)}`)
}

function createEntry(index, prefix) {
  return {
    __uuidv7: uuidv7(),
    name: `${prefix}-${index}`,
    group: index % 16,
    index,
  }
}

function createEntries(count, prefix) {
  const entries = []
  for (let index = 0; index < count; index++) {
    entries.push(createEntry(index, prefix))
  }
  return entries
}

function createAppendInput(index, prefix) {
  return {
    name: `${prefix}-${index}`,
    group: index % 16,
    index,
  }
}

function createAppendInputs(count, prefix) {
  const entries = []
  for (let index = 0; index < count; index++) {
    entries.push(createAppendInput(index, prefix))
  }
  return entries
}

function createSnapshot(items, tombs = []) {
  return { items, tombs }
}

console.log(
  `Benchmarking @sovereignbase/observed-remove-set on Node ${process.versions.node}...`
)

const oneLiveEntry = createEntry(0, 'single')
const oneLiveSnapshot = createSnapshot([oneLiveEntry])
const live64 = createEntries(64, 'live64')
const live256 = createEntries(256, 'live256')
const live512 = createEntries(512, 'live512')
const live2048 = createEntries(2048, 'live2048')
const appendBatch256 = createAppendInputs(256, 'append')
const snapshot64 = createSnapshot(live64)
const snapshot256 = createSnapshot(live256)
const snapshot512 = createSnapshot(live512)
const snapshot2048 = createSnapshot(live2048)
const mixedLive512 = createEntries(512, 'mixed-live')
const mixedRemoved128 = createEntries(128, 'mixed-removed')
const mixedDuplicates128 = mixedLive512.slice(0, 128).map((entry, index) => ({
  __uuidv7: entry.__uuidv7,
  name: `mixed-duplicate-${index}`,
  group: index % 16,
  index,
}))
const mixedSnapshot = createSnapshot(
  [
    ...mixedLive512,
    ...mixedRemoved128,
    ...mixedDuplicates128,
    { __uuidv7: 'bad', name: 'invalid', group: -1, index: -1 },
  ],
  ['bad', ...mixedRemoved128.map((entry) => entry.__uuidv7)]
)
const hasSet = new ORSet(snapshot512)
const hasLive = hasSet.values()[256]
const hasMiss = createEntry(4096, 'miss')
const valuesSet = new ORSet(snapshot512)
const snapshotSet = new ORSet(snapshot512)
const duplicateSet = new ORSet()
const duplicateEntry = createEntry(0, 'duplicate')
duplicateSet.append(duplicateEntry)
const removeNoopSet = new ORSet()
const removeNoopEntry = createEntry(0, 'remove-noop')
removeNoopSet.remove(removeNoopEntry)
const clearNoopSet = new ORSet()
const mergeDuplicateSet = new ORSet(snapshot512)
const mergeListenerSnapshot = createSnapshot(
  createEntries(256, 'merge-listener')
)
const mergeDuplicateSnapshot = createSnapshot(mergeDuplicateSet.values())
const mergeRemoveSnapshot = createSnapshot(
  [],
  live512.map((entry) => entry.__uuidv7)
)
const mergeMixedBaseEntries = createEntries(512, 'merge-base')
const mergeMixedBaseSnapshot = createSnapshot(mergeMixedBaseEntries)
const mergeMixedSnapshot = createSnapshot(
  createEntries(512, 'merge-incoming'),
  mergeMixedBaseEntries.slice(0, 256).map((entry) => entry.__uuidv7)
)
const appendWithListenersListener = () => {}

section('Constructor')
bench('constructor empty', 100000, () => {
  new ORSet()
})
bench('constructor hydrate x64', 5000, () => {
  new ORSet(snapshot64)
})
bench('constructor hydrate x512', 1000, () => {
  new ORSet(snapshot512)
})
bench('constructor hydrate x2048', 250, () => {
  new ORSet(snapshot2048)
})
bench('constructor filter mixed', 750, () => {
  new ORSet(mixedSnapshot)
})

section('Read Paths')
bench('has live', 200000, () => {
  hasSet.has(hasLive)
})
bench('has miss', 200000, () => {
  hasSet.has(hasMiss)
})
bench('values x512', 5000, () => {
  valuesSet.values()
})
bench('snapshot x512', 5000, () => {
  snapshotSet.snapshot()
})

section('Write Paths')
bench('append fresh', 50000, () => {
  const set = new ORSet()
  set.append(createAppendInput(0, 'fresh'))
})
bench('append valid uuid', 50000, () => {
  const set = new ORSet()
  set.append(duplicateEntry)
})
bench('append duplicate noop', 200000, () => {
  duplicateSet.append(duplicateEntry)
})
bench('append tomb regen', 20000, () => {
  const set = new ORSet()
  const entry = createEntry(0, 'tomb')
  set.append(entry)
  set.remove(entry)
  set.append({
    __uuidv7: entry.__uuidv7,
    name: 'tomb-regenerated',
    group: 0,
    index: 1,
  })
})
bench('append batch x256', 300, () => {
  const set = new ORSet()
  for (const entry of appendBatch256) set.append(entry)
})
bench('remove live', 50000, () => {
  const set = new ORSet(oneLiveSnapshot)
  set.remove(oneLiveEntry)
})
bench('remove ghost tomb', 50000, () => {
  const set = new ORSet()
  set.remove(hasMiss)
})
bench('remove tomb noop', 200000, () => {
  removeNoopSet.remove(removeNoopEntry)
})
bench('clear noop', 200000, () => {
  clearNoopSet.clear()
})
bench('clear x512', 2000, () => {
  const set = new ORSet(snapshot512)
  set.clear()
})

section('Merge And Replication')
bench('merge add x64', 5000, () => {
  const set = new ORSet()
  set.merge(snapshot64)
})
bench('merge add x512', 1250, () => {
  const set = new ORSet()
  set.merge(snapshot512)
})
bench('merge remove x512', 1250, () => {
  const set = new ORSet(snapshot512)
  set.merge(mergeRemoveSnapshot)
})
bench('merge mixed x512', 750, () => {
  const set = new ORSet(mergeMixedBaseSnapshot)
  set.merge(mergeMixedSnapshot)
})
bench('merge duplicate noop', 5000, () => {
  mergeDuplicateSet.merge(mergeDuplicateSnapshot)
})
bench('replica roundtrip x256', 1500, () => {
  const a = new ORSet(snapshot256)
  const b = new ORSet()
  b.merge(a.snapshot())
  a.merge(b.snapshot())
})

section('Event Overhead')
bench('listener add/remove', 200000, () => {
  const set = new ORSet()
  set.addEventListener('delta', appendWithListenersListener)
  set.removeEventListener('delta', appendWithListenersListener)
})
bench('append with listeners', 30000, () => {
  const set = new ORSet()
  set.addEventListener('delta', appendWithListenersListener)
  set.addEventListener('snapshot', appendWithListenersListener)
  set.append(createAppendInput(0, 'eventful'))
})
bench('merge with listeners x256', 2000, () => {
  const set = new ORSet()
  set.addEventListener('merge', appendWithListenersListener)
  set.addEventListener('snapshot', appendWithListenersListener)
  set.merge(mergeListenerSnapshot)
})

console.log('\nBenchmark complete.')
