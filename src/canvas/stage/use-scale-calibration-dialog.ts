import { useCallback, useState } from 'react'
import { computePlanPxPerMeter, type RefLine } from '../../domain/shared/scale-calibration-calculator'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'

/**
 * State + handlers for the "Calibrate" tool's draw-line-then-dialog flow: a
 * drawn line (`ScaleCalibrationOverlay`, via `onLineDrawn`) is held pending
 * until the length dialog confirms or cancels it. Split out of
 * `floor-plan-stage.tsx` to keep that file under 200 lines (mirrors
 * `use-shaft-floor-range-dialog.ts`'s same split for the shaft tool).
 */
export function useScaleCalibrationDialog() {
  const setScale = useProjectStore((s) => s.setScale)
  const setToolMode = useEditorUiStore((s) => s.setToolMode)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)

  const [pendingLine, setPendingLine] = useState<RefLine | null>(null)

  const handleLineDrawn = useCallback((line: RefLine) => setPendingLine(line), [])

  const handleCancelLength = useCallback(() => setPendingLine(null), [])

  const handleConfirmLength = useCallback(
    (lengthM: number) => {
      if (!pendingLine) return
      const planPxPerMeter = computePlanPxPerMeter(pendingLine, lengthM)
      setScale({ planPxPerMeter, refLine: pendingLine, refLengthM: lengthM })
      setPendingLine(null)
      setToolMode('select')
      pushNotification('info', `Scale set: 1 m = ${planPxPerMeter.toFixed(1)} px.`)
    },
    [pendingLine, setScale, setToolMode, pushNotification],
  )

  return { pendingLine, handleLineDrawn, handleCancelLength, handleConfirmLength }
}
