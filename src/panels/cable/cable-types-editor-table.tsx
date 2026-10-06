import { cableTypeColor } from '../../canvas/cable/cable-type-color-palette'
import {
  CABLE_LENGTH_LIMIT_MAX_M,
  CABLE_PRICE_MAX_VND_PER_M,
  CABLE_TYPE_NAME_MAX_LENGTH,
  MAX_CABLE_TYPES,
  type Cable,
  type CableType,
} from '../../domain/cable/cable-layout-types'
import { isCableTypeInUse } from '../../domain/cable/cable-reference-integrity'
import { compactInputClass, secondaryButtonClass } from '../camera/camera-properties-form-helpers'
import { CommittedTextInput } from '../shared/committed-text-input'
import { NullableNumberInput } from '../shared/nullable-number-input'

interface CableTypesEditorTableProps {
  cableTypes: CableType[]
  cables: Cable[]
  onUpdate: (id: string, patch: Partial<Omit<CableType, 'id'>>) => void
  onAdd: () => void
  onDelete: (id: string) => void
}

/**
 * The project's cable types: name, length limit (empty = none) and price
 * per metre (empty = price on request - prices are typed by the user, never
 * prefilled). A type cannot be deleted while a cable uses it, nor when it
 * is the last one.
 */
export function CableTypesEditorTable({ cableTypes, cables, onUpdate, onAdd, onDelete }: CableTypesEditorTableProps) {
  const isLast = cableTypes.length <= 1

  return (
    <div className="mt-1">
      {cableTypes.map((type, i) => {
        const inUse = isCableTypeInUse(cables, type.id)
        const deleteTitle = inUse ? 'In use by a cable' : isLast ? 'At least one cable type is needed' : 'Delete this cable type'
        return (
          <div key={type.id} data-testid={`cable-type-row-${type.id}`} className="mt-2 border-t border-neutral-100 pt-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: cableTypeColor(i) }} />
              <CommittedTextInput
                id={`cable-type-name-${type.id}`}
                testId={`cable-type-name-${type.id}`}
                ariaLabel="Cable type name"
                value={type.name}
                maxLength={CABLE_TYPE_NAME_MAX_LENGTH}
                onCommit={(name) => onUpdate(type.id, { name })}
                className={`flex-1 ${compactInputClass}`}
              />
              <button
                type="button"
                data-testid={`cable-type-delete-${type.id}`}
                onClick={() => onDelete(type.id)}
                disabled={inUse || isLast}
                title={deleteTitle}
                aria-label={`Delete cable type ${type.name}`}
                className="flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent"
              >
                ×
              </button>
            </div>
            <div className="mt-1 flex items-center gap-1.5 pl-4 text-[10px] text-neutral-500">
              <label htmlFor={`cable-type-limit-${type.id}`}>Limit (m)</label>
              <NullableNumberInput
                id={`cable-type-limit-${type.id}`}
                testId={`cable-type-limit-${type.id}`}
                value={type.lengthLimitM}
                min={0}
                max={CABLE_LENGTH_LIMIT_MAX_M}
                placeholder="none"
                // 0 means "no limit" to a user; the schema also requires a limit above 0.
                onCommit={(lengthLimitM) => onUpdate(type.id, { lengthLimitM: lengthLimitM === 0 ? null : lengthLimitM })}
                className={`w-16 ${compactInputClass}`}
              />
              <label htmlFor={`cable-type-price-${type.id}`}>VND/m</label>
              <NullableNumberInput
                id={`cable-type-price-${type.id}`}
                testId={`cable-type-price-${type.id}`}
                value={type.pricePerMeterVnd}
                min={0}
                max={CABLE_PRICE_MAX_VND_PER_M}
                integer
                placeholder="on request"
                onCommit={(pricePerMeterVnd) => onUpdate(type.id, { pricePerMeterVnd })}
                className={`flex-1 ${compactInputClass}`}
              />
            </div>
          </div>
        )
      })}
      <button
        type="button"
        data-testid="cable-type-add-button"
        onClick={onAdd}
        disabled={cableTypes.length >= MAX_CABLE_TYPES}
        title={cableTypes.length >= MAX_CABLE_TYPES ? `At most ${MAX_CABLE_TYPES} cable types` : undefined}
        className={`mt-2 disabled:cursor-not-allowed disabled:text-neutral-300 ${secondaryButtonClass}`}
      >
        Add cable type
      </button>
    </div>
  )
}
