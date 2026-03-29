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
    assertJsonEqual(set.snapshot(), { items: [], tombs: [] })
  })

  await runTest('constructor rejects malformed snapshot', () => {
    assertThrows(() => new ORSet(null), assertBadSnapshotError)
  })

  await runTest(
    'constructor filters invalid tombs duplicate ids and tombed items',
    () => {
      const liveId = createValidUuid('live')
      const removedId = createValidUuid('removed')
      const set = new ORSet({
        items: [
          { __uuidv7: liveId, name: 'first' },
          { __uuidv7: liveId, name: 'second' },
          { __uuidv7: removedId, name: 'removed' },
          { __uuidv7: 'bad', name: 'invalid' },
        ],
        tombs: ['bad', removedId],
      })

      assertEqual(set.size, 1)
      assertJsonEqual(
        set.values().map((item) => item.name),
        ['first']
      )
      assertJsonEqual(set.snapshot().tombs, [removedId])
    }
  )

  await runTest('has reflects live membership', () => {
    const set = new ORSet()
    set.append({ name: 'alice' })
    const [live] = set.values()
    assertEqual(set.has(live), true)
    assertEqual(
      set.has({ __uuidv7: createValidUuid('missing'), name: 'missing' }),
      false
    )
  })

  await runTest('append generates uuid freezes entry and emits events', () => {
    const set = new ORSet()
    const events = captureEvents(set)
    set.append({ name: 'alice' })
    const [stored] = set.values()

    assertEqual(set.size, 1)
    assertEqual(typeof stored.__uuidv7, 'string')
    assertEqual(Object.isFrozen(stored), true)
    assertEqual(events.delta.length, 1)
    assertEqual(events.snapshot.length, 1)
    assertEqual(events.delta[0].items[0].__uuidv7, stored.__uuidv7)
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

  await runTest('clear removes every live item', () => {
    const set = new ORSet()
    set.append({ name: 'alice' })
    set.append({ name: 'bob' })
    const liveIds = set.values().map((item) => item.__uuidv7)
    const events = captureEvents(set)
    set.clear()

    assertEqual(set.size, 0)
    assertJsonEqual(sortStrings(set.snapshot().tombs), sortStrings(liveIds))
    assertEqual(events.delta.length, 1)
    assertEqual(events.snapshot.length, 1)
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

  await runTest('remove tombstones a live item once', () => {
    const set = new ORSet()
    set.append({ name: 'alice' })
    const [live] = set.values()
    const events = captureEvents(set)
    set.remove(live)
    set.remove(live)

    assertEqual(set.size, 0)
    assertJsonEqual(set.snapshot().tombs, [live.__uuidv7])
    assertEqual(events.delta.length, 1)
    assertEqual(events.snapshot.length, 1)
  })

  await runTest(
    'remove records a causal tomb for an unknown valid uuid',
    () => {
      const set = new ORSet()
      const ghostId = createValidUuid('ghost')
      const events = captureEvents(set)
      set.remove({ __uuidv7: ghostId, name: 'ghost' })

      assertJsonEqual(set.snapshot().tombs, [ghostId])
      assertEqual(events.delta.length, 1)
      assertEqual(events.snapshot.length, 1)
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
    target.merge(source.snapshot())

    assertEqual(target.size, 1)
    assertEqual(target.values()[0].__uuidv7, live.__uuidv7)
    assertEqual(events.merge.length, 1)
    assertEqual(events.snapshot.length, 1)
  })

  await runTest('merge applies tomb removals', () => {
    const removedId = createValidUuid('removed')
    const target = new ORSet({
      items: [{ __uuidv7: removedId, name: 'removed' }],
      tombs: [],
    })
    const events = captureEvents(target)
    target.merge({ items: [], tombs: [removedId] })

    assertEqual(target.size, 0)
    assertJsonEqual(target.snapshot().tombs, [removedId])
    assertEqual(events.merge.length, 1)
  })

  await runTest('merge skips invalid data and stays silent on no-op', () => {
    const target = new ORSet()
    const knownTomb = createValidUuid('known')
    target.merge({ items: [], tombs: [knownTomb] })
    const events = captureEvents(target)
    target.merge({
      items: [{ __uuidv7: 'bad', name: 'invalid' }],
      tombs: ['bad', knownTomb],
    })

    assertEqual(events.merge.length, 0)
    assertEqual(events.snapshot.length, 0)
  })

  await runTest('merge does not resurrect tombstoned uuid', () => {
    const tombedId = createValidUuid('tombed')
    const target = new ORSet({ items: [], tombs: [tombedId] })
    const events = captureEvents(target)
    target.merge({
      items: [{ __uuidv7: tombedId, name: 'zombie' }],
      tombs: [],
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
      items: [{ __uuidv7: removedId, name: 'removed' }],
      tombs: [],
    })
    const events = captureEvents(target)
    target.merge({ items: [added], tombs: [removedId] })

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
    const snapshot = set.snapshot()
    snapshot.items.push({ __uuidv7: createValidUuid('other'), name: 'other' })
    snapshot.tombs.push(createValidUuid('ghost'))

    assertEqual(set.snapshot().items.length, 1)
    assertEqual(set.snapshot().tombs.length, 0)
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
    set.removeEventListener('delta', objectListener)
    set.removeEventListener('snapshot', fnListener)
    set.append({ name: 'bob' })

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
      b.merge(a.snapshot())

      const alice = a.values().find((item) => item.name === 'alice')
      a.remove(alice)
      b.merge(a.snapshot())
      a.merge(b.snapshot())

      assertEqual(a.size, b.size)
      assertJsonEqual(
        sortStrings(a.snapshot().items.map((item) => item.__uuidv7)),
        sortStrings(b.snapshot().items.map((item) => item.__uuidv7))
      )
      assertJsonEqual(
        sortStrings(a.snapshot().tombs),
        sortStrings(b.snapshot().tombs)
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
