export interface ToolbarExportButtonsProps {
  /** Gates "Export PNG": the ACTIVE floor's own plan (the handler itself warns if that floor has no scale yet). */
  hasActiveFloorImage: boolean
  isExportingPng: boolean
  onExportPng: () => void
  /** Gates "Export CSV": ANY floor has a placed camera, sensor, fire-alarm device or cable (drift addendum - CSV is project-wide, unlike the two PNG buttons). */
  hasAnyBomContent: boolean
  onExportCsv: () => void
  /** "Export all floors" only exists once there is more than one floor to export. */
  floorCount: number
  isExportingAllFloors: boolean
  onExportAllFloors: () => void
  /** M2 review fix: true while EITHER async export is in flight - disables all three buttons so a user cannot start a second export while one is running. */
  isExporting: boolean
  buttonClass: string
}

/**
 * The toolbar's three export buttons, extracted from `app-toolbar.tsx`
 * (phase 7) to keep that file under the project's line-count guideline once
 * "Export all floors" joined "Export PNG"/"Export CSV". One-floor tooltips
 * match the pre-plan wording exactly (Low review fix); a multi-floor
 * project gets more specific wording since the buttons' scope genuinely
 * changed (PNG = current floor, CSV = whole project).
 */
export function ToolbarExportButtons({
  hasActiveFloorImage,
  isExportingPng,
  onExportPng,
  hasAnyBomContent,
  onExportCsv,
  floorCount,
  isExportingAllFloors,
  onExportAllFloors,
  isExporting,
  buttonClass,
}: ToolbarExportButtonsProps) {
  const pngTitle = !hasActiveFloorImage
    ? 'Load a floor plan first'
    : floorCount > 1
      ? 'Export this floor (plan + BOM) as a PNG'
      : 'Export the plan + BOM as a PNG'
  const csvTitle = !hasAnyBomContent
    ? 'Place at least one camera, sensor, fire-alarm device or cable first'
    : floorCount > 1
      ? 'Export the whole project BOM as a CSV'
      : 'Export the BOM as a CSV'

  return (
    <>
      <button
        type="button"
        data-testid="export-png-button"
        onClick={onExportPng}
        disabled={!hasActiveFloorImage || isExporting}
        title={pngTitle}
        className={buttonClass}
      >
        {isExportingPng ? 'Exporting…' : 'Export PNG'}
      </button>

      <button type="button" data-testid="export-csv-button" onClick={onExportCsv} disabled={!hasAnyBomContent || isExporting} title={csvTitle} className={buttonClass}>
        Export CSV
      </button>

      {floorCount > 1 && (
        <button
          type="button"
          data-testid="export-all-floors-button"
          onClick={onExportAllFloors}
          disabled={isExporting}
          title="Export one PNG per floor that has a plan and a scale"
          className={buttonClass}
        >
          {isExportingAllFloors ? 'Exporting…' : 'Export all floors'}
        </button>
      )}
    </>
  )
}
