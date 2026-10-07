import { expect, type Page } from '@playwright/test'

/**
 * Dev-only test hook shapes actually used by the e2e specs (mirrors
 * `src/dev-test-hooks.tsx`). Declared loosely (not imported from `src/`) -
 * these specs run outside the app's own tsconfig project and Playwright
 * transpiles without type-checking.
 */
export interface TestHooks {
  getScale: () => { planPxPerMeter: number } | null
  getCameras: () => Array<{ id: string }>
  getSensors: () => Array<{ id: string }>
  getHubs: () => Array<{ id: string }>
  getCables: () => Array<{ id: string }>
  getFireAlarmDevices: () => Array<{ id: string }>
  getFloors: () => Array<{ id: string; name: string; floorHeightM: number; image: { fileName: string } | null; cameras: unknown[]; sensors: unknown[] }>
  getActiveFloorId: () => string
  seedFloor: (name?: string) => string
  getDecodedImageInfo: () => { widthPx: number; heightPx: number } | null
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

/** Real catalog model ids (verified against `data/`). */
export const CAMERA_MODEL_ID = 'hikvision-ds-2cd2t47g2-l-2.8mm'
export const PIR_SENSOR_MODEL_ID = 'hikvision-ds-pdpg12p-eg2-pir'
export const FIRE_PANEL_MODEL_ID = 'hikvision-ds-pha48-ep'

export async function waitForTestHooks(page: Page): Promise<void> {
  await page.waitForFunction(() => !!window.__cameraLayoutToolTestHooks, { timeout: 10_000 })
}

export async function loadImage(page: Page, buffer: Buffer, fileName: string): Promise<void> {
  await page.locator('[data-testid="load-image-input"]').setInputFiles({ name: fileName, mimeType: 'image/png', buffer })
}

export async function canvasCount(page: Page): Promise<number> {
  return page.locator('[data-testid="stage-container"] canvas').count()
}

/** Clicks the button `times` times, confirming it is enabled before each click (does not require it to become disabled after the last one). */
export async function clickButtonTimes(page: Page, testId: string, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    const button = page.locator(`[data-testid="${testId}"]`)
    await expect(button).toBeEnabled()
    await button.click()
  }
}

/**
 * M4: waits for the REAL decoded bitmap to report `widthPx`/`heightPx`
 * exactly matching the floor currently expected on screen - a much
 * stronger signal than "a `<canvas>` element exists" (which can be true
 * before Konva has actually painted the right image, or the wrong one
 * during a floor-switch race). Used by the floor-switch latency test
 * instead of `canvasCount`/`toBeVisible`.
 */
export async function waitForDecodedImageSize(page: Page, widthPx: number, heightPx: number, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    ({ widthPx, heightPx }) => {
      const info = window.__cameraLayoutToolTestHooks?.getDecodedImageInfo()
      return !!info && info.widthPx === widthPx && info.heightPx === heightPx
    },
    { widthPx, heightPx },
    { timeout: timeoutMs },
  )
}
