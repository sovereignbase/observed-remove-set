import { version as uuidVersion } from 'uuid'

/** Returns whether a value is a syntactically valid UUID version 7 string. */
export function isUuidV7(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    return uuidVersion(value) === 7
  } catch {
    return false
  }
}
