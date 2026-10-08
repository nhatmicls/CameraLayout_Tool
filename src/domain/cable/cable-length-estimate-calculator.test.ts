import { describe, expect, it } from 'vitest'
import { buildCableEndpointIndex } from './cable-endpoint-index'
import { DEFAULT_CABLE_SETTINGS, type Cable, type CableSettings, type CableType, type Hub } from './cable-layout-types'
import { resolveHubBeyondLength } from './cross-floor-hub-beyond-length-resolver'
import { CROSS_FLOOR_CABLE, CROSS_FLOOR_CAMERA, RISER_1, twoFloorLinkedProject } from './cross-floor-worked-example.test-fixtures'
import { computeScaleUncertainty, estimateCableLength, polylineLengthPx } from './cable-length-estimate-calculator'
import { CABLE_A, CABLE_B, CAMERA_C1, CAMERA_C2, HUB_H1, SCALE_100_PX_PER_M } from './cable-worked-example.test-fixtures'

const CAT6: CableType = { id: 'cat6-utp', name: 'Cat6 UTP', lengthLimitM: 90, pricePerMeterVnd: null }
const index = buildCableEndpointIndex([CAMERA_C1, CAMERA_C2], [], [HUB_H1])
const uncertainty = computeScaleUncertainty(SCALE_100_PX_PER_M, 3)

function estimate(cable: Cable, overrides: { type?: CableType; settings?: Partial<CableSettings>; clickErrorPx?: number } = {}) {
  const settings = { ...DEFAULT_CABLE_SETTINGS, ...overrides.settings }
  const result = estimateCableLength({
    cable,
    index,
    type: overrides.type ?? CAT6,
    settings,
    planPxPerMeter: 100,
    uncertainty: computeScaleUncertainty(SCALE_100_PX_PER_M, overrides.clickErrorPx ?? settings.clickErrorPx),
  })
  if (!result) throw new Error('expected an estimate')
  return result
}

/** A C1 -> H1 cable whose single vertex, on the perpendicular bisector of the two ends, makes the route exactly `horizPx` long. */
function cableOfHorizPx(horizPx: number): Cable {
  const half = horizPx / 2
  const mid = { x: 400, y: 300 }
  const halfChord = Math.hypot(700 - 100, 500 - 100) / 2
  const offset = Math.sqrt(half * half - halfChord * halfChord)
  const nx = -(500 - 100) / (2 * halfChord)
  const ny = (700 - 100) / (2 * halfChord)
  return { ...CABLE_A, points: [{ x: mid.x + nx * offset, y: mid.y + ny * offset }] }
}

describe('computeScaleUncertainty', () => {
  it('matches the worked example', () => {
    expect(uncertainty.refLengthPx).toBe(400)
    expect(uncertainty.relativeError).toBeCloseTo(0.015, 6)
    expect(uncertainty.minFactor).toBeCloseTo(0.985222, 4)
    expect(uncertainty.maxFactor).toBeCloseTo(1.015228, 4)
    expect(uncertainty.isUnreliable).toBe(false)
  })

  it('has no factors when the reference line is no longer than the click error spread', () => {
    const short = computeScaleUncertainty({ ...SCALE_100_PX_PER_M, refLine: { x1: 0, y1: 0, x2: 5, y2: 0 } }, 3)
    expect(short).toMatchObject({ minFactor: null, maxFactor: null, isUnreliable: true })
  })

  it('flags a relative error above 5%', () => {
    const line100 = computeScaleUncertainty({ ...SCALE_100_PX_PER_M, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 } }, 3)
    expect(line100.relativeError).toBeCloseTo(0.06, 6)
    expect(line100.isUnreliable).toBe(true)
    expect(line100.minFactor).not.toBeNull()
  })

  it('gives both factors 1 for a zero click error', () => {
    expect(computeScaleUncertainty(SCALE_100_PX_PER_M, 0)).toMatchObject({ minFactor: 1, maxFactor: 1, isUnreliable: false })
  })
})

