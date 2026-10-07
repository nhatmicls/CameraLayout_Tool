import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { serializeProject, type ProjectFileLookups, type SensorModelLookup } from '../../domain/project-file/project-file-schema'
import { createEmptyCableLayout } from '../../domain/cable/cable-layout-types'
import { createEmptyFireAlarmLayout, type Project } from '../../domain/project-file/project-types'
import { deriveProjectFileName, loadProjectFromFile } from './project-file-save-and-load'

describe('deriveProjectFileName', () => {
  it('replaces the image extension with -camera-layout.json', () => {
    expect(deriveProjectFileName('warehouse-floor-plan.png')).toBe('warehouse-floor-plan-camera-layout.json')
  })

  it('handles file names with multiple dots by stripping only the last extension', () => {
    expect(deriveProjectFileName('site.v2.final.jpg')).toBe('site.v2.final-camera-layout.json')
  })

  it('falls back to "project" for a name with no usable base', () => {
    expect(deriveProjectFileName('.png')).toBe('project-camera-layout.json')
    expect(deriveProjectFileName('')).toBe('project-camera-layout.json')
  })
})

// Smallest possible valid PNG (1x1 transparent pixel), as a real base64 data URL.
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAAk6WgQAAAABJRU5ErkJggg=='

/**
 * `decodeEmbeddedImage` needs a browser `Image` element; this suite's test
 * environment is `node` (see vite.config.ts), which has none. This stand-in
 * only gets past that one decode step - the rest of `loadProjectFromFile`
 * (read -> real `parseProjectFile` -> real `normaliseLoadedSensors`) runs
 * unmodified, which is what these tests are actually exercising.
 */
class StubImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 1
  naturalHeight = 1
  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
  decode(): Promise<void> {
    return Promise.resolve()
  }
}

describe('loadProjectFromFile - sensor model lookup pass-through', () => {
  const OriginalImage = globalThis.Image

  beforeAll(() => {
    globalThis.Image = StubImage as unknown as typeof Image
  })

  afterAll(() => {
    globalThis.Image = OriginalImage
  })

  const project: Project = {
    image: { dataUrl: TINY_PNG_DATA_URL, widthPx: 1, heightPx: 1, fileName: 'plan.png' },
    scale: null,
    cameras: [],
    walls: [],
    sensors: [{ id: 's1', modelId: 'pir-1', shape: 'sector', x: 0, y: 0, rotationDeg: 0, rangeM: 5 }],
    ...createEmptyCableLayout(),
    ...createEmptyFireAlarmLayout(),
  }

  function makeFile(): File {
    return new File([serializeProject(project)], 'plan-camera-layout.json', { type: 'application/json' })
  }

  function lookupsWith(sensorModelLookup: SensorModelLookup): ProjectFileLookups {
    return { cameraModelIds: new Set(), sensorModelLookup, fireAlarmModelIds: new Set() }
  }

  it('keeps a sensor whose model and shape the lookup recognises', async () => {
    const outcome = await loadProjectFromFile(makeFile(), lookupsWith(new Map([['pir-1', { shape: 'sector' }]])))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) throw new Error('expected ok')
    expect(outcome.project.sensors).toHaveLength(1)
    expect(outcome.warnings).toEqual([])
  })

  it('drops a sensor whose modelId the lookup does not know, with a warning', async () => {
    const outcome = await loadProjectFromFile(makeFile(), lookupsWith(new Map()))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) throw new Error('expected ok')
    expect(outcome.project.sensors).toHaveLength(0)
    expect(outcome.warnings.some((w) => w.includes('pir-1'))).toBe(true)
  })
})
