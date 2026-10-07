import { describe, expect, it } from 'vitest'
import { wrapTextToWidth } from './wrap-text-to-width'

/** Fake metrics: every character is 10 px wide. */
const measure = (s: string) => s.length * 10

describe('wrapTextToWidth', () => {
  it('keeps a text that fits on one line', () => {
    expect(wrapTextToWidth('Hidden: cables, walls', 500, measure)).toEqual(['Hidden: cables, walls'])
  })

  it('wraps at spaces', () => {
    expect(wrapTextToWidth('Shown: camera markers, FOV cones, walls', 200, measure)).toEqual([
      'Shown: camera',
      'markers, FOV cones,',
      'walls',
    ])
  })

  it('keeps a line that fits exactly and breaks one px later', () => {
    expect(wrapTextToWidth('aaaa bbbb', 90, measure)).toEqual(['aaaa bbbb'])
    expect(wrapTextToWidth('aaaa bbbb', 89, measure)).toEqual(['aaaa', 'bbbb'])
  })

  it('keeps a single over-long word whole on its own line', () => {
    expect(wrapTextToWidth('a verylongwordindeed b', 50, measure)).toEqual(['a', 'verylongwordindeed', 'b'])
  })

  it('returns no lines for an empty or blank text', () => {
    expect(wrapTextToWidth('', 100, measure)).toEqual([])
    expect(wrapTextToWidth('   ', 100, measure)).toEqual([])
  })

  it('every wrapped line fits unless it is a single word', () => {
    const text = 'Shown: camera markers, FOV cones, bullet cameras, turret cameras, PTZ cameras, hubs, walls'
    for (const line of wrapTextToWidth(text, 230, measure)) {
      expect(measure(line) <= 230 || !line.includes(' ')).toBe(true)
    }
  })
})
