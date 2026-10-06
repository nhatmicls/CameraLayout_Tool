import { describe, expect, it } from 'vitest'
import { parseCommittedNumber } from './committed-number-input-parser'

const price = { min: 0, max: 100_000_000, integer: true, allowEmpty: true }
const waste = { min: 0, max: 50, allowEmpty: false }

describe('parseCommittedNumber', () => {
  it('commits a number inside the range as typed', () => {
    expect(parseCommittedNumber('8000', price)).toEqual({ value: 8000 })
    expect(parseCommittedNumber(' 12.5 ', waste)).toEqual({ value: 12.5 })
  })

  it('clamps into the range', () => {
    expect(parseCommittedNumber('51', waste)).toEqual({ value: 50 })
    expect(parseCommittedNumber('-1', price)).toEqual({ value: 0 })
  })

  it('rounds when integer', () => {
    expect(parseCommittedNumber('1.5', price)).toEqual({ value: 2 })
  })

  it('treats an empty field as null only when allowed', () => {
    expect(parseCommittedNumber('  ', price)).toEqual({ value: null })
    expect(parseCommittedNumber('', waste)).toBeNull()
  })

  it('rejects text that is not a finite number', () => {
    expect(parseCommittedNumber('abc', price)).toBeNull()
    expect(parseCommittedNumber('Infinity', waste)).toBeNull()
    expect(parseCommittedNumber('1e999', waste)).toBeNull()
  })
})
