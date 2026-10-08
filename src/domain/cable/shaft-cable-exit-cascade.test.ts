import { describe, expect, it } from 'vitest'
import { clearStaleExitChoices, stampImplicitExitChoices, summariseShaftCables } from './shaft-cable-exit-cascade'
import { SHAFT_ID, SHAFT_MARKER_F1, SHAFT_MARKER_F3, shaftCable, shaftFourFloorProject } from './shaft-worked-example.test-fixtures'

describe('stampImplicitExitChoices', () => {
  it('stamps every choiceless cable of the shaft with the given (previously sole) exit floor', () => {
    const { floors } = shaftFourFloorProject([
      {},
      { cables: [shaftCable('c1', 'sm2'), shaftCable('c2', 'sm2', 'sf2')] }, // c2 already has a choice
      {},
      { cables: [shaftCable('c3', 'sm4')] },
    ])
    const next = stampImplicitExitChoices(floors, SHAFT_ID, 'sf0')
    const cablesById = new Map(next.flatMap((f) => f.cables).map((c) => [c.id, c] as const))
    expect(cablesById.get('c1')?.exitFloorId).toBe('sf0') // stamped
    expect(cablesById.get('c2')?.exitFloorId).toBe('sf2') // untouched - already had a choice
    expect(cablesById.get('c3')?.exitFloorId).toBe('sf0') // stamped, different floor than c1
  })

  it('returns the SAME floors reference when nothing needed stamping', () => {
    const { floors } = shaftFourFloorProject()
    expect(stampImplicitExitChoices(floors, SHAFT_ID, 'sf0')).toBe(floors)
  })

  it('never touches a cable on a different hub', () => {
    const { floors } = shaftFourFloorProject([{}, { cables: [{ id: 'plain-cable', device: { kind: 'camera', id: 'cam-x' }, hubId: 'not-a-shaft-marker', typeId: 'cat6-utp', points: [] }] }])
    expect(stampImplicitExitChoices(floors, SHAFT_ID, 'sf0')).toBe(floors)
  })
})

describe('clearStaleExitChoices', () => {
  it('clears a choice naming a floor that is no longer an exit, keeps a still-valid one', () => {
    const { floors } = shaftFourFloorProject([
      {},
      { cables: [shaftCable('c1', 'sm2', 'sf0'), shaftCable('c2', 'sm2', 'sf2')] },
    ])
    // Remove F3's exit (sm3's trunk) - sf0 (F1) stays a valid exit, sf2 (F3) no longer is.
    const withoutF3Exit = floors.map((f, i) => (i === 2 ? { ...f, hubs: f.hubs.map((h) => (h.id === 'sm3' ? { ...h, trunk: undefined } : h)) } : f))
    const warnings: string[] = []
    const next = clearStaleExitChoices(withoutF3Exit, warnings)
    const cablesById = new Map(next.flatMap((f) => f.cables).map((c) => [c.id, c] as const))
    expect(cablesById.get('c1')?.exitFloorId).toBe('sf0') // still valid
    expect(cablesById.get('c2')?.exitFloorId).toBeUndefined() // cleared
    expect(warnings).toHaveLength(1)
  })

  it('clears a choice on a cable that no longer ends on a shaft marker at all (hub deleted/retyped)', () => {
    const { floors } = shaftFourFloorProject([{}, { cables: [shaftCable('c1', 'sm2', 'sf0')], hubs: [] }])
    const next = clearStaleExitChoices(floors)
    expect(next[1].cables[0].exitFloorId).toBeUndefined()
  })

  it('returns the SAME floors reference when nothing needed clearing', () => {
    const { floors } = shaftFourFloorProject([{}, { cables: [shaftCable('c1', 'sm2', 'sf0')] }])
    expect(clearStaleExitChoices(floors)).toBe(floors)
  })
})

describe('summariseShaftCables', () => {
  it('counts cables in, per exit, and unchosen - "10 in / 6 at F1 / 4 at F3 / 0 unaccounted" shape', () => {
    const sixToF1 = Array.from({ length: 6 }, (_, i) => shaftCable(`a${i}`, 'sm2', 'sf0'))
    const fourToF3 = Array.from({ length: 4 }, (_, i) => shaftCable(`b${i}`, 'sm4', 'sf2'))
    const { floors, shafts } = shaftFourFloorProject([{}, { cables: sixToF1 }, {}, { cables: fourToF3 }])
    const summary = summariseShaftCables(floors, shafts.map((s) => s.id), SHAFT_ID)
    expect(summary.cablesIn).toBe(10)
    expect(summary.perExit.find((e) => e.floorId === 'sf0')?.count).toBe(6)
    expect(summary.perExit.find((e) => e.floorId === 'sf2')?.count).toBe(4)
    expect(summary.notChosen).toBe(0)
  })

  it('an unassigned cable among several exits is counted as notChosen, never in a perExit bucket', () => {
    const { floors, shafts } = shaftFourFloorProject([{}, { cables: [shaftCable('unassigned', 'sm2')] }])
    const summary = summariseShaftCables(floors, shafts.map((s) => s.id), SHAFT_ID)
    expect(summary.cablesIn).toBe(1)
    expect(summary.notChosen).toBe(1)
    expect(summary.perExit.every((e) => e.count === 0)).toBe(true)
  })

  it('with exactly one exit every cable counts there implicitly, never notChosen', () => {
    const { floors, shafts } = shaftFourFloorProject([
      {},
      { cables: [shaftCable('c1', 'sm2')] },
      { hubs: [{ ...SHAFT_MARKER_F3, trunk: undefined }] }, // only F1 is an exit now
    ])
    const summary = summariseShaftCables(floors, shafts.map((s) => s.id), SHAFT_ID)
    expect(summary.perExit).toHaveLength(1)
    expect(summary.perExit[0].count).toBe(1)
    expect(summary.notChosen).toBe(0)
  })

  it('with NO exit, cables are counted in but not in any bucket (typed fallback, not "unaccounted")', () => {
    const { floors, shafts } = shaftFourFloorProject([
      { hubs: [{ ...SHAFT_MARKER_F1, trunk: undefined }] },
      { cables: [shaftCable('c1', 'sm2')] },
      { hubs: [{ ...SHAFT_MARKER_F3, trunk: undefined }] },
    ])
    const summary = summariseShaftCables(floors, shafts.map((s) => s.id), SHAFT_ID)
    expect(summary.cablesIn).toBe(1)
    expect(summary.perExit).toHaveLength(0)
    expect(summary.notChosen).toBe(0)
  })
})
