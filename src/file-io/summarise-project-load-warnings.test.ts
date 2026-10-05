import { describe, expect, it } from 'vitest'
import { WALLS_CROSS_WARNING } from '../domain/project-file-schema'
import { summariseProjectLoadWarnings } from './summarise-project-load-warnings'

describe('summariseProjectLoadWarnings', () => {
  it('joins up to three warnings in full', () => {
    expect(summariseProjectLoadWarnings(['a.', 'b.', 'c.'])).toBe('a. b. c.')
  })

  it('shows the first plus a count beyond three', () => {
    expect(summariseProjectLoadWarnings(['a.', 'b.', 'c.', 'd.'])).toBe('a. (+3 more load warnings)')
  })

  it('shows the crossing warning alone', () => {
    expect(summariseProjectLoadWarnings([WALLS_CROSS_WARNING])).toBe(WALLS_CROSS_WARNING)
  })

  it('never folds the crossing warning into the count', () => {
    const text = summariseProjectLoadWarnings(['a.', 'b.', 'c.', 'd.', WALLS_CROSS_WARNING])
    expect(text).toBe(`a. (+3 more load warnings) ${WALLS_CROSS_WARNING}`)
  })

  it('keeps three drops in full next to the crossing warning', () => {
    expect(summariseProjectLoadWarnings(['a.', 'b.', 'c.', WALLS_CROSS_WARNING])).toBe(`a. b. c. ${WALLS_CROSS_WARNING}`)
  })
})
