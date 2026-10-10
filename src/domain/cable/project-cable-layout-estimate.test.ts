import { describe, expect, it } from 'vitest'
import { computeProjectCableEstimate } from './project-cable-layout-estimate'
import { threeFloorChainProject, twoFloorLinkedProject } from './cross-floor-worked-example.test-fixtures'
import { shaftCable, shaftFourFloorProject } from './shaft-worked-example.test-fixtures'

describe('computeProjectCableEstimate', () => {
  it('byFloorId holds every floor\'s own estimate, cross-floor contributions resolved', () => {
    const project = twoFloorLinkedProject()
    const result = computeProjectCableEstimate(project)
    expect(result.byFloorId.size).toBe(2)
    const floor0 = result.byFloorId.get('floor-0')!
    expect(floor0.cables).toHaveLength(1)
    expect(floor0.cables[0].run.nominal).toBeCloseTo(28.5, 6)
    expect(result.byFloorId.get('floor-1')!.cables).toEqual([]) // floor 1 has no cables of its own
  })

  it('totals read the cable\'s own end-to-end label, both floors, never re-prefixed', () => {
    const project = twoFloorLinkedProject()
    const result = computeProjectCableEstimate(project)
    expect(result.totals).toHaveLength(1)
    const [total] = result.totals
    expect(total.type.id).toBe('cat6-utp')
    expect(total.cableCount).toBe(1)
    expect(total.labels).toEqual(['F1_C1_F2_H1']) // reaches the plain hub on floor 2 (index 1)
    expect(total.run.nominal).toBeCloseTo(28.5, 6)
    expect(total.purchaseWholeM).toBe(Math.ceil(28.5 * 1.15))
  })

  it('a single-floor project still carries F1_ on both ends; a typed (unlinked) riser is an open end', () => {
    const project = twoFloorLinkedProject()
    const singleFloor = { ...project, floors: [project.floors[0]] }
    const result = computeProjectCableEstimate(singleFloor)
    // floor-0's own riser is now unlinked (its partner floor is gone) - a typed riser is an open
    // end, never guessed - but the start still carries its floor like every other label.
    expect(result.totals[0]?.labels).toEqual(['F1_C1_?'])
  })

  it('floorsWithoutScale lists every floor with no scale, in floor order', () => {
    const project = twoFloorLinkedProject({ floor1: { scale: null } })
    expect(computeProjectCableEstimate(project).floorsWithoutScale).toEqual([{ id: 'floor-1', name: 'Floor 2' }])
  })

  it('warnings concatenate every floor\'s own warnings, in floor order', () => {
    const project = twoFloorLinkedProject({ floor1: { scale: null } })
    const result = computeProjectCableEstimate(project)
    expect(result.warnings.map((w) => w.code)).toEqual(['linked-floor-scale-not-set'])
  })

  it('grandPurchase/grandTotalVnd/unpricedTypeCount mirror the single-floor estimate shape, summed', () => {
    const project = twoFloorLinkedProject()
    const priced = { ...project, cableTypes: project.cableTypes.map((t) => (t.id === 'cat6-utp' ? { ...t, pricePerMeterVnd: 10000 } : t)) }
    const result = computeProjectCableEstimate(priced)
    expect(result.grandPurchase).toEqual(result.totals[0].purchase)
    expect(result.grandTotalVnd).toBe(result.totals[0].purchaseWholeM * 10000)
    expect(result.unpricedTypeCount).toBe(0)
  })

  it('a three-floor chain resolves correctly through the project-wide call', () => {
    const result = computeProjectCableEstimate(threeFloorChainProject())
    expect(result.byFloorId.get('floor-0')!.cables[0].run.nominal).toBeCloseTo(40.5, 6)
  })

  it('an empty project (no cables anywhere) has no totals and no warnings', () => {
    const project = twoFloorLinkedProject({ floor0: { cables: [] } })
    const result = computeProjectCableEstimate(project)
    expect(result.totals).toEqual([])
    expect(result.grandPurchase).toBeNull()
    expect(result.warnings).toEqual([])
  })
})

