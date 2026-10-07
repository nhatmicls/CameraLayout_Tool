import { useCallback, useState } from 'react'
import { fireAlarmModelById, type FireAlarmModel } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import { sensorModelById } from '../../catalog/sensor/sensor-catalog-loader'
import { FireAlarmCompatibilityPopup, type FireAlarmCompatibilityPopupRow } from './fire-alarm-compatibility-popup'
import { FIRE_COMPATIBILITY_CONTROLLER_HEADING, FIRE_COMPATIBILITY_NONE_RECORDED } from './fire-alarm-ui-wording'

interface FireAlarmCompatibilityListProps {
  model: FireAlarmModel
}

/**
 * Compatibility of one catalog record, shared by the catalog card and the
 * device properties panel so the two never disagree. Compatibility is
 * controller-centric (owner decision): the control panel / hub is the main
 * item and lists the devices that work with it, so only a controller
 * ('compatibleDevices' in model) renders anything here - a sensor or other
 * peripheral shows no list of its own (its status against the PLACED
 * controllers is the properties panel's status line). The card shows only
 * the count and a button; the entries (source links, firmware notes) open
 * in `FireAlarmCompatibilityPopup`, so a long list never stretches the card.
 */
export function FireAlarmCompatibilityList({ model }: FireAlarmCompatibilityListProps) {
  const [popupOpen, setPopupOpen] = useState(false)
  const closePopup = useCallback(() => setPopupOpen(false), [])
  if (!('compatibleDevices' in model)) return null

  // A compatibleDevices entry may point at this catalog OR the sensor catalog (ids are
  // disjoint - CLAUDE.md), e.g. an AX Hybrid PRO motion/glass-break detector that is a
  // sensor-catalog record, not a fire-alarm one. Try this catalog first, then the sensor
  // catalog, so the popup never shows a bare id when the model is known.
  const rows: FireAlarmCompatibilityPopupRow[] = model.compatibleDevices.map((entry) => ({
    key: entry.modelId,
    label: fireAlarmModelById(entry.modelId)?.model ?? sensorModelById(entry.modelId)?.model ?? entry.modelId,
    sourceUrl: entry.sourceUrl,
    note: entry.note,
  }))

  const heading = FIRE_COMPATIBILITY_CONTROLLER_HEADING
  const testPrefix = 'fire-alarm-compat-controller'

  if (rows.length === 0) {
    return (
      <p data-testid={`${testPrefix}-empty-${model.id}`} className="mt-1 text-neutral-400">
        {FIRE_COMPATIBILITY_NONE_RECORDED}
      </p>
    )
  }

  return (
    <div data-testid={`${testPrefix}-${model.id}`} className="mt-1 flex items-center justify-between gap-2">
      <span className="text-neutral-500">
        {heading}: {rows.length}
      </span>
      <button
        type="button"
        data-testid={`${testPrefix}-open-${model.id}`}
        onClick={(e) => {
          e.stopPropagation()
          setPopupOpen(true)
        }}
        className="flex-shrink-0 rounded border border-neutral-300 px-1.5 py-0.5 text-blue-600 hover:bg-neutral-50"
      >
        View list
      </button>
      {popupOpen && (
        <FireAlarmCompatibilityPopup
          title={`${model.model} - ${heading.toLowerCase()}`}
          rows={rows}
          testId={`${testPrefix}-popup-${model.id}`}
          onClose={closePopup}
        />
      )}
    </div>
  )
}