describe('estimateCableLength - worked example', () => {
  it('cable A: mounted camera, two vertices', () => {
    const a = estimate(CABLE_A)
    expect(a.label).toBe('C1-H1')
    expect(a.horizPx).toBeCloseTo(1000, 4)
    expect(a.horizM).toBeCloseTo(10, 4)
    expect(a.deviceRiseM).toBeCloseTo(0.5, 4)
    expect(a.hubDropM).toBeCloseTo(1.5, 4)
    expect(a.slackM).toBeCloseTo(3.5, 4)
    expect(a.fixedM).toBeCloseTo(5.5, 4)
    expect(a.run.nominal).toBeCloseTo(15.5, 4)
    expect(a.run.min).toBeCloseTo(15.352217, 4)
    expect(a.run.max).toBeCloseTo(15.652284, 4)
    expect(a.wasteM).toBeCloseTo(2.325, 4)
    expect(a.purchase.nominal).toBeCloseTo(17.825, 4)
    expect(a.purchase.min).toBeCloseTo(17.655049, 4)
    expect(a.purchase.max).toBeCloseTo(18.000127, 4)
    expect(a.limitStatus).toBe('ok')
  })

  it('REGRESSION (item 7): typed mode is bit-identical to the pre-phase-4 formula\'s own addition order', () => {
    // HEAD's formula (before `beyond` existed): fixedM = deviceRiseM + hubDropM + hubExtraM +
    // slackM; run.min/max = horizM * factor + fixedM. A mathematically-equal but differently
    // GROUPED expression can differ at the float ULP level - `toBe` (exact), not `toBeCloseTo`,
    // catches that; the literals here mirror HEAD's own expression, not a rounded decimal.
    const a = estimate(CABLE_A)
    const fixedM = 0.5 + 1.5 + 0 + 3.5 // deviceRiseM + hubDropM + hubExtraM + slackM, HEAD's order
    expect(a.fixedM).toBe(fixedM)
    expect(a.run.nominal).toBe(10 + fixedM)
    expect(a.run.min).toBe(10 * (400 / 406) + fixedM)
    expect(a.run.max).toBe(10 * (400 / 394) + fixedM)
  })

  it('cable B: unmounted camera uses the default device height, no vertices', () => {
    const b = estimate(CABLE_B)
    expect(b.horizPx).toBeCloseTo(632.455532, 4)
    expect(b.horizM).toBeCloseTo(6.324555, 4)
    expect(b.deviceRiseM).toBe(0)
    expect(b.fixedM).toBeCloseTo(5, 4)
    expect(b.run.nominal).toBeCloseTo(11.324555, 4)
    expect(b.purchase.nominal).toBeCloseTo(13.023239, 4)
  })

  it('applies the scale factor to horizontal metres only', () => {
    const a = estimate(CABLE_A)
    expect((a.run.max ?? 0) - a.fixedM).toBeCloseTo(a.horizM * (400 / 394), 6)
  })

  it('purchase equals run when waste is 0', () => {
    const a = estimate(CABLE_A, { settings: { wastePercent: 0 } })
    expect(a.purchase).toEqual(a.run)
    expect(a.wasteM).toBe(0)
  })

  it('min = max = nominal for a zero click error', () => {
    const a = estimate(CABLE_A, { clickErrorPx: 0 })
    expect(a.run.min).toBeCloseTo(a.run.nominal, 9)
    expect(a.run.max).toBeCloseTo(a.run.nominal, 9)
  })

  it('returns null for a dangling cable', () => {
    const dangling = estimateCableLength({
      cable: { ...CABLE_A, hubId: 'gone' },
      index,
      type: CAT6,
      settings: DEFAULT_CABLE_SETTINGS,
      planPxPerMeter: 100,
      uncertainty,
    })
    expect(dangling).toBeNull()
  })
})

describe('estimateCableLength - riser and drop', () => {
  function estimateTo(hub: Hub) {
    const result = estimateCableLength({
      cable: CABLE_A,
      index: buildCableEndpointIndex([CAMERA_C1], [], [hub]),
      type: CAT6,
      settings: DEFAULT_CABLE_SETTINGS,
      planPxPerMeter: 100,
      uncertainty,
    })
    if (!result) throw new Error('expected an estimate')
    return result
  }

  it('riser to 6 m: climbs 3 m from the 3 m route, plus the length on the upper floor', () => {
    const up = estimateTo({ ...HUB_H1, kind: 'riser', mountHeightM: 6, extraLengthM: 12 })
    expect(up.hubDropM).toBeCloseTo(3, 9)
    expect(up.hubExtraM).toBe(12)
    expect(up.fixedM).toBeCloseTo(0.5 + 3 + 12 + 3.5, 9)
    expect(up.run.nominal).toBeCloseTo(10 + 19, 9)
    expect((up.run.max ?? 0) - up.fixedM).toBeCloseTo(10 * (400 / 394), 6) // scale error still horizontal only
  })

  it('drop to 2 m below: descends the 3 m route height plus 2 m', () => {
    const down = estimateTo({ ...HUB_H1, kind: 'drop', mountHeightM: 2 })
    expect(down.hubDropM).toBeCloseTo(5, 9)
    expect(down.hubExtraM).toBe(0)
  })

  it('a new drop (0 m below) descends exactly the route height', () => {
    expect(estimateTo({ ...HUB_H1, kind: 'drop', mountHeightM: 0 }).hubDropM).toBeCloseTo(3, 9)
  })
})

