import { describe, expect, it } from 'vitest'
import { EMPTY_CABLE_LAYOUT_ESTIMATE } from '../../domain/cable/cable-layout-estimate'
import { DEFAULT_CABLE_SETTINGS, type Cable, type CableType } from '../../domain/cable/cable-layout-types'
import { buildCableLegend } from './draw-export-cable-legend-line'

const CABLE: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'hub-1', typeId: 'cat6-utp', points: [] }
const TYPE: CableType = { id: 'cat6-utp', name: 'Cat6 UTP', lengthLimitM: 90, pricePerMeterVnd: null }

describe('buildCableLegend - unestimated note (HIGH fix)', () => {
  it('is null when there are no cables', () => {
    expect(buildCableLegend([], [TYPE], DEFAULT_CABLE_SETTINGS, EMPTY_CABLE_LAYOUT_ESTIMATE)).toBeNull()
  })

  it('prepends the unestimated-cable summary to the note text, ahead of the provisional-estimate note', () => {
    const estimate = {
      ...EMPTY_CABLE_LAYOUT_ESTIMATE,
      hasScale: true,
      unestimatedCableCount: 1,
      warnings: [{ code: 'linked-floor-scale-not-set' as const, cableId: 'c1', message: 'C1-H1: the route continues on "Floor 2"...' }],
    }
    const legend = buildCableLegend([CABLE], [TYPE], DEFAULT_CABLE_SETTINGS, estimate)
    expect(legend?.noteText).toContain('1 cable not estimated: a linked floor has no scale set (1).')
  })

  it('is just the provisional note when nothing is unestimated', () => {
    const estimate = {
      ...EMPTY_CABLE_LAYOUT_ESTIMATE,
      hasScale: true,
      totals: [
        {
          type: TYPE,
          cableCount: 1,
          labels: ['C1-H1'],
          run: { nominal: 10, min: 10, max: 10 },
          purchase: { nominal: 11.5, min: 11.5, max: 11.5 },
          purchaseWholeM: 12,
          lineTotalVnd: null,
        },
      ],
      grandPurchase: { nominal: 11.5, min: 11.5, max: 11.5 },
    }
    const legend = buildCableLegend([CABLE], [TYPE], DEFAULT_CABLE_SETTINGS, estimate)
    expect(legend?.noteText).not.toContain('not estimated')
    expect(legend?.noteText).toContain('provisional')
  })
})
