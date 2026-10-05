import { useMemo } from 'react'
import { cameraModelById } from '../catalog/camera-catalog-loader'
import { computeBomTotal, formatVnd, formatVndNumber, groupCamerasIntoBom, type BomRow } from '../domain/bill-of-materials-grouping'
import type { CameraModelSpec } from '../domain/project-types'
import { useProjectStore } from '../state/project-store'

/** Stable per-row id derived from the row's own identity (brand+model+lens) - the same key `groupCamerasIntoBom` groups by, so it's as stable as the BOM itself. */
function bomRowSlug(row: BomRow): string {
  return `${row.brand}-${row.model}-${row.lens}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

/**
 * Live bill-of-materials table, grouped by the domain layer
 * (`groupCamerasIntoBom`). Pure presentation - no grouping/sorting logic
 * lives here.
 */
export function BillOfMaterialsPanel() {
  const cameras = useProjectStore((s) => s.cameras)

  const modelById = useMemo(() => {
    const map: Record<string, CameraModelSpec> = {}
    for (const camera of cameras) {
      if (map[camera.modelId]) continue
      const model = cameraModelById(camera.modelId)
      if (model) map[camera.modelId] = model
    }
    return map
  }, [cameras])

  const rows = useMemo(() => groupCamerasIntoBom(cameras, modelById), [cameras, modelById])
  const totalCount = useMemo(() => rows.reduce((sum, row) => sum + row.quantity, 0), [rows])
  const total = useMemo(() => computeBomTotal(rows), [rows])

  return (
    <div data-testid="bom-panel" className="mt-4 border-t border-neutral-200 pt-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">Bill of materials</h2>
        <span data-testid="bom-total-count" className="text-xs text-neutral-500">
          {totalCount} camera{totalCount === 1 ? '' : 's'}
        </span>
      </div>

      {rows.length === 0 ? (
        <p data-testid="bom-empty-state" className="mt-2 text-xs text-neutral-400">
          No cameras placed yet.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[400px] text-left text-xs">
            <thead>
              <tr className="text-neutral-400">
                <th className="pb-1 pr-2 font-normal">Brand</th>
                <th className="pb-1 pr-2 font-normal">Model</th>
                <th className="pb-1 pr-2 font-normal">Form</th>
                <th className="pb-1 pr-2 font-normal">Resolution</th>
                <th className="pb-1 pr-2 font-normal">Lens</th>
                <th className="pb-1 pr-2 font-normal">Qty</th>
                <th className="pb-1 pr-2 font-normal">Cameras</th>
                <th className="pb-1 pr-2 text-right font-normal">Unit (VND)</th>
                <th className="pb-1 text-right font-normal">Total (VND)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const slug = bomRowSlug(row)
                return (
                  <tr key={slug} data-testid={`bom-row-${slug}`} className="border-t border-neutral-100 text-neutral-700">
                    <td className="py-1 pr-2">{row.brand}</td>
                    <td className="py-1 pr-2 font-medium text-neutral-900">{row.model}</td>
                    <td className="py-1 pr-2">{row.formFactor}</td>
                    <td className="py-1 pr-2">{row.resolution}</td>
                    <td className="py-1 pr-2">{row.lens}</td>
                    <td data-testid={`bom-qty-${slug}`} className="py-1 pr-2">
                      {row.quantity}
                    </td>
                    <td data-testid={`bom-cameras-${slug}`} className="py-1 pr-2 text-neutral-500">
                      {row.cameraNumbers}
                    </td>
                    <td className="py-1 pr-2 text-right tabular-nums">
                      {row.unitPriceVnd === null ? '—' : formatVndNumber(row.unitPriceVnd)}
                    </td>
                    <td data-testid={`bom-line-total-${slug}`} className="py-1 text-right tabular-nums">
                      {row.lineTotalVnd === null ? '—' : formatVndNumber(row.lineTotalVnd)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p data-testid="bom-total-price" className="mt-2 text-right text-xs font-semibold text-neutral-800">
            Estimated total: {formatVnd(total.totalVnd)}
            {total.unpricedQuantity > 0 && (
              <span className="ml-1 font-normal text-neutral-500">
                (excludes {total.unpricedQuantity} camera{total.unpricedQuantity === 1 ? '' : 's'} with no listed price)
              </span>
            )}
          </p>
          <p className="mt-0.5 text-right text-[10px] text-neutral-400">Indicative Vietnam reseller prices - confirm with your supplier.</p>
        </div>
      )}
    </div>
  )
}
