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

function createValue(index, prefix) {
  return {
    __uuidv7: uuidv7(),
    name: `${prefix}-${index}`,
    group: index % 16,
    index,
  }
}

function createValues(count, prefix) {
  const values = []
  for (let index = 0; index < count; index++) {
    values.push(createValue(index, prefix))
  }
  return values
}

function createAppendInput(index, prefix) {
  return {
    name: `${prefix}-${index}`,
    group: index % 16,
    index,
  }
}

function createAppendInputs(count, prefix) {
  const values = []
  for (let index = 0; index < count; index++) {
    values.push(createAppendInput(index, prefix))
  }
  return values
}

function createSnapshot(values, tombstones = []) {
  return { values, tombstones }
}

function readSnapshot(set) {
  let snapshot

  set.addEventListener(
    'snapshot',
    (event) => {
      snapshot = event.detail
    },
    { once: true }
  )
  set.snapshot()

  return snapshot
}

console.log(
  `Benchmarking @sovereignbase/observed-remove-set on Node ${process.versions.node}...`
)

const oneLiveValue = createValue(0, 'single')
const oneLiveSnapshot = createSnapshot([oneLiveValue])
const live64 = createValues(64, 'live64')
const live256 = createValues(256, 'live256')
const live512 = createValues(512, 'live512')
const live2048 = createValues(2048, 'live2048')
const appendBatch256 = createAppendInputs(256, 'append')
const snapshot64 = createSnapshot(live64)
const snapshot256 = createSnapshot(live256)
const snapshot512 = createSnapshot(live512)
const snapshot2048 = createSnapshot(live2048)
const mixedLive512 = createValues(512, 'mixed-live')
const mixedRemoved128 = createValues(128, 'mixed-removed')
const mixedDuplicates128 = mixedLive512.slice(0, 128).map((value, index) => ({
  __uuidv7: value.__uuidv7,
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
  ['bad', ...mixedRemoved128.map((value) => value.__uuidv7)]
)
const hasSet = new ORSet(snapshot512)
const hasLive = hasSet.values()[256]
const hasMiss = createValue(4096, 'miss')
const valuesSet = new ORSet(snapshot512)
const snapshotSet = new ORSet(snapshot512)
const tombstoneReadSet = new ORSet(snapshot512)
tombstoneReadSet.clear()
const duplicateSet = new ORSet()
const duplicateValue = createValue(0, 'duplicate')
duplicateSet.append(duplicateValue)
const removeNoopSet = new ORSet()
const removeNoopValue = createValue(0, 'remove-noop')
removeNoopSet.remove(removeNoopValue)
const clearNoopSet = new ORSet()
const mergeDuplicateSet = new ORSet(snapshot512)
const mergeListenerSnapshot = createSnapshot(
  createValues(256, 'merge-listener')
)
const mergeDuplicateSnapshot = createSnapshot(mergeDuplicateSet.values())
const mergeRemoveSnapshot = createSnapshot(
  [],
  live512.map((value) => value.__uuidv7)
)
const mergeMixedBaseValues = createValues(512, 'merge-base')
const mergeMixedBaseSnapshot = createSnapshot(mergeMixedBaseValues)
const mergeMixedSnapshot = createSnapshot(
  createValues(512, 'merge-incoming'),
  mergeMixedBaseValues.slice(0, 256).map((value) => value.__uuidv7)
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
bench('has live string', 200000, () => {
  hasSet.has(hasLive.__uuidv7)
})
bench('has miss', 200000, () => {
  hasSet.has(hasMiss)
})
bench('has miss string', 200000, () => {
  hasSet.has(hasMiss.__uuidv7)
})
bench('values x512', 5000, () => {
  valuesSet.values()
})
bench('tombstones x512', 200000, () => {
  tombstoneReadSet.tombstones()
})
bench('snapshot x512', 5000, () => {
  readSnapshot(snapshotSet)
})

section('Write Paths')
bench('append fresh', 50000, () => {
  const set = new ORSet()
  set.append(createAppendInput(0, 'fresh'))
})
bench('append valid uuid', 50000, () => {
  const set = new ORSet()
  set.append(duplicateValue)
})
bench('append duplicate noop', 200000, () => {
  duplicateSet.append(duplicateValue)
})
bench('append tomb regen', 20000, () => {
  const set = new ORSet()
  const value = createValue(0, 'tomb')
  set.append(value)
  set.remove(value)
  set.append({
    __uuidv7: value.__uuidv7,
    name: 'tomb-regenerated',
    group: 0,
    index: 1,
  })
})
bench('append batch x256', 300, () => {
  const set = new ORSet()
  for (const value of appendBatch256) set.append(value)
})
bench('remove live', 50000, () => {
  const set = new ORSet(oneLiveSnapshot)
  set.remove(oneLiveValue)
})
bench('remove live string', 50000, () => {
  const set = new ORSet(oneLiveSnapshot)
  set.remove(oneLiveValue.__uuidv7)
})
bench('remove ghost tomb', 50000, () => {
  const set = new ORSet()
  set.remove(hasMiss)
})
bench('remove ghost tomb string', 50000, () => {
  const set = new ORSet()
  set.remove(hasMiss.__uuidv7)
})
bench('remove tomb noop', 200000, () => {
  removeNoopSet.remove(removeNoopValue)
})
bench('remove tomb noop string', 200000, () => {
  removeNoopSet.remove(removeNoopValue.__uuidv7)
})
bench('clear noop', 200000, () => {
  clearNoopSet.clear()
})
bench('clear x512', 2000, () => {
  const set = new ORSet(snapshot512)
  set.clear()
})
bench('gc delete x512 tombstones', 1500, () => {
  const set = new ORSet(snapshot512)
  set.clear()
  const tombstones = set.tombstones()
  for (const tombstone of [...tombstones]) tombstones.delete(tombstone)
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
  b.merge(readSnapshot(a))
  a.merge(readSnapshot(b))
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
  set.append(createAppendInput(0, 'eventful'))
})
bench('merge with listeners x256', 2000, () => {
  const set = new ORSet()
  set.addEventListener('merge', appendWithListenersListener)
  set.merge(mergeListenerSnapshot)
})

console.log('\nBenchmark complete.')
