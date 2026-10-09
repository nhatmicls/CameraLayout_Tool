import { test, expect, type Download } from '@playwright/test'
import { buildSolidColorPng } from './helpers/build-solid-color-png'
import { collectErrors, readDownloadText } from './helpers/export-test-helpers'
import { CAMERA_MODEL_ID, loadImage, waitForDecodedImageSize, waitForTestHooks } from './helpers/test-hooks'

/**
 * Phase 7 smoke test: a 3-floor project (F3 never calibrated), the same
 * camera model placed on F1 and F2, a fire-alarm device on F2 whose
 * controller sits on F1, and two cables (one crossing floors via a linked
 * riser/drop pair, hand-computed 28.0 m - same maths as
 * `cross-floor-pair-link-smoke.spec.ts`; one plain cable on F2, 10.0 m) -
 * project cable total 32.2 + 11.5 = 43.7 m, rounded up once to 44 m.
 *
 * Covers: BOM panel "All floors" merge + per-floor filter, CSV (whole
 * project, 12 columns, floor-prefixed labels, no false "no panel/hub"
 * note), "Export PNG" (current floor, multi-floor file name), "Export all
 * floors" (F3 skipped, exactly 2 downloads, F1's strip never leaks F2's
 * device - C1 review fix). The one-floor regression lives in its own spec,
 * `project-bom-one-floor-regression-smoke.spec.ts`.
 */

const FLOOR_1_IMAGE = buildSolidColorPng(200, 200, [200, 60, 60])
const FLOOR_2_IMAGE = buildSolidColorPng(300, 200, [60, 60, 200])
const FLOOR_3_IMAGE = buildSolidColorPng(100, 100, [60, 200, 60])

const SCALE_10_PX_PER_M = { planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 10 }

// Real catalog ids: a wireless-hub controller that officially lists the smoke detector as
// compatible (`data/hikvision/fire-alarm-wireless-hub/..._01.json`), on different floors.
const CONTROLLER_MODEL_ID = 'hikvision-ds-pwa96-m-we'
const SMOKE_MODEL_ID = 'hikvision-ds-pdsmk-s-we'
// A 433 MHz smoke detector - NOT in the 868 MHz controller's compatible list (frequency
// mismatch) - placed alongside it to generate a REAL "not listed" warning for the C1 test gap.
const UNLISTED_SMOKE_MODEL_ID = 'hikvision-ds-pdsmk-s-wb'

