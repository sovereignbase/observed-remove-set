[![npm version](https://img.shields.io/npm/v/@sovereignbase/observed-remove-set)](https://www.npmjs.com/package/@sovereignbase/observed-remove-set)
[![CI](https://github.com/sovereignbase/observed-remove-set/actions/workflows/ci.yaml/badge.svg?branch=master)](https://github.com/sovereignbase/observed-remove-set/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/sovereignbase/observed-remove-set/branch/master/graph/badge.svg)](https://codecov.io/gh/sovereignbase/observed-remove-set)
[![license](https://img.shields.io/npm/l/@sovereignbase/observed-remove-set)](LICENSE)

# observed-remove-set

UUIDv7-optimized observed-remove set for JavaScript and TypeScript. It gives each value a stable UUIDv7 identity, stores removals as tombstoned identifiers, and exposes local mutation, merge, and snapshot flows through events.

This package is best suited to membership state and static metadata where values are appended or removed as whole units. For the model itself and a possible tombstone garbage-collection strategy, see the specification at https://sovereignbase.github.io/observed-remove-set/.

## Compatibility

- Runtimes: Node >= 20; Browsers: modern browsers with `EventTarget` and `CustomEvent`; Workers/Edge: tested in Bun, Deno, Cloudflare Workers, and Edge Runtime.
- Module format: ESM and CJS.
- Required globals / APIs: `EventTarget`, `CustomEvent`.
- TypeScript: bundled types.

## Goals

- Small UUIDv7-based OR-Set for membership and static metadata replication.
- Deterministic event channels: `delta` for local mutations, `merge` for accepted ingress changes, `snapshot` only when explicitly requested.
- Compact tombstone representation based on identifiers instead of whole value payloads.
- Runtime-agnostic behavior across Node, browsers, and edge-like runtimes.
- Explicit fatal errors only for malformed top-level snapshots.

## Installation

```sh
npm install @sovereignbase/observed-remove-set
# or
pnpm add @sovereignbase/observed-remove-set
# or
yarn add @sovereignbase/observed-remove-set
# or
bun add @sovereignbase/observed-remove-set
# or
deno add jsr:@sovereignbase/observed-remove-set
# or
vlt install jsr:@sovereignbase/observed-remove-set
```

## Usage

Use the `snapshot` event when you want the full current replica state, the
`delta` event when you want to forward locally produced changes, and the
`merge` event when you want to react to accepted ingress changes.

### Persist or export the current replica state

```ts
import { ORSet } from '@sovereignbase/observed-remove-set'

const set = new ORSet<{ role: string }>()

set.addEventListener('snapshot', (event) => {
  localStorage.setItem('members', JSON.stringify(event.detail))
})

set.append({ role: 'admin' })
set.snapshot()
```

### Forward local mutations upstream

```ts
import { ORSet } from '@sovereignbase/observed-remove-set'

const set = new ORSet<{ role: string }>()

set.addEventListener('delta', (event) => {
  upstream.broadcast(JSON.stringify(event.detail))
})

set.append({ role: 'admin' })
const [admin] = set.values()
set.remove(admin)
```

### Apply ingress and react to accepted changes

```ts
import { ORSet } from '@sovereignbase/observed-remove-set'

const set = new ORSet<{ name: string }>()

set.addEventListener('merge', (event) => {
  for (const value of event.detail.additions) {
    console.log('added', value)
  }

  for (const tombstone of event.detail.removals) {
    console.log('removed', tombstone)
  }
})

upstream.onmessage = (snapshot) => {
  set.merge(snapshot)
}
```

### Tombstone inspection for application-level GC

```ts
import { ORSet } from '@sovereignbase/observed-remove-set'

const set = new ORSet<{ name: string }>()
set.append({ name: 'alice' })
const [alice] = set.values()
set.remove(alice)

const tombstones = set.tombstones()

for (const tombstone of tombstones) {
  console.log(tombstone)
}
```

## Runtime behavior

### Validation & errors

- `new ORSet(snapshot)` and `merge(snapshot)` throw `ORSetError` with code `BAD_SNAPSHOT` when the top-level snapshot shape is malformed.
- Invalid individual UUIDs inside an otherwise well-formed snapshot are filtered out instead of crashing the replica.

### Event model

- `append()`, `clear()`, and `remove()` returns void and dispatch only `delta`.
- `merge()` returns void dispatches only `merge`.
- `snapshot()` returns `void` and dispatches only `snapshot`.
- No-op operations do not dispatch events.

### Value semantics

- Accepted values are shallow-frozen as a low-cost hint that they are not intended to be mutated in place.
- Nested object mutation is not CRDT-managed.
- This package is for append/remove membership semantics, not field-level conflict-free updates inside nested value payloads.

## Tests

- Suite: unit + integration (Node), E2E across runtime-specific harnesses and browsers.
- Runtime matrix: Node ESM/CJS, Bun ESM/CJS, Deno, Cloudflare Workers, Edge Runtime, Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari.
- Coverage: `c8` — 100% statements / branches / functions / lines.
- Status: currently passes across the full matrix above.

## Benchmarks

How it was run: `npm run bench`  
Environment: Node v22.14.0 (win32 x64)

| Benchmark                | Result                     |
| ------------------------ | -------------------------- |
| constructor hydrate x512 | 3,369 ops/s (296.8 ms)     |
| has live                 | 16,615,298 ops/s (12.0 ms) |
| values x512              | 4,621 ops/s (1082.1 ms)    |
| snapshot x512            | 5,024 ops/s (995.1 ms)     |
| append fresh             | 143,698 ops/s (348.0 ms)   |
| remove live              | 231,874 ops/s (215.6 ms)   |
| clear x512               | 1,937 ops/s (1032.6 ms)    |
| merge add x512           | 3,747 ops/s (333.6 ms)     |
| merge mixed x512         | 1,441 ops/s (520.6 ms)     |
| replica roundtrip x256   | 1,587 ops/s (945.3 ms)     |

Results vary by machine.

## License

Apache-2.0
