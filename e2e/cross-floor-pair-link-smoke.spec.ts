import { test, expect } from '@playwright/test'
import { buildSolidColorPng } from './helpers/build-solid-color-png'
import { CAMERA_MODEL_ID, canvasCount, loadImage, waitForDecodedImageSize, waitForTestHooks } from './helpers/test-hooks'

/**
 * Phase 4 smoke test: two floors, each with its own scale; a riser on
 * floor 1 paired (via the hub panel's "Create paired point" button - real
 * UI, not a hook) with a drop on floor 2; a cable from a camera to the
 * riser; a trunk from the drop to a plain hub on floor 2 (no drawing UI for
 * the trunk route yet - phase 5 - so this one step uses the dev hook that
 * calls the same store action a future "draw trunk" tool would).
 *
 * Hand-computed expectation (see also `cross-floor-worked-example.test-fixtures.ts`
 * for the unit-level version of this maths):
 *  - Floor 1: scale 10 px/m (ref line 100 px = 10 m), floorHeightM set to 3.
 *    Camera C1 (10,10) -> riser R1 (110,10), no intermediate points:
 *    horizPx 100 => horizM 10; deviceRiseM 0 (no mounting height, default
 *    device height 3 m == route height 3 m); slack 3.5 m (defaults).
 *  - Floor 2: scale 10 px/m (ref line 100 px = 10 m). Drop D1 (110,10,
 *    paired from R1, position inherited) trunks to plain hub T (210,10):
 *    horizPx 100 => horizM 10; T has no mounting height override (1.5 m,
 *    the hub default) => typed contribution |3 - 1.5| = 1.5 m.
 *  - Crossing vertical = floor 1's own floorHeightM = 3 m (the riser's floor).
 *  - beyond = 3 (crossing) + 10 (floor-2 route) + 1.5 (T typed) = 14.5 m.
 *  - Full cable run = 10 (floor-1 horizontal) + 0 (device rise) + 3.5 (slack)
 *    + 14.5 (beyond) = 28.0 m exactly.
 */

const FLOOR_1_IMAGE = buildSolidColorPng(200, 200, [200, 60, 60])
const FLOOR_2_IMAGE = buildSolidColorPng(300, 200, [60, 60, 200])

const FLOOR_1_SCALE = { planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 10 }
const FLOOR_2_SCALE = { planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 10 }

