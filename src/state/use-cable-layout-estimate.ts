import { useMemo } from 'react'
import { computeCableLayoutEstimate, type CableLayoutEstimate } from '../domain/cable/cable-layout-estimate'
import { useProjectStore } from './project-store'
import { selectCables, selectCameras, selectHubs, selectScale, selectSensors } from './project-store-floor-selectors'

/**
 * The live cable estimate over the project store. Recomputed when anything
 * it reads changes; cheap enough (<= 1000 cables) that panels each call this
 * hook instead of sharing a cache.
 */
export function useCableLayoutEstimate(): CableLayoutEstimate {
  const cameras = useProjectStore(selectCameras)
  const sensors = useProjectStore(selectSensors)
  const hubs = useProjectStore(selectHubs)
  const cables = useProjectStore(selectCables)
  const cableTypes = useProjectStore((s) => s.cableTypes)
  const cableSettings = useProjectStore((s) => s.cableSettings)
  const scale = useProjectStore(selectScale)

  return useMemo(
    () => computeCableLayoutEstimate({ cameras, sensors, hubs, cables, cableTypes, cableSettings, scale }),
    [cameras, sensors, hubs, cables, cableTypes, cableSettings, scale],
  )
}
