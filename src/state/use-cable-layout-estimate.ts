import { useMemo } from 'react'
import { computeCableLayoutEstimate, type CableLayoutEstimate } from '../domain/cable/cable-layout-estimate'
import { useProjectStore } from './project-store'

/**
 * The live cable estimate over the project store. Recomputed when anything
 * it reads changes; cheap enough (<= 1000 cables) that panels each call this
 * hook instead of sharing a cache.
 */
export function useCableLayoutEstimate(): CableLayoutEstimate {
  const cameras = useProjectStore((s) => s.cameras)
  const sensors = useProjectStore((s) => s.sensors)
  const hubs = useProjectStore((s) => s.hubs)
  const cables = useProjectStore((s) => s.cables)
  const cableTypes = useProjectStore((s) => s.cableTypes)
  const cableSettings = useProjectStore((s) => s.cableSettings)
  const scale = useProjectStore((s) => s.scale)

  return useMemo(
    () => computeCableLayoutEstimate({ cameras, sensors, hubs, cables, cableTypes, cableSettings, scale }),
    [cameras, sensors, hubs, cables, cableTypes, cableSettings, scale],
  )
}
