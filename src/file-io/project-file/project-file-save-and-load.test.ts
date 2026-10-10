import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MAX_PROJECT_TEXT_LENGTH_BYTES } from '../../domain/project-file/project-file-floor-schema'
import { serializeProject, type ProjectFileLookups, type SensorModelLookup } from '../../domain/project-file/project-file-schema'
import { buildFloor, buildProject, buildProjectWithFloors, TINY_PNG_DATA_URL } from '../../domain/project-file/project-file-test-fixtures'
import { deriveProjectFileName, loadProjectFromFile, saveProjectToFile, utf8ByteLength } from './project-file-save-and-load'

const EMPTY_LOOKUPS: ProjectFileLookups = { cameraModelIds: new Set(), sensorModelLookup: new Map(), fireAlarmModelIds: new Set() }

describe('utf8ByteLength', () => {
  it('matches JS .length for pure ASCII', () => {
    expect(utf8ByteLength('abc')).toBe(3)
  })

  it('counts a multi-byte character as more than one byte (unlike JS string .length)', () => {
    // "ầ" (a with circumflex and grave) is one UTF-16 code unit but multiple UTF-8 bytes.
    const vietnamese = 'Tầng trệt'
    expect(utf8ByteLength(vietnamese)).toBeGreaterThan(vietnamese.length)
  })
})

describe('saveProjectToFile - size guard (low: Low item, must measure real UTF-8 bytes)', () => {
  it('refuses (no download attempted) a project whose serialised JSON exceeds the 80 MB cap', () => {
    // A valid-looking (regex-passing) but oversized base64 payload - cheap to build, and the
    // refuse path returns before `triggerBrowserFileDownload` ever touches the DOM, so this is
    // safe to run in this suite's `node` test environment (see the class comment below).
    const hugeDataUrl = 'data:image/png;base64,' + 'A'.repeat(MAX_PROJECT_TEXT_LENGTH_BYTES)
    const project = buildProject({ image: { dataUrl: hugeDataUrl, widthPx: 10, heightPx: 10, fileName: 'huge.png' } })

    const result = saveProjectToFile(project)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected ok: false')
    expect(result.error).toContain('MB')
  })

  it('succeeds (download attempted) for an ordinary small project', () => {
    // `triggerBrowserFileDownload` needs `document`/`URL` - stub just enough of the DOM surface
    // it touches rather than switching this whole suite to a jsdom environment.
    const originalDocument = globalThis.document
    const originalUrl = globalThis.URL
    const originalWindow = globalThis.window
    const stubLink = { href: '', download: '', rel: '', click: () => {}, remove: () => {} }
    try {
      // @ts-expect-error - minimal stub, not a full Document
      globalThis.document = { createElement: () => stubLink, body: { appendChild: () => {} } }
      // @ts-expect-error - minimal stub, not the full URL API
      globalThis.URL = { createObjectURL: () => 'blob:stub', revokeObjectURL: () => {} }
      // @ts-expect-error - minimal stub: `triggerBrowserFileDownload` calls `window.setTimeout`
      globalThis.window = { setTimeout: () => 0 }

      const result = saveProjectToFile(buildProject())
      expect(result.ok).toBe(true)
    } finally {
      globalThis.document = originalDocument
      globalThis.URL = originalUrl
      globalThis.window = originalWindow
    }
  })
})

describe('deriveProjectFileName', () => {
  it('replaces the image extension with -device-layout.json', () => {
    expect(deriveProjectFileName('warehouse-floor-plan.png')).toBe('warehouse-floor-plan-device-layout.json')
  })

  it('handles file names with multiple dots by stripping only the last extension', () => {
    expect(deriveProjectFileName('site.v2.final.jpg')).toBe('site.v2.final-device-layout.json')
  })

  it('falls back to "project" for a name with no usable base', () => {
    expect(deriveProjectFileName('.png')).toBe('project-device-layout.json')
    expect(deriveProjectFileName('')).toBe('project-device-layout.json')
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
