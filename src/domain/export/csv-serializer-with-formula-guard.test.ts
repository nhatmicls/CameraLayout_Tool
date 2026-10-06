import { describe, expect, it } from 'vitest'
import { serializeCsv } from './csv-serializer-with-formula-guard'

describe('serializeCsv', () => {
  it('starts with a UTF-8 BOM', () => {
    const csv = serializeCsv([['a', 'b']])
    expect(csv.codePointAt(0)).toBe(0xfeff)
  })

  it('uses CRLF line endings, including a trailing one', () => {
    const csv = serializeCsv([
      ['a', 'b'],
      ['c', 'd'],
    ])
    const body = csv.slice(1) // drop BOM
    expect(body).toBe('a,b\r\nc,d\r\n')
  })

  it('escapes embedded quotes by doubling them and wraps the cell in quotes', () => {
    const csv = serializeCsv([['say "hi"']])
    expect(csv.slice(1)).toBe('"say ""hi"""\r\n')
  })

  it('wraps a cell containing a comma in quotes', () => {
    const csv = serializeCsv([['C1, C3']])
    expect(csv.slice(1)).toBe('"C1, C3"\r\n')
  })

  it('wraps a cell containing an embedded newline in quotes', () => {
    const csv = serializeCsv([['line1\nline2']])
    expect(csv.slice(1)).toBe('"line1\nline2"\r\n')
  })

  it('neutralises every formula-trigger leading character with a leading apostrophe', () => {
    const triggers = ['=1+1', '+1', '-1', '@SUM(A1)']
    for (const cell of triggers) {
      const body = serializeCsv([[cell]]).slice(1)
      expect(body).toBe(`'${cell}\r\n`)
    }
  })

  it('neutralises a leading tab (not RFC-4180 special, so no quoting needed)', () => {
    expect(serializeCsv([['\ttab-start']]).slice(1)).toBe("'\ttab-start\r\n")
  })

  it('neutralises a leading carriage return (which also forces RFC-4180 quoting)', () => {
    expect(serializeCsv([['\rcr-start']]).slice(1)).toBe('"\'\rcr-start"\r\n')
  })

  it('leaves a plain model name starting with a letter untouched', () => {
    const csv = serializeCsv([['DS-2CD2143G2-I']])
    expect(csv.slice(1)).toBe('DS-2CD2143G2-I\r\n')
  })

  it('returns just the BOM plus a trailing CRLF for an empty table', () => {
    const csv = serializeCsv([])
    expect(csv.codePointAt(0)).toBe(0xfeff)
    expect(csv.slice(1)).toBe('\r\n')
  })
})
