import { test, expect, type Page } from '@playwright/test'
import { buildSolidColorPng } from './helpers/build-solid-color-png'
import {
  CAMERA_MODEL_ID,
  canvasCount,
  clearNotifications,
  clickImagePx,
  loadImage,
  waitForDecodedImageSize,
  waitForTestHooks,
} from './helpers/test-hooks'

/** Clicks the real canvas to select whatever marker/device sits at this image px - "select by clicking", not the `selectHub`/`selectCable` dev hooks (review item: select markers by clicking them). Only valid in `select` tool mode. */
async function clickToSelect(page: Page, x: number, y: number): Promise<void> {
  await clickImagePx(page, x, y)
}

/**
 * Phase 6 smoke test: a shaft spanning 3 floors, several exits, per-cable
 * exit choice, bulk assign, exit removal, delete + undo, save/reload - all
 * through the real UI (shaft tool click + dialog, trunk tool via real mouse
 * clicks, the cable panel's exit `<select>`) except camera/cable seeding
 * (dev hooks, same convention as the phase 4/5 specs).
 *
 * Layout: F1/F2/F3, each 300x300, scale 10 px/m (ref line 100 px = 10 m).
 * `floorHeightM`: F1 3, F2 3.5, F3 unused (top floor). Shaft "Main shaft"
 * clicked at (50,50) on F1, range F1-F3 -> marker T1 on every floor, same
 * image px (no clamping needed, all floors the same size).
 *
 * Exit F1: T1 -> H1 (150,50), trunk 100 px = 10 m; H1 mountHeightM 1.5 (the
 * hub default) => typed drop beyond it = |3 - 1.5| = 1.5 m.
 * Exit F3: T1 -> H2 (150,50), trunk 100 px = 10 m; H2 same typed 1.5 m.
 *
 * Cable C1 on F2: camera (50,10) -> T1 (50,50), vertical route 40 px = 4 m.
 *   Via F1: crossingVerticalM = sumFloorHeightsBetween(F2,F1) = F1's own
 *     floorHeightM = 3; beyond = 3 + 10 (F1 trunk) + 1.5 (H1) = 14.5.
 *     fixedM = deviceRiseM 0 + slack 3.5 + 14.5 = 18.0; run = 4 + 18.0 = 22.0 m.
 *   Via F3: crossingVerticalM = F2's own floorHeightM = 3.5; beyond =
 *     3.5 + 10 (F3 trunk) + 1.5 (H2) = 15.0; fixedM = 0 + 3.5 + 15.0 = 18.5;
 *     run = 4 + 18.5 = 22.5 m.
 */

const FLOOR_IMAGE = buildSolidColorPng(300, 300, [120, 120, 120])
const SCALE = { planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 10 }

/** Sets the active floor's scale. The height input only exists once a floor is NOT the top one - setting heights is done in a separate pass once all three floors exist (see step 1). */
async function setScaleOnly(page: Page): Promise<void> {
  await page.evaluate(({ scale }) => window.__cameraLayoutToolTestHooks!.setScale(scale), { scale: SCALE })
}

