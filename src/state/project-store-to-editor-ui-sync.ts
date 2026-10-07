import { selectActiveFloor } from './project-store-floor-selectors'
import { useProjectStore, type ProjectState } from './project-store'
import { useEditorUiStore } from './editor-ui-store'

/**
 * One `useProjectStore.subscribe` that keeps `editor-ui-store` in sync with
 * the project store, replacing the old "any change marks the project dirty"
 * subscription now that a floor switch is a project-store change too but
 * must NOT mark the project dirty, reset the selection, or leave a stale
 * decoded image on screen by itself.
 *
 * Called once from `editor-ui-store.ts` (so every test that imports that
 * store still gets the wiring, same as before this phase).
 */
export function installProjectStoreToEditorUiSync(): void {
  useProjectStore.subscribe((state, prevState) => {
    if (hasTrackedChange(state, prevState)) {
      useEditorUiStore.getState().setHasUnsavedChanges(true)
    }

    // M2 fix: a plain `activeFloorId` comparison misses a project load whose new active floor
    // happens to share an id with the old one (two legacy, pre-v7 files BOTH wrap their one
    // floor as `LEGACY_FLOOR_ID` - opening one right after the other left selection/tool/the
    // stage itself untouched). `loadSeq` changes on EVERY `replaceProject`/`resetProject` call
    // regardless, so it is checked independently and ALSO forces a stage remount via
    // `projectLoadEpoch` (`app.tsx`'s key) - a floor switch alone still only resets selection/tool.
    const isProjectLoad = state.loadSeq !== prevState.loadSeq
    if (state.activeFloorId !== prevState.activeFloorId || isProjectLoad) {
      useEditorUiStore.getState().clearSelection()
      useEditorUiStore.getState().setToolMode('select')
    }
    if (isProjectLoad) {
      useEditorUiStore.getState().bumpProjectLoadEpoch()
    }

    // Keyed on the data URL STRING, not the `PlanImage` object reference, and must match the
    // key `use-active-floor-decoded-image-sync.ts`'s effect re-decodes on (also the data URL) -
    // otherwise a `setImage`/floor switch that lands a NEW `PlanImage` object with the SAME
    // data URL (reloading the same file, undo back to it, re-opening the same saved project, or
    // two floors sharing one image) nulls the bitmap here but never re-triggers that effect,
    // leaving `decodedImage` stuck null and the canvas blank. Covers both a floor switch to a
    // floor with a different image AND a `setImage` call on the floor that is already active -
    // either way the on-screen bitmap is stale until that effect decodes the new one. Setting
    // this synchronously (inside the subscription, not an effect) means no frame ever draws
    // floor A's bitmap while floor B's data is on screen.
    const prevDataUrl = selectActiveFloor(prevState).image?.dataUrl ?? null
    const nextDataUrl = selectActiveFloor(state).image?.dataUrl ?? null
    if (nextDataUrl !== prevDataUrl) {
      useEditorUiStore.getState().setDecodedImage(null)
    }
  })
}

/** Mirrors `project-store.ts`'s zundo `partialize`: the fields a user thinks of as "my project". */
function hasTrackedChange(state: ProjectState, prevState: ProjectState): boolean {
  return (
    state.floors !== prevState.floors ||
    state.shafts !== prevState.shafts ||
    state.cableTypes !== prevState.cableTypes ||
    state.cableSettings !== prevState.cableSettings ||
    state.fireAlarmSettings !== prevState.fireAlarmSettings
  )
}
