import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FIRE_ALARM_SETTINGS,
  FIRE_ALARM_KIND_CATALOG_TAB,
  FIRE_ALARM_KIND_DISPLAY_ORDER,
  FIRE_ALARM_KIND_LABELS,
  isFireAlarmControllerKind,
  isFireDetectorKind,
  type FireAlarmKind,
  type FireAlarmModelSpec,
  type PlacedFireAlarmDevice,
} from './fire-alarm-device-types'

const ALL_KINDS: readonly FireAlarmKind[] = [
  'control-panel',
  'wireless-hub',
  'expander-module',
  'keypad',
  'keyfob',
  'tag-reader',
  'relay-module',
  'repeater',
  'communicator',
  'power-supply',
  'accessory',
  'smoke-detector',
  'heat-detector',
  'co-detector',
  'manual-call-point',
  'sounder',
  'magnetic-contact',
  'environment-detector',
]

describe('isFireAlarmControllerKind', () => {
  it('is true only for control-panel and wireless-hub', () => {
    expect(ALL_KINDS.filter(isFireAlarmControllerKind)).toEqual(['control-panel', 'wireless-hub'])
  })
})

describe('isFireDetectorKind', () => {
  it('is true only for the three detector kinds', () => {
    expect(ALL_KINDS.filter(isFireDetectorKind)).toEqual(['smoke-detector', 'heat-detector', 'co-detector'])
  })
})

describe('FIRE_ALARM_KIND_LABELS', () => {
  it('has one label per kind, exhaustively', () => {
    for (const kind of ALL_KINDS) expect(typeof FIRE_ALARM_KIND_LABELS[kind]).toBe('string')
  })

  it('labels the shipped manual-call-point record as a call point / panic button', () => {
    expect(FIRE_ALARM_KIND_LABELS['manual-call-point']).toBe('Call point / panic button')
  })
})

describe('FIRE_ALARM_KIND_DISPLAY_ORDER', () => {
  it('lists every kind exactly once', () => {
    expect([...FIRE_ALARM_KIND_DISPLAY_ORDER].sort()).toEqual([...ALL_KINDS].sort())
  })
})

describe('FIRE_ALARM_KIND_CATALOG_TAB', () => {
  it('maps every kind to exactly one of the three catalog tabs', () => {
    for (const kind of ALL_KINDS) {
      expect(['sensors', 'fire-alarm', 'control-panel']).toContain(FIRE_ALARM_KIND_CATALOG_TAB[kind])
    }
  })

  it('maps the two controller kinds and the other control-panel accessories to the control-panel tab', () => {
    const controlPanelKinds = ALL_KINDS.filter((kind) => FIRE_ALARM_KIND_CATALOG_TAB[kind] === 'control-panel')
    expect(controlPanelKinds.sort()).toEqual(
      [
        'control-panel',
        'wireless-hub',
        'expander-module',
        'keypad',
        'keyfob',
        'tag-reader',
        'relay-module',
        'repeater',
        'communicator',
        'power-supply',
        'accessory',
      ].sort(),
    )
  })

  it('maps the five fire-detector/sounder/call-point kinds to the fire-alarm tab', () => {
    const fireAlarmKinds = ALL_KINDS.filter((kind) => FIRE_ALARM_KIND_CATALOG_TAB[kind] === 'fire-alarm')
    expect(fireAlarmKinds.sort()).toEqual(
      ['smoke-detector', 'heat-detector', 'co-detector', 'manual-call-point', 'sounder'].sort(),
    )
  })

  it('maps magnetic-contact and environment-detector to the sensors tab', () => {
    const sensorsKinds = ALL_KINDS.filter((kind) => FIRE_ALARM_KIND_CATALOG_TAB[kind] === 'sensors')
    expect(sensorsKinds.sort()).toEqual(['magnetic-contact', 'environment-detector'].sort())
  })
})

describe('DEFAULT_FIRE_ALARM_SETTINGS', () => {
  it('defaults to datasheet mode with no ceiling height', () => {
    expect(DEFAULT_FIRE_ALARM_SETTINGS).toEqual({ coverageMode: 'datasheet', ceilingHeightM: null })
  })
})

describe('FireAlarmModelSpec structural shape', () => {
  it('accepts a controller spec with capacityAsPrinted + compatibleDevices', () => {
    const controller: FireAlarmModelSpec = {
      id: 'hikvision-ds-pha48-ep',
      brand: 'hikvision',
      model: 'DS-PHA48-EP',
      kind: 'control-panel',
      productLine: 'ax-hybrid',
      worksStandalone: false,
      certificationsAsPrinted: [],
      sourceUrl: 'https://assets.hikvision.com/a.pdf',
      sourceRetrieved: '2026-10-07',
      capacityAsPrinted: [{ label: 'Zones', value: '48' }],
      compatibleDevices: [{ modelId: 'hikvision-ds-pk1-lrt-hwe', sourceUrl: 'https://assets.hikvision.com/b.pdf', sourceRetrieved: '2026-10-07' }],
    }
    expect(controller.kind).toBe('control-panel')
  })

  it('accepts a non-controller spec with no capacity/compatibility fields', () => {
    const detector: FireAlarmModelSpec = {
      id: 'hikvision-ds-pdsmk-s-we',
      brand: 'hikvision',
      model: 'DS-PDSMK-S-WE',
      kind: 'smoke-detector',
      productLine: 'ax-pro',
      worksStandalone: false,
      certificationsAsPrinted: ['EN 14604 Certified'],
      sourceUrl: 'https://assets.hikvision.com/c.pdf',
      sourceRetrieved: '2026-10-07',
      priceVn: { amountVnd: 1_000_000 },
      notes: 'example',
    }
    expect(detector.kind).toBe('smoke-detector')
  })

  it('a placed device carries only id/modelId/x/y, no shape discriminator', () => {
    const device: PlacedFireAlarmDevice = { id: 'f1', modelId: 'hikvision-ds-pdsmk-s-we', x: 10, y: 20 }
    expect(Object.keys(device).sort()).toEqual(['id', 'modelId', 'x', 'y'])
  })
})
