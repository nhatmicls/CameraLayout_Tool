import { test, expect, type Page } from '@playwright/test'
import { buildSolidColorPng } from './helpers/build-solid-color-png'
import {
  CAMERA_MODEL_ID,
  FIRE_PANEL_MODEL_ID,
  canvasCount,
  clearNotifications,
  clickImagePx,
  loadImage,
  waitForDecodedImageSize,
  waitForTestHooks,
} from './helpers/test-hooks'

/**
 * Smoke test of a cable's OWN route beyond a shaft, and of a cable that ends
 * on a device - all through the real UI (shaft tool + dialog, "Draw cable"
 * with real mouse clicks, the shaft panel's "from C1" list and its route
 * button, real clicks to finish the route) except device / hub seeding.
 *
 * Layout: F1 / F2 / F3, each 300x300, scale 10 px/m. `floorHeightM`: F1 3,
 * F2 3.5. Shaft "Main shaft" at (50,50) on every floor (T1). F1 holds hub H1
 * at (150,50), `mountHeightM` 1.5; F3 holds a fire-alarm control panel P1 at
 * (150,50). Route height 3 m = default device height 3 m (no device rise).
 *
 * C1 on F2: camera (50,10) -> T1 (50,50) = 40 px = 4 m.
 *   Not routed ("F2_C1_?"): 4 + rise 0 + slack (0.5 + 3) + 0 beyond = 7.5 m.
 *   Routed on F1 to H1 ("F2_C1_F1_H1"): beyond = F1 height 3 + route 100 px = 10 m
 *     + H1 drop |3 - 1.5| = 1.5 -> 14.5; run = 4 + 0 + 3.5 + 14.5 = 22.0 m.
 * C2 on F2: camera (10,50) -> T1 (50,50) = 4 m, routed on F3 to P1 ("F2_C2_F3_P1"):
 *   beyond = F2 height 3.5 + route 10 m + panel rise |3 - 3| = 0 -> 13.5;
 *   a DEVICE end takes the device slack: 0.5 + 0.5 = 1.
 *   run = 4 + 0 + 1 + 13.5 = 18.5 m.
 */

const FLOOR_IMAGE = buildSolidColorPng(300, 300, [120, 120, 120])
const SCALE = { planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 10 }

async function goToFloor(page: Page, index: number): Promise<void> {
  await page.locator(`[data-testid="floor-tab-button-${index}"]`).click()
  await waitForDecodedImageSize(page, 300, 300)
}

const getFloors = (page: Page) => page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())

