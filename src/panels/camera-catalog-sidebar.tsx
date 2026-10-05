import { useMemo } from 'react'
import { cameraModels } from '../catalog/camera-catalog-loader'
import { BRANDS, FORM_FACTORS, type Brand, type FormFactor } from '../catalog/camera-catalog-schema'
import { CATALOG_FEATURE_FILTERS, matchesCatalogFilters, type CatalogFilterCriteria } from '../catalog/camera-catalog-feature-filters'
import { useProjectStore } from '../state/project-store'
import { useEditorUiStore } from '../state/editor-ui-store'
import { CameraCatalogModelCard } from './camera-catalog-model-card'
import { DoriLegend } from './dori-legend'
import { capitalizeFirstLetter } from './capitalize-first-letter'

/**
 * Left sidebar: catalog of camera models, filterable by brand, form factor, listed price
 * and datasheet features (outdoor rating, built-in mic, human / vehicle detection), each
 * a draggable card (HTML5 drag-and-drop - `floor-plan-stage.tsx` owns the
 * drop target). Disabled with an explanatory hint until the plan's scale is
 * calibrated, since a cone with no scale has a meaningless radius.
 */
export function CameraCatalogSidebar() {
  const scale = useProjectStore((s) => s.scale)
  const brandFilter = useEditorUiStore((s) => s.catalogBrandFilter)
  const formFactorFilter = useEditorUiStore((s) => s.catalogFormFactorFilter)
  const setBrandFilter = useEditorUiStore((s) => s.setCatalogBrandFilter)
  const setFormFactorFilter = useEditorUiStore((s) => s.setCatalogFormFactorFilter)
  const pricedOnlyFilter = useEditorUiStore((s) => s.catalogPricedOnlyFilter)
  const setPricedOnlyFilter = useEditorUiStore((s) => s.setCatalogPricedOnlyFilter)
  const featureFilters = useEditorUiStore((s) => s.catalogFeatureFilters)
  const toggleFeatureFilter = useEditorUiStore((s) => s.toggleCatalogFeatureFilter)

  const disabled = scale === null

  const filteredModels = useMemo(() => {
    const criteria: CatalogFilterCriteria = {
      brand: brandFilter,
      formFactor: formFactorFilter,
      pricedOnly: pricedOnlyFilter,
      features: featureFilters,
    }
    return cameraModels.filter((m) => matchesCatalogFilters(m, criteria))
  }, [brandFilter, formFactorFilter, pricedOnlyFilter, featureFilters])

  return (
    <aside className="flex w-[280px] flex-shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-white">
      <div className="flex-1 overflow-y-auto p-3">
        <h2 className="text-sm font-semibold text-neutral-700">Camera catalog</h2>

        {disabled && (
          <p data-testid="catalog-disabled-hint" className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
            Set the scale first (toolbar &rarr; &quot;Set scale&quot;) to unlock the catalog.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2 text-xs">
          <label className="flex items-center gap-2">
            <span className="w-14 flex-shrink-0 text-neutral-500">Brand</span>
            <select
              data-testid="catalog-brand-filter"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value as Brand | 'all')}
              className="flex-1 rounded border border-neutral-300 px-1.5 py-1"
            >
              <option value="all">All</option>
              {BRANDS.map((b) => (
                <option key={b} value={b}>
                  {capitalizeFirstLetter(b)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-14 flex-shrink-0 text-neutral-500">Form</span>
            <select
              data-testid="catalog-form-factor-filter"
              value={formFactorFilter}
              onChange={(e) => setFormFactorFilter(e.target.value as FormFactor | 'all')}
              className="flex-1 rounded border border-neutral-300 px-1.5 py-1"
            >
              <option value="all">All</option>
              {FORM_FACTORS.map((f) => (
                <option key={f} value={f}>
                  {capitalizeFirstLetter(f)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid="catalog-priced-only-filter"
              checked={pricedOnlyFilter}
              onChange={(e) => setPricedOnlyFilter(e.target.checked)}
            />
            <span className="text-neutral-500">Only models with a listed price</span>
          </label>
          <div className="grid grid-cols-2 gap-1">
            {CATALOG_FEATURE_FILTERS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  data-testid={`catalog-feature-filter-${key}`}
                  checked={featureFilters.includes(key)}
                  onChange={() => toggleFeatureFilter(key)}
                />
                <span className="text-neutral-500">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {filteredModels.map((model) => (
            <CameraCatalogModelCard key={model.id} model={model} disabled={disabled} />
          ))}
          {filteredModels.length === 0 && <p className="text-xs text-neutral-400">No models match these filters.</p>}
        </div>
      </div>

      <DoriLegend />
    </aside>
  )
}
