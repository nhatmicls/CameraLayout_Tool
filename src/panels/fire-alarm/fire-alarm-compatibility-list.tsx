import { useState } from 'react'
import { fireAlarmModelById, type FireAlarmModel } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import { fireAlarmCompatibilityIndex } from '../../export/shared/fire-alarm-compatibility-index-singleton'
import {
  FIRE_COMPATIBILITY_COLLAPSE_THRESHOLD,
  FIRE_COMPATIBILITY_CONTROLLER_HEADING,
  FIRE_COMPATIBILITY_NONE_RECORDED,
  FIRE_COMPATIBILITY_PERIPHERAL_HEADING,
} from './fire-alarm-ui-wording'

interface FireAlarmCompatibilityListProps {
  model: FireAlarmModel
}

interface CompatibilityRow {
  key: string
  label: string
  sourceUrl: string
  note?: string
}

/**
 * Both compatibility directions for one catalog record, shared by the
 * catalog card and the device properties panel so the two never disagree
 * (phase-07 risk register). A controller ('compatibleDevices' in model,
 * narrowed via the `in` check the catalog loader itself uses) shows
 * "Compatible devices in this catalog" from its own forward list; any other
 * kind shows "Listed for" from the reverse index built once at module load.
 * Collapses past `FIRE_COMPATIBILITY_COLLAPSE_THRESHOLD` rows behind a
 * "Show all N" toggle (phase-07 risk register: long lists blow up the card).
 */
export function FireAlarmCompatibilityList({ model }: FireAlarmCompatibilityListProps) {
  const [expanded, setExpanded] = useState(false)
  const isController = 'compatibleDevices' in model

  const rows: CompatibilityRow[] = isController
    ? model.compatibleDevices.map((entry) => ({
        key: entry.modelId,
        label: fireAlarmModelById(entry.modelId)?.model ?? entry.modelId,
        sourceUrl: entry.sourceUrl,
        note: entry.note,
      }))
    : (fireAlarmCompatibilityIndex.controllersByDeviceModelId.get(model.id) ?? []).map((link) => ({
        key: link.controllerModelId,
        label: fireAlarmModelById(link.controllerModelId)?.model ?? link.controllerModelId,
        sourceUrl: link.sourceUrl,
        note: link.note,
      }))

  const heading = isController ? FIRE_COMPATIBILITY_CONTROLLER_HEADING : FIRE_COMPATIBILITY_PERIPHERAL_HEADING
  const testPrefix = isController ? 'fire-alarm-compat-controller' : 'fire-alarm-compat-peripheral'

  if (rows.length === 0) {
    return (
      <p data-testid={`${testPrefix}-empty-${model.id}`} className="mt-1 text-neutral-400">
        {FIRE_COMPATIBILITY_NONE_RECORDED}
      </p>
    )
  }

  const visibleRows = expanded ? rows : rows.slice(0, FIRE_COMPATIBILITY_COLLAPSE_THRESHOLD)

  return (
    <div data-testid={`${testPrefix}-${model.id}`} className="mt-1">
      <p className="text-neutral-500">{heading}</p>
      <ul className="mt-0.5 list-inside list-disc text-neutral-600">
        {visibleRows.map((row) => (
          <li key={row.key}>
            <a
              href={row.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-blue-600 hover:underline"
            >
              {row.label}
            </a>
            {row.note && <span className="text-neutral-400"> ({row.note})</span>}
          </li>
        ))}
      </ul>
      {rows.length > FIRE_COMPATIBILITY_COLLAPSE_THRESHOLD && !expanded && (
        <button
          type="button"
          data-testid={`${testPrefix}-show-all-${model.id}`}
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(true)
          }}
          className="mt-0.5 text-blue-600 hover:underline"
        >
          Show all {rows.length}
        </button>
      )}
    </div>
  )
}
