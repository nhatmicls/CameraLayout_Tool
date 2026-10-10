import { describe, expect, it } from 'vitest'
import { groupFireAlarmDevicesIntoBom } from './fire-alarm-bill-of-materials-grouping'
import { buildFireAlarmCompatibilityIndex, checkFireAlarmCompatibility, type CompatibilityWarning } from '../fire-alarm/fire-alarm-compatibility-checker'
import type { FireAlarmModelSpec, PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'
import { buildFloorItemLabels } from '../floor/floor-item-label-allocator'

const wirelessHub: FireAlarmModelSpec = {
  id: 'hik-hub',
  brand: 'hikvision',
  model: 'DS-PWA96-M-WE',
  productLine: 'ax-pro',
  worksStandalone: false,
  certificationsAsPrinted: [],
  sourceUrl: 'https://example.test',
  sourceRetrieved: '2026-10-07',
  priceVn: null,
  kind: 'wireless-hub',
  capacityAsPrinted: [],
  compatibleDevices: [],
}

const smokeDetector: FireAlarmModelSpec = {
  id: 'hik-smoke',
  brand: 'hikvision',
  model: 'DS-PDSMK-S-WE',
  productLine: 'ax-pro',
  worksStandalone: false,
  certificationsAsPrinted: [],
  sourceUrl: 'https://example.test',
  sourceRetrieved: '2026-10-07',
  priceVn: { amountVnd: 500_000 },
  kind: 'smoke-detector',
}

const standaloneSmoke: FireAlarmModelSpec = {
  id: 'hik-standalone-smoke',
  brand: 'hikvision',
  model: 'HF-S2',
  productLine: 'standalone',
  worksStandalone: true,
  certificationsAsPrinted: [],
  sourceUrl: 'https://example.test',
  sourceRetrieved: '2026-10-07',
  priceVn: null,
  kind: 'smoke-detector',
}

const heatDetector: FireAlarmModelSpec = {
  id: 'hik-heat',
  brand: 'hikvision',
  model: 'DS-PDHT-E-WE',
  productLine: 'ax-pro',
  worksStandalone: false,
  certificationsAsPrinted: [],
  sourceUrl: 'https://example.test',
  sourceRetrieved: '2026-10-07',
  priceVn: null,
  kind: 'heat-detector',
}

const modelById: Record<string, FireAlarmModelSpec> = {
  'hik-hub': wirelessHub,
  'hik-smoke': smokeDetector,
  'hik-standalone-smoke': standaloneSmoke,
  'hik-heat': heatDetector,
}

function device(id: string, modelId: string): PlacedFireAlarmDevice {
  return { id, modelId, x: 0, y: 0 }
}

/** `groupFireAlarmDevicesIntoBom` takes labels from the shared allocator (`floor-item-label-allocator.ts`) - this grouper-only test asks the real thing for them, same as `buildCombinedBomRows` does. */
function fireAlarmLabels(devices: readonly PlacedFireAlarmDevice[], modelById: Record<string, FireAlarmModelSpec>): string[] {
  return buildFloorItemLabels({ cameras: [], sensors: [], fireAlarmDevices: devices, hubs: [] }, { fireAlarmModelById: modelById }).fireAlarmDevices
}

describe('groupFireAlarmDevicesIntoBom', () => {
  it('groups same kind+brand+model into one row with a quantity and label list', () => {
    const devices = [device('d1', 'hik-smoke'), device('d2', 'hik-smoke')]
    const rows = groupFireAlarmDevicesIntoBom(devices, modelById, fireAlarmLabels(devices, modelById))
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(2)
    expect(rows[0].labels).toBe('S1, S2')
    expect(rows[0].type).toBe('Smoke detector')
  })

  it('leaves formFactor, resolution and lens empty', () => {
    const devices = [device('d1', 'hik-smoke')]
    const rows = groupFireAlarmDevicesIntoBom(devices, modelById, fireAlarmLabels(devices, modelById))
    expect(rows[0].formFactor).toBe('')
    expect(rows[0].resolution).toBe('')
    expect(rows[0].lens).toBe('')
  })

  it('numbers labels per designator prefix in devices[] order, skipping an unknown modelId', () => {
    const devices = [device('d1', 'unknown-model'), device('d2', 'hik-smoke'), device('d3', 'unknown-model'), device('d4', 'hik-smoke')]
    const rows = groupFireAlarmDevicesIntoBom(devices, modelById, fireAlarmLabels(devices, modelById))
    expect(rows).toHaveLength(1)
    expect(rows[0].labels).toBe('S1, S2')
  })

  it('sorts rows by FIRE_ALARM_KIND_DISPLAY_ORDER, not alphabetically by label', () => {
    const devices = [device('d1', 'hik-smoke'), device('d2', 'hik-hub'), device('d3', 'hik-heat')]
    const rows = groupFireAlarmDevicesIntoBom(devices, modelById, fireAlarmLabels(devices, modelById))
    // Display order: control-panel, wireless-hub, expander-module, keypad, smoke-detector, heat-detector, ...
    expect(rows.map((r) => r.type)).toEqual(['Wireless hub', 'Smoke detector', 'Heat detector'])
  })

  it('treats a null price as unpriced (null unit + line total)', () => {
    const devices = [device('d1', 'hik-heat')]
    const rows = groupFireAlarmDevicesIntoBom(devices, modelById, fireAlarmLabels(devices, modelById))
    expect(rows[0].unitPriceVnd).toBeNull()
    expect(rows[0].lineTotalVnd).toBeNull()
  })

  it('multiplies a known price by quantity', () => {
    const devices = [device('d1', 'hik-smoke'), device('d2', 'hik-smoke')]
    const rows = groupFireAlarmDevicesIntoBom(devices, modelById, fireAlarmLabels(devices, modelById))
    expect(rows[0].unitPriceVnd).toBe(500_000)
    expect(rows[0].lineTotalVnd).toBe(1_000_000)
  })

  it('returns an empty array for no devices', () => {
    expect(groupFireAlarmDevicesIntoBom([], modelById, [])).toEqual([])
  })

  it('leaves notes empty with no warnings', () => {
    const devices = [device('d1', 'hik-smoke')]
    const rows = groupFireAlarmDevicesIntoBom(devices, modelById, fireAlarmLabels(devices, modelById), [])
    expect(rows[0].notes).toBe('')
  })

  it('notes only the warned labels of a not-listed-for-placed-controllers row', () => {
    const warnings: CompatibilityWarning[] = [
      { code: 'not-listed-for-placed-controllers', deviceId: 'd1', modelId: 'hik-smoke' },
    ]
    const devices = [device('d1', 'hik-smoke'), device('d2', 'hik-smoke')]
    const rows = groupFireAlarmDevicesIntoBom(devices, modelById, fireAlarmLabels(devices, modelById), warnings)
    expect(rows[0].notes).toBe('Not listed for a placed panel/hub: S1')
  })

  it('notes "No panel/hub placed" for a device in the aggregated no-controller-placed warning', () => {
    const warnings: CompatibilityWarning[] = [{ code: 'no-controller-placed', deviceIds: ['d1'] }]
    const devices = [device('d1', 'hik-smoke')]
    const rows = groupFireAlarmDevicesIntoBom(devices, modelById, fireAlarmLabels(devices, modelById), warnings)
    expect(rows[0].notes).toBe('No panel/hub placed')
  })

  it('leaves a controller row and a standalone-device row without notes - the real checker never warns either', () => {
    const devices = [device('d1', 'hik-hub'), device('d2', 'hik-standalone-smoke'), device('d3', 'hik-smoke')]
    const warnings = checkFireAlarmCompatibility(devices, modelById, buildFireAlarmCompatibilityIndex(Object.values(modelById)))
    const rows = groupFireAlarmDevicesIntoBom(devices, modelById, fireAlarmLabels(devices, modelById), warnings)
    const hubRow = rows.find((r) => r.type === 'Wireless hub')
    const standaloneRow = rows.find((r) => r.model === 'HF-S2')
    const smokeRow = rows.find((r) => r.model === 'DS-PDSMK-S-WE')
    expect(hubRow?.notes).toBe('')
    expect(standaloneRow?.notes).toBe('')
    // d3 is placed with a controller (the hub), but the hub's compatibleDevices list is empty in this fixture.
    expect(smokeRow?.notes).toBe('Not listed for a placed panel/hub: S2')
  })
})
