import { useCallback, useState, type KeyboardEvent, type PointerEvent } from 'react'

export const SIDEBAR_DEFAULT_WIDTH_PX = 280
export const SIDEBAR_MIN_WIDTH_PX = 240
export const SIDEBAR_MAX_WIDTH_PX = 560
const KEYBOARD_STEP_PX = 16

export function clampSidebarWidth(widthPx: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH_PX, Math.max(SIDEBAR_MIN_WIDTH_PX, Math.round(widthPx)))
}

/**
 * Width of a left sidebar that the user drags wider / narrower by its right-edge handle.
 * UI-only (component state): never persisted, never an undo step. The handle captures the
 * pointer, so the drag keeps tracking over the Konva stage; double-click resets the width.
 */
export function useResizableSidebarWidth() {
  const [widthPx, setWidthPx] = useState(SIDEBAR_DEFAULT_WIDTH_PX)

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    // The sidebar is the leftmost column, so its width is the pointer's distance from its left edge.
    const left = e.currentTarget.parentElement?.getBoundingClientRect().left ?? 0
    setWidthPx(clampSidebarWidth(e.clientX - left))
  }, [])

  const onDoubleClick = useCallback(() => setWidthPx(SIDEBAR_DEFAULT_WIDTH_PX), [])

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const step = e.key === 'ArrowLeft' ? -KEYBOARD_STEP_PX : KEYBOARD_STEP_PX
    setWidthPx((w) => clampSidebarWidth(w + step))
  }, [])

  return { widthPx, handleProps: { onPointerDown, onPointerMove, onDoubleClick, onKeyDown } }
}
