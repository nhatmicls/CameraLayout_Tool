import { test, expect, type Page } from '@playwright/test'
import { buildSolidColorPng } from './helpers/build-solid-color-png'
import {
  CAMERA_MODEL_ID,
  canvasCount,
  clearNotifications,
  clickImagePx,
  doubleClickImagePx,
  dragImagePx,
  loadImage,
  waitForDecodedImageSize,
  waitForTestHooks,
} from './helpers/test-hooks'

/**
 * Phase 5 smoke test: drives the REAL canvas with mouse clicks (via
 * `imagePxToClient` + Playwright's `page.mouse`) to draw, point-edit and
 * remove a hub's trunk route - the trunk drawing tool phase 4 only had a
 * dev-hook shortcut for (`cross-floor-pair-link-smoke.spec.ts`). Also covers
 * the coordinator's phase-5 review findings (H1, H2, M2) end to end.
 *
 * Layout (same two floors/scale as the phase-4 spec): F1 200x200 @ 10 px/m,
 * floorHeightM 3, camera C1 (10,10), riser R1 (110,10) linked to a paired
 * drop D1 on F2 (same image-px position, 300x200 @ 10 px/m); cable C1 -> R1.
 * The trunk is drawn from D1 to a plain hub H1 (210,10, mountHeightM 1.5)
 * via two intermediate points (150,10) and (180,10): horizontal length
 * 100 px = 10 m, so the hand-computed cable run matches the phase-4 spec's
 * 28.0 m exactly (3 m crossing + 10 m route + 1.5 m typed at H1 = 14.5 m
 * beyond R1, + 10 m F1 horizontal + 0 m device rise + 3.5 m slack = 28.0 m).
 *
 * Point coordinates stored from a REAL mouse click/drag are compared with
 * `toBeCloseTo(..., 0)` (nearest image px), not exact equality: the
 * click -> client-px -> Konva's own inverse-stage-transform round trip can
 * leave sub-pixel float noise that exact equality would flake on - the
 * click still LANDS on the intended px, which is what matters functionally.
 *
 * `clearNotifications` is called right after every "Draw/Redraw route"
 * click: that action pushes an info toast (`notification-banner.tsx`,
 * `fixed`/`z-50` over the stage), and this script clicks far faster than a
 * real user - several 4s-auto-dismiss toasts stacking up at once can cover
 * the exact client position the next canvas click needs to land on.
 */

type ImagePoint = { x: number; y: number }

function expectPointClose(actual: ImagePoint, expected: ImagePoint): void {
  expect(actual.x).toBeCloseTo(expected.x, 0)
  expect(actual.y).toBeCloseTo(expected.y, 0)
}

/** Straight-line length of [start, ...points, end] in image px - used to confirm "length changes" after a drag, independent of any UI text. */
function polylineLengthPx(path: ImagePoint[]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  return total
}

/**
 * Exports the F2 PNG (must already be the active floor) and probes a window
 * that, on this test's F2 layout, contains ONLY the D1->H1 trunk line (D1 at
 * x=110, H1 at x=210; both hubs' own icons+labels stay within ~100-120 /
 * ~200-220, outside this window) on a WHITE floor background - any
 * non-white pixel in it can only be the dotted trunk line. This confirms
 * the line's PRESENCE, not its exact colour (the dash phase along the
 * polyline is not reproduced here, so an exact-colour probe at one fixed
 * pixel would be flaky) - stated plainly per the task's own allowance.
 */
async function exportF2PngAndProbeTrunkWindow(page: Page): Promise<{ pngBuffer: Buffer; nonWhitePixels: number }> {
  const downloadPromise = page.waitForEvent('download')
  await page.locator('[data-testid="export-png-button"]').click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const pngBuffer = Buffer.concat(chunks)

  expect(pngBuffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a') // PNG signature
  expect(pngBuffer.length).toBeGreaterThan(1000) // non-trivial, not a near-empty file

  const probe = await page.evaluate(async (base64) => {
    const res = await fetch(`data:image/png;base64,${base64}`)
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const data = ctx.getImageData(140, 4, 20, 12).data
    let nonWhitePixels = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) nonWhitePixels++
    }
    return { nonWhitePixels }
  }, pngBuffer.toString('base64'))

  return { pngBuffer, nonWhitePixels: probe.nonWhitePixels }
}

const FLOOR_1_IMAGE = buildSolidColorPng(200, 200, [200, 60, 60])
// White: the PNG export pixel probe looks for "anything not background" near the trunk line,
// so the background itself must be white, not a plan colour that would also read as non-white.
const FLOOR_2_IMAGE = buildSolidColorPng(300, 200, [255, 255, 255])

