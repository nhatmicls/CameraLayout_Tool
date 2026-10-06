import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorUiStore } from './editor-ui-store'

describe('useEditorUiStore camera / wall / sensor selection', () => {
  beforeEach(() => {
    useEditorUiStore.setState({
      selectedCameraId: null,
      selectedWallId: null,
      selectedSensorId: null,
      selectedHubId: null,
      selectedCableId: null,
      wallDrawKind: 'opaque',
      toolMode: 'select',
    })
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

  it('selecting a sensor clears both camera and wall selection', () => {
    const { setSelectedCameraId, setSelectedWallId, setSelectedSensorId } = useEditorUiStore.getState()
    setSelectedCameraId('cam-1')
    setSelectedWallId('wall-1')
    setSelectedSensorId('sensor-1')
    expect(useEditorUiStore.getState()).toMatchObject({
      selectedCameraId: null,
      selectedWallId: null,
      selectedSensorId: 'sensor-1',
    })
  })

  it('selecting a camera or a wall clears a prior sensor selection', () => {
    const { setSelectedCameraId, setSelectedWallId, setSelectedSensorId } = useEditorUiStore.getState()
    setSelectedSensorId('sensor-1')
    setSelectedCameraId('cam-1')
    expect(useEditorUiStore.getState()).toMatchObject({ selectedCameraId: 'cam-1', selectedSensorId: null })

    setSelectedSensorId('sensor-1')
    setSelectedWallId('wall-1')
    expect(useEditorUiStore.getState()).toMatchObject({ selectedWallId: 'wall-1', selectedSensorId: null })
  })

  const selectedIds = () => {
    const { selectedCameraId, selectedWallId, selectedSensorId, selectedHubId, selectedCableId } = useEditorUiStore.getState()
    return { selectedCameraId, selectedWallId, selectedSensorId, selectedHubId, selectedCableId }
  }
  const NONE = { selectedCameraId: null, selectedWallId: null, selectedSensorId: null, selectedHubId: null, selectedCableId: null }

  it('at most one of the five selection ids is ever set, across an interleaved sequence', () => {
    const { setSelectedCameraId, setSelectedWallId, setSelectedSensorId, setSelectedHubId, setSelectedCableId } =
      useEditorUiStore.getState()
    const sequence: Array<() => void> = [
      () => setSelectedCameraId('cam-1'),
      () => setSelectedHubId('hub-1'),
      () => setSelectedSensorId('sensor-1'),
      () => setSelectedCableId('cable-1'),
      () => setSelectedWallId('wall-1'),
      () => setSelectedCameraId('cam-2'),
      () => setSelectedCableId('cable-2'),
      () => setSelectedHubId('hub-2'),
      () => setSelectedSensorId('sensor-2'),
    ]
    for (const step of sequence) {
      step()
      expect(Object.values(selectedIds()).filter((id) => id !== null)).toHaveLength(1)
    }
  })

  it('selecting a hub or a cable clears the other four ids', () => {
    const { setSelectedCameraId, setSelectedHubId, setSelectedCableId } = useEditorUiStore.getState()
    setSelectedCameraId('cam-1')
    setSelectedHubId('hub-1')
    expect(selectedIds()).toEqual({ ...NONE, selectedHubId: 'hub-1' })
    setSelectedCableId('cable-1')
    expect(selectedIds()).toEqual({ ...NONE, selectedCableId: 'cable-1' })
    setSelectedCameraId('cam-1')
    expect(selectedIds()).toEqual({ ...NONE, selectedCameraId: 'cam-1' })
  })

  it('clearing the hub id leaves a cable selection alone', () => {
    useEditorUiStore.getState().setSelectedCableId('cable-1')
    useEditorUiStore.getState().setSelectedHubId(null)
    expect(selectedIds()).toEqual({ ...NONE, selectedCableId: 'cable-1' })
  })

  it('clearSelection sets all five ids to null', () => {
    useEditorUiStore.getState().setSelectedCableId('cable-1')
    useEditorUiStore.getState().clearSelection()
    expect(selectedIds()).toEqual(NONE)
  })

  it('stores the hub and cable tool modes and the cable draw type', () => {
    useEditorUiStore.getState().setToolMode('hub')
    expect(useEditorUiStore.getState().toolMode).toBe('hub')
    useEditorUiStore.getState().setToolMode('cable')
    useEditorUiStore.getState().setCableDrawTypeId('cat6-utp')
    expect(useEditorUiStore.getState()).toMatchObject({ toolMode: 'cable', cableDrawTypeId: 'cat6-utp' })
  })

  it('defaults new walls to opaque and remembers the chosen kind and the wall tool mode', () => {
    expect(useEditorUiStore.getState().wallDrawKind).toBe('opaque')
    useEditorUiStore.getState().setWallDrawKind('glass')
    useEditorUiStore.getState().setToolMode('wall')
    expect(useEditorUiStore.getState()).toMatchObject({ wallDrawKind: 'glass', toolMode: 'wall' })
  })
})

describe('useEditorUiStore catalog tab and sensor kind filter', () => {
  beforeEach(() => {
    useEditorUiStore.setState({ catalogTab: 'cameras', sensorCatalogKindFilter: 'all' })
  })

  it('defaults to the cameras tab and no kind filter', () => {
    expect(useEditorUiStore.getState()).toMatchObject({ catalogTab: 'cameras', sensorCatalogKindFilter: 'all' })
  })

  it('switches tab and sensor kind filter independently', () => {
    useEditorUiStore.getState().setCatalogTab('sensors')
    useEditorUiStore.getState().setSensorCatalogKindFilter('pir')
    expect(useEditorUiStore.getState()).toMatchObject({ catalogTab: 'sensors', sensorCatalogKindFilter: 'pir' })
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
