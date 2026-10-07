import { test, expect, type Page } from '@playwright/test'
import { deflateSync } from 'node:zlib'

/**
 * Single-floor editing smoke test (multi-floor phase 2). Runs against the
 * Vite DEV server (see `playwright.config.ts`) because it relies on
 * `window.__cameraLayoutToolTestHooks` to seed catalog items with correctly
 * shaped data without reimplementing HTML5 drag-and-drop onto a Konva
 * canvas - those hooks are dead-code-eliminated from the production build
 * (`installDevTestHooks`'s `import.meta.env.DEV` guard), so they do not
 * exist under `vite preview`.
 *
 * One long test, `test.step`-segmented, because every later step depends on
 * the live undo history / store state the previous step left behind:
 *  1. load a generated PNG -> a canvas renders
 *  2. load the SAME file again (same data URL, new `PlanImage` object) -> canvas still there
 *  3. scale + camera + sensor + hub + cable + fire-alarm device via hooks; undo all; redo all
 *  4. replace with a DIFFERENT PNG -> items cleared; one undo -> old image + items back, canvas renders
 *  5. save (capture the download), reload, open it -> same counts; schemaVersion 7, floors.length 1
 *  6. open a legacy flat v6 JSON derived from the saved one -> loads as one floor, canvas renders
 */

// ---------------------------------------------------------------------------
// Minimal valid PNG builder (no external deps): a solid-colour, uncompressed-
// filter RGB image. Hand-typed base64 PNGs are easy to get subtly wrong;
// building real bytes with Node's own `zlib` guarantees a real browser can
// decode them.
// ---------------------------------------------------------------------------
function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii')
  const lengthBuf = Buffer.alloc(4)
  lengthBuf.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([lengthBuf, typeBuf, data, crcBuf])
}

function buildSolidColorPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 2 // colour type: RGB
  ihdrData[10] = 0 // compression
  ihdrData[11] = 0 // filter
  ihdrData[12] = 0 // interlace
  const ihdr = pngChunk('IHDR', ihdrData)

  const [r, g, b] = rgb
  const rows: Buffer[] = []
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3)
    row[0] = 0 // per-row filter: none
    for (let x = 0; x < width; x++) {
      row[1 + x * 3] = r
      row[1 + x * 3 + 1] = g
      row[1 + x * 3 + 2] = b
    }
    rows.push(row)
  }
  const idat = pngChunk('IDAT', deflateSync(Buffer.concat(rows)))
  const iend = pngChunk('IEND', Buffer.alloc(0))
  return Buffer.concat([signature, ihdr, idat, iend])
}

const IMAGE_1 = buildSolidColorPng(20, 16, [220, 20, 20]) // red
const IMAGE_2 = buildSolidColorPng(24, 18, [20, 20, 220]) // blue, different size too - a genuinely different plan

// ---------------------------------------------------------------------------
// Dev-only test hook shapes actually used here (mirrors `dev-test-hooks.tsx`).
// Declared loosely (not imported from `src/`) - this spec runs outside the
// app's own tsconfig project and Playwright transpiles without type-checking.
// ---------------------------------------------------------------------------
interface TestHooks {
  getScale: () => { planPxPerMeter: number } | null
  getCameras: () => Array<{ id: string }>
  getSensors: () => Array<{ id: string }>
  getHubs: () => Array<{ id: string }>
  getCables: () => Array<{ id: string }>
  getFireAlarmDevices: () => Array<{ id: string }>
  setScale: (scale: { planPxPerMeter: number; refLine: { x1: number; y1: number; x2: number; y2: number }; refLengthM: number }) => void
  seedCamera: (camera: { modelId: string; x: number; y: number; rotationDeg: number; rangeM: number }) => void
  seedSensor: (sensor: { modelId: string; shape: 'sector'; x: number; y: number; rotationDeg: number; rangeM: number }) => void
  seedHub: (hub: { x: number; y: number; mountHeightM: number }) => void
  seedCable: (cable: { device: { kind: 'camera'; id: string }; hubId: string; typeId: string; points: Array<{ x: number; y: number }> }) => void
  seedFireAlarmDevice: (device: { modelId: string; x: number; y: number }) => void
}
declare global {
  interface Window {
    __cameraLayoutToolTestHooks?: TestHooks
  }
}

/** The subset of the saved v7 project file this spec reads back - loose on purpose (full validation is the domain schema's job, covered by Vitest). */
interface SavedFloor {
  image: { dataUrl: string }
  scale: unknown
  cameras: unknown[]
  walls: unknown[]
  sensors: unknown[]
  hubs: unknown[]
  cables: unknown[]
  fireAlarmDevices: unknown[]
}
interface SavedProject {
  app: string
  schemaVersion: number
  floors: SavedFloor[]
  cableTypes: unknown
  cableSettings: unknown
  fireAlarmSettings: unknown
}