const FLOOR_1_SCALE = { planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 10 }
const FLOOR_2_SCALE = { planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 10 }

test.describe('trunk-route-drawing-smoke', () => {
  test('draw, point-edit, remove a hub trunk via real mouse clicks; cable editing regression; PNG export', async ({ page }) => {
    test.setTimeout(120_000)

    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[console] ${msg.text()}`)
    })
    page.on('pageerror', (err) => pageErrors.push(`[page] ${err.message}`))

    await page.goto('/')
    await waitForTestHooks(page)

    let riserId = ''
    let dropId = ''
    let targetHubId = ''

    await test.step('1. two floors with scale + floor height; camera + riser + cable on F1; paired drop on F2', async () => {
      await loadImage(page, FLOOR_1_IMAGE, 'floor-1.png')
      await page.evaluate(({ scale }) => window.__cameraLayoutToolTestHooks!.setScale(scale), { scale: FLOOR_1_SCALE })

      await page.locator('[data-testid="floor-tab-add-button"]').click()
      await loadImage(page, FLOOR_2_IMAGE, 'floor-2.png')
      await page.evaluate(({ scale }) => window.__cameraLayoutToolTestHooks!.setScale(scale), { scale: FLOOR_2_SCALE })

      await page.locator('[data-testid="floor-tab-button-0"]').click()
      await waitForDecodedImageSize(page, 200, 200)
      await page.locator('[data-testid="floor-height-input"]').fill('3')
      await page.locator('[data-testid="floor-height-input"]').press('Enter')

      await page.evaluate(
        ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedCamera({ modelId, x: 10, y: 10, rotationDeg: 0, rangeM: 10 }),
        { modelId: CAMERA_MODEL_ID },
      )
      await page.evaluate(() => window.__cameraLayoutToolTestHooks!.seedHub({ kind: 'riser', x: 110, y: 10, mountHeightM: 3 }))
      const floor1 = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[0]
      riserId = floor1.hubs[0].id
      const cameraId = (floor1.cameras[0] as { id: string }).id
      await page.evaluate(
        ({ cameraId, riserId }) =>
          window.__cameraLayoutToolTestHooks!.seedCable({ device: { kind: 'camera', id: cameraId }, hubId: riserId, typeId: 'cat6-utp', points: [] }),
        { cameraId, riserId },
      )

      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), riserId)
      await page.locator('[data-testid="properties-hub-create-paired-point"]').click()
    })

    await test.step('2. F2: target hub H1; select D1', async () => {
      await page.locator('[data-testid="floor-tab-button-1"]').click()
      await waitForDecodedImageSize(page, 300, 200)
      await page.evaluate(() => window.__cameraLayoutToolTestHooks!.seedHub({ x: 210, y: 10, mountHeightM: 1.5 }))
      // F2 otherwise has only 2 tiny hub icons + a thin dotted trunk line, all clustered near
      // y=10 - the PNG export's blank-image guard samples a sparse 3x3 grid across the WHOLE
      // canvas and can miss that thin a sliver of content entirely (a real false positive on
      // this specific, deliberately-sparse test scene, not a rendering bug). A camera's CONE
      // (a wide filled shape, unlike a thin line/small icon) is much more likely to land on one
      // of those 9 sample points - centred on the canvas and pointed +x with a generous range so
      // its cone is never clipped off an edge (phase 6 regression: the previous placement at
      // (280,180) pointed its cone mostly off the right edge of this 300px-wide floor, and adding
      // the new cabling-point BOM rows - this floor now has a drop + a plain hub, so the strip
      // grew a "Drop" and a "Cable hub" row - shifted the sample grid onto an all-white patch,
      // turning this already-marginal mitigation into a hard failure). Kept well clear of the
      // pixel-probe window used by the trunk-line checks below (x 140-160, y 4-16): the cone's
      // leading edge does not cross that window at this position/range. Also gives the export a
      // real BOM row, without affecting anything else this spec checks.
      await page.evaluate(
        ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedCamera({ modelId, x: 150, y: 100, rotationDeg: 0, rangeM: 15 }),
        { modelId: CAMERA_MODEL_ID },
      )

      const floor2 = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors()))[1]
      dropId = floor2.hubs.find((h) => h.kind === 'drop')!.id
      targetHubId = floor2.hubs.find((h) => h.kind === undefined)!.id
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), dropId)
      await expect(page.locator('[data-testid="properties-hub-draw-trunk-button"]')).toHaveText('Draw route to hub')
    })

    await test.step('2b. PNG negative control: before any trunk exists, the probe window is all background', async () => {
      const { nonWhitePixels } = await exportF2PngAndProbeTrunkWindow(page)
      expect(nonWhitePixels).toBe(0)
    })

    await test.step('3. draw the trunk via real mouse clicks: two points, then click H1 to commit', async () => {
      await page.locator('[data-testid="properties-hub-draw-trunk-button"]').click()
      await expect(page.locator('[data-testid="trunk-draw-hint"]')).toContainText('Drawing route from D1')
      await clearNotifications(page)

      // M2: the stage never grows a sixth Konva Layer while a drawing tool is active.
      expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getLayerCount())).toBe(5)

      await clickImagePx(page, 150, 10)
      await clickImagePx(page, 180, 10)
      await clickImagePx(page, 210, 10) // H1 - commits

      await expect(page.locator('[data-testid="trunk-draw-hint"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="properties-hub-draw-trunk-button"]')).toHaveText('Redraw route')
      expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getLayerCount())).toBe(5)

      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      const trunk = floors[1].hubs.find((h) => h.id === dropId)!.trunk!
      expect(trunk.hubId).toBe(targetHubId)
      expect(trunk.points).toHaveLength(2)
      expectPointClose(trunk.points[0] as ImagePoint, { x: 150, y: 10 })
      expectPointClose(trunk.points[1] as ImagePoint, { x: 180, y: 10 })
    })

    await test.step('4. the draw commit is one undo step', async () => {
      await page.locator('[data-testid="undo-button"]').click()
      let floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors[1].hubs.find((h) => h.id === dropId)!.trunk).toBeUndefined()

      await page.locator('[data-testid="redo-button"]').click()
      floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      const trunk = floors[1].hubs.find((h) => h.id === dropId)!.trunk!
      expect(trunk.hubId).toBe(targetHubId)
      expect(trunk.points).toHaveLength(2)
    })

    await test.step('5. F1: the cable shows the hand-computed 28.0 m (cross-floor via the trunk)', async () => {
      await page.locator('[data-testid="floor-tab-button-0"]').click()
      await waitForDecodedImageSize(page, 200, 200)
      const cable = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCables()))[0]
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), cable.id)
      await expect(page.locator('[data-testid="properties-cable-run"]')).toContainText('28.0 m')

      // R1's own "beyond" depends on ITS link partner's (D1's) trunk - not D1's own panel, which
      // always reads D1's partner (R1) and so never flips to Computed in this scenario.
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), riserId)
      await expect(page.locator('[data-testid="properties-hub-cross-floor-mode"]')).toContainText('Computed')

      await page.locator('[data-testid="floor-tab-button-1"]').click()
      await waitForDecodedImageSize(page, 300, 200)
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), dropId)
      // Waits for the SELECTION to actually reach the canvas (the vertex editor mounts off the
      // React render of this selection, not off the hook call returning) before the next step
      // interacts with the canvas directly.
      await expect(page.locator('[data-testid="properties-hub-draw-trunk-button"]')).toBeVisible()
    })

    await test.step('6. point editing: drag a handle, double-click the line to add a point, double-click a handle to remove one - each one undo step', async () => {
      const lengthBeforeDrag = polylineLengthPx([{ x: 110, y: 10 }, { x: 150, y: 10 }, { x: 180, y: 10 }, { x: 210, y: 10 }])

      await dragImagePx(page, { x: 150, y: 10 }, { x: 150, y: 30 })
      let floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      let points = floors[1].hubs.find((h) => h.id === dropId)!.trunk!.points as ImagePoint[]
      expect(points).toHaveLength(2)
      expectPointClose(points[0], { x: 150, y: 30 })
      expectPointClose(points[1], { x: 180, y: 10 })

      // The drag genuinely moved the route, not just the stored point: the polyline got longer.
      const lengthAfterDrag = polylineLengthPx([{ x: 110, y: 10 }, points[0], points[1], { x: 210, y: 10 }])
      expect(lengthAfterDrag).toBeGreaterThan(lengthBeforeDrag + 5)

      await doubleClickImagePx(page, 195, 10) // on the (180,10)->(210,10) segment
      floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      points = floors[1].hubs.find((h) => h.id === dropId)!.trunk!.points as ImagePoint[]
      expect(points).toHaveLength(3)
      expectPointClose(points[2], { x: 195, y: 10 })

      await doubleClickImagePx(page, 180, 10) // removes the unmoved middle handle
      floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      points = floors[1].hubs.find((h) => h.id === dropId)!.trunk!.points as ImagePoint[]
      expect(points).toHaveLength(2)
      expectPointClose(points[1], { x: 195, y: 10 })

      // 3 edits, each its own undo step: undo back to the post-draw [150,10]/[180,10] state.
      await page.locator('[data-testid="undo-button"]').click()
      await page.locator('[data-testid="undo-button"]').click()
      await page.locator('[data-testid="undo-button"]').click()
      floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      points = floors[1].hubs.find((h) => h.id === dropId)!.trunk!.points as ImagePoint[]
      expect(points).toHaveLength(2)
      expectPointClose(points[0], { x: 150, y: 10 })
      expectPointClose(points[1], { x: 180, y: 10 })

      await page.locator('[data-testid="redo-button"]').click()
      await page.locator('[data-testid="redo-button"]').click()
      await page.locator('[data-testid="redo-button"]').click()
      floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      points = floors[1].hubs.find((h) => h.id === dropId)!.trunk!.points as ImagePoint[]
      expect(points).toHaveLength(2)
      expectPointClose(points[0], { x: 150, y: 30 })
      expectPointClose(points[1], { x: 195, y: 10 })
    })

    await test.step('7. "Remove route" -> typed values return', async () => {
      await page.locator('[data-testid="properties-hub-remove-trunk-button"]').click()
      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors[1].hubs.find((h) => h.id === dropId)!.trunk).toBeUndefined()
      await expect(page.locator('[data-testid="properties-hub-draw-trunk-button"]')).toHaveText('Draw route to hub')

      // R1 (whose beyond-length depends on D1's now-removed trunk) is back to typed mode.
      await page.locator('[data-testid="floor-tab-button-0"]').click()
      await waitForDecodedImageSize(page, 200, 200)
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), riserId)
      await expect(page.locator('[data-testid="properties-hub-cross-floor-mode"]')).toContainText('no route drawn')
      await expect(page.locator('[data-testid="properties-hub-height-input"]')).toBeEnabled()

      await page.locator('[data-testid="floor-tab-button-1"]').click()
      await waitForDecodedImageSize(page, 300, 200)
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), dropId)
      await expect(page.locator('[data-testid="properties-hub-draw-trunk-button"]')).toBeVisible()
    })

    await test.step('8. Esc mid-draw cancels with no trunk, and leaves the hub selected', async () => {
      await page.locator('[data-testid="properties-hub-draw-trunk-button"]').click()
      await clearNotifications(page)
      await clickImagePx(page, 160, 20)
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-testid="trunk-draw-hint"]')).toHaveCount(0)
      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors[1].hubs.find((h) => h.id === dropId)!.trunk).toBeUndefined()
      expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getSelectedHubId())).toBe(dropId)
    })

    await test.step('8b. Backspace and Delete with zero vertices leave the hub in place', async () => {
      await page.locator('[data-testid="properties-hub-draw-trunk-button"]').click()
      await clearNotifications(page)
      // No vertex clicked yet - both keys must no-op, not touch the owner hub.
      await page.keyboard.press('Backspace')
      await page.keyboard.press('Delete')
      let floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors[1].hubs.find((h) => h.id === dropId)).toBeTruthy()
      expect(floors[1].hubs.find((h) => h.id === dropId)!.trunk).toBeUndefined()

      await page.keyboard.press('Escape')
      floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      expect(floors[1].hubs.find((h) => h.id === dropId)).toBeTruthy()
    })

    await test.step('9. Backspace removes the last vertex mid-draw', async () => {
      await page.locator('[data-testid="properties-hub-draw-trunk-button"]').click()
      await clearNotifications(page)
      await clickImagePx(page, 150, 10)
      await clickImagePx(page, 180, 10)
      await page.keyboard.press('Backspace') // drops (180,10)
      await clickImagePx(page, 210, 10) // H1 - commits with only (150,10)

      const floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      const trunk = floors[1].hubs.find((h) => h.id === dropId)!.trunk!
      expect(trunk.hubId).toBe(targetHubId)
      expect(trunk.points).toHaveLength(1)
      expectPointClose(trunk.points[0] as ImagePoint, { x: 150, y: 10 })
    })

    await test.step('9b. H1 fix: the owner hub (D1, with a trunk) can still be dragged, and its target hub (H1) can still be clicked', async () => {
      const viewportBefore = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getViewport())

      await dragImagePx(page, { x: 110, y: 10 }, { x: 110, y: 50 })
      let floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      let d1 = floors[1].hubs.find((h) => h.id === dropId)!
      expectPointClose(d1, { x: 110, y: 50 }) // the HUB moved - the drag did not just pan the plan

      const viewportAfter = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getViewport())
      expect(viewportAfter).toEqual(viewportBefore) // confirms it was a hub drag, not a stage pan

      await clickImagePx(page, 210, 10) // H1 - unmoved
      expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getSelectedHubId())).toBe(targetHubId)

      // Restore D1's position so the later PNG probe's geometry assumptions still hold.
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), dropId)
      await dragImagePx(page, { x: 110, y: 50 }, { x: 110, y: 10 })
      floors = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      d1 = floors[1].hubs.find((h) => h.id === dropId)!
      expectPointClose(d1, { x: 110, y: 10 })
    })

    await test.step('9c. H2 fix: the trunk stays visible (plain line) when switching to a tool other than select/trunk', async () => {
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectHub(id), dropId)
      await expect(page.locator('[data-testid="properties-hub-draw-trunk-button"]')).toBeVisible()

      await page.locator('[data-testid="draw-walls-button"]').click()
      const hubIdsInWallMode = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getTrunkRouteLineHubIds())
      expect(hubIdsInWallMode).toContain(dropId)
      expect(await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getLayerCount())).toBe(5)

      await page.locator('[data-testid="draw-walls-button"]').click() // back to select
      const hubIdsInSelectMode = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getTrunkRouteLineHubIds())
      // Back in select mode with D1 still selected, the EDITOR draws it instead of the plain line.
      expect(hubIdsInSelectMode).not.toContain(dropId)
    })

    await test.step('10. regression: cable vertex editing still works; selected-cable hub end stays draggable (H1, cable case)', async () => {
      await page.locator('[data-testid="floor-tab-button-0"]').click()
      await waitForDecodedImageSize(page, 200, 200)
      const cable = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCables()))[0]
      await page.evaluate((id) => window.__cameraLayoutToolTestHooks!.selectCable(id), cable.id)
      await expect(page.locator('[data-testid="properties-cable-type-select"]')).toBeVisible()

      // Same click/drag-blocking pattern H1 fixed for trunks, demonstrated here for a selected
      // cable ending on a hub (R1) too - confirmed broken before the mount-order fix (logged, not
      // asserted, in an earlier run: the plan panned instead of moving the hub), then fixed by
      // mounting the cable editor before `hubs.map` as well. Asserted as a hard regression now.
      const viewportBeforeRiserDrag = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getViewport())
      await dragImagePx(page, { x: 110, y: 10 }, { x: 110, y: 40 })
      const floorsAfterRiserDrag = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getFloors())
      const riserAfterDrag = floorsAfterRiserDrag[0].hubs.find((h) => h.id === riserId)!
      expectPointClose(riserAfterDrag, { x: 110, y: 40 })
      const viewportAfterRiserDrag = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getViewport())
      expect(viewportAfterRiserDrag).toEqual(viewportBeforeRiserDrag)
      // Restore position so the hand-computed 28.0 m (already asserted earlier) still describes this layout.
      await dragImagePx(page, { x: 110, y: 40 }, { x: 110, y: 10 })

      await doubleClickImagePx(page, 60, 10) // on the C1(10,10)->R1(110,10) segment
      let points = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCables()))[0].points as ImagePoint[]
      expect(points).toHaveLength(1)

      await dragImagePx(page, { x: 60, y: 10 }, { x: 60, y: 30 })
      points = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCables()))[0].points as ImagePoint[]
      expect(points).toHaveLength(1)
      expectPointClose(points[0], { x: 60, y: 30 })

      await doubleClickImagePx(page, 85, 20) // on the (60,30)->R1(110,10) segment
      points = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCables()))[0].points as ImagePoint[]
      expect(points).toHaveLength(2)

      await doubleClickImagePx(page, 85, 20) // removes the point just added
      points = (await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getCables()))[0].points as ImagePoint[]
      expect(points).toHaveLength(1)
    })

    await test.step('11. export the F2 PNG: non-trivial file, trunk line present in the pixels (positive control)', async () => {
      await page.locator('[data-testid="floor-tab-button-1"]').click()
      await waitForDecodedImageSize(page, 300, 200)

      const { nonWhitePixels } = await exportF2PngAndProbeTrunkWindow(page)
      expect(nonWhitePixels).toBeGreaterThan(0)
    })

    const filteredErrors = [...consoleErrors, ...pageErrors]
    if (filteredErrors.length > 0) {
      console.error('Console/page errors collected during the run:\n' + filteredErrors.join('\n'))
    }
    expect(filteredErrors).toEqual([])
    expect(await canvasCount(page)).toBeGreaterThan(0)
  })
})
