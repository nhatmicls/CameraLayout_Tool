import { useEffect, type RefObject } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { DEFAULT_HUB_MOUNT_HEIGHT_M, MAX_HUBS } from '../../domain/cable/cable-layout-types'
import { clampPointToImageBounds } from '../../domain/shared/clamp'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'

interface HubPlacementOverlayProps {
  stageRef: RefObject<Konva.Stage | null>
  imageWidthPx: number
  imageHeightPx: number
}

/**
 * Editor-only tool for "Add hub", "Add riser" and "Add drop": while one of
 * those modes is on, every left click on the stage places that item there
 * (clamped to the image) and the mode stays on. A riser starts at the route
 * height (no climb until its height is set); a drop starts at this floor's
 * level (it descends the route height until a depth below is set);
 * Esc returns to select mode. Renders nothing - the hub itself is drawn by
 * the scene. Panning stays a plain left-drag: Konva cancels the click once a
 * drag passes its drag distance, so a pan never places a hub.
 *
 * Listens on the Stage (namespaced `on`/`off`), like the wall-drawing overlay.
 */
export function HubPlacementOverlay({ stageRef, imageWidthPx, imageHeightPx }: HubPlacementOverlayProps) {
  const placeKind = useEditorUiStore((s) => (s.toolMode === 'hub' || s.toolMode === 'riser' || s.toolMode === 'drop' ? s.toolMode : null))

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !placeKind) return

    const handleClick = (e: KonvaEventObject<MouseEvent>) => {
      // `detail > 1` = the second click of a double-click, which would stack a second hub on the first.
      if (e.evt.button !== 0 || e.evt.detail > 1) return
      const raw = stage.getRelativePointerPosition()
      if (!raw) return
      const { hubs, addHub, cableSettings } = useProjectStore.getState()
      if (hubs.length >= MAX_HUBS) {
        useEditorUiStore.getState().pushNotification('error', `A project can hold at most ${MAX_HUBS} hubs, risers and drops.`)
        return
      }
      const { x, y } = clampPointToImageBounds(raw, imageWidthPx, imageHeightPx)
      if (placeKind === 'riser') addHub({ id: crypto.randomUUID(), kind: 'riser', x, y, mountHeightM: cableSettings.routeHeightM })
      else if (placeKind === 'drop') addHub({ id: crypto.randomUUID(), kind: 'drop', x, y, mountHeightM: 0 })
      else addHub({ id: crypto.randomUUID(), x, y, mountHeightM: DEFAULT_HUB_MOUNT_HEIGHT_M })
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const target = e.target
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      useEditorUiStore.getState().setToolMode('select')
    }

    stage.on('click.hubplace', handleClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      stage.off('click.hubplace')
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [stageRef, placeKind, imageWidthPx, imageHeightPx])

  return null
}
