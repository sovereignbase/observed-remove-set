export type ObjectType =
  | 'record'
  | 'array'
  | 'map'
  | 'set'
  | 'weakmap'
  | 'weakset'
  | 'date'
  | 'regexp'
  | 'error'
  | 'promise'
  | 'arraybuffer'
  | 'sharedarraybuffer'
  | 'dataview'
  | 'int8array'
  | 'uint8array'
  | 'uint8clampedarray'
  | 'int16array'
  | 'uint16array'
  | 'int32array'
  | 'uint32array'
  | 'float32array'
  | 'float64array'
  | 'bigint64array'
  | 'biguint64array'

export function getObjectType(object: object): ObjectType {
  const type = Object.prototype.toString.call(object).slice(8, -1).toLowerCase()
  return type === 'object' ? 'record' : (type as ObjectType)
}
