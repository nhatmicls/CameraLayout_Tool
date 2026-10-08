import { describe, expect, it } from 'vitest'
import { resolveHubTrunkPathPx } from './hub-trunk-path'
import type { Hub } from './cable-layout-types'

const OWNER: Hub = { id: 'drop-1', kind: 'drop', x: 10, y: 20, mountHeightM: 0, trunk: { hubId: 'hub-1', points: [{ x: 50, y: 20 }] } }
const TARGET: Hub = { id: 'hub-1', x: 100, y: 20, mountHeightM: 1.5 }

describe('resolveHubTrunkPathPx', () => {
  it('returns [owner, ...trunk points, target] in image px', () => {
    expect(resolveHubTrunkPathPx(OWNER, [OWNER, TARGET])).toEqual([
      { x: 10, y: 20 },
      { x: 50, y: 20 },
      { x: 100, y: 20 },
    ])
  })

  it('follows live hub positions (not a stored snapshot)', () => {
    const movedTarget: Hub = { ...TARGET, x: 200 }
    expect(resolveHubTrunkPathPx(OWNER, [OWNER, movedTarget])).toEqual([{ x: 10, y: 20 }, { x: 50, y: 20 }, { x: 200, y: 20 }])
  })

  it('null when the hub has no trunk', () => {
    const noTrunk: Hub = { id: 'hub-2', x: 0, y: 0, mountHeightM: 0 }
    expect(resolveHubTrunkPathPx(noTrunk, [noTrunk, TARGET])).toBeNull()
  })

  it('null when the trunk target no longer exists', () => {
    expect(resolveHubTrunkPathPx(OWNER, [OWNER])).toBeNull()
  })
})
