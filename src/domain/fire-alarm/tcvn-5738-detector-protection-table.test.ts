import { describe, expect, it } from 'vitest'
import {
  CEILING_HEIGHT_MAX_M,
  HEAT_DETECTOR_ROWS,
  SMOKE_DETECTOR_ROWS,
  TCVN_5738_CITATIONS,
  TCVN_5738_EDITION,
  TCVN_5738_ROWS,
  isTcvn5738TableAvailable,
  lookupTcvn5738Row,
} from './tcvn-5738-detector-protection-table'

describe('table shape', () => {
  it('is strictly increasing in maxCeilingHeightM for both tables', () => {
    for (const rows of [SMOKE_DETECTOR_ROWS, HEAT_DETECTOR_ROWS]) {
      for (let i = 1; i < rows.length; i++) expect(rows[i].maxCeilingHeightM).toBeGreaterThan(rows[i - 1].maxCeilingHeightM)
    }
  })

  it('has no co-detector row (the standard prints no CO table)', () => {
    expect(TCVN_5738_ROWS['co-detector']).toBeUndefined()
  })

  it('CEILING_HEIGHT_MAX_M is the largest maxCeilingHeightM in the whole table (12, from the smoke table)', () => {
    expect(CEILING_HEIGHT_MAX_M).toBe(12)
  })

  it('names the edition', () => {
    expect(TCVN_5738_EDITION).toBe('TCVN 5738:2021')
  })

  it('cites clause + table for smoke and heat, nothing for co', () => {
    expect(TCVN_5738_CITATIONS['smoke-detector']).toEqual({ clause: '6.13', table: 'Bảng 1' })
    expect(TCVN_5738_CITATIONS['heat-detector']).toEqual({ clause: '6.15.1', table: 'Bảng 2' })
    expect(TCVN_5738_CITATIONS['co-detector']).toBeUndefined()
  })
})

describe('isTcvn5738TableAvailable', () => {
  it('is true (G3 is a go: both tables are populated)', () => {
    expect(isTcvn5738TableAvailable()).toBe(true)
  })
})

describe('lookupTcvn5738Row', () => {
  it('returns no-table for co-detector (no printed table at all)', () => {
    expect(lookupTcvn5738Row('co-detector', 3)).toBe('no-table')
  })

  it('is inclusive at the top of a band: exactly 3.5 m is still the first smoke row', () => {
    expect(lookupTcvn5738Row('smoke-detector', 3.5)).toEqual(SMOKE_DETECTOR_ROWS[0])
  })

  it('just above a band boundary falls into the next row', () => {
    expect(lookupTcvn5738Row('smoke-detector', 3.51)).toEqual(SMOKE_DETECTOR_ROWS[1])
  })

  it('resolves a height strictly inside a band', () => {
    expect(lookupTcvn5738Row('heat-detector', 7)).toEqual(HEAT_DETECTOR_ROWS[2])
  })

  it('returns above-table past the last band', () => {
    expect(lookupTcvn5738Row('smoke-detector', 12.01)).toBe('above-table')
    expect(lookupTcvn5738Row('heat-detector', 9.01)).toBe('above-table')
  })

  it('the last smoke row is exactly at CEILING_HEIGHT_MAX_M', () => {
    expect(lookupTcvn5738Row('smoke-detector', CEILING_HEIGHT_MAX_M)).toEqual(SMOKE_DETECTOR_ROWS[SMOKE_DETECTOR_ROWS.length - 1])
  })
})
