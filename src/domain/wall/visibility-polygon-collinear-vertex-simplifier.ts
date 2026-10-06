/**
 * Below this |sine of the angle| between a vertex's incoming and outgoing
 * edge, the three points count as collinear (float noise from the ray/
 * segment intersection math, at any plan coordinate, is well under this).
 */
const COLLINEAR_SINE_EPSILON = 1e-9

/**
 * True when `cur` sits exactly on the straight line from `prev` through
 * `next` AND the path keeps going the same way through it (as opposed to a
 * spike that reaches `cur` then reverses) - i.e. `cur` contributes nothing a
 * straight edge from `prev` to `next` did not already cover. Assumes `prev`,
 * `cur` and `next` are already pairwise distinct (see `dedupeConsecutiveVertices`
 * below, which runs first) - the zero-length-edge guard (`lenA === 0 || lenB === 0`)
 * is defensive only, never actually hit once that precondition holds.
 */
function isRedundantVertex(prevX: number, prevY: number, curX: number, curY: number, nextX: number, nextY: number): boolean {
  const ax = curX - prevX
  const ay = curY - prevY
  const bx = nextX - curX
  const by = nextY - curY
  const lenA = Math.hypot(ax, ay)
  const lenB = Math.hypot(bx, by)
  if (lenA === 0 || lenB === 0) return false
  const cross = ax * by - ay * bx
  const dot = ax * bx + ay * by
  return Math.abs(cross / (lenA * lenB)) < COLLINEAR_SINE_EPSILON && dot > 0
}

/**
 * Collapses a run of consecutive, EXACTLY equal points (cyclically - the
 * seam between the last point and the first counts too) down to one
 * representative each. Two different rays (or a ray and a corner-pair push
 * from the two walls sharing that corner) routinely land on the exact same
 * point - e.g. two adjacent box walls sharing a corner each push a bearing
 * triple for it, and the walls' own crossing at that shared endpoint pushes
 * a third. This MUST run before `isRedundantVertex` below: checking a
 * vertex's redundancy against an immediate duplicate SIBLING (rather than
 * its true geometric neighbour on each side) would cascade-delete an entire
 * meaningful transition - exactly the bug this comment is here to prevent a
 * regression of (covered by `wall-occlusion-visibility-polygon.test.ts`'s box
 * and crossing-wall cases turning the wrong pixels visible).
 */
function dedupeConsecutiveVertices(polygon: number[]): number[] {
  const count = polygon.length / 2
  if (count <= 1) return polygon

  const deduped: number[] = []
  for (let i = 0; i < count; i++) {
    const x = polygon[i * 2]
    const y = polygon[i * 2 + 1]
    const n = deduped.length
    if (n > 0 && deduped[n - 2] === x && deduped[n - 1] === y) continue
    deduped.push(x, y)
  }
  const n = deduped.length
  if (n >= 4 && deduped[0] === deduped[n - 2] && deduped[1] === deduped[n - 1]) deduped.length = n - 2
  return deduped
}

/**
 * Drops every (post-dedupe) polygon vertex that is redundant between its two
 * ORIGINAL neighbours (see `isRedundantVertex`) - the common case being many
 * nearby rays (fixed + corner) that all land on the same straight wall edge,
 * which before this pass each kept their own vertex (
 * ~3100 vertices measured where ~20 suffice with 300 walls in range). Using
 * each vertex's ORIGINAL (post-dedupe) neighbours - not the shrinking output -
 * is deliberate and still correct: collinearity-with-same-direction is
 * transitive along a straight run, so dropping every redundant point in one
 * O(n) pass - however many are consecutive - still leaves the kept points
 * tracing the exact same shape. Cyclic, so the wrap-around seam simplifies
 * too. Falls back to the deduped-but-unsimplified polygon when fewer than 3
 * vertices would remain (never collapse below a triangle) or when there
 * were already 3 or fewer after dedupe (nothing redundant can exist there).
 */
export function simplifyCollinearVertices(polygon: number[]): number[] {
  const deduped = dedupeConsecutiveVertices(polygon)
  const count = deduped.length / 2
  if (count <= 3) return deduped

  const simplified: number[] = []
  for (let i = 0; i < count; i++) {
    const prev = (i - 1 + count) % count
    const next = (i + 1) % count
    if (
      isRedundantVertex(
        deduped[prev * 2],
        deduped[prev * 2 + 1],
        deduped[i * 2],
        deduped[i * 2 + 1],
        deduped[next * 2],
        deduped[next * 2 + 1],
      )
    ) {
      continue
    }
    simplified.push(deduped[i * 2], deduped[i * 2 + 1])
  }
  return simplified.length >= 6 ? simplified : deduped
}
