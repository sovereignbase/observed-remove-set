const TEST_TIMEOUT_MS = 5000

export async function runORSetSuite(api, options = {}) {
  const { label = 'runtime' } = options
  const results = { label, ok: true, errors: [], tests: [] }
  const { ORSet } = api

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'assertion failed')
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `expected ${actual} to equal ${expected}`)
    }
  }

  function assertJsonEqual(actual, expected, message) {
    assertEqual(
      JSON.stringify(actual),
      JSON.stringify(expected),
      message || 'json mismatch'
    )
  }

  function sortStrings(values) {
    return [...values].sort()
  }

  function captureEvents(set) {
    const events = {
      delta: [],
      snapshot: [],
      merge: [],
    }

    set.addEventListener('delta', (event) => {
      events.delta.push(event.detail)
    })
    set.addEventListener('snapshot', (event) => {
      events.snapshot.push(event.detail)
    })
    set.addEventListener('merge', (event) => {
      events.merge.push(event.detail)
    })

    return events
  }

  function createValidUuid(seed = 'seed') {
    const set = new ORSet()
    set.append({ name: seed })
    return set.values()[0].__uuidv7
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
    assertEqual(set.snapshot(), undefined)
    assert(snapshot, 'expected snapshot detail')

    return snapshot
  }

  function assertBadSnapshotError(error) {
    assert(error, 'expected an error')
    assertEqual(error.name, 'ORSetError', 'expected ORSetError name')
    assertEqual(error.code, 'BAD_SNAPSHOT', 'expected BAD_SNAPSHOT code')
    assert(
      /\{@sovereignbase\/observed-remove-set\}/.test(String(error.message)),
      'expected prefixed error message'
    )
  }

  function assertThrows(fn, validate) {
    let threw = false

    try {
      fn()
    } catch (error) {
      threw = true
      if (validate) validate(error)
    }

    if (!threw) throw new Error('expected function to throw')
  }

  async function withTimeout(promise, ms, name) {
    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`timeout after ${ms}ms: ${name}`))
      }, ms)
    })
    return Promise.race([promise.finally(() => clearTimeout(timer)), timeout])
  }

  async function runTest(name, fn) {
    try {
      await withTimeout(Promise.resolve().then(fn), TEST_TIMEOUT_MS, name)
      results.tests.push({ name, ok: true })
    } catch (error) {
      results.ok = false
      results.tests.push({ name, ok: false })
      results.errors.push({ name, message: String(error) })
    }
  }

  await runTest('exports shape', () => {
    assert(typeof ORSet === 'function', 'ORSet export missing')
  })

  await runTest('empty constructor', () => {
    const set = new ORSet()
    assertEqual(set.size, 0)
    assertJsonEqual(set.values(), [])
    assertJsonEqual(readSnapshot(set), { values: [], tombstones: [] })
  })

  await runTest('constructor rejects malformed snapshot', () => {
    assertThrows(() => new ORSet(null), assertBadSnapshotError)
  })

  await runTest(
    'constructor filters invalid tombstones duplicate ids and tombstoned values',
    () => {
      const liveId = createValidUuid('live')
      const removedId = createValidUuid('removed')
      const set = new ORSet({
        values: [
          { __uuidv7: liveId, name: 'first' },
          { __uuidv7: liveId, name: 'second' },
          { __uuidv7: removedId, name: 'removed' },
          { __uuidv7: 'bad', name: 'invalid' },
        ],
        tombstones: ['bad', removedId],
      })

      assertEqual(set.size, 1)
      assertJsonEqual(
        set.values().map((item) => item.name),
        ['first']
      )
      assertJsonEqual(readSnapshot(set).tombstones, [removedId])
    }
  )

  await runTest('has reflects live membership', () => {
    const set = new ORSet()
    set.append({ name: 'alice' })
    const [live] = set.values()
    const missingId = createValidUuid('missing')
    assertEqual(set.has(live), true)
    assertEqual(set.has(live.__uuidv7), true)
    assertEqual(set.has({ __uuidv7: missingId, name: 'missing' }), false)
    assertEqual(set.has(missingId), false)
  })

  await runTest('append generates uuid freezes value and emits events', () => {
    const set = new ORSet()
    const events = captureEvents(set)
    set.append({ name: 'alice' })
    const [stored] = set.values()

    assertEqual(set.size, 1)
    assertEqual(typeof stored.__uuidv7, 'string')
    assertEqual(Object.isFrozen(stored), true)
    assertEqual(events.delta.length, 1)
    assertEqual(events.snapshot.length, 0)
    assertEqual(events.delta[0].values[0].__uuidv7, stored.__uuidv7)
  })

  await runTest('append preserves a valid supplied free uuid', () => {
    const set = new ORSet()
    const v7 = createValidUuid('seed')
    set.append({ __uuidv7: v7, name: 'manual' })
    assertEqual(set.values()[0].__uuidv7, v7)
  })

  await runTest('append regenerates invalid supplied uuid', () => {
    const set = new ORSet()
    set.append({ __uuidv7: 'bad', name: 'alice' })
    assertEqual(set.size, 1)
    assert(set.values()[0].__uuidv7 !== 'bad', 'expected regenerated uuid')
  })

  await runTest('append ignores duplicate live uuid', () => {
    const set = new ORSet()
    set.append({ name: 'alice' })
    const [stored] = set.values()
    const events = captureEvents(set)
    set.append(stored)

    assertEqual(set.size, 1)
    assertEqual(events.delta.length, 0)
    assertEqual(events.snapshot.length, 0)
  })

  await runTest('append regenerates tombstoned supplied uuid', () => {
    const set = new ORSet()
    set.append({ name: 'alice' })
    const [removed] = set.values()
    set.remove(removed)
    set.append({ __uuidv7: removed.__uuidv7, name: 'bob' })

    assertEqual(set.size, 1)
    assert(set.values()[0].__uuidv7 !== removed.__uuidv7, 'expected new uuid')
  })

  await runTest('clear removes every live value', () => {
    const set = new ORSet()
    set.append({ name: 'alice' })
    set.append({ name: 'bob' })
    const liveIds = set.values().map((item) => item.__uuidv7)
    const events = captureEvents(set)
    set.clear()

    assertEqual(set.size, 0)
    assertEqual(events.delta.length, 1)
    assertEqual(events.snapshot.length, 0)
    assertJsonEqual(
      sortStrings(readSnapshot(set).tombstones),
      sortStrings(liveIds)
    )
  })

  await runTest('clear stays silent on empty state', () => {
    const set = new ORSet()
    const events = captureEvents(set)
    set.clear()

    assertEqual(events.delta.length, 0)
    assertEqual(events.snapshot.length, 0)
  })

  await runTest('remove ignores invalid uuid', () => {
    const set = new ORSet()
    const events = captureEvents(set)
    set.remove({ __uuidv7: 'bad', name: 'ghost' })

    assertEqual(set.size, 0)
    assertEqual(events.delta.length, 0)
    assertEqual(events.snapshot.length, 0)
  })

  await runTest('remove tombstones a live uuid string once', () => {
    const set = new ORSet()
    set.append({ name: 'alice' })
    const [live] = set.values()
    const events = captureEvents(set)
    set.remove(live.__uuidv7)
    set.remove(live)

    assertEqual(set.size, 0)
    assertEqual(events.delta.length, 1)
    assertEqual(events.snapshot.length, 0)
    assertJsonEqual(readSnapshot(set).tombstones, [live.__uuidv7])
  })

  await runTest(
    'remove records a causal tomb for an unknown valid uuid string',
    () => {
      const set = new ORSet()
      const ghostId = createValidUuid('ghost')
      const events = captureEvents(set)
      set.remove(ghostId)

      assertEqual(events.delta.length, 1)
      assertEqual(events.snapshot.length, 0)
      assertJsonEqual(readSnapshot(set).tombstones, [ghostId])
    }
  )

  await runTest('merge rejects malformed snapshot', () => {
    const set = new ORSet()
    assertThrows(() => set.merge(null), assertBadSnapshotError)
  })

  await runTest('merge imports live additions', () => {
    const source = new ORSet()
    source.append({ name: 'alice' })
    const [live] = source.values()
    const target = new ORSet()
    const events = captureEvents(target)
    target.merge(readSnapshot(source))

    assertEqual(target.size, 1)
    assertEqual(target.values()[0].__uuidv7, live.__uuidv7)
    assertEqual(events.merge.length, 1)
    assertEqual(events.snapshot.length, 0)
  })

  await runTest('merge applies tomb removals', () => {
    const removedId = createValidUuid('removed')
    const target = new ORSet({
      values: [{ __uuidv7: removedId, name: 'removed' }],
      tombstones: [],
    })
    const events = captureEvents(target)
    target.merge({ values: [], tombstones: [removedId] })

    assertEqual(target.size, 0)
    assertJsonEqual(readSnapshot(target).tombstones, [removedId])
    assertEqual(events.merge.length, 1)
  })

  await runTest('merge skips invalid data and stays silent on no-op', () => {
    const target = new ORSet()
    const knownTomb = createValidUuid('known')
    target.merge({ values: [], tombstones: [knownTomb] })
    const events = captureEvents(target)
    target.merge({
      values: [{ __uuidv7: 'bad', name: 'invalid' }],
      tombstones: ['bad', knownTomb],
    })

    assertEqual(events.merge.length, 0)
    assertEqual(events.snapshot.length, 0)
  })

  await runTest('merge does not resurrect tombstoned uuid', () => {
    const tombedId = createValidUuid('tombed')
    const target = new ORSet({ values: [], tombstones: [tombedId] })
    const events = captureEvents(target)
    target.merge({
      values: [{ __uuidv7: tombedId, name: 'zombie' }],
      tombstones: [],
    })

    assertEqual(target.size, 0)
    assertEqual(events.merge.length, 0)
    assertEqual(events.snapshot.length, 0)
  })

  await runTest('merge handles additions and removals together', () => {
    const removedId = createValidUuid('removed')
    const source = new ORSet()
    source.append({ name: 'added' })
    const [added] = source.values()
    const target = new ORSet({
      values: [{ __uuidv7: removedId, name: 'removed' }],
      tombstones: [],
    })
    const events = captureEvents(target)
    target.merge({ values: [added], tombstones: [removedId] })

    assertEqual(target.size, 1)
    assertEqual(target.values()[0].__uuidv7, added.__uuidv7)
    assertEqual(events.merge.length, 1)
    assertJsonEqual(events.merge[0].removals, [removedId])
    assertJsonEqual(
      events.merge[0].additions.map((item) => item.__uuidv7),
      [added.__uuidv7]
    )
  })

  await runTest('snapshot returns detached arrays', () => {
    const set = new ORSet()
    set.append({ name: 'alice' })
    const snapshot = readSnapshot(set)
    snapshot.values.push({ __uuidv7: createValidUuid('other'), name: 'other' })
    snapshot.tombstones.push(createValidUuid('ghost'))

    assertEqual(readSnapshot(set).values.length, 1)
    assertEqual(readSnapshot(set).tombstones.length, 0)
  })

  await runTest('tombstones exposes a live set for external gc', () => {
    const set = new ORSet()
    set.append({ name: 'alice' })
    const [removed] = set.values()
    set.remove(removed)

    const tombstones = set.tombstones()

    assert(
      tombstones &&
        typeof tombstones.has === 'function' &&
        typeof tombstones.delete === 'function' &&
        typeof tombstones.values === 'function',
      'expected set-like tomb view'
    )
    assert(
      tombstones.has(removed.__uuidv7),
      'expected removed uuid in tombstone set'
    )

    tombstones.delete(removed.__uuidv7)

    assertEqual(readSnapshot(set).tombstones.length, 0)

    set.append({ __uuidv7: removed.__uuidv7, name: 'alice-again' })

    assertEqual(set.values()[0].__uuidv7, removed.__uuidv7)
  })

  await runTest('listener object and removeEventListener both work', () => {
    const set = new ORSet()
    let objectCalls = 0
    let fnCalls = 0
    const objectListener = {
      handleEvent() {
        objectCalls++
      },
    }
    const fnListener = () => {
      fnCalls++
    }

    set.addEventListener('delta', objectListener)
    set.addEventListener('snapshot', fnListener)
    set.append({ name: 'alice' })
    set.snapshot()
    set.removeEventListener('delta', objectListener)
    set.removeEventListener('snapshot', fnListener)
    set.append({ name: 'bob' })
    set.snapshot()

    assertEqual(objectCalls, 1)
    assertEqual(fnCalls, 1)
  })

  await runTest(
    'replicas converge after append remove and merge roundtrip',
    () => {
      const a = new ORSet()
      const b = new ORSet()
      a.append({ name: 'alice' })
      a.append({ name: 'bob' })
      b.merge(readSnapshot(a))

      const alice = a.values().find((item) => item.name === 'alice')
      a.remove(alice)
      b.merge(readSnapshot(a))
      a.merge(readSnapshot(b))

      assertEqual(a.size, b.size)
      assertJsonEqual(
        sortStrings(readSnapshot(a).values.map((value) => value.__uuidv7)),
        sortStrings(readSnapshot(b).values.map((value) => value.__uuidv7))
      )
      assertJsonEqual(
        sortStrings(readSnapshot(a).tombstones),
        sortStrings(readSnapshot(b).tombstones)
      )
    }
  )

  return results
}

export function printResults(results) {
  const passed = results.tests.filter((test) => test.ok).length
  console.log(`${results.label}: ${passed}/${results.tests.length} passed`)
  if (!results.ok) {
    for (const error of results.errors) {
      console.error(`  - ${error.name}: ${error.message}`)
    }
  }
}

export function ensurePassing(results) {
  if (results.ok) return
  throw new Error(
    `${results.label} failed with ${results.errors.length} failing tests`
  )
}
