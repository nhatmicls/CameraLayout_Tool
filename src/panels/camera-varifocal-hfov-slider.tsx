import type { ChangeEvent } from 'react'
import { fieldLabelClass } from './camera-properties-form-helpers'

interface CameraVarifocalHfovSliderProps {
  hfovTeleDeg: number
  hfovWideDeg: number
  /** Effective (already clamped) HFOV of the selected camera. */
  hfovDeg: number
  onChange: (hfovDeg: number) => void
}

/** Zoom control for a varifocal lens: picks an HFOV between the datasheet's tele and wide angles. */
export function CameraVarifocalHfovSlider({ hfovTeleDeg, hfovWideDeg, hfovDeg, onChange }: CameraVarifocalHfovSliderProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.valueAsNumber
    if (!Number.isFinite(raw)) return
    onChange(raw)
  }

  return (
    <>
      <label className={fieldLabelClass} htmlFor="properties-hfov-slider">
        HFOV: <span data-testid="properties-hfov-value">{hfovDeg.toFixed(1)}&deg;</span>
      </label>
      <input
        id="properties-hfov-slider"
        data-testid="properties-hfov-slider"
        type="range"
        min={hfovTeleDeg}
        max={hfovWideDeg}
        step={0.1}
        value={hfovDeg}
        onChange={handleChange}
        className="mt-1 w-full"
      />
    </>
  )
}
