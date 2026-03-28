import type { ORSetEntry } from '../../.types/index.js'
export function validateORSetSnapshot<T>(ingress: T): boolean {
  const { items, tombs } = ingress as {
    items: Array<ORSetEntry<T>>
    tombs: Array<string>
  }
  return items && Array.isArray(items) && tombs && Array.isArray(tombs)
}
