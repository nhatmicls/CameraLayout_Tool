import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { serializeProject, type ProjectFileLookups, type SensorModelLookup } from '../../domain/project-file/project-file-schema'
import { buildFloor, buildProject, buildProjectWithFloors, TINY_PNG_DATA_URL } from '../../domain/project-file/project-file-test-fixtures'
import { deriveProjectFileName, loadProjectFromFile } from './project-file-save-and-load'

const EMPTY_LOOKUPS: ProjectFileLookups = { cameraModelIds: new Set(), sensorModelLookup: new Map(), fireAlarmModelIds: new Set() }

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

  const project = buildProject({
    sensors: [{ id: 's1', modelId: 'pir-1', shape: 'sector', x: 0, y: 0, rotationDeg: 0, rangeM: 5 }],
  })

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
    expect(outcome.project.floors[0].sensors).toHaveLength(1)
    expect(outcome.warnings).toEqual([])
  })

  it('drops a sensor whose modelId the lookup does not know, with a warning', async () => {
    const outcome = await loadProjectFromFile(makeFile(), lookupsWith(new Map()))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) throw new Error('expected ok')
    expect(outcome.project.floors[0].sensors).toHaveLength(0)
    expect(outcome.warnings.some((w) => w.includes('pir-1'))).toBe(true)
  })
})

describe('loadProjectFromFile - decodes every floor image', () => {
  const OriginalImage = globalThis.Image

  beforeAll(() => {
    globalThis.Image = StubImage as unknown as typeof Image
  })

  afterAll(() => {
    globalThis.Image = OriginalImage
  })

  it("updates every floor's image to the decoded element's real dimensions, skipping an image-less floor", async () => {
    const project = buildProjectWithFloors([
      buildFloor({ id: 'floor-1', name: 'Ground', image: { dataUrl: TINY_PNG_DATA_URL, widthPx: 999, heightPx: 999, fileName: 'a.png' } }),
      buildFloor({ id: 'floor-2', name: 'Roof', image: null, scale: null }),
      buildFloor({ id: 'floor-3', name: 'Basement', image: { dataUrl: TINY_PNG_DATA_URL, widthPx: 500, heightPx: 500, fileName: 'b.png' } }),
    ])
    const file = new File([serializeProject(project)], 'plan-camera-layout.json', { type: 'application/json' })
    const outcome = await loadProjectFromFile(file, EMPTY_LOOKUPS)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) throw new Error('expected ok')
    expect(outcome.project.floors[0].image).toMatchObject({ widthPx: 1, heightPx: 1 })
    expect(outcome.project.floors[1].image).toBeNull()
    expect(outcome.project.floors[2].image).toMatchObject({ widthPx: 1, heightPx: 1 })
  })

  it("fails the whole load, as { ok: false }, when a LATER floor's embedded image fails to decode", async () => {
    let callCount = 0
    class FailsOnSecondDecodeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 1
      naturalHeight = 1
      private readonly shouldFail = callCount++ === 1 // the second `new Image()` call (floor 1's) fails

      set src(_value: string) {
        queueMicrotask(() => (this.shouldFail ? this.onerror?.() : this.onload?.()))
      }
      decode(): Promise<void> {
        return Promise.resolve()
      }
    }
    globalThis.Image = FailsOnSecondDecodeImage as unknown as typeof Image

    try {
      const project = buildProjectWithFloors([buildFloor({ id: 'floor-1', name: 'Ground' }), buildFloor({ id: 'floor-2', name: 'Roof' })])
      const file = new File([serializeProject(project)], 'plan-camera-layout.json', { type: 'application/json' })
      const outcome = await loadProjectFromFile(file, EMPTY_LOOKUPS)
      expect(outcome.ok).toBe(false)
    } finally {
      globalThis.Image = StubImage as unknown as typeof Image // restore for any later test in this file
    }
  })
})
