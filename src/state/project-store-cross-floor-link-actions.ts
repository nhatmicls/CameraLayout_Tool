import type { CablePoint, CableSettings, HubRef } from '../domain/cable/cable-layout-types'
import {
  linkHubPair,
  relinkHub as domainRelinkHub,
  setHubTrunk as domainSetHubTrunk,
  unlinkHub as domainUnlinkHub,
} from '../domain/cable/cross-floor-hub-link-writer'
import { createPairedHub as domainCreatePairedHub } from '../domain/cable/cross-floor-paired-hub-creator'
import type { Floor } from '../domain/floor/floor-types'

/**
 * The riser/drop link + trunk slice of the project store. Unlike the
 * cabling/fire-alarm slices, a link always touches the hub's OWN floor
 * AND (`linkHubs`/`unlinkHub`/`createPairedHub`) its partner's - so these
 * actions set the WHOLE `floors` array directly rather than going through
 * `patchActiveFloor`/`patchFloorById` (the domain functions already return
 * the complete, correctly-patched `Floor[]`). Every action is a no-op
 * (same `floors` reference, no `set()` call) when the domain function
 * refuses - never an empty undo step.
 */
export interface CrossFloorLinkState {
  floors: Floor[]
  cableSettings: CableSettings
}

export interface CrossFloorLinkActions {
  /** Links `a` and `b` (whichever is the riser, whichever is the drop). No-op if not a legal adjacent riser/drop pair, already linked to each other, or EITHER side is already linked elsewhere (never steals - use `relinkHub` to switch a hub that already has a partner). */
  linkHubs: (a: HubRef, b: HubRef) => void
  /** Clears `ref`'s link (and both sides' trunks) symmetrically. No-op if `ref` isn't linked. */
  unlinkHub: (ref: HubRef) => void
  /** The hub panel's "Linked to" picker: switches `ref` to `newPartner` (or, `null`, just unlinks) in ONE undo step - `ref`'s OLD partner (and its trunk, and `ref`'s own trunk) is cleared first, then the new link is set via the same no-stealing rule `linkHubs` enforces. */
  relinkHub: (ref: HubRef, newPartner: HubRef | null) => void
  /** One click: creates the opposite-kind point on the one legal adjacent floor and links both. */
  createPairedHub: (ref: HubRef, newHubId: string) => { ok: true } | { ok: false; problem: string }
  /** Sets (or, with `trunk: null`, clears) `ref`'s own route to another hub on its own floor. No-op (returns `false`) if `ref` isn't linked, the target is itself/unknown, or `ref` itself doesn't resolve - the caller (the drawing overlay) uses this to warn instead of silently discarding a just-drawn route. */
  setHubTrunk: (ref: HubRef, trunk: { hubId: string; points: CablePoint[] } | null) => boolean
}

export function createCrossFloorLinkActions(
  set: (partial: Pick<CrossFloorLinkState, 'floors'>) => void,
  get: () => CrossFloorLinkState,
): CrossFloorLinkActions {
  return {
    linkHubs: (a, b) => {
      const { floors } = get()
      const next = linkHubPair(floors, a, b)
      if (next !== floors) set({ floors: next })
    },

    unlinkHub: (ref) => {
      const { floors } = get()
      const next = domainUnlinkHub(floors, ref)
      if (next !== floors) set({ floors: next })
    },

    relinkHub: (ref, newPartner) => {
      const { floors } = get()
      const next = domainRelinkHub(floors, ref, newPartner)
      if (next !== floors) set({ floors: next })
    },

    createPairedHub: (ref, newHubId) => {
      const { floors, cableSettings } = get()
      const result = domainCreatePairedHub(floors, ref, newHubId, cableSettings.routeHeightM)
      if ('problem' in result) return { ok: false, problem: result.problem }
      set({ floors: result.floors })
      return { ok: true }
    },

    setHubTrunk: (ref, trunk) => {
      const { floors } = get()
      const next = domainSetHubTrunk(floors, ref, trunk)
      if (next === floors) return false
      set({ floors: next })
      return true
    },
  }
}
