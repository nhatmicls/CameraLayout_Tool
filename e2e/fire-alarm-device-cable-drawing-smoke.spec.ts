import { test, expect } from '@playwright/test'
import { buildSolidColorPng } from './helpers/build-solid-color-png'
import { FIRE_PANEL_MODEL_ID, clickImagePx, loadImage, waitForDecodedImageSize, waitForTestHooks } from './helpers/test-hooks'

/**
 * A cable drawn from a placed fire-alarm device with the REAL "Draw cable"
 * tool (real mouse clicks; only the device, hub and scale are seeded).
 *
 * Layout: 300x300, scale 10 px/m. Control panel P1 at (50,50), hub H1 at
 * (150,50), `mountHeightM` 1.5. Route 100 px = 10 m. A fire-alarm device has
 * no mounting height, so the default device height (3 m) = the route height
 * (3 m) -> 0 m device rise; hub drop |3 - 1.5| = 1.5 m; slack 0.5 + 3 = 3.5 m.
 * Run = 10 + 0 + 1.5 + 3.5 = 15.0 m.
 */
test('draws a cable from a fire-alarm device to a hub, labelled by its designator; clicking the device under the selected cable selects the device', async ({ page }) => {
  await page.goto('/')
  await waitForTestHooks(page)
  await loadImage(page, buildSolidColorPng(300, 300, [240, 240, 240]), 'plan.png')
  await waitForDecodedImageSize(page, 300, 300)

  await page.evaluate(() =>
    window.__cameraLayoutToolTestHooks!.setScale({ planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 10 }),
  )
  await page.evaluate(({ modelId }) => window.__cameraLayoutToolTestHooks!.seedFireAlarmDevice({ modelId, x: 50, y: 50 }), {
    modelId: FIRE_PANEL_MODEL_ID,
  })
  await page.evaluate(() => window.__cameraLayoutToolTestHooks!.seedHub({ x: 150, y: 50, mountHeightM: 1.5 }))
  const deviceId = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFireAlarmDevices()))[0].id

  await page.locator('[data-testid="draw-cable-button"]').click()
  await clickImagePx(page, 50, 50) // starts on the control panel (P1)
  await clickImagePx(page, 150, 50) // ends on H1 - commits

  const cables = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCables())
  expect(cables).toHaveLength(1)
  expect(cables[0].device).toEqual({ kind: 'fire-alarm', id: deviceId })

  await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), cables[0].id)
  await expect(page.locator('[data-testid="properties-cable-label"]')).toContainText('F1_P1_F1_H1')
  await expect(page.locator('[data-testid="properties-cable-run"]')).toContainText('15.0 m')

  // The cable is still selected and ends on the device: a click inside the device's hitbox must
  // select the DEVICE (not stay on the cable), so Delete removes the device and - in the same
  // undo step - its cable.
  await page.locator('[data-testid="draw-cable-button"]').click() // leave the cable tool - back to select
  await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), cables[0].id)
  await clickImagePx(page, 50, 50)
  await page.keyboard.press('Delete')
  expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFireAlarmDevices().length)).toBe(0)
  expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCables().length)).toBe(0)
  await page.locator('[data-testid="undo-button"]').click()
  expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFireAlarmDevices().length)).toBe(1)
  expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCables().length)).toBe(1)
})