test.describe('shaft-per-cable-route-smoke', () => {
  test('F2_C1_? until routed, route each cable from the exit floor\'s shaft opening to a hub / a device, cascade + undo, save/reload', async ({ page }) => {
    test.setTimeout(150_000)

    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`)
    })
    page.on('pageerror', (err) => errors.push(`[page] ${err.message}`))
    page.on('dialog', (dialog) => void dialog.accept())

    await page.goto('/')
    await waitForTestHooks(page)

    await test.step('1. three floors with plan + scale, heights F1 3 / F2 3.5, hub H1 on F1, fire-alarm panel on F3', async () => {
      await loadImage(page, FLOOR_IMAGE, 'f1.png')
      await page.evaluate(({ scale }) => window.__cameraLayoutToolTestHooks!.setScale(scale), { scale: SCALE })
      for (const name of ['f2.png', 'f3.png']) {
        await page.locator('[data-testid="floor-tab-add-button"]').click()
        await loadImage(page, FLOOR_IMAGE, name)
        await page.evaluate(({ scale }) => window.__cameraLayoutToolTestHooks!.setScale(scale), { scale: SCALE })
      }
      await page.evaluate(({ modelId }) => window.__cameraLayoutToolTestHooks!.seedFireAlarmDevice({ modelId, x: 150, y: 50 }), {
        modelId: FIRE_PANEL_MODEL_ID,
      })

      await goToFloor(page, 0)
      await page.locator('[data-testid="floor-height-input"]').fill('3')
      await page.locator('[data-testid="floor-height-input"]').press('Enter')
      await page.evaluate(() => window.__cameraLayoutToolTestHooks!.seedHub({ x: 150, y: 50, mountHeightM: 1.5 }))

      await goToFloor(page, 1)
      await page.locator('[data-testid="floor-height-input"]').fill('3.5')
      await page.locator('[data-testid="floor-height-input"]').press('Enter')
      await goToFloor(page, 0)
    })

    await test.step('2. Shaft tool: one opening (T1) on every floor', async () => {
      await page.locator('[data-testid="add-shaft-button"]').click()
      await clickImagePx(page, 50, 50)
      await page.locator('[data-testid="shaft-range-name-input"]').fill('Main shaft')
      await page.locator('[data-testid="shaft-range-confirm-button"]').click()
      await expect(page.locator('[role="dialog"]')).toHaveCount(0)
      expect((await getFloors(page)).every((floor) => floor.hubs.some((hub) => hub.kind === 'shaft'))).toBe(true)
    })

    let cable1Id = ''
    let cable2Id = ''
    await test.step('3. F2: draw C1 and C2 onto the shaft with the real cable tool - each reads "F2_C?_?" and is counted up to the shaft', async () => {
      await goToFloor(page, 1)
      await page.evaluate(({ modelId }) => window.__cameraLayoutToolTestHooks!.seedCamera({ modelId, x: 50, y: 10, rotationDeg: 0, rangeM: 10 }), {
        modelId: CAMERA_MODEL_ID,
      })
      await page.evaluate(({ modelId }) => window.__cameraLayoutToolTestHooks!.seedCamera({ modelId, x: 10, y: 50, rotationDeg: 0, rangeM: 10 }), {
        modelId: CAMERA_MODEL_ID,
      })

      await page.locator('[data-testid="draw-cable-button"]').click()
      await clearNotifications(page)
      await clickImagePx(page, 50, 10) // C1
      await clickImagePx(page, 50, 50) // T1 - commits
      await expect(page.locator('[data-testid="notification-banner"]')).toContainText('F2_C1_? enters the shaft')
      await clickImagePx(page, 10, 50) // C2
      await clickImagePx(page, 50, 50) // T1 - commits
      await page.locator('[data-testid="draw-cable-button"]').click() // back to select

      const cables = (await getFloors(page))[1].cables
      expect(cables).toHaveLength(2)
      expect(cables.every((cable) => cable.beyondShaft === undefined)).toBe(true)
      cable1Id = cables[0].id
      cable2Id = cables[1].id

      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), cable1Id)
      await expect(page.locator('[data-testid="properties-cable-label"]')).toContainText('F2_C1_?')
      await expect(page.locator('[data-testid="properties-cable-run"]')).toContainText('7.5 m')
      await expect(page.locator('[data-testid="properties-cable-shaft-route"]')).toContainText('Not routed beyond the shaft yet')
    })

    await test.step('4. F1: the shaft opening lists the incoming cables by device; route C1 to H1 with real clicks -> "F2_C1_F1_H1", 22.0 m', async () => {
      await goToFloor(page, 0)
      await clickImagePx(page, 50, 50) // select T1 on F1 by clicking it
      await expect(page.locator('[data-testid="shaft-cables-in"]')).toContainText('Cables in: 2')
      await expect(page.locator('[data-testid="shaft-not-routed-count"]')).toContainText('Not routed: 2')
      await expect(page.locator(`[data-testid="shaft-cable-${cable1Id}"]`)).toContainText('C1')
      await expect(page.locator(`[data-testid="shaft-cable-route-text-${cable1Id}"]`)).toContainText('not routed')

      await page.locator(`[data-testid="shaft-cable-route-button-${cable1Id}"]`).click()
      await clearNotifications(page)
      await clickImagePx(page, 100, 80) // one route vertex
      await clickImagePx(page, 150, 50) // H1 - commits

      const f1Id = (await getFloors(page))[0].id
      const cable1 = (await getFloors(page))[1].cables.find((cable) => cable.id === cable1Id)!
      expect(cable1.beyondShaft?.floorId).toBe(f1Id)
      expect(cable1.beyondShaft?.hubId).toBe((await getFloors(page))[0].hubs.find((hub) => hub.kind === undefined)!.id)
      expect(cable1.beyondShaft?.points).toHaveLength(1)
      await expect(page.locator('[data-testid="shaft-not-routed-count"]')).toContainText('Not routed: 1')
      await expect(page.locator(`[data-testid="shaft-cable-route-text-${cable1Id}"]`)).toContainText('H1')
      // The leg is drawn on THIS floor even though its cable belongs to F2.
      expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getShaftLegLineCableIds())).toEqual([cable1Id])

      // Redraw it straight (no vertex) so the hand-computed 100 px route holds.
      await page.locator(`[data-testid="shaft-cable-route-button-${cable1Id}"]`).click()
      await clearNotifications(page)
      await clickImagePx(page, 150, 50)
      expect((await getFloors(page))[1].cables.find((cable) => cable.id === cable1Id)!.beyondShaft?.points).toHaveLength(0)

      await goToFloor(page, 1)
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), cable1Id)
      await expect(page.locator('[data-testid="properties-cable-label"]')).toContainText('F2_C1_F1_H1')
      await expect(page.locator('[data-testid="properties-cable-run"]')).toContainText('22.0 m')
      await expect(page.locator('[data-testid="properties-cable-shaft-route"]')).toContainText('H1')
    })

    await test.step('5. F3: route C2 to the fire-alarm panel (a DEVICE end) -> "F2_C2_F3_P1", 18.5 m', async () => {
      await goToFloor(page, 2)
      await clickImagePx(page, 50, 50) // select T1 on F3
      await page.locator(`[data-testid="shaft-cable-route-button-${cable2Id}"]`).click()
      await clearNotifications(page)
      await clickImagePx(page, 150, 50) // the panel - commits

      const floors = await getFloors(page)
      const cable2 = floors[1].cables.find((cable) => cable.id === cable2Id)!
      expect(cable2.beyondShaft?.floorId).toBe(floors[2].id)
      expect(cable2.beyondShaft?.endDevice?.kind).toBe('fire-alarm')
      await expect(page.locator('[data-testid="shaft-not-routed-count"]')).toContainText('Not routed: 0')

      await goToFloor(page, 1)
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), cable2Id)
      await expect(page.locator('[data-testid="properties-cable-label"]')).toContainText('F2_C2_F3_P1')
      await expect(page.locator('[data-testid="properties-cable-run"]')).toContainText('18.5 m')
    })

    await test.step('6. F2: a cable drawn from one camera to ANOTHER camera ends on that device -> "F2_C1_F2_C2"', async () => {
      await page.locator('[data-testid="draw-cable-button"]').click()
      await clearNotifications(page)
      await clickImagePx(page, 50, 10) // C1
      await clickImagePx(page, 10, 50) // C2 - commits (a device end)
      await page.locator('[data-testid="draw-cable-button"]').click()

      const cables = (await getFloors(page))[1].cables
      expect(cables).toHaveLength(3)
      expect(cables[2].hubId).toBeUndefined()
      expect(cables[2].endDevice?.kind).toBe('camera')
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), cables[2].id)
      await expect(page.locator('[data-testid="properties-cable-label"]')).toContainText('F2_C1_F2_C2')
    })

    await test.step('7. deleting H1 on F1 clears C1\'s route in the same step (back to "F2_C1_?", 7.5 m); undo restores it', async () => {
      await goToFloor(page, 0)
      await clearNotifications(page)
      await clickImagePx(page, 150, 50) // select H1
      await page.keyboard.press('Delete')
      expect((await getFloors(page))[1].cables.find((cable) => cable.id === cable1Id)!.beyondShaft).toBeUndefined()

      await page.locator('[data-testid="undo-button"]').click()
      expect((await getFloors(page))[1].cables.find((cable) => cable.id === cable1Id)!.beyondShaft?.hubId).toBeDefined()
    })

    await test.step('8. export the PNG of F1 (draws C1\'s leg) - non-trivial file', async () => {
      await goToFloor(page, 0)
      const downloadPromise = page.waitForEvent('download')
      await page.locator('[data-testid="export-png-button"]').click()
      const stream = await (await downloadPromise).createReadStream()
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(chunk as Buffer)
      const png = Buffer.concat(chunks)
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect(png.length).toBeGreaterThan(1000)
    })

    await test.step('9. save -> reload -> open: version 9, both routes and the device-end cable intact', async () => {
      const before = (await getFloors(page))[1].cables
      const downloadPromise = page.waitForEvent('download')
      await page.locator('[data-testid="save-project-button"]').click()
      const stream = await (await downloadPromise).createReadStream()
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(chunk as Buffer)
      const savedText = Buffer.concat(chunks).toString('utf-8')
      expect(JSON.parse(savedText).schemaVersion).toBe(9)

      await page.reload()
      await waitForTestHooks(page)
      await page.locator('[data-testid="open-project-button"]').click()
      await page.locator('[data-testid="load-project-input"]').setInputFiles({
        name: 'project.json',
        mimeType: 'application/json',
        buffer: Buffer.from(savedText, 'utf-8'),
      })
      await expect(async () => {
        expect((await getFloors(page))[1]?.cables).toEqual(before)
      }).toPass({ timeout: 5_000 })
    })

    expect(errors).toEqual([])
    expect(await canvasCount(page)).toBeGreaterThan(0)
  })
})