test.describe('project-bom-and-per-floor-export-smoke', () => {
  test('3 floors: BOM merge/filter, CSV, per-floor PNG, export all floors', async ({ page }) => {
    test.setTimeout(120_000)
    const getErrors = await collectErrors(page)

    await page.goto('/')
    await waitForTestHooks(page)

    await test.step('F1: image + scale; F2: image + scale (needed before pairing); back to F1, height 3', async () => {
      await loadImage(page, FLOOR_1_IMAGE, 'floor-1.png')
      await page.evaluate(({ scale }) => window.__cameraLayoutToolTestHooks!.setScale(scale), { scale: SCALE_10_PX_PER_M })

      await page.locator('[data-testid="floor-tab-add-button"]').click() // floor 2, now active, no image yet
      await loadImage(page, FLOOR_2_IMAGE, 'floor-2.png') // "Create paired point" below needs F2 to already have a plan
      await page.evaluate(({ scale }) => window.__cameraLayoutToolTestHooks!.setScale(scale), { scale: SCALE_10_PX_PER_M })

      await page.locator('[data-testid="floor-tab-button-0"]').click()
      await waitForDecodedImageSize(page, 200, 200)
      await page.locator('[data-testid="floor-height-input"]').fill('3')
      await page.locator('[data-testid="floor-height-input"]').press('Enter')
    })

    await test.step('F1: camera C1, riser, crossing cable, controller, create the paired drop on F2', async () => {
      await page.evaluate(
        ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedCamera({ modelId, x: 10, y: 10, rotationDeg: 0, rangeM: 10 }),
        { modelId: CAMERA_MODEL_ID },
      )
      await page.evaluate(() => window.__cameraLayoutToolTestHooks!.seedHub({ kind: 'riser', x: 110, y: 10, mountHeightM: 3 }))
      await page.evaluate(
        ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedFireAlarmDevice({ modelId, x: 20, y: 20 }),
        { modelId: CONTROLLER_MODEL_ID },
      )

      const floor1 = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[0]
      const cameraId = (floor1.cameras[0] as { id: string }).id
      const riserId = floor1.hubs[0].id
      await page.evaluate(
        ({ cameraId, riserId }) =>
          window.__cameraLayoutToolTestHooks!.seedCable({ device: { kind: 'camera', id: cameraId }, hubId: riserId, typeId: 'cat6-utp', points: [] }),
        { cameraId, riserId },
      )

      // "Create paired point" (real hub-panel button) - auto-creates the matching drop on floor 2.
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), riserId)
      await page.locator('[data-testid="properties-hub-create-paired-point"]').click()
    })

    await test.step('F2: trunk to a target hub, own camera C1 + plain cable, smoke detector', async () => {
      await page.locator('[data-testid="floor-tab-button-1"]').click()
      await waitForDecodedImageSize(page, 300, 200)

      await page.evaluate(() => window.__cameraLayoutToolTestHooks!.seedHub({ x: 210, y: 10, mountHeightM: 1.5 })) // trunk target
      await page.evaluate(() => window.__cameraLayoutToolTestHooks!.seedHub({ x: 100, y: 50, mountHeightM: 1.5 })) // plain hub for the second cable
      await page.evaluate(
        ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedCamera({ modelId, x: 50, y: 50, rotationDeg: 0, rangeM: 10 }),
        { modelId: CAMERA_MODEL_ID },
      )
      await page.evaluate(
        ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedFireAlarmDevice({ modelId, x: 5, y: 5 }),
        { modelId: SMOKE_MODEL_ID },
      )
      await page.evaluate(
        ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedFireAlarmDevice({ modelId, x: 8, y: 8 }),
        { modelId: UNLISTED_SMOKE_MODEL_ID },
      )

      const floor2 = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[1]
      const dropId = floor2.hubs.find((h) => h.kind === 'drop')!.id
      const targetHubId = floor2.hubs.find((h) => h.kind === undefined && h.y === 10)!.id
      const plainHubId = floor2.hubs.find((h) => h.kind === undefined && h.y === 50)!.id
      const cameraId = (floor2.cameras[0] as { id: string }).id

      await page.evaluate(
        ({ floorId, dropId, targetHubId }) =>
          window.__cameraLayoutToolTestHooks!.setHubTrunk({ floorId, hubId: dropId }, { hubId: targetHubId, points: [] }),
        { floorId: floor2.id, dropId, targetHubId },
      )
      await page.evaluate(
        ({ cameraId, plainHubId }) =>
          window.__cameraLayoutToolTestHooks!.seedCable({ device: { kind: 'camera', id: cameraId }, hubId: plainHubId, typeId: 'cat6-utp', points: [] }),
        { cameraId, plainHubId },
      )
    })

    await test.step('F3: image loaded, scale NEVER set, no items', async () => {
      await page.locator('[data-testid="floor-tab-add-button"]').click()
      await loadImage(page, FLOOR_3_IMAGE, 'floor-3.png')
      await waitForDecodedImageSize(page, 100, 100)
      const scale = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getScale())
      expect(scale).toBeNull()
    })

    await test.step('cable maths sanity: the crossing cable is 28.0 m, the plain one 10.0 m', async () => {
      await page.locator('[data-testid="floor-tab-button-0"]').click()
      const cable = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCables()))[0]
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), cable.id)
      await expect(page.locator('[data-testid="properties-cable-run"]')).toContainText('28.0 m')

      await page.locator('[data-testid="floor-tab-button-1"]').click()
      const floor2Cable = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCables())).find((c) => c.id !== cable.id)!
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), floor2Cable.id)
      await expect(page.locator('[data-testid="properties-cable-run"]')).toContainText('10.0 m')
    })

    await test.step('BOM panel: "All floors" merges the camera row; the per-floor filter shows unprefixed rows', async () => {
      const cameraLabelsCell = page.locator('[data-testid^="bom-cameras-"]').first()
      await expect(cameraLabelsCell).toHaveText('F1_C1, F2_C1')

      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      await page.locator('[data-testid="bom-floor-filter"]').selectOption(floors[1].id) // F2 alone
      await expect(cameraLabelsCell).toHaveText('C1')
      await page.locator('[data-testid="bom-floor-filter"]').selectOption('all')
    })

    let csvText = ''
    await test.step('Export CSV: whole project, 12 columns, prefixed labels, project cable total, no false "no panel/hub" note', async () => {
      const downloadPromise = page.waitForEvent('download')
      await page.locator('[data-testid="export-csv-button"]').click()
      const download = await downloadPromise
      csvText = await readDownloadText(download)

      const withoutBom = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText
      const [headerLine] = withoutBom.split('\r\n')
      expect(headerLine.split(',')).toHaveLength(12)

      expect(csvText).toContain('F1_C1, F2_C1') // camera row, merged + prefixed
      expect(csvText).not.toContain('No panel/hub placed') // controller on F1 covers the F2 smoke device

      const cableRowMatch = csvText.match(/Cable,,Cat6 UTP,,,,(\d+),m,/)
      expect(cableRowMatch).not.toBeNull()
      expect(cableRowMatch?.[1]).toBe('44') // ceil(28.0*1.15 + 10.0*1.15) = ceil(32.2 + 11.5) = ceil(43.7) = 44
    })

    await test.step('Export PNG: current floor, multi-floor file name', async () => {
      await page.locator('[data-testid="floor-tab-button-0"]').click() // F1
      const downloadPromise = page.waitForEvent('download')
      await page.locator('[data-testid="export-png-button"]').click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBe('F1-Floor-1-floor-1-camera-layout.png')
    })

    await test.step('C1 test gap: F2\'s unlisted smoke warns by its OWN per-floor label; F1\'s strip never shows it', async () => {
      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      const f1Text = await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.getFloorCompatibilityWarningText(id), floors[0].id)
      expect(f1Text).toBeNull() // F1's own device is the controller itself - never warned, and F2's warned device must never leak here
      const f2Text = await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.getFloorCompatibilityWarningText(id), floors[1].id)
      expect(f2Text).toBe('Compatibility: 1 device(s) not listed for a placed panel/hub: S2') // F2's own 2nd smoke detector, bare (per-floor view)
    })

    await test.step('Export all floors: exactly 2 downloads (F1, F2), F3 skipped and named', async () => {
      const downloads: Download[] = []
      page.on('download', (d) => downloads.push(d))

      await page.locator('[data-testid="export-all-floors-button"]').click()
      await expect.poll(() => downloads.length, { timeout: 15_000 }).toBe(2)

      const names = downloads.map((d) => d.suggestedFilename()).sort()
      expect(names).toEqual(['F1-Floor-1-floor-1-camera-layout.png', 'F2-Floor-2-floor-2-camera-layout.png'])

      await expect(page.locator('[data-testid="notification-banner"]')).toContainText('Floor 3')
      await expect(page.locator('[data-testid="notification-banner"]')).toContainText('Floor 1') // M2: the one final notification also names what WAS exported
    })

    const errors = getErrors()
    if (errors.length > 0) console.error('Console/page errors collected during the run:\n' + errors.join('\n'))
    expect(errors).toEqual([])
  })
})
