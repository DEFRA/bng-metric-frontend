import { currentEpoch, deriveKey } from './derive-key.js'

describe('#currentEpoch', () => {
  test('Should floor unix-seconds / period', () => {
    expect(currentEpoch(3600, 3600 * 1000)).toBe(1)
    expect(currentEpoch(3600, 3600 * 1000 - 1)).toBe(0)
    expect(currentEpoch(3600, 3600 * 7 * 1000 + 1)).toBe(7)
  })
})

describe('#deriveKey', () => {
  test('Should produce a 32-byte key', () => {
    const key = deriveKey('root-secret', 42)
    expect(key.length).toBe(32)
  })

  test('Should be deterministic for the same root + epoch', () => {
    const a = deriveKey('root-secret', 42)
    const b = deriveKey('root-secret', 42)
    expect(a.equals(b)).toBe(true)
  })

  test('Should differ when the epoch changes', () => {
    const a = deriveKey('root-secret', 42)
    const b = deriveKey('root-secret', 43)
    expect(a.equals(b)).toBe(false)
  })
})
