import { useCallback, useState } from 'react'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'

/**
 * State + handlers for the "Shaft" tool's click-then-dialog flow: a click on
 * the plan (`HubPlacementOverlay`, via `onShaftPoint`) reports the point;
 * confirming the dialog creates the shaft's markers and selects the one on
 * the active floor (if any), so the shaft panel opens right away. Split out
 * of `floor-plan-stage.tsx` to keep that file under 200 lines.
 */
export function useShaftFloorRangeDialog() {
  const setToolMode = useEditorUiStore((s) => s.setToolMode)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)
  const setSelectedHubId = useEditorUiStore((s) => s.setSelectedHubId)
  const floors = useProjectStore((s) => s.floors)
  const shafts = useProjectStore((s) => s.shafts)
  const createShaft = useProjectStore((s) => s.createShaft)

  const [pendingShaftPoint, setPendingShaftPoint] = useState<{ x: number; y: number } | null>(null)

  const handleShaftPoint = useCallback((point: { x: number; y: number }) => setPendingShaftPoint(point), [])

  const handleCancelShaft = useCallback(() => {
    setPendingShaftPoint(null)
    setToolMode('select')
  }, [setToolMode])

  const handleConfirmShaft = useCallback(
    (name: string, fromFloorIndex: number, toFloorIndex: number) => {
      if (!pendingShaftPoint) return
      const result = createShaft(name, fromFloorIndex, toFloorIndex, pendingShaftPoint)
      setPendingShaftPoint(null)
      setToolMode('select')
      if (!result.ok) {
        pushNotification('error', result.reason)
        return
      }
      if (result.skippedFloorNames.length > 0) {
        pushNotification('info', `No opening on: ${result.skippedFloorNames.join(', ')}.`)
      }
      // H5 fix: `createShaft` just wrote to the store SYNCHRONOUSLY, but this callback's own
      // `floors`/`activeFloorId` closure variables still hold the PRE-write render's values (React
      // hasn't re-rendered yet) - reading `getState()` fresh is the only way to see the markers that
      // were just created. Select the marker on the ACTIVE floor, if one was created there, so the
      // shaft panel opens right away.
      const fresh = useProjectStore.getState()
      const activeFloor = fresh.floors.find((floor) => floor.id === fresh.activeFloorId)
      const activeMarker = activeFloor?.hubs.find((hub) => hub.kind === 'shaft' && hub.shaftId === result.shaftId)
      if (activeMarker) setSelectedHubId(activeMarker.id)
    },
    [pendingShaftPoint, createShaft, setToolMode, pushNotification, setSelectedHubId],
  )

  return {
    floors,
    defaultShaftName: `Shaft ${shafts.length + 1}`,
    pendingShaftPoint,
    handleShaftPoint,
    handleCancelShaft,
    handleConfirmShaft,
  }
}
