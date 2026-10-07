import { describe, expect, it } from 'vitest'
import { buildFloor } from '../project-file/project-file-test-fixtures'
import { describeFloorContent, floorHasPlacedContent } from './floor-content-summary'

describe('floorHasPlacedContent', () => {
  it('is false for a bare image-less floor', () => {
    expect(floorHasPlacedContent(buildFloor({ image: null, scale: null }))).toBe(false)
  })

  it('is true when only an image is set (no placed items yet)', () => {
    expect(floorHasPlacedContent(buildFloor())).toBe(true) // buildFloor defaults to a tiny image
  })

  it('is true for walls alone (M1 regression: hasLayout used to ignore walls)', () => {
    expect(
      floorHasPlacedContent(buildFloor({ image: null, scale: null, walls: [{ id: 'w1', x1: 0, y1: 0, x2: 1, y2: 1, kind: 'opaque' }] })),
    ).toBe(true)
  })

  it('is true for a scale alone (image required by schema, so paired here, but checked independently)', () => {
    expect(
      floorHasPlacedContent(
        buildFloor({ scale: { planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 10, y2: 0 }, refLengthM: 1 } }),
      ),
    ).toBe(true)
  })
})

describe('describeFloorContent', () => {
  it('lists every present kind, image first, walls last, each with correct pluralisation', () => {
    const floor = buildFloor({
      scale: { planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 10, y2: 0 }, refLengthM: 1 },
      cameras: [{ id: 'c1', modelId: 'm', x: 0, y: 0, rotationDeg: 0, rangeM: 5 }],
      sensors: [],
      fireAlarmDevices: [
        { id: 'f1', modelId: 'm', x: 0, y: 0 },
        { id: 'f2', modelId: 'm', x: 0, y: 0 },
      ],
      hubs: [{ id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }],
      cables: [],
      walls: [{ id: 'w1', x1: 0, y1: 0, x2: 1, y2: 1, kind: 'opaque' }],
    })
    expect(describeFloorContent(floor)).toBe('its plan image, its scale calibration, 1 camera, 2 fire-alarm devices, 1 hub, 1 wall')
  })

  it('is empty for a floor with nothing to lose', () => {
    expect(describeFloorContent(buildFloor({ image: null, scale: null }))).toBe('')
  })
})
