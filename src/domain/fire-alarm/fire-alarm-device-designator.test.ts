import { describe, expect, it } from 'vitest'
import { buildFireAlarmDeviceLabels } from './fire-alarm-device-designator'
import type { FireAlarmKind } from './fire-alarm-device-types'

const modelById: Record<string, { kind: FireAlarmKind }> = {
  panel: { kind: 'control-panel' },
  hub: { kind: 'wireless-hub' },
  keypad: { kind: 'keypad' },
  relay: { kind: 'relay-module' },
  smoke: { kind: 'smoke-detector' },
  heat: { kind: 'heat-detector' },
  co: { kind: 'co-detector' },
  callPoint: { kind: 'manual-call-point' },
  sounder: { kind: 'sounder' },
  expander: { kind: 'expander-module' },
  keyfob: { kind: 'keyfob' },
  tagReader: { kind: 'tag-reader' },
  repeater: { kind: 'repeater' },
  communicator: { kind: 'communicator' },
  powerSupply: { kind: 'power-supply' },
  accessory: { kind: 'accessory' },
  magnetic: { kind: 'magnetic-contact' },
  environment: { kind: 'environment-detector' },
  intrusion: { kind: 'intrusion-detector' },
}

function labelsFor(modelIds: string[]): string[] {
  return buildFireAlarmDeviceLabels(
    modelIds.map((modelId, i) => ({ id: `d${i}`, modelId, x: 0, y: 0 })),
    modelById,
  )
}

describe('buildFireAlarmDeviceLabels', () => {
  it('uses the designator prefix of each kind', () => {
    expect(
      labelsFor(['panel', 'hub', 'keypad', 'keyfob', 'tagReader', 'relay', 'repeater', 'communicator', 'powerSupply', 'accessory']),
    ).toEqual(['P1', 'PW1', 'KP1', 'KF1', 'TR1', 'R1', 'REP1', 'COM1', 'PS1', 'ACE1'])
    expect(labelsFor(['smoke', 'heat', 'co', 'callPoint', 'sounder', 'magnetic', 'environment', 'intrusion'])).toEqual([
      'S1',
      'H1',
      'CO1',
      'E1',
      'SO1',
      'MAG1',
      'ENV1',
      'ID1',
    ])
  })

  it('numbers each prefix on its own, in devices[] order', () => {
    expect(labelsFor(['smoke', 'heat', 'smoke', 'sounder', 'heat', 'smoke'])).toEqual(['S1', 'H1', 'S2', 'SO1', 'H2', 'S3'])
  })

  it('expander module and call point share the one E series - never the same label twice', () => {
    expect(labelsFor(['expander', 'callPoint', 'expander'])).toEqual(['E1', 'E2', 'E3'])
  })

  it('keeps the generic F only for an unknown model', () => {
    expect(labelsFor(['does-not-exist', 'smoke', 'does-not-exist'])).toEqual(['F1', 'S1', 'F2'])
  })
})