/** Real catalog model ids (verified against `data/`) - the broken draft this replaces used placeholders that do not exist in the catalog. */
const CAMERA_MODEL_ID = 'hikvision-ds-2cd2t47g2-l-2.8mm'
const PIR_SENSOR_MODEL_ID = 'hikvision-ds-pdpg12p-eg2-pir'
const FIRE_PANEL_MODEL_ID = 'hikvision-ds-pha48-ep'

async function waitForTestHooks(page: Page): Promise<void> {
  await page.waitForFunction(() => !!window.__cameraLayoutToolTestHooks, { timeout: 10_000 })
}

async function loadImage(page: Page, buffer: Buffer, fileName: string): Promise<void> {
  await page.locator('[data-testid="load-image-input"]').setInputFiles({ name: fileName, mimeType: 'image/png', buffer })
}

async function canvasCount(page: Page): Promise<number> {
  return page.locator('[data-testid="stage-container"] canvas').count()
}

/** Clicks the button `times` times, confirming it is enabled before each click (does not require it to become disabled after the last one). */
async function clickButtonTimes(page: Page, testId: string, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    const button = page.locator(`[data-testid="${testId}"]`)
    await expect(button).toBeEnabled()
    await button.click()
  }
}

test.describe('single-floor-editing-smoke', () => {
  test('load, edit, undo/redo, replace, save/reload, legacy open - one continuous session', async ({ page }) => {
    test.setTimeout(90_000)

    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[console] ${msg.text()}`)
    })
    page.on('pageerror', (err) => pageErrors.push(`[page] ${err.message}`))
    page.on('dialog', (dialog) => dialog.accept())

    await page.goto('/')
    await waitForTestHooks(page)

    await test.step('1. load a generated PNG -> a canvas renders', async () => {
      await loadImage(page, IMAGE_1, 'image-1.png')
      await expect(page.locator('[data-testid="stage-container"] canvas').first()).toBeVisible()
      expect(await canvasCount(page)).toBeGreaterThan(0)
    })

    await test.step('2. load the SAME file again -> canvas still there (decodedImage must not get stuck null)', async () => {
      await loadImage(page, IMAGE_1, 'image-1.png')
      await expect(page.locator('[data-testid="stage-container"] canvas').first()).toBeVisible()
      expect(await canvasCount(page)).toBeGreaterThan(0)
    })

    await test.step('3. place scale + camera + sensor + hub + cable + fire-alarm device; undo all; redo all', async () => {
      await page.evaluate(
        ({ scale }) => window.__cameraLayoutToolTestHooks!.setScale(scale),
        { scale: { planPxPerMeter: 10, refLine: { x1: 10, y1: 10, x2: 110, y2: 10 }, refLengthM: 10 } },
      )
      const scale = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getScale())
      expect(scale?.planPxPerMeter).toBe(10)

      await page.evaluate(
        ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedCamera({ modelId, x: 30, y: 30, rotationDeg: 0, rangeM: 10 }),
        { modelId: CAMERA_MODEL_ID },
      )
      await page.evaluate(
        ({ modelId }) =>
          window.__cameraLayoutToolTestHooks!.seedSensor({ modelId, shape: 'sector', x: 50, y: 50, rotationDeg: 0, rangeM: 8 }),
        { modelId: PIR_SENSOR_MODEL_ID },
      )
      await page.evaluate(() => window.__cameraLayoutToolTestHooks!.seedHub({ x: 70, y: 70, mountHeightM: 1.5 }))
      await page.evaluate(({ modelId }) => window.__cameraLayoutToolTestHooks!.seedFireAlarmDevice({ modelId, x: 20, y: 20 }), {
        modelId: FIRE_PANEL_MODEL_ID,
      })

      const cameraId = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCameras()))[0].id
      const hubId = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getHubs()))[0].id
      await page.evaluate(
        ({ cameraId: camId, hubId: hId }) =>
          window.__cameraLayoutToolTestHooks!.seedCable({
            device: { kind: 'camera', id: camId },
            hubId: hId,
            typeId: 'cat6-utp',
            points: [],
          }),
        { cameraId, hubId },
      )

      const counts = async () => ({
        scale: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getScale()),
        cameras: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCameras().length),
        sensors: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getSensors().length),
        hubs: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getHubs().length),
        cables: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCables().length),
        fireAlarmDevices: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFireAlarmDevices().length),
      })

      const placed = await counts()
      expect(placed).toEqual({ scale: expect.any(Object), cameras: 1, sensors: 1, hubs: 1, cables: 1, fireAlarmDevices: 1 })

      // 6 undo steps (setScale, seedCamera, seedSensor, seedHub, seedFireAlarmDevice, seedCable) -
      // one each, per `createPlacedItemActions`/`createCablingActions`/`createFireAlarmActions`'s
      // "no-op or one undo step" contract - back to the empty floor (image still loaded).
      await clickButtonTimes(page, 'undo-button', 6)
      const empty = await counts()
      expect(empty).toEqual({ scale: null, cameras: 0, sensors: 0, hubs: 0, cables: 0, fireAlarmDevices: 0 })
      expect(await canvasCount(page)).toBeGreaterThan(0) // the image itself was never undone

      await clickButtonTimes(page, 'redo-button', 6)
      const restored = await counts()
      expect(restored).toEqual(placed)
    })

    await test.step('4. replace with a DIFFERENT PNG -> items cleared; one undo -> old image + items back, canvas renders', async () => {
      await loadImage(page, IMAGE_2, 'image-2.png')
      const clearedCounts = {
        scale: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getScale()),
        cameras: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCameras().length),
      }
      expect(clearedCounts).toEqual({ scale: null, cameras: 0 })
      await expect(page.locator('[data-testid="stage-container"] canvas').first()).toBeVisible()

      await clickButtonTimes(page, 'undo-button', 1)

      const restoredScale = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getScale())
      const restoredCameras = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCameras().length)
      expect(restoredScale?.planPxPerMeter).toBe(10)
      expect(restoredCameras).toBe(1)
      // The bitmap on screen must be the OLD (image-1) one again, not stuck blank/null (C1/C2 regression guard).
      await expect(page.locator('[data-testid="stage-container"] canvas').first()).toBeVisible()
      expect(await canvasCount(page)).toBeGreaterThan(0)
    })

    let savedProjectJson: SavedProject | null = null
    await test.step('5. save (capture the download), reload, open it -> same counts; schemaVersion 7, floors.length 1', async () => {
      const downloadPromise = page.waitForEvent('download')
      await page.locator('[data-testid="save-project-button"]').click()
      const download = await downloadPromise
      const stream = await download.createReadStream()
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(chunk as Buffer)
      const savedText = Buffer.concat(chunks).toString('utf-8')
      savedProjectJson = JSON.parse(savedText)

      expect(savedProjectJson!.app).toBe('camera-layout-tool')
      expect(savedProjectJson!.schemaVersion).toBe(7)
      expect(Array.isArray(savedProjectJson!.floors)).toBe(true)
      expect(savedProjectJson!.floors).toHaveLength(1)
      const savedFloor = savedProjectJson!.floors[0]
      expect(savedFloor.cameras).toHaveLength(1)
      expect(savedFloor.sensors).toHaveLength(1)
      expect(savedFloor.hubs).toHaveLength(1)
      expect(savedFloor.cables).toHaveLength(1)
      expect(savedFloor.fireAlarmDevices).toHaveLength(1)
      expect(savedFloor.image.dataUrl).toContain('data:image/png;base64,')

      await page.reload()
      await waitForTestHooks(page)

      await page.locator('[data-testid="open-project-button"]').click()
      await page.locator('[data-testid="load-project-input"]').setInputFiles({
        name: 'project.json',
        mimeType: 'application/json',
        buffer: Buffer.from(savedText, 'utf-8'),
      })

      // `setInputFiles` only waits for the input's change event to be dispatched, not for the
      // page's own async handler (file.text() -> parse -> decode every floor's image ->
      // replaceProject) to finish - `toPass` retries the read until the store has caught up
      // instead of asserting on a possibly-still-loading snapshot.
      await expect(async () => {
        const reopened = {
          cameras: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCameras().length),
          sensors: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getSensors().length),
          hubs: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getHubs().length),
          cables: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCables().length),
          fireAlarmDevices: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFireAlarmDevices().length),
        }
        expect(reopened).toEqual({ cameras: 1, sensors: 1, hubs: 1, cables: 1, fireAlarmDevices: 1 })
      }).toPass({ timeout: 5_000 })
      await expect(page.locator('[data-testid="stage-container"] canvas').first()).toBeVisible()
    })

    await test.step('6. open a legacy flat v6 JSON derived from the saved one -> loads as one floor, canvas renders', async () => {
      const floor = savedProjectJson!.floors[0]
      const legacyV6 = {
        app: 'camera-layout-tool',
        schemaVersion: 6,
        image: floor.image,
        scale: floor.scale,
        cameras: floor.cameras,
        walls: floor.walls,
        sensors: floor.sensors,
        hubs: floor.hubs,
        cables: floor.cables,
        cableTypes: savedProjectJson!.cableTypes,
        cableSettings: savedProjectJson!.cableSettings,
        fireAlarmDevices: floor.fireAlarmDevices,
        fireAlarmSettings: savedProjectJson!.fireAlarmSettings,
      }

      await page.locator('[data-testid="open-project-button"]').click()
      await page.locator('[data-testid="load-project-input"]').setInputFiles({
        name: 'legacy-v6-project.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(legacyV6), 'utf-8'),
      })

      await expect(async () => {
        const legacyLoaded = {
          cameras: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCameras().length),
          sensors: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getSensors().length),
          scaleSet: (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getScale())) !== null,
        }
        expect(legacyLoaded).toEqual({ cameras: 1, sensors: 1, scaleSet: true })
      }).toPass({ timeout: 5_000 })
      await expect(page.locator('[data-testid="stage-container"] canvas').first()).toBeVisible()
    })

    const filteredErrors = [...consoleErrors, ...pageErrors]
    if (filteredErrors.length > 0) {
      console.error('Console/page errors collected during the run:\n' + filteredErrors.join('\n'))
    }
    expect(filteredErrors).toEqual([])
  })
})
