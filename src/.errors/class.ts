export type ORSetErrorCode = 'BAD_SNAPSHOT'

export class ORSetError extends Error {
  readonly code: ORSetErrorCode

  constructor(code: ORSetErrorCode, message?: string) {
    const detail = message ?? code
    super(`{@sovereignbase/observed-remove-set} ${detail}`)
    this.code = code
    this.name = 'ORSetError'
  }
}
