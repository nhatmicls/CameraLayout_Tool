import { test, expect } from '@playwright/test'
import { buildSolidColorPng } from './helpers/build-solid-color-png'
import { collectErrors } from './helpers/export-test-helpers'
import { CAMERA_MODEL_ID, loadImage, waitForTestHooks } from './helpers/test-hooks'

/**
 * Phase 7 regression (format updated by phase 6, owner decision 2026-10-09):
 * a ONE-floor project's BOM panel still has no floor filter and no "Export
 * all floors" button, but its labels are now ALWAYS floor-prefixed (`F1_C1`,
 * not `C1`) and its exported file names use the `-device-layout` stem
 * (renamed from `-camera-layout`). Split out of
 * `project-bom-and-per-floor-export-smoke.spec.ts` to keep that file
 * (the real multi-floor journey) under the project's line-count guideline.
 */

const FLOOR_1_IMAGE = buildSolidColorPng(200, 200, [200, 60, 60])
const SCALE_10_PX_PER_M = { planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 10 }

test.describe('project-bom-one-floor-regression-smoke', () => {
  test('a one-floor project has no floor filter/export-all button, device-layout file names and floor-prefixed BOM/CSV', async ({ page }) => {
    test.setTimeout(60_000)
    const getErrors = await collectErrors(page)

    await page.goto('/')
    await waitForTestHooks(page)

    await loadImage(page, FLOOR_1_IMAGE, 'single-floor.png')
    await page.evaluate(({ scale }) => window.__cameraLayoutToolTestHooks!.setScale(scale), { scale: SCALE_10_PX_PER_M })
    await page.evaluate(
      ({ modelId }) => window.__cameraLayoutToolTestHooks!.seedCamera({ modelId, x: 10, y: 10, rotationDeg: 0, rangeM: 10 }),
      { modelId: CAMERA_MODEL_ID },
    )

    await expect(page.locator('[data-testid="bom-floor-filter"]')).toHaveCount(0) // no filter with one floor
    await expect(page.locator('[data-testid="export-all-floors-button"]')).toHaveCount(0)
    await expect(page.locator('[data-testid^="bom-cameras-"]').first()).toHaveText('F1_C1') // always floor-prefixed (owner decision 2026-10-09)

    const pngDownloadPromise = page.waitForEvent('download')
    await page.locator('[data-testid="export-png-button"]').click()
    const pngDownload = await pngDownloadPromise
    expect(pngDownload.suggestedFilename()).toBe('single-floor-device-layout.png')

    const csvDownloadPromise = page.waitForEvent('download')
    await page.locator('[data-testid="export-csv-button"]').click()
    const csvDownload = await csvDownloadPromise
    expect(csvDownload.suggestedFilename()).toBe('single-floor-bom.csv')

    const errors = getErrors()
    if (errors.length > 0) console.error('Console/page errors collected during the run:\n' + errors.join('\n'))
    expect(errors).toEqual([])
  })
})
