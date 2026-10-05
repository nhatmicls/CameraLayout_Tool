import { describe, expect, it } from 'vitest'
import { buildConeClipFunc, computeConeClipFunc } from './wall-occlusion-cone-clip'

/** Records the path calls a clip function makes. */
function recordPath(clip: NonNullable<ReturnType<typeof buildConeClipFunc>>): string[] {
  const calls: string[] = []
  clip({
    moveTo: (x: number, y: number) => void calls.push(`M ${x} ${y}`),
    lineTo: (x: number, y: number) => void calls.push(`L ${x} ${y}`),
    closePath: () => void calls.push('Z'),
  })
  return calls
}

describe('buildConeClipFunc', () => {
  it('returns undefined for null and for fewer than three vertices', () => {
    expect(buildConeClipFunc(null)).toBeUndefined()
    expect(buildConeClipFunc([0, 0, 1, 1])).toBeUndefined()
  })

  it('traces the polygon as one closed path, in order', () => {
    const clip = buildConeClipFunc([0, 0, 10, 0, 10, 5])
    expect(recordPath(clip!)).toEqual(['M 0 0', 'L 10 0', 'L 10 5', 'Z'])
  })
})

describe('computeConeClipFunc', () => {
  const wall = { x1: 150, y1: 50, x2: 150, y2: 150 }

  it('returns undefined with no walls, with nothing drawn, and with every wall out of range', () => {
    expect(computeConeClipFunc(100, 100, { clipRadiusPx: 100, opaqueWalls: [], clearancePx: 0 })).toBeUndefined()
    expect(computeConeClipFunc(100, 100, { clipRadiusPx: 0, opaqueWalls: [wall], clearancePx: 0 })).toBeUndefined()
    expect(computeConeClipFunc(100, 100, { clipRadiusPx: 20, opaqueWalls: [wall], clearancePx: 0 })).toBeUndefined()
  })

  it('returns undefined when the only wall is inside the mounting clearance', () => {
    expect(computeConeClipFunc(148, 100, { clipRadiusPx: 100, opaqueWalls: [wall], clearancePx: 5 })).toBeUndefined()
  })

  it('returns a closed camera-relative path when a wall is in range', () => {
    const clip = computeConeClipFunc(100, 100, { clipRadiusPx: 100, opaqueWalls: [wall], clearancePx: 0 })
    const calls = recordPath(clip!)
    expect(calls[0].startsWith('M ')).toBe(true)
    expect(calls[calls.length - 1]).toBe('Z')
    // The wall is 50 px to the right of the camera: some vertex lies on it, in camera-relative coordinates.
    expect(calls.some((call) => Math.abs(Number(call.split(' ')[1]) - 50) < 1e-6)).toBe(true)
  })
})