test.describe('cross-floor-pair-link-smoke', () => {
  test('riser/drop pair + trunk: computed length, panel mode, undo/redo, save/reload', async ({ page }) => {
    test.setTimeout(90_000)

    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[console] ${msg.text()}`)
    })
    page.on('pageerror', (err) => pageErrors.push(`[page] ${err.message}`))

    await page.goto('/')
    await waitForTestHooks(page)

    await test.step('1. floor 1: image + scale + floor height 3; floor 2: image + scale', async () => {
      await loadImage(page, FLOOR_1_IMAGE, 'floor-1.png')
      await expect(page.locator('[data-testid="stage-container"] canvas').first()).toBeVisible()
      await page.evaluate(({ scale }) => window.__cameraLayoutToolTestHooks!.setScale(scale), { scale: FLOOR_1_SCALE })

      const heightInput = page.locator('[data-testid="floor-height-input"]')
      await expect(heightInput).toHaveCount(0) // one floor only - no height input yet (nothing above it)

      await page.locator('[data-testid="floor-tab-add-button"]').click() // floor 2, now active
      await loadImage(page, FLOOR_2_IMAGE, 'floor-2.png')
      await page.evaluate(({ scale }) => window.__cameraLayoutToolTestHooks!.setScale(scale), { scale: FLOOR_2_SCALE })

      await page.locator('[data-testid="floor-tab-button-0"]').click() // back to floor 1 (not the top floor now)
      await waitForDecodedImageSize(page, 200, 200)
      await expect(page.locator('[data-testid="floor-height-input"]')).toBeVisible()
      await page.locator('[data-testid="floor-height-input"]').fill('3')
      await page.locator('[data-testid="floor-height-input"]').press('Enter')
      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors[0].floorHeightM).toBeCloseTo(3)
    })

    let riserId = ''
    await test.step('2. seed camera + riser + cable on floor 1', async () => {
      await page.evaluate(
        ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedCamera({ modelId, x: 10, y: 10, rotationDeg: 0, rangeM: 10 }),
        { modelId: CAMERA_MODEL_ID },
      )
      await page.evaluate(() => window.__cameraLayoutToolTestHooks!.seedHub({ kind: 'riser', x: 110, y: 10, mountHeightM: 3 }))
      const floor1 = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[0]
      riserId = floor1.hubs[0].id
      const cameraId = floor1.cameras[0] && (floor1.cameras[0] as { id: string }).id
      await page.evaluate(
        ({ cameraId, riserId }) =>
          window.__cameraLayoutToolTestHooks!.seedCable({ device: { kind: 'camera', id: cameraId }, hubId: riserId, typeId: 'cat6-utp', points: [] }),
        { cameraId, riserId },
      )
    })

    await test.step('3. "Create paired point" via the real hub panel UI', async () => {
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), riserId)
      const createButton = page.locator('[data-testid="properties-hub-create-paired-point"]')
      await expect(createButton).toBeEnabled()
      await expect(createButton).toHaveText('Create paired point on Floor 2')
      await createButton.click()

      const linkSelect = page.locator('[data-testid="properties-hub-link-select"]')
      await expect(linkSelect).toHaveValue(/.+/)
      await expect(page.locator('[data-testid="properties-hub-cross-floor-mode"]')).toContainText('No route drawn')

      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors[0].hubs[0].link).toBeTruthy()
      expect(floors[1].hubs).toHaveLength(1)
      expect(floors[1].hubs[0].kind).toBe('drop')
    })

    let dropId = ''
    let targetHubId = ''
    await test.step('4. floor 2: seed the trunk target hub, set the trunk via the store hook (no drawing UI yet)', async () => {
      await page.locator('[data-testid="floor-tab-button-1"]').click()
      await waitForDecodedImageSize(page, 300, 200)
      await page.evaluate(() => window.__cameraLayoutToolTestHooks!.seedHub({ x: 210, y: 10, mountHeightM: 1.5 }))

      const floor2 = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[1]
      dropId = floor2.hubs.find((h) => h.kind === 'drop')!.id
      targetHubId = floor2.hubs.find((h) => h.kind === undefined)!.id

      await page.evaluate(
        ({ floorId, dropId, targetHubId }) =>
          window.__cameraLayoutToolTestHooks!.setHubTrunk({ floorId, hubId: dropId }, { hubId: targetHubId, points: [] }),
        { floorId: floor2.id, dropId, targetHubId },
      )
      const updatedFloor2 = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[1]
      expect(updatedFloor2.hubs.find((h) => h.id === dropId)!.trunk).toEqual({ hubId: targetHubId, points: [] })
    })

    await test.step('5. back on floor 1: the cable shows the hand-computed 28.0 m, the hub panel shows computed mode', async () => {
      await page.locator('[data-testid="floor-tab-button-0"]').click()
      await waitForDecodedImageSize(page, 200, 200)

      const cable = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCables()))[0]
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), cable.id)
      await expect(page.locator('[data-testid="properties-cable-run"]')).toContainText('28.0 m')

      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), riserId)
      await expect(page.locator('[data-testid="properties-hub-cross-floor-mode"]')).toContainText('Computed')
      await expect(page.locator('[data-testid="properties-hub-height-input"]')).toBeDisabled()
    })

    await test.step('6. undo removes the trunk/link steps; redo restores them', async () => {
      // Steps so far (back to back): seedCamera, seedHub(riser), seedCable, createPairedHub,
      // [switch floor - not undoable], seedHub(target on floor2), setHubTrunk. Undo the last two
      // (setHubTrunk, seedHub target) then the paired-point creation, each its own step.
      await page.locator('[data-testid="undo-button"]').click() // undoes setHubTrunk
      let floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors[1].hubs.find((h) => h.id === dropId)!.trunk).toBeUndefined()

      await page.locator('[data-testid="undo-button"]').click() // undoes seeding the target hub
      await page.locator('[data-testid="undo-button"]').click() // undoes createPairedHub (link + new drop)
      floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors[1].hubs).toHaveLength(0)
      expect(floors[0].hubs[0].link).toBeUndefined()

      await page.locator('[data-testid="redo-button"]').click()
      await page.locator('[data-testid="redo-button"]').click()
      await page.locator('[data-testid="redo-button"]').click()
      floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors[0].hubs[0].link).toBeTruthy()
      expect(floors[1].hubs.find((h) => h.id === dropId)!.trunk).toEqual({ hubId: targetHubId, points: [] })
    })

    await test.step('7. save + reload: link + trunk survive', async () => {
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
      await page.locator('[data-testid="load-project-input"]').setInputFiles({ name: 'cross-floor.json', mimeType: 'application/json', buffer: Buffer.from(savedText, 'utf-8') })

      await expect(async () => {
        const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
        expect(floors).toHaveLength(2)
        expect(floors[0].hubs[0]?.link).toBeTruthy()
        expect(floors[1].hubs.find((h) => h.id === dropId)?.trunk).toEqual({ hubId: targetHubId, points: [] })
      }).toPass({ timeout: 5_000 })
      await expect(page.locator('[data-testid="stage-container"] canvas').first()).toBeVisible()
      expect(await canvasCount(page)).toBeGreaterThan(0)
    })

    const filteredErrors = [...consoleErrors, ...pageErrors]
    if (filteredErrors.length > 0) {
      console.error('Console/page errors collected during the run:\n' + filteredErrors.join('\n'))
    }
    expect(filteredErrors).toEqual([])
  })
})
