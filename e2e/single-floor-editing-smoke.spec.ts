import { test, expect } from '@playwright/test'
import { buildSolidColorPng } from './helpers/build-solid-color-png'
import {
  CAMERA_MODEL_ID,
  FIRE_PANEL_MODEL_ID,
  PIR_SENSOR_MODEL_ID,
  canvasCount,
  clickButtonTimes,
  loadImage,
  waitForTestHooks,
} from './helpers/test-hooks'

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

const IMAGE_1 = buildSolidColorPng(20, 16, [220, 20, 20]) // red
const IMAGE_2 = buildSolidColorPng(24, 18, [20, 20, 220]) // blue, different size too - a genuinely different plan

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
