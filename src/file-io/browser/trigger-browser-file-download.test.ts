import { describe, expect, it } from 'vitest'
import { sanitiseDownloadFileName } from './trigger-browser-file-download'

describe('sanitiseDownloadFileName', () => {
  it('passes through an already-safe file name', () => {
    expect(sanitiseDownloadFileName('floor-plan-camera-layout.json')).toBe('floor-plan-camera-layout.json')
  })

  it('strips path separators so the name cannot escape the downloads folder', () => {
    expect(sanitiseDownloadFileName('../../etc/passwd')).toBe('.._.._etc_passwd')
    expect(sanitiseDownloadFileName('a\\b/c')).toBe('a_b_c')
  })

  it('strips control characters', () => {
    expect(sanitiseDownloadFileName('plan\x00name\x1f.json')).toBe('plan_name_.json')
  })

  it('falls back to a generic name when nothing usable remains', () => {
    expect(sanitiseDownloadFileName('   ')).toBe('download')
    expect(sanitiseDownloadFileName('')).toBe('download')
  })
})
