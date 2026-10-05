import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorUiStore } from './editor-ui-store'

describe('useEditorUiStore camera / wall selection', () => {
  beforeEach(() => {
    useEditorUiStore.setState({ selectedCameraId: null, selectedWallId: null, wallDrawKind: 'opaque', toolMode: 'select' })
  })

  it('selecting a wall clears the camera selection, and the reverse', () => {
    const { setSelectedCameraId, setSelectedWallId } = useEditorUiStore.getState()
    setSelectedCameraId('cam-1')
    setSelectedWallId('wall-1')
    expect(useEditorUiStore.getState()).toMatchObject({ selectedCameraId: null, selectedWallId: 'wall-1' })

    setSelectedCameraId('cam-2')
    expect(useEditorUiStore.getState()).toMatchObject({ selectedCameraId: 'cam-2', selectedWallId: null })
  })

  it('clearing one selection does not touch the other', () => {
    const { setSelectedCameraId, setSelectedWallId } = useEditorUiStore.getState()
    setSelectedWallId('wall-1')
    setSelectedCameraId(null)
    expect(useEditorUiStore.getState().selectedWallId).toBe('wall-1')

    setSelectedCameraId('cam-1')
    setSelectedWallId(null)
    expect(useEditorUiStore.getState().selectedCameraId).toBe('cam-1')
  })

  it('defaults new walls to opaque and remembers the chosen kind and the wall tool mode', () => {
    expect(useEditorUiStore.getState().wallDrawKind).toBe('opaque')
    useEditorUiStore.getState().setWallDrawKind('glass')
    useEditorUiStore.getState().setToolMode('wall')
    expect(useEditorUiStore.getState()).toMatchObject({ wallDrawKind: 'glass', toolMode: 'wall' })
  })
})

describe('useEditorUiStore catalog feature filters', () => {
  beforeEach(() => {
    useEditorUiStore.setState({ catalogFeatureFilters: [] })
  })

  it('starts with no feature filter selected', () => {
    expect(useEditorUiStore.getState().catalogFeatureFilters).toEqual([])
  })

  it('adds a key that is absent and removes one that is present', () => {
    const { toggleCatalogFeatureFilter } = useEditorUiStore.getState()
    toggleCatalogFeatureFilter('built-in-mic')
    toggleCatalogFeatureFilter('outdoor-rated')
    expect(useEditorUiStore.getState().catalogFeatureFilters).toEqual(['built-in-mic', 'outdoor-rated'])

    toggleCatalogFeatureFilter('built-in-mic')
    expect(useEditorUiStore.getState().catalogFeatureFilters).toEqual(['outdoor-rated'])
  })

  it('replaces the array instead of mutating it', () => {
    const before = useEditorUiStore.getState().catalogFeatureFilters
    useEditorUiStore.getState().toggleCatalogFeatureFilter('human-detection')
    expect(useEditorUiStore.getState().catalogFeatureFilters).not.toBe(before)
    expect(before).toEqual([])
  })
})
