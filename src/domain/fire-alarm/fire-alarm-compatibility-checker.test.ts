import { describe, expect, it } from 'vitest'
import {
  buildFireAlarmCompatibilityIndex,
  checkFireAlarmCompatibility,
  filterCompatibilityWarningsToDeviceIds,
  type CompatibilityWarning,
} from './fire-alarm-compatibility-checker'
import type { FireAlarmModelSpec, PlacedFireAlarmDevice } from './fire-alarm-device-types'

const PROVENANCE = { sourceUrl: 'https://assets.hikvision.com/x.pdf', sourceRetrieved: '2026-10-07' }

const panelA: FireAlarmModelSpec = {
  id: 'panel-a',
  brand: 'hikvision',
  model: 'Panel A',
  kind: 'control-panel',
  productLine: 'ax-hybrid',
  worksStandalone: false,
  certificationsAsPrinted: [],
  ...PROVENANCE,
  capacityAsPrinted: [],
  compatibleDevices: [{ modelId: 'keypad-1', ...PROVENANCE }],
}

const panelB: FireAlarmModelSpec = {
  id: 'panel-b',
  brand: 'hikvision',
  model: 'Panel B',
  kind: 'wireless-hub',
  productLine: 'ax-pro',
  worksStandalone: false,
  certificationsAsPrinted: [],
  ...PROVENANCE,
  capacityAsPrinted: [],
  compatibleDevices: [{ modelId: 'smoke-1', ...PROVENANCE, note: 'family statement' }],
}

const keypad1: FireAlarmModelSpec = {
  id: 'keypad-1',
  brand: 'hikvision',
  model: 'Keypad 1',
  kind: 'keypad',
  productLine: 'ax-hybrid',
  worksStandalone: false,
  certificationsAsPrinted: [],
  ...PROVENANCE,
}

const smoke1: FireAlarmModelSpec = {
  id: 'smoke-1',
  brand: 'hikvision',
  model: 'Smoke 1',
  kind: 'smoke-detector',
  productLine: 'ax-pro',
  worksStandalone: false,
  certificationsAsPrinted: [],
  ...PROVENANCE,
}

const standaloneSmoke: FireAlarmModelSpec = {
  id: 'hf-s2',
  brand: 'hikvision',
  model: 'HF-S2',
  kind: 'smoke-detector',
  productLine: 'standalone',
  worksStandalone: true,
  certificationsAsPrinted: ['EN14604:2005'],
  ...PROVENANCE,
}

const allSpecs = [panelA, panelB, keypad1, smoke1, standaloneSmoke]
const specById: Record<string, FireAlarmModelSpec> = Object.fromEntries(allSpecs.map((spec) => [spec.id, spec]))
const index = buildFireAlarmCompatibilityIndex(allSpecs)

function device(id: string, modelId: string): PlacedFireAlarmDevice {
  return { id, modelId, x: 0, y: 0 }
}

describe('buildFireAlarmCompatibilityIndex', () => {
  it('inverts each controller compatibleDevices entry into a device -> controller link', () => {
    expect(index.controllersByDeviceModelId.get('keypad-1')).toEqual([{ controllerModelId: 'panel-a', ...PROVENANCE, note: undefined }])
    expect(index.controllersByDeviceModelId.get('smoke-1')).toEqual([
      { controllerModelId: 'panel-b', ...PROVENANCE, note: 'family statement' },
    ])
  })

  it('has no entry for a device no controller lists', () => {
    expect(index.controllersByDeviceModelId.get('hf-s2')).toBeUndefined()
  })
})

describe('checkFireAlarmCompatibility', () => {
  it('standalone devices are never warned, even with no controller placed', () => {
    const warnings = checkFireAlarmCompatibility([device('d1', 'hf-s2')], specById, index)
    expect(warnings).toEqual([])
  })

  it('no controller placed, one non-standalone peripheral -> one aggregated no-controller-placed warning', () => {
    const warnings = checkFireAlarmCompatibility([device('d1', 'keypad-1')], specById, index)
    expect(warnings).toEqual([{ code: 'no-controller-placed', deviceIds: ['d1'] }])
  })

  it('no controller placed, two non-standalone peripherals -> one warning aggregating both ids', () => {
    const warnings = checkFireAlarmCompatibility([device('d1', 'keypad-1'), device('d2', 'smoke-1')], specById, index)
    expect(warnings).toEqual([{ code: 'no-controller-placed', deviceIds: ['d1', 'd2'] }])
  })

  it('controller placed, peripheral listed for it -> no warning', () => {
    const warnings = checkFireAlarmCompatibility([device('p', 'panel-a'), device('d1', 'keypad-1')], specById, index)
    expect(warnings).toEqual([])
  })

  it('controller placed, peripheral not listed for it -> not-listed-for-placed-controllers', () => {
    const warnings = checkFireAlarmCompatibility([device('p', 'panel-a'), device('d1', 'smoke-1')], specById, index)
    expect(warnings).toEqual([{ code: 'not-listed-for-placed-controllers', deviceId: 'd1', modelId: 'smoke-1' }])
  })

  it('two controllers placed, peripheral listed for one of them -> no warning', () => {
    const warnings = checkFireAlarmCompatibility(
      [device('pa', 'panel-a'), device('pb', 'panel-b'), device('d1', 'smoke-1')],
      specById,
      index,
    )
    expect(warnings).toEqual([])
  })

  it('unknown modelId is skipped, same as the BOM', () => {
    const warnings = checkFireAlarmCompatibility([device('p', 'panel-a'), device('d1', 'unknown-model')], specById, index)
    expect(warnings).toEqual([])
  })

  it('controllers themselves are never warned', () => {
    const warnings = checkFireAlarmCompatibility([device('pa', 'panel-a'), device('pb', 'panel-b')], specById, index)
    expect(warnings).toEqual([])
  })
})

describe('filterCompatibilityWarningsToDeviceIds (C1/H3 review fix: the one shared per-floor filter)', () => {
  it('drops a not-listed-for-placed-controllers warning whose device is not in the set', () => {
    const warnings: CompatibilityWarning[] = [{ code: 'not-listed-for-placed-controllers', deviceId: 'd1', modelId: 'smoke-1' }]
    expect(filterCompatibilityWarningsToDeviceIds(warnings, new Set(['d2']))).toEqual([])
  })

  it('keeps a not-listed-for-placed-controllers warning whose device IS in the set', () => {
    const warnings: CompatibilityWarning[] = [{ code: 'not-listed-for-placed-controllers', deviceId: 'd1', modelId: 'smoke-1' }]
    expect(filterCompatibilityWarningsToDeviceIds(warnings, new Set(['d1']))).toEqual(warnings)
  })

  it('narrows a no-controller-placed warning to only the device ids in the set', () => {
    const warnings: CompatibilityWarning[] = [{ code: 'no-controller-placed', deviceIds: ['d1', 'd2', 'd3'] }]
    expect(filterCompatibilityWarningsToDeviceIds(warnings, new Set(['d2']))).toEqual([{ code: 'no-controller-placed', deviceIds: ['d2'] }])
  })

  it('drops a no-controller-placed warning entirely once none of its ids are in the set', () => {
    const warnings: CompatibilityWarning[] = [{ code: 'no-controller-placed', deviceIds: ['d1', 'd2'] }]
    expect(filterCompatibilityWarningsToDeviceIds(warnings, new Set(['d9']))).toEqual([])
  })
})
