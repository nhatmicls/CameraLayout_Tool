import { describe, expect, it } from 'vitest'
import type { Cable, Hub } from './cable-layout-types'
import { migrateSharedShaftExitsToCableLegs } from './shaft-shared-exit-migration'

/** Pre-v9 shapes: a shaft opening could carry a shared exit `trunk`, a cable an `exitFloorId` choice. */
type LegacyCable = Cable & { exitFloorId?: string }

const marker = (id: string, trunk?: Hub['trunk']): Hub => ({ id, kind: 'shaft', shaftId: 's1', x: 0, y: 0, mountHeightM: 0, ...(trunk ? { trunk } : {}) })
const cable = (id: string, hubId: string, exitFloorId?: string): LegacyCable => ({
  id,
  device: { kind: 'camera', id: `cam-${id}` },
  hubId,
  typeId: 't',
  points: [],
  ...(exitFloorId ? { exitFloorId } : {}),
})

const plainHub = (id: string): Hub => ({ id, x: 9, y: 9, mountHeightM: 1.5 })
const TRUNK_F1 = { hubId: 'h1', points: [{ x: 5, y: 5 }] }
const TRUNK_F3 = { hubId: 'h3', points: [] }

describe('migrateSharedShaftExitsToCableLegs', () => {
  it('ONE exit: every cable of the shaft used it implicitly, so each gets its own copy of that route', () => {
    const { floors, convertedCableCount } = migrateSharedShaftExitsToCableLegs([
      { id: 'f1', hubs: [marker('m1', TRUNK_F1), { id: 'h1', x: 9, y: 9, mountHeightM: 1.5 }], cables: [cable('a', 'm1')] },
      { id: 'f2', hubs: [marker('m2')], cables: [cable('b', 'm2'), cable('c', 'm2', 'stale-choice')] },
    ])
    expect(convertedCableCount).toBe(3)
    const leg = { floorId: 'f1', points: [{ x: 5, y: 5 }], hubId: 'h1' }
    expect(floors[0].cables![0].beyondShaft).toEqual(leg) // a cable on the exit floor itself follows it too
    expect(floors[1].cables!.map((migrated) => migrated.beyondShaft)).toEqual([leg, leg])
  })

  it('SEVERAL exits: only a cable that had chosen one is converted; an unchosen / stale one stays not routed', () => {
    const { floors, convertedCableCount, unchosenCableCount } = migrateSharedShaftExitsToCableLegs([
      { id: 'f1', hubs: [marker('m1', TRUNK_F1), plainHub('h1')], cables: [] },
      { id: 'f2', hubs: [marker('m2')], cables: [cable('toF3', 'm2', 'f3'), cable('none', 'm2'), cable('stale', 'm2', 'gone')] },
      { id: 'f3', hubs: [marker('m3', TRUNK_F3), plainHub('h3')], cables: [] },
    ])
    expect(convertedCableCount).toBe(1)
    expect(unchosenCableCount).toBe(2)
    expect(floors[1].cables!.map((migrated) => migrated.beyondShaft)).toEqual([{ floorId: 'f3', points: [], hubId: 'h3' }, undefined, undefined])
  })

  it('a shared route to a missing hub or to a shaft opening never was an exit: skipped, so ONE real exit stays implicit', () => {
    const { floors, convertedCableCount, unchosenCableCount } = migrateSharedShaftExitsToCableLegs([
      { id: 'f1', hubs: [marker('m1', TRUNK_F1), plainHub('h1')], cables: [] },
      { id: 'f2', hubs: [marker('m2', { hubId: 'gone', points: [] })], cables: [cable('a', 'm2')] },
      { id: 'f3', hubs: [marker('m3', { hubId: 'm3', points: [] })], cables: [] },
    ])
    expect(convertedCableCount).toBe(1)
    expect(unchosenCableCount).toBe(0)
    expect(floors[1].cables![0].beyondShaft).toEqual({ floorId: 'f1', points: [{ x: 5, y: 5 }], hubId: 'h1' })
  })

  it('a shaft that never had an exit reports no unchosen cable - "not routed" is simply what it already was', () => {
    expect(migrateSharedShaftExitsToCableLegs([{ id: 'f1', hubs: [marker('m1')], cables: [cable('a', 'm1')] }]).unchosenCableCount).toBe(0)
  })

  it('removes the shared route from every shaft opening and exitFloorId from every cable', () => {
    const { floors } = migrateSharedShaftExitsToCableLegs([
      { id: 'f1', hubs: [marker('m1', TRUNK_F1)], cables: [cable('a', 'm1', 'f1')] },
    ])
    expect(floors[0].hubs).toEqual([marker('m1')])
    expect('trunk' in floors[0].hubs![0]).toBe(false)
    expect('exitFloorId' in floors[0].cables![0]).toBe(false)
  })

  it('leaves a riser / drop trunk, a cable on an ordinary hub and an existing leg alone', () => {
    const riser: Hub = { id: 'r1', kind: 'riser', x: 0, y: 0, mountHeightM: 3, link: { floorId: 'f2', hubId: 'd1' }, trunk: { hubId: 'h1', points: [] } }
    const ownLeg = { floorId: 'f1', points: [{ x: 1, y: 2 }], endDevice: { kind: 'camera' as const, id: 'cam-z' } }
    const { floors, convertedCableCount } = migrateSharedShaftExitsToCableLegs([
      {
        id: 'f1',
        hubs: [marker('m1', TRUNK_F1), riser, { id: 'h1', x: 9, y: 9, mountHeightM: 1.5 }],
        cables: [cable('plain', 'h1', 'f1'), { ...cable('own', 'm1'), beyondShaft: ownLeg }],
      },
    ])
    expect(convertedCableCount).toBe(0)
    expect(floors[0].hubs![1]).toBe(riser)
    expect(floors[0].cables![0]).toEqual(cable('plain', 'h1'))
    expect(floors[0].cables![1].beyondShaft).toBe(ownLeg)
  })

  it('is a no-op on floors without hubs / cables keys, and on a file with no shared exit', () => {
    const { floors, convertedCableCount } = migrateSharedShaftExitsToCableLegs([{ id: 'f1' }, { id: 'f2', hubs: [marker('m2')], cables: [cable('a', 'm2')] }])
    expect(convertedCableCount).toBe(0)
    expect(floors).toEqual([{ id: 'f1' }, { id: 'f2', hubs: [marker('m2')], cables: [cable('a', 'm2')] }])
  })
})
