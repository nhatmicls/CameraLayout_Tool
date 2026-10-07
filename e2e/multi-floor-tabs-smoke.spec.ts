import { test, expect, type Locator } from '@playwright/test'
import { buildSolidColorPng } from './helpers/build-solid-color-png'
import {
  CAMERA_MODEL_ID,
  PIR_SENSOR_MODEL_ID,
  canvasCount,
  loadImage,
  waitForDecodedImageSize,
  waitForTestHooks,
} from './helpers/test-hooks'

/**
 * Multi-floor tab bar smoke test (phase 3, + the coordinator's phase-3
 * review fixes C1/C2/H1/H2/M1-M4). Runs against the Vite DEV server (see
 * `playwright.config.ts`) for the same reason as
 * `single-floor-editing-smoke.spec.ts`: `window.__cameraLayoutToolTestHooks`
 * seeds catalog items without reimplementing drag-and-drop onto Konva.
 *
 * Four tests in this file:
 *  1. The main continuous session (add/edit/rename/move/delete+undo/height/
 *     save-reload-open), `test.step`-segmented - each step depends on the
 *     live store state the previous one left behind. M4: asserts the
 *     delete confirm dialog's text, the REAL decoded bitmap size per floor
 *     (not just "a canvas exists"), Esc/empty rename, and undo of an add.
 *  2. C1 regression: tab 1 has no image, tab 2 does - save/reload/open must
 *     still work (the old code refused any file whose FIRST floor lacked
 *     an image).
 *  3. C2 regression: switching floors while a big image is still decoding
 *     must abort that load with a warning, not silently land it on
 *     whichever floor happens to be active when the decode finishes.
 *  4. H1 regression: Save project stays enabled while the ACTIVE floor has
 *     no image, as long as some OTHER floor does.
 *  5. A floor-switch latency measurement (phase file step 6), waiting on
 *     the real decoded-bitmap signal rather than timing the remount alone.
 */

const IMAGE_1 = buildSolidColorPng(20, 16, [220, 20, 20]) // red
const IMAGE_2 = buildSolidColorPng(28, 22, [20, 120, 20]) // green, different size - a genuinely different plan

interface SavedFloor {
  name: string
  floorHeightM: number
  image: { dataUrl: string } | null
  cameras: unknown[]
  sensors: unknown[]
}
interface SavedProject {
  schemaVersion: number
  floors: SavedFloor[]
}

/** Attaches a persistent dialog auto-accepter that also records the last message seen, so a step can assert what the dialog actually SAID (M4) without losing the "never block on a native dialog" safety net. */
function trackDialogs(page: import('@playwright/test').Page): { lastMessage: () => string | null } {
  let lastMessage: string | null = null
  page.on('dialog', (dialog) => {
    lastMessage = dialog.message()
    void dialog.accept()
  })
  return { lastMessage: () => lastMessage }
}

