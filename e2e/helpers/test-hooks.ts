import { expect, type Page } from '@playwright/test'

/**
 * Dev-only test hook shapes actually used by the e2e specs (mirrors
 * `src/dev-test-hooks.tsx`). Declared loosely (not imported from `src/`) -
 * these specs run outside the app's own tsconfig project and Playwright
 * transpiles without type-checking.
 */
export interface TestHooks {
  getViewport: () => { x: number; y: number; scale: number }
  getScale: () => { planPxPerMeter: number } | null
  getCameras: () => Array<{ id: string }>
  getSensors: () => Array<{ id: string }>
  getHubs: () => Array<{ id: string }>
  getCables: () => Array<{ id: string }>
  getSelectedHubId: () => string | null
  getFireAlarmDevices: () => Array<{ id: string }>
  getFloors: () => Array<{
    id: string
    name: string
    floorHeightM: number
    image: { fileName: string } | null
    cameras: unknown[]
    sensors: unknown[]
    hubs: Array<{
      id: string
      kind?: 'riser' | 'drop' | 'shaft'
      shaftId?: string
      x: number
      y: number
      link?: { floorId: string; hubId: string }
      trunk?: { hubId: string; points: unknown[] }
    }>
    cables: Array<{ id: string; hubId: string; exitFloorId?: string }>
  }>
  getShafts: () => Array<{ id: string; name: string }>
  getActiveFloorId: () => string
  seedFloor: (name?: string) => string
  getDecodedImageInfo: () => { widthPx: number; heightPx: number } | null
  setScale: (scale: { planPxPerMeter: number; refLine: { x1: number; y1: number; x2: number; y2: number }; refLengthM: number }) => void
  seedCamera: (camera: { modelId: string; x: number; y: number; rotationDeg: number; rangeM: number }) => void
  seedSensor: (sensor: { modelId: string; shape: 'sector'; x: number; y: number; rotationDeg: number; rangeM: number }) => void
  seedHub: (hub: { kind?: 'riser' | 'drop'; x: number; y: number; mountHeightM: number }) => void
  seedCable: (cable: { device: { kind: 'camera'; id: string }; hubId: string; typeId: string; points: Array<{ x: number; y: number }> }) => void
  seedFireAlarmDevice: (device: { modelId: string; x: number; y: number }) => void
  selectHub: (id: string) => void
  selectCable: (id: string) => void
  setHubTrunk: (ref: { floorId: string; hubId: string }, trunk: { hubId: string; points: Array<{ x: number; y: number }> } | null) => void
  imagePxToClient: (x: number, y: number) => { x: number; y: number } | null
  dismissAllNotifications: () => void
  getTrunkRouteLineHubIds: () => string[]
  getLayerCount: () => number
  /** Phase 7 test gap: the compatibility-warning text that floor's own PNG strip would show - lets a spec confirm it never names another floor's device. */
  getFloorCompatibilityWarningText: (floorId: string) => string | null
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

/**
 * Fires the file input's `change` event and returns immediately, before the
 * async decode (`FileReader` + `Image.decode()` inside `useFloorPlanImageLoader`)
 * resolves. This is the raw primitive - almost every spec wants `loadImage`
 * below instead; only a spec that deliberately exercises the race (switching
 * floors or seeding other state WHILE the decode is still in flight, e.g.
 * the C2 regression test) should call this directly.
 */
export async function triggerImageLoadWithoutWaiting(page: Page, buffer: Buffer, fileName: string): Promise<void> {
  await page.locator('[data-testid="load-image-input"]').setInputFiles({ name: fileName, mimeType: 'image/png', buffer })
}

/**
 * Loads an image file and waits until the floor that was ACTIVE at the
 * START of the call has actually received it (`floor.image.fileName`
 * matches) before returning. Fixes a real flake: `setInputFiles` only
 * waits for the input's `change` event, not for the async decode it kicks
 * off - a spec that immediately called `setScale` or switched floors right
 * after could have that land BEFORE `setImage` actually applied (wiping the
 * scale it just set, or tripping the "floor changed during load" guard and
 * silently refusing the whole load). Every spec except the one deliberately
 * racing this (`triggerImageLoadWithoutWaiting`) should use this.
 */
export async function loadImage(page: Page, buffer: Buffer, fileName: string): Promise<void> {
  const targetFloorId = await page.evaluate(() => window.__cameraLayoutToolTestHooks!.getActiveFloorId())
  await triggerImageLoadWithoutWaiting(page, buffer, fileName)
  await page.waitForFunction(
    ({ targetFloorId, fileName }) => {
      const hooks = window.__cameraLayoutToolTestHooks
      const floor = hooks?.getFloors().find((f) => f.id === targetFloorId)
      return floor?.image?.fileName === fileName
    },
    { targetFloorId, fileName },
    { timeout: 15_000 },
  )
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

/**
 * Clears every pending notification toast. The toast banner is `fixed`/
 * `z-50` over the stage (`notification-banner.tsx`) - a script clicking
 * much faster than a real user (so several 4s-auto-dismiss info toasts
 * stack up at once) risks a click landing on a still-visible toast instead
 * of the canvas underneath it. Call this right after any action that pushes
 * a hint toast and before the next `clickImagePx`/`dragImagePx` call.
 */
export async function clearNotifications(page: Page): Promise<void> {
  await page.evaluate(() => window.__cameraLayoutToolTestHooks!.dismissAllNotifications())
}

/**
 * Clicks the real stage at an IMAGE px position, via `imagePxToClient` (the
 * stage container's on-screen rect combined with the live pan/zoom
 * viewport) + `page.mouse.click` - drives the canvas exactly like a user,
 * rather than calling a store action directly.
 */
export async function clickImagePx(page: Page, x: number, y: number): Promise<void> {
  const client = await page.evaluate(({ x, y }) => window.__cameraLayoutToolTestHooks!.imagePxToClient(x, y), { x, y })
  if (!client) throw new Error(`clickImagePx(${x}, ${y}): stage container not found`)
  await page.mouse.click(client.x, client.y)
}

/**
 * Same as `clickImagePx` but double-clicks (adds a cable/trunk route point
 * on a line). `Mouse` has no `dblclick` - `click(x, y, { clickCount: 2 })`
 * is Playwright's own way to fire a real double-click at a coordinate.
 */
export async function doubleClickImagePx(page: Page, x: number, y: number): Promise<void> {
  const client = await page.evaluate(({ x, y }) => window.__cameraLayoutToolTestHooks!.imagePxToClient(x, y), { x, y })
  if (!client) throw new Error(`doubleClickImagePx(${x}, ${y}): stage container not found`)
  await page.mouse.click(client.x, client.y, { clickCount: 2 })
}

/**
 * Drags a handle from one IMAGE px position to another (a cable/trunk
 * vertex handle), via real mouse events - `move` then `down` so Konva sees
 * the pointer land on the handle before the drag starts, then a few
 * intermediate `move`s (Konva's drag threshold needs more than one pixel of
 * travel to register as a drag rather than a click) before `up`.
 */
export async function dragImagePx(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const start = await page.evaluate(({ x, y }) => window.__cameraLayoutToolTestHooks!.imagePxToClient(x, y), from)
  const end = await page.evaluate(({ x, y }) => window.__cameraLayoutToolTestHooks!.imagePxToClient(x, y), to)
  if (!start || !end) throw new Error('dragImagePx: stage container not found')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  const steps = 5
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(start.x + ((end.x - start.x) * i) / steps, start.y + ((end.y - start.y) * i) / steps)
  }
  await page.mouse.up()
}
