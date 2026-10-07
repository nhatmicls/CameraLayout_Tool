/**
 * Built once at module load from the static fire-alarm catalog: the reverse
 * (device -> controllers) compatibility index, and an id -> record map for
 * `checkFireAlarmCompatibility`'s `specById` argument. Shared by the catalog
 * card, the compatibility list and the device properties panel (phase 7),
 * and by the BOM panel + CSV/PNG export (phase 8) - built once here rather
 * than once per component so every consumer sees the same object identity.
 *
 * Lives under `src/export/shared` (moved from `src/panels/fire-alarm` in
 * phase 8), not `src/panels`: export code must not import from panels
 * (one-way layering - `bill-of-materials-panel.tsx` already imports from
 * `src/export/shared`, never the reverse), so the shared singleton moved to
 * the side both export and panels may import from.
 */
import { fireAlarmModels, type FireAlarmModel } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import { buildFireAlarmCompatibilityIndex } from '../../domain/fire-alarm/fire-alarm-compatibility-checker'

export const fireAlarmCompatibilityIndex = buildFireAlarmCompatibilityIndex(fireAlarmModels)

/** `FireAlarmModel` (catalog) structurally satisfies `FireAlarmModelSpec` (domain) - see `fire-alarm-model-spec-assignability.test.ts`. */
export const fireAlarmModelSpecById: Record<string, FireAlarmModel> = Object.fromEntries(
  fireAlarmModels.map((model) => [model.id, model]),
)