test.describe('shaft-several-exits-smoke', () => {
  test('shaft tool + dialog, real-mouse trunk drawing, several exits, exit choice, bulk assign, removal, delete + undo, save/reload', async ({
    page,
  }) => {
    test.setTimeout(150_000)

    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[console] ${msg.text()}`)
    })
    page.on('pageerror', (err) => pageErrors.push(`[page] ${err.message}`))
    let lastDialogMessage: string | null = null
    page.on('dialog', (dialog) => {
      lastDialogMessage = dialog.message()
      void dialog.accept()
    })

    await page.goto('/')
    await waitForTestHooks(page)

    await test.step('1. three floors, each with the plan and scale; heights set once all three exist (the top floor never has a height input)', async () => {
      await loadImage(page, FLOOR_IMAGE, 'f1.png')
      await setScaleOnly(page)

      await page.locator('[data-testid="floor-tab-add-button"]').click()
      await loadImage(page, FLOOR_IMAGE, 'f2.png')
      await setScaleOnly(page)

      await page.locator('[data-testid="floor-tab-add-button"]').click()
      await loadImage(page, FLOOR_IMAGE, 'f3.png')
      await setScaleOnly(page)

      await page.locator('[data-testid="floor-tab-button-0"]').click()
      await waitForDecodedImageSize(page, 300, 300)
      await page.locator('[data-testid="floor-height-input"]').fill('3')
      await page.locator('[data-testid="floor-height-input"]').press('Enter')

      await page.locator('[data-testid="floor-tab-button-1"]').click()
      await waitForDecodedImageSize(page, 300, 300)
      await page.locator('[data-testid="floor-height-input"]').fill('3.5')
      await page.locator('[data-testid="floor-height-input"]').press('Enter')

      await page.locator('[data-testid="floor-tab-button-0"]').click()
      await waitForDecodedImageSize(page, 300, 300)
    })

    let h1Id = ''
    let h2Id = ''
    let shaftId = ''
    let markerF1Id = ''
    let markerF2Id = ''
    let markerF3Id = ''

    await test.step('2. seed H1 (F1) and H2 (F3) - plain hubs the exits will route to', async () => {
      await page.evaluate(() => window.__cameraLayoutToolTestHooks!.seedHub({ x: 150, y: 50, mountHeightM: 1.5 }))
      h1Id = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[0].hubs[0].id

      await page.locator('[data-testid="floor-tab-button-2"]').click()
      await waitForDecodedImageSize(page, 300, 300)
      await page.evaluate(() => window.__cameraLayoutToolTestHooks!.seedHub({ x: 150, y: 50, mountHeightM: 1.5 }))
      h2Id = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[2].hubs[0].id

      await page.locator('[data-testid="floor-tab-button-0"]').click()
      await waitForDecodedImageSize(page, 300, 300)
    })

    await test.step('3. Shaft tool: click the plan, dialog (range F1-F3 default), confirm -> marker T1 on every floor', async () => {
      await page.locator('[data-testid="add-shaft-button"]').click()
      await clickImagePx(page, 50, 50)

      const dialog = page.locator('[role="dialog"]')
      await expect(dialog).toBeVisible()
      await page.locator('[data-testid="shaft-range-name-input"]').fill('Main shaft')
      // Defaults are already "lowest .. highest" (F1 .. F3) - just confirm.
      await page.locator('[data-testid="shaft-range-confirm-button"]').click()
      await expect(dialog).toHaveCount(0)

      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors.every((f) => f.hubs.some((h) => h.kind === 'shaft'))).toBe(true)
      shaftId = floors[0].hubs.find((h) => h.kind === 'shaft')!.shaftId!
      markerF1Id = floors[0].hubs.find((h) => h.kind === 'shaft')!.id
      markerF2Id = floors[1].hubs.find((h) => h.kind === 'shaft')!.id
      markerF3Id = floors[2].hubs.find((h) => h.kind === 'shaft')!.id

      const shafts = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getShafts())
      expect(shafts).toEqual([{ id: shaftId, name: 'Main shaft' }])

      // H5 regression: Create auto-selects the marker on the ACTIVE floor (F1) with NO manual
      // selection call here - the shaft panel must appear on its own, reading the FRESH store state
      // right after the write (not a stale pre-write closure).
      await expect(page.locator('[data-testid="properties-hub-number"]')).toContainText('T1')
      expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getSelectedHubId())).toBe(markerF1Id)
    })

    await test.step('4. F1: draw the first exit route via REAL mouse clicks (T1 -> H1) - the shaft\'s implicit single exit', async () => {
      await page.locator('[data-testid="shaft-draw-route-button"]').click()
      await clearNotifications(page)
      await clickImagePx(page, 150, 50) // H1 - commits
      await expect(page.locator('[data-testid="shaft-redraw-route-button"]')).toBeVisible()

      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      const trunk = floors[0].hubs.find((h) => h.id === markerF1Id)!.trunk!
      expect(trunk.hubId).toBe(h1Id)
    })

    let camera1Id = ''
    let cable1Id = ''
    await test.step('5. F2: a cable from a camera to T1 - implicit single exit, hand-computed 22.0 m', async () => {
      await page.locator('[data-testid="floor-tab-button-1"]').click()
      await waitForDecodedImageSize(page, 300, 300)
      await page.evaluate(
        ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedCamera({ modelId, x: 50, y: 10, rotationDeg: 0, rangeM: 10 }),
        { modelId: CAMERA_MODEL_ID },
      )
      const floor2 = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[1]
      camera1Id = (floor2.cameras[0] as { id: string }).id
      await page.evaluate(
        ({ cameraId, hubId }) =>
          window.__cameraLayoutToolTestHooks!.seedCable({ device: { kind: 'camera', id: cameraId }, hubId, typeId: 'cat6-utp', points: [] }),
        { cameraId: camera1Id, hubId: markerF2Id },
      )
      cable1Id = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[1].cables[0].id

      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), cable1Id)
      await expect(page.locator('[data-testid="properties-cable-run"]')).toContainText('22.0 m')
      await expect(page.locator('[data-testid="properties-cable-label"]')).toContainText('C1-T1')
      // Only one exit so far - no exit suffix, no exit select shown.
      await expect(page.locator('[data-testid="cable-exit-select"]')).toHaveCount(0)
    })

    await test.step('6. F3: draw the SECOND exit route via real mouse clicks - C1 (choiceless) is stamped to F1, length unchanged', async () => {
      await page.locator('[data-testid="floor-tab-button-2"]').click()
      await waitForDecodedImageSize(page, 300, 300)
      await clickToSelect(page, 50, 50) // T1's marker position on F3 - select by clicking, not the dev hook
      expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getSelectedHubId())).toBe(markerF3Id)
      await expect(page.locator('[data-testid="properties-hub-number"]')).toContainText('T1')

      await page.locator('[data-testid="shaft-draw-route-button"]').click()
      await clearNotifications(page)
      await clickImagePx(page, 150, 50) // H2 - commits, the shaft's second exit
      await expect(page.locator('[data-testid="shaft-redraw-route-button"]')).toBeVisible()

      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors[2].hubs.find((h) => h.id === markerF3Id)!.trunk!.hubId).toBe(h2Id)
      const f1IdValue = floors[0].id
      expect(floors[1].cables[0].exitFloorId).toBe(f1IdValue) // stamped - preserved what it was implicitly using

      await page.locator('[data-testid="floor-tab-button-1"]').click()
      await waitForDecodedImageSize(page, 300, 300)
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), cable1Id)
      await expect(page.locator('[data-testid="properties-cable-run"]')).toContainText('22.0 m') // unchanged
      await expect(page.locator('[data-testid="properties-cable-label"]')).toContainText('C1-T1>F1')
    })

    let cable2Id = ''
    await test.step('7. draw a NEW cable onto the several-exit shaft with the REAL cable tool: no default exit, select-after-draw + "Choose the exit" notification, warned + counted red in the shaft summary', async () => {
      // (10,50): SAME 40 px / 4 m distance to T1 (50,50) as camera 1's (50,10) - just the other
      // axis - so the hand-computed 22.5 m (via F3) below still holds. Deliberately NOT the same
      // point as camera 1 (50,10): identical positions would make the next click's nearest-device
      // snap tie-break onto camera 1 instead (devices are tied by distance, first-in-array wins).
      // Seeded (not dragged from the catalog sidebar - a separate, already-covered interaction);
      // the CABLE itself below is drawn through the real "Draw cable" tool with real mouse clicks.
      await page.evaluate(
        ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedCamera({ modelId, x: 10, y: 50, rotationDeg: 0, rangeM: 10 }),
        { modelId: CAMERA_MODEL_ID },
      )

      await page.locator('[data-testid="draw-cable-button"]').click()
      await clearNotifications(page)
      await clickImagePx(page, 10, 50) // starts on the new camera (C2)
      await clickImagePx(page, 50, 50) // ends on T1 - commits

      const floor2After = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[1]
      const newCable = floor2After.cables.find((c) => c.hubId === markerF2Id && c.id !== cable1Id)
      expect(newCable).toBeDefined()
      cable2Id = newCable!.id

      // Select-after-draw: the cable panel shows the JUST-drawn cable (no selectCable hook call),
      // and the "Choose the exit" notification appeared - both without any default exit assigned.
      await expect(page.locator('[data-testid="notification-banner"]')).toContainText('Choose the exit')
      await expect(page.locator('[data-testid="properties-cable-no-estimate"]')).toContainText('no exit chosen')
      expect(newCable!.exitFloorId).toBeUndefined()

      await page.locator('[data-testid="draw-cable-button"]').click() // leave the cable tool - back to select
      await clickToSelect(page, 50, 50) // T1's marker position on F2 - select by clicking
      expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getSelectedHubId())).toBe(markerF2Id)
      await expect(page.locator('[data-testid="shaft-not-chosen-count"]')).toContainText('No exit chosen: 1')
      await expect(page.locator('[data-testid="shaft-not-chosen-count"]')).toHaveClass(/text-red-600/)
    })

    await test.step('8. choose the exit (F3) in the cable panel -> hand-computed 22.5 m, label "C2-T1>F3"', async () => {
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), cable2Id)
      const f3Id = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[2].id
      await page.locator('[data-testid="cable-exit-select"]').selectOption(f3Id)

      await expect(page.locator('[data-testid="properties-cable-run"]')).toContainText('22.5 m')
      await expect(page.locator('[data-testid="properties-cable-label"]')).toContainText('C2-T1>F3')

      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), markerF2Id)
      await expect(page.locator('[data-testid="shaft-not-chosen-count"]')).toContainText('No exit chosen: 0')
    })

    let cable3Id = ''
    await test.step('9. bulk assign: a third choiceless cable on F2 is assigned to F1 in one action', async () => {
      await page.evaluate(
        ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedCamera({ modelId, x: 70, y: 10, rotationDeg: 0, rangeM: 10 }),
        { modelId: CAMERA_MODEL_ID },
      )
      const floor2 = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[1]
      const camera3Id = (floor2.cameras[2] as { id: string }).id
      await page.evaluate(
        ({ cameraId, hubId }) =>
          window.__cameraLayoutToolTestHooks!.seedCable({ device: { kind: 'camera', id: cameraId }, hubId, typeId: 'cat6-utp', points: [] }),
        { cameraId: camera3Id, hubId: markerF2Id },
      )
      const cables = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[1].cables
      cable3Id = cables[cables.length - 1].id

      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), markerF2Id)
      await expect(page.locator('[data-testid="shaft-not-chosen-count"]')).toContainText('No exit chosen: 1')

      const f1Id = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[0].id
      await page.locator('[data-testid="shaft-bulk-assign-select"]').selectOption(f1Id)
      await page.locator('[data-testid="shaft-bulk-assign-button"]').click()

      await expect(page.locator('[data-testid="shaft-not-chosen-count"]')).toContainText('No exit chosen: 0')
      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors[1].cables.find((c) => c.id === cable3Id)!.exitFloorId).toBe(f1Id)
    })

    await test.step('10. remove the F3 exit route: M6 confirm names the 1 cable using it; choices naming it are cleared; the shaft returns to a single implicit exit', async () => {
      await page.locator('[data-testid="floor-tab-button-2"]').click()
      await waitForDecodedImageSize(page, 300, 300)
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), markerF3Id)
      lastDialogMessage = null
      await page.locator('[data-testid="shaft-remove-route-button"]').click()
      expect(lastDialogMessage).toMatch(/1 cable/) // M6: only cable2 (C2) uses the F3 exit at this point

      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors[2].hubs.find((h) => h.id === markerF3Id)!.trunk).toBeUndefined()
      const cable2 = floors[1].cables.find((c) => c.id === cable2Id)!
      expect(cable2.exitFloorId).toBeUndefined() // cleared - F3 is no longer a valid exit

      await page.locator('[data-testid="floor-tab-button-1"]').click()
      await waitForDecodedImageSize(page, 300, 300)
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), cable2Id)
      // Back to implicit single exit (F1) - run resolves again, no exit select shown.
      await expect(page.locator('[data-testid="properties-cable-run"]')).toContainText('22.0 m')
      await expect(page.locator('[data-testid="cable-exit-select"]')).toHaveCount(0)
    })

    await test.step('10b. export the PNG of F2 (holds a shaft marker, T1) - non-trivial file', async () => {
      const downloadPromise = page.waitForEvent('download')
      await page.locator('[data-testid="export-png-button"]').click()
      const download = await downloadPromise
      const stream = await download.createReadStream()
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(chunk as Buffer)
      const pngBuffer = Buffer.concat(chunks)
      expect(pngBuffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a') // PNG signature
      expect(pngBuffer.length).toBeGreaterThan(1000) // non-trivial, not a near-empty file
    })

    await test.step('11. delete the shaft: confirm names counts; undo restores everything', async () => {
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), markerF2Id)
      await page.locator('[data-testid="shaft-delete-button"]').click()
      expect(lastDialogMessage).toContain('Main shaft')
      expect(lastDialogMessage).toMatch(/3 openings/)
      expect(lastDialogMessage).toMatch(/3 cables/) // C1, C2, C3 - all three end on F2's marker

      let floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors.every((f) => !f.hubs.some((h) => h.kind === 'shaft'))).toBe(true)
      expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getShafts())).toEqual([])

      await page.locator('[data-testid="undo-button"]').click()
      floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors.every((f) => f.hubs.some((h) => h.kind === 'shaft'))).toBe(true)
      expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getShafts())).toEqual([{ id: shaftId, name: 'Main shaft' }])
    })

    await test.step('12. save -> reload -> open: shafts, markers, exits and exitFloorId all intact', async () => {
      const downloadPromise = page.waitForEvent('download')
      await page.locator('[data-testid="save-project-button"]').click()
      const download = await downloadPromise
      const stream = await download.createReadStream()
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(chunk as Buffer)
      const savedText = Buffer.concat(chunks).toString('utf-8')

      await page.reload()
      await waitForTestHooks(page)
      await page.locator('[data-testid="open-project-button"]').click()
      await page.locator('[data-testid="load-project-input"]').setInputFiles({
        name: 'project.json',
        mimeType: 'application/json',
        buffer: Buffer.from(savedText, 'utf-8'),
      })

      await expect(async () => {
        const shafts = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getShafts())
        expect(shafts).toEqual([{ id: shaftId, name: 'Main shaft' }])
      }).toPass({ timeout: 5_000 })

      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors.every((f) => f.hubs.some((h) => h.kind === 'shaft' && h.shaftId === shaftId))).toBe(true)
      expect(floors[0].hubs.find((h) => h.id === markerF1Id)!.trunk?.hubId).toBe(h1Id)
      expect(floors[2].hubs.find((h) => h.id === markerF3Id)!.trunk).toBeUndefined() // removed in step 10
      const f1Id = floors[0].id
      expect(floors[1].cables.find((c) => c.id === cable1Id)!.exitFloorId).toBe(f1Id)
      expect(floors[1].cables.find((c) => c.id === cable2Id)!.exitFloorId).toBeUndefined()
      expect(floors[1].cables.find((c) => c.id === cable3Id)!.exitFloorId).toBe(f1Id)
    })

    const filteredErrors = [...consoleErrors, ...pageErrors]
    if (filteredErrors.length > 0) {
      console.error('Console/page errors collected during the run:\n' + filteredErrors.join('\n'))
    }
    expect(filteredErrors).toEqual([])
    expect(await canvasCount(page)).toBeGreaterThan(0)
  })
})