describe('computeProjectCableEstimate - end-to-end labels', () => {
  it('project totals labels deep-equal the per-floor labels concatenated, never double floor-prefixed', () => {
    const project = threeFloorChainProject()
    const result = computeProjectCableEstimate(project)
    const perFloorLabels = project.floors.flatMap((floor) => result.byFloorId.get(floor.id)!.totals.flatMap((total) => total.labels))
    expect(result.totals[0].labels).toEqual(perFloorLabels)
    for (const label of result.totals[0].labels) expect(label).not.toMatch(/^F\d+_F\d+_/)
  })

  it('a one-floor project reaching a plain hub reads F1_C1_F1_H1 (not an open end)', () => {
    const project = twoFloorLinkedProject()
    const singleFloor = { ...project, floors: [{ ...project.floors[0], hubs: [{ id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }], cables: [{ ...project.floors[0].cables[0], hubId: 'h1' }] }] }
    const result = computeProjectCableEstimate(singleFloor)
    expect(result.totals[0]?.labels).toEqual(['F1_C1_F1_H1'])
  })

  it('the "linked floor has no scale" warning message starts with the cable\'s own end-to-end label', () => {
    const project = twoFloorLinkedProject({ floor1: { scale: null } })
    const result = computeProjectCableEstimate(project)
    const warning = result.warnings.find((w) => w.code === 'linked-floor-scale-not-set')
    expect(warning?.message.startsWith('F1_C1_F2_H1:')).toBe(true)
  })

  it('the "not routed beyond its shaft" notice starts with the cable\'s own end-to-end label', () => {
    const cam1 = { id: 'cam-c1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 10 }
    const project = shaftFourFloorProject([{}, { cameras: [cam1], cables: [shaftCable('c1', 'sm2')] }])
    const result = computeProjectCableEstimate(project)
    const notice = result.warnings.find((w) => w.code === 'shaft-cable-not-routed')
    expect(notice?.message.startsWith('F2_C1_?:')).toBe(true)
  })
})

describe('computeProjectCableEstimate - item 5 perf: single-slot memo', () => {
  it('returns the SAME result object for the SAME (floors, shafts, cableTypes, cableSettings) references - no behaviour change, just no recompute', () => {
    const project = twoFloorLinkedProject()
    const first = computeProjectCableEstimate(project)
    const second = computeProjectCableEstimate(project) // identical references throughout
    expect(second).toBe(first)
    expect(second.byFloorId).toBe(first.byFloorId)
  })

  it('recomputes when `floors` is a different reference, even if structurally equal', () => {
    const project = twoFloorLinkedProject()
    const first = computeProjectCableEstimate(project)
    const second = computeProjectCableEstimate({ ...project, floors: [...project.floors] }) // new array, same floor objects
    expect(second).not.toBe(first)
    expect(second).toEqual(first) // same content though
  })

  it('does NOT key on fireAlarmSettings: changing it alone still hits the cache', () => {
    const project = twoFloorLinkedProject()
    const first = computeProjectCableEstimate(project)
    const second = computeProjectCableEstimate({ ...project, fireAlarmSettings: { ...project.fireAlarmSettings, ceilingHeightM: 999 } })
    expect(second).toBe(first)
  })

  it('a genuinely different project (fresh floors array) after a cached call recomputes correctly, not a stale value', () => {
    const projectA = twoFloorLinkedProject()
    computeProjectCableEstimate(projectA) // warms the single cache slot with A (floorHeightM 3 -> run 28.5, see other describe block)
    const projectB = twoFloorLinkedProject({ floor0: { floorHeightM: 10 } })
    const resultB = computeProjectCableEstimate(projectB)
    // crossing 10 (was 3) + floor-2 route 10 + plain-hub-2 typed 1.5 = 21.5 beyond; run = 10 + 0.5 + 3.5 + 21.5 = 35.5
    expect(resultB.byFloorId.get('floor-0')!.cables[0].run.nominal).toBeCloseTo(35.5, 6)
  })
})