test.describe('multi-floor-tabs-smoke', () => {
  test('add, edit independently, rename, move, delete + undo, set height, save/reload - one continuous session', async ({ page }) => {
    test.setTimeout(90_000)

    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[console] ${msg.text()}`)
    })
    page.on('pageerror', (err) => pageErrors.push(`[page] ${err.message}`))
    const dialogs = trackDialogs(page)

    await page.goto('/')
    await waitForTestHooks(page)

    await test.step('1. floor 1: load an image, set scale, place a camera + sensor', async () => {
      await loadImage(page, IMAGE_1, 'floor-1.png')
      await waitForDecodedImageSize(page, 20, 16) // M4: the REAL bitmap, not just "a canvas exists"

      await page.evaluate(
        ({ scale }) => window.__cameraLayoutToolTestHooks!.setScale(scale),
        { scale: { planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 10, y2: 0 }, refLengthM: 1 } },
      )
      await page.evaluate(
        ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedCamera({ modelId, x: 5, y: 5, rotationDeg: 0, rangeM: 5 }),
        { modelId: CAMERA_MODEL_ID },
      )
      await page.evaluate(
        ({ modelId }) =>
          window.__cameraLayoutToolTestHooks!.seedSensor({ modelId, shape: 'sector', x: 8, y: 8, rotationDeg: 0, rangeM: 3 }),
        { modelId: PIR_SENSOR_MODEL_ID },
      )

      // Exactly one floor tab, active, before any floor is added.
      await expect(page.locator('[data-testid="floor-tab-0"]')).toBeVisible()
      await expect(page.locator('[data-testid="floor-tab-1"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="floor-tab-button-0"]')).toHaveAttribute('aria-selected', 'true')
    })

    await test.step('2. "+" adds floor 2 -> empty picker, named for the new floor', async () => {
      await page.locator('[data-testid="floor-tab-add-button"]').click()

      await expect(page.locator('[data-testid="floor-tab-1"]')).toBeVisible()
      await expect(page.locator('[data-testid="floor-tab-button-1"]')).toHaveAttribute('aria-selected', 'true')
      await expect(page.locator('[data-testid="floor-tab-button-0"]')).toHaveAttribute('aria-selected', 'false')

      const emptyState = page.locator('[data-testid="empty-state"]')
      await expect(emptyState).toBeVisible()
      await expect(emptyState).toContainText('F2')
      await expect(emptyState).toContainText('Floor 2')
    })

    await test.step('2b. undo the add -> back to one floor (H2)', async () => {
      await page.locator('[data-testid="undo-button"]').click()
      await expect(page.locator('[data-testid="floor-tab-1"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="floor-tab-button-0"]')).toHaveAttribute('aria-selected', 'true')

      await page.locator('[data-testid="redo-button"]').click() // back to 2 floors for the rest of the test
      await expect(page.locator('[data-testid="floor-tab-1"]')).toBeVisible()
      // H2: redoing an add does NOT auto-switch to it (nothing was just taken away to restore) -
      // still on floor 1. Switch to floor 2 explicitly before step 3 edits it.
      await expect(page.locator('[data-testid="floor-tab-button-0"]')).toHaveAttribute('aria-selected', 'true')
      await page.locator('[data-testid="floor-tab-button-1"]').click()
    })

    await test.step('3. load a DIFFERENT image onto floor 2 -> the REAL bitmap matches it; place a camera via hooks', async () => {
      await loadImage(page, IMAGE_2, 'floor-2.png')
      await waitForDecodedImageSize(page, 28, 22) // distinct size from floor 1's 20x16 - proves it's really floor 2's bitmap

      await page.evaluate(
        ({ scale }) => window.__cameraLayoutToolTestHooks!.setScale(scale),
        { scale: { planPxPerMeter: 12, refLine: { x1: 0, y1: 0, x2: 12, y2: 0 }, refLengthM: 1 } },
      )
      await page.evaluate(
        ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedCamera({ modelId, x: 6, y: 6, rotationDeg: 0, rangeM: 4 }),
        { modelId: CAMERA_MODEL_ID },
      )
      const floor2Cameras = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCameras().length)
      expect(floor2Cameras).toBe(1)
    })

    await test.step('4. switch back to floor 1 -> its items are intact, its OWN bitmap is back on screen', async () => {
      await page.locator('[data-testid="floor-tab-button-0"]').click()
      await expect(page.locator('[data-testid="floor-tab-button-0"]')).toHaveAttribute('aria-selected', 'true')
      await waitForDecodedImageSize(page, 20, 16) // back to floor 1's own bitmap, not floor 2's

      const counts = {
        cameras: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCameras().length),
        sensors: await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getSensors().length),
      }
      expect(counts).toEqual({ cameras: 1, sensors: 1 })
      expect(await canvasCount(page)).toBeGreaterThan(0)
    })

    await test.step('5. rename floor 1: Esc cancels, an empty name reverts, then a real rename commits', async () => {
      const tabButton = page.locator('[data-testid="floor-tab-button-0"]')
      const renameInput = page.locator('[data-testid="floor-tab-rename-input"]')

      await tabButton.dblclick()
      await expect(renameInput).toBeVisible()
      await expect(renameInput).toHaveAttribute('aria-label', /Rename/)
      await renameInput.fill('Should not stick')
      await renameInput.press('Escape')
      await expect(renameInput).toHaveCount(0)
      await expect(tabButton).toContainText('Floor 1') // untouched - Esc cancelled

      await tabButton.dblclick()
      await renameInput.fill('   ')
      await renameInput.press('Enter')
      await expect(tabButton).toContainText('Floor 1') // untouched - empty/whitespace reverts

      await tabButton.dblclick()
      await renameInput.fill('Ground Floor')
      await renameInput.press('Enter')
      await expect(tabButton).toContainText('Ground Floor')
    })

    await test.step('6. move it to the right (reorder) - controls live OUTSIDE role=tablist (M3)', async () => {
      const tablist = page.locator('[data-testid="floor-tabs-bar"]')
      await expect(tablist.locator('[data-testid="floor-tab-move-right-button"]')).toHaveCount(0) // not inside the tablist
      await page.locator('[data-testid="floor-tab-move-right-button"]').click()

      // "Ground Floor" (still the active floor) is now at index 1; the testids are position-based.
      await expect(page.locator('[data-testid="floor-tab-button-1"]')).toContainText('Ground Floor')
      await expect(page.locator('[data-testid="floor-tab-button-1"]')).toHaveAttribute('aria-selected', 'true')
      await expect(page.locator('[data-testid="floor-tab-button-0"]')).toContainText('Floor 2')
    })

    await test.step('7. delete the active floor: the confirm dialog names what is lost, undo restores image/items and switches back to it', async () => {
      await page.locator('[data-testid="floor-tab-delete-button"]').click()
      const dialogText = dialogs.lastMessage()
      expect(dialogText).toContain('Ground Floor')
      expect(dialogText).toContain('plan image')
      expect(dialogText).toContain('camera')
      expect(dialogText).toContain('sensor')
      expect(dialogText).toContain('Can be undone')

      await expect(page.locator('[data-testid="floor-tab-1"]')).toHaveCount(0)

      await page.locator('[data-testid="undo-button"]').click()
      await expect(page.locator('[data-testid="floor-tab-1"]')).toBeVisible()
      await expect(page.locator('[data-testid="floor-tab-button-1"]')).toContainText('Ground Floor')
      // Phase 3 decision (H2 rule ii): undo of a floor delete auto-switches back to the restored floor.
      await expect(page.locator('[data-testid="floor-tab-button-1"]')).toHaveAttribute('aria-selected', 'true')

      const restoredFloors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      const groundFloor = restoredFloors.find((f) => f.name === 'Ground Floor')!
      expect(groundFloor.cameras).toHaveLength(1)
      expect(groundFloor.sensors).toHaveLength(1)
      await waitForDecodedImageSize(page, 20, 16) // Ground Floor's own bitmap is back
    })

    await test.step('8. set the floor height on the other (non-top) floor', async () => {
      await page.locator('[data-testid="floor-tab-button-0"]').click() // "Floor 2", now the lowest tab - not the top floor
      const heightInput = page.locator('[data-testid="floor-height-input"]')
      await expect(heightInput).toBeVisible()
      await expect(heightInput).not.toHaveAttribute('aria-hidden', 'true')
      await heightInput.fill('4.2')
      await heightInput.press('Enter')

      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors[0].floorHeightM).toBeCloseTo(4.2)
      // The top floor ("Ground Floor", index 1) never shows a height input - nothing above it to span.
      await page.locator('[data-testid="floor-tab-button-1"]').click()
      await expect(page.locator('[data-testid="floor-height-input"]')).toHaveCount(0)
    })

    let savedProjectJson: SavedProject | null = null
    await test.step('9. save -> reload -> open -> 2 floors, names, heights, per-floor counts match', async () => {
      const downloadPromise = page.waitForEvent('download')
      await page.locator('[data-testid="save-project-button"]').click()
      const download = await downloadPromise
      const stream = await download.createReadStream()
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(chunk as Buffer)
      const savedText = Buffer.concat(chunks).toString('utf-8')
      savedProjectJson = JSON.parse(savedText)

      expect(savedProjectJson!.schemaVersion).toBe(7)
      expect(savedProjectJson!.floors).toHaveLength(2)
      const [floor2, groundFloor] = savedProjectJson!.floors
      expect(floor2.name).toBe('Floor 2')
      expect(floor2.floorHeightM).toBeCloseTo(4.2)
      expect(floor2.cameras).toHaveLength(1)
      expect(groundFloor.name).toBe('Ground Floor')
      expect(groundFloor.cameras).toHaveLength(1)
      expect(groundFloor.sensors).toHaveLength(1)
      expect(groundFloor.image?.dataUrl).toContain('data:image/png;base64,')

      await page.reload()
      await waitForTestHooks(page)

      await page.locator('[data-testid="open-project-button"]').click()
      await page.locator('[data-testid="load-project-input"]').setInputFiles({
        name: 'project.json',
        mimeType: 'application/json',
        buffer: Buffer.from(savedText, 'utf-8'),
      })

      await expect(async () => {
        const reopenedFloors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
        expect(reopenedFloors).toHaveLength(2)
        expect(reopenedFloors.map((f) => f.name)).toEqual(['Floor 2', 'Ground Floor'])
      }).toPass({ timeout: 5_000 })
      await expect(page.locator('[data-testid="stage-container"] canvas').first()).toBeVisible()
      await expect(page.locator('[data-testid="floor-tab-1"]')).toBeVisible()
    })

    const filteredErrors = [...consoleErrors, ...pageErrors]
    if (filteredErrors.length > 0) {
      console.error('Console/page errors collected during the run:\n' + filteredErrors.join('\n'))
    }
    expect(filteredErrors).toEqual([])
  })

  test('C1: tab 1 has no image, tab 2 does - save/reload/open still works', async ({ page }) => {
    test.setTimeout(60_000)
    page.on('dialog', (dialog) => void dialog.accept())

    await page.goto('/')
    await waitForTestHooks(page)

    // Floor 1 (the default floor) is left completely empty - never gets an image.
    await page.locator('[data-testid="floor-tab-add-button"]').click() // floor 2, now active
    await loadImage(page, IMAGE_1, 'only-floor-2.png')
    await waitForDecodedImageSize(page, 20, 16)

    const beforeSave = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
    expect(beforeSave[0].image).toBeNull()
    expect(beforeSave[1].image).not.toBeNull()

    const downloadPromise = page.waitForEvent('download')
    await page.locator('[data-testid="save-project-button"]').click()
    const download = await downloadPromise
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    const savedText = Buffer.concat(chunks).toString('utf-8')
    const saved: SavedProject = JSON.parse(savedText)
    expect(saved.floors).toHaveLength(2)
    expect(saved.floors[0].image).toBeNull()
    expect(saved.floors[1].image).not.toBeNull()

    await page.reload()
    await waitForTestHooks(page)

    const notificationBanner = page.locator('[data-testid="notification-banner"]')
    await page.locator('[data-testid="open-project-button"]').click()
    await page.locator('[data-testid="load-project-input"]').setInputFiles({
      name: 'project.json',
      mimeType: 'application/json',
      buffer: Buffer.from(savedText, 'utf-8'),
    })

    // C1: this used to be refused outright ("first floor has no plan image").
    await expect(async () => {
      const reopened = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(reopened).toHaveLength(2)
    }).toPass({ timeout: 5_000 })
    await expect(notificationBanner.getByText(/no plan image|has no/i)).toHaveCount(0) // no error about missing images
    // The floor WITH the image becomes active (not floors[0], which has none).
    const activeFloorId = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getActiveFloorId())
    const reopenedFloors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
    expect(reopenedFloors.find((f) => f.id === activeFloorId)?.image).not.toBeNull()
    await expect(page.locator('[data-testid="stage-container"] canvas').first()).toBeVisible()
  })

  test('C2: switching floors while a big image is still decoding aborts that load instead of mis-applying it', async ({ page }) => {
    test.setTimeout(60_000)
    page.on('dialog', (dialog) => void dialog.accept())

    await page.goto('/')
    await waitForTestHooks(page)

    await page.locator('[data-testid="floor-tab-add-button"]').click() // floor 2, now active, no image
    await page.locator('[data-testid="floor-tab-button-0"]').click() // back to floor 1 (also no image), the load TARGET

    // ~20.5 Mpx, large enough that FileReader + decode leaves a real window to switch floors
    // mid-flight (measured consistently hundreds of ms in the latency test below).
    const bigImage = buildSolidColorPng(5000, 4096, [10, 10, 10])

    // Deliberately NOT awaited beyond the input's change event (loadImage only waits for that) -
    // the point of this test is to act WHILE the async decode is still in flight.
    const loadPromise = loadImage(page, bigImage, 'big-race.png')
    await page.locator('[data-testid="floor-tab-button-1"]').click() // switch away from floor 1 before the decode resolves
    await loadPromise

    await expect(page.locator('[data-testid="notification-banner"]')).toContainText('NOT applied', { timeout: 15_000 })

    const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
    expect(floors[0].image).toBeNull() // floor 1 (the load's real target): never got it
    expect(floors[1].image).toBeNull() // floor 2 (active when the decode resolved): did NOT silently receive it either
  })

  test('H1: Save project stays enabled while the active floor has no image, as long as another floor does', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/')
    await waitForTestHooks(page)

    await loadImage(page, IMAGE_1, 'floor-1.png') // floor 1 gets an image
    await waitForDecodedImageSize(page, 20, 16)
    await page.locator('[data-testid="floor-tab-add-button"]').click() // floor 2, now active, NO image

    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible() // confirms floor 2 really has no image
    await expect(page.locator('[data-testid="save-project-button"]')).toBeEnabled()
  })
})

test.describe('multi-floor-tabs-smoke - floor switch latency', () => {
  test('measures the blank-gap when switching between two floors holding a 20+ Mpx plan each', async ({ page }) => {
    test.setTimeout(90_000)
    await page.goto('/')
    await waitForTestHooks(page)

    // ~20.5 Mpx each; solid colour keeps the PNG FILE tiny (well under the 40 MB upload cap)
    // while still forcing the browser to decode + redraw a full 20+ Mpx bitmap on every switch.
    // Deliberately DIFFERENT dimensions per floor so `waitForDecodedImageSize` can confirm the
    // REAL bitmap matches the floor just switched to, not merely that "some" image decoded.
    const BIG_IMAGE_1 = buildSolidColorPng(5000, 4096, [200, 40, 40])
    const BIG_IMAGE_2 = buildSolidColorPng(5004, 4096, [40, 40, 200])

    await loadImage(page, BIG_IMAGE_1, 'big-floor-1.png')
    await waitForDecodedImageSize(page, 5000, 4096)

    await page.evaluate(() => window.__cameraLayoutToolTestHooks!.seedFloor('Big floor 2'))
    await loadImage(page, BIG_IMAGE_2, 'big-floor-2.png')
    await waitForDecodedImageSize(page, 5004, 4096)

    const measureSwitch = async (button: Locator, widthPx: number, heightPx: number): Promise<number> => {
      const start = Date.now()
      await button.click()
      await waitForDecodedImageSize(page, widthPx, heightPx) // M4: the real bitmap, not the remount alone
      return Date.now() - start
    }

    const floor1Button = page.locator('[data-testid="floor-tab-button-0"]')
    const floor2Button = page.locator('[data-testid="floor-tab-button-1"]')

    // First switch each way, then a couple more round trips - a first switch can include extra
    // browser warm-up cost that is not representative of steady-state use.
    await measureSwitch(floor1Button, 5000, 4096)
    const toFloor2WarmMs = await measureSwitch(floor2Button, 5004, 4096)
    const toFloor1WarmMs = await measureSwitch(floor1Button, 5000, 4096)
    const toFloor2Ms = await measureSwitch(floor2Button, 5004, 4096)
    const toFloor1Ms = await measureSwitch(floor1Button, 5000, 4096)

    console.log(
      `[floor-switch-latency] ~20.5 Mpx floors, waiting on the REAL decoded-bitmap signal: warm-up ${toFloor2WarmMs}ms/${toFloor1WarmMs}ms, steady-state ${toFloor2Ms}ms/${toFloor1Ms}ms`,
    )

    // Generous sanity bound (not a strict perf budget - machines vary): the phase file's own
    // ~300 ms "add a cache" threshold is judged from the logged number above, not this assertion.
    expect(toFloor2Ms).toBeLessThan(5000)
    expect(toFloor1Ms).toBeLessThan(5000)
  })
})