describe('estimateCableLength - limit status (limit 90, fixed 5.5)', () => {
  it.each([
    [8500, 90.5, 'over'],
    [8400, 89.5, 'maybe-over'],
    [8000, 85.5, 'ok'],
  ] as const)('%i px => %f m run => %s', (horizPx, runM, status) => {
    const result = estimate(cableOfHorizPx(horizPx))
    expect(result.horizPx).toBeCloseTo(horizPx, 4)
    expect(result.run.nominal).toBeCloseTo(runM, 4)
    expect(result.limitStatus).toBe(status)
  })

  it('reports the worst case of a maybe-over cable', () => {
    expect(estimate(cableOfHorizPx(8400)).run.max).toBeCloseTo(90.779, 2)
    expect(estimate(cableOfHorizPx(8000)).run.max).toBeCloseTo(86.718, 2)
  })

  it("is 'no-limit' for a type without a limit", () => {
    expect(estimate(cableOfHorizPx(8500), { type: { ...CAT6, lengthLimitM: null } }).limitStatus).toBe('no-limit')
  })

  it('falls back to the nominal run when the interval is undefined', () => {
    const noInterval = computeScaleUncertainty({ ...SCALE_100_PX_PER_M, refLine: { x1: 0, y1: 0, x2: 5, y2: 0 } }, 3)
    const result = estimateCableLength({
      cable: cableOfHorizPx(8400),
      index,
      type: CAT6,
      settings: DEFAULT_CABLE_SETTINGS,
      planPxPerMeter: 100,
      uncertainty: noInterval,
    })
    expect(result?.run).toMatchObject({ min: null, max: null })
    expect(result?.limitStatus).toBe('ok')
  })
})

describe('estimateCableLength - beyond (cross-floor), the two-floor worked example', () => {
  const project = twoFloorLinkedProject()
  const beyond = resolveHubBeyondLength(project, { floorId: 'floor-0', hubId: 'riser-1' }, CROSS_FLOOR_CABLE)
  const crossFloorIndex = buildCableEndpointIndex([CROSS_FLOOR_CAMERA], [], [RISER_1])
  const crossFloorUncertainty = computeScaleUncertainty(project.floors[0].scale!, 3)

  function estimateWithBeyond(beyondInput: typeof beyond | undefined) {
    const result = estimateCableLength({
      cable: CROSS_FLOOR_CABLE,
      index: crossFloorIndex,
      type: CAT6,
      settings: DEFAULT_CABLE_SETTINGS,
      planPxPerMeter: 100,
      uncertainty: crossFloorUncertainty,
      beyond: beyondInput,
    })
    if (!result) throw new Error('expected an estimate')
    return result
  }

  it('route mode: hubDropM is just the crossing, hubExtraM the rest, beyondVia names where it leads', () => {
    const result = estimateWithBeyond(beyond)
    expect(result.hubDropM).toBeCloseTo(3, 9) // crossingVerticalM
    expect(result.hubExtraM).toBeCloseTo(11.5, 6) // 14.5 - 3
    expect(result.beyondVia).toBe('Floor 2 D1')
    expect(result.fixedM).toBeCloseTo(18.5, 6) // deviceRiseM 0.5 + slackM 3.5 + beyond 14.5
    expect(result.run.nominal).toBeCloseTo(28.5, 6)
    expect(result.run.min!).toBeCloseTo(28.204433, 6)
    expect(result.run.max!).toBeCloseTo(28.804569, 6)
    expect(result.purchase.nominal).toBeCloseTo(32.775, 6)
    expect(result.purchase.min!).toBeCloseTo(32.435099, 5)
    expect(result.purchase.max!).toBeCloseTo(33.125254, 5)
  })

  it('omitting `beyond` and an explicit `source: "typed"` are byte-identical to today\'s formula', () => {
    const withoutBeyond = estimateWithBeyond(undefined)
    expect(withoutBeyond.hubDropM).toBeCloseTo(0, 9) // |routeHeightM 3 - RISER_1.mountHeightM 3|
    expect(withoutBeyond.hubExtraM).toBe(0)
    expect(withoutBeyond.beyondVia).toBeUndefined()
    expect('beyondVia' in withoutBeyond).toBe(false) // never present (not even as `undefined`) so `toEqual` stays exact

    const typedExplicit = estimateWithBeyond({ source: 'typed', run: { nominal: 42, min: 42, max: 42 } })
    expect(typedExplicit.hubDropM).toBe(withoutBeyond.hubDropM) // an explicit `typed` source still reads the hub endpoint's OWN fields, not `run`
    expect(typedExplicit.hubExtraM).toBe(withoutBeyond.hubExtraM)
    expect(typedExplicit.run).toEqual(withoutBeyond.run)
  })
})

describe('polylineLengthPx', () => {
  it('sums segment lengths and is 0 for fewer than two points', () => {
    expect(polylineLengthPx([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }])).toBe(11)
    expect(polylineLengthPx([{ x: 1, y: 1 }])).toBe(0)
  })
})
