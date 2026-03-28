import { ORSet } from './dist/index.js'

const set = new ORSet()

const obj = { name: 'jaakko' }

void set.add(obj)

const test = set.has(obj)
console.log(test)

const vals = set.values()
console.log(vals)

for (const val of vals) {
  console.log(val)
}
