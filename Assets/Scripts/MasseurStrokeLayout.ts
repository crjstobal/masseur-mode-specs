/**
 * MasseurStrokeLayout - pure geometry for one move laid out on the body.
 *
 * Owns: converting a MoveDef (back UV paths / point groups) into evenly
 * resampled mannequin-local polylines with tangents and arc length, plus the
 * timing math shared by the pulse and the ghost hands, so both always agree.
 * Must not: create scene objects or hold state between steps.
 */
import {MasseurBodyMap} from "./MasseurBodyMap"
import {MoveDef} from "./MasseurMoveLibrary"

export interface PathLayout {
  points: vec3[]
  tangents: vec3[]
  cum: number[]
  length: number
}

export interface StrokeLayout {
  move: MoveDef
  paths: PathLayout[]
  /** Mannequin-local skin points for "points" moves, one array per press group. */
  groups: vec3[][]
}

/** Builds the layout in mannequin-local space, lifted `liftCm` above the skin. */
export function buildStrokeLayout(move: MoveDef, bodyMap: MasseurBodyMap, liftCm: number, spacingCm: number = 1): StrokeLayout {
  const paths: PathLayout[] = move.paths.map((p) => resample(p.map((q) => bodyMap.uvToLocal(q, liftCm)), spacingCm))
  const groups: vec3[][] = move.pointGroups.map((g) => g.map((q) => bodyMap.uvToLocal(q, liftCm)))
  return {move, paths, groups}
}

function resample(raw: vec3[], spacing: number): PathLayout {
  const cumRaw: number[] = [0]
  for (let i = 1; i < raw.length; i++) cumRaw.push(cumRaw[i - 1] + raw[i].distance(raw[i - 1]))
  const total = cumRaw[cumRaw.length - 1]
  const n = Math.max(2, Math.ceil(total / spacing) + 1)
  const points: vec3[] = []
  const cum: number[] = []
  let j = 0
  for (let i = 0; i < n; i++) {
    const d = (total * i) / (n - 1)
    while (j < raw.length - 2 && cumRaw[j + 1] < d) j++
    const seg = Math.max(1e-6, cumRaw[j + 1] - cumRaw[j])
    points.push(vec3.lerp(raw[j], raw[j + 1], Math.min(1, Math.max(0, (d - cumRaw[j]) / seg))))
    cum.push(d)
  }
  const tangents: vec3[] = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)]
    const b = points[Math.min(points.length - 1, i + 1)]
    const t = b.sub(a)
    return t.length > 1e-6 ? t.normalize() : new vec3(0, 0, -1)
  })
  return {points, tangents, cum, length: total}
}

/** Point and tangent at arc length d along a path (clamped). */
export function samplePath(path: PathLayout, d: number): {pos: vec3; tan: vec3} {
  const dd = Math.max(0, Math.min(path.length, d))
  const n = path.points.length
  const f = path.length > 0 ? (dd / path.length) * (n - 1) : 0
  const i = Math.min(n - 2, Math.floor(f))
  const t = f - i
  return {
    pos: vec3.lerp(path.points[i], path.points[i + 1], t),
    tan: vec3.lerp(path.tangents[i], path.tangents[i + 1], t).normalize(),
  }
}

/** Cycle phase 0..1 of a path at a motion time (alternating moves offset odd paths by half a cycle). */
export function pathPhase(move: MoveDef, pathIndex: number, motionTime: number): number {
  const offset = move.alternate && pathIndex % 2 === 1 ? 0.5 : 0
  const x = motionTime / move.cycleSec + offset
  return x - Math.floor(x)
}

/** For "points" moves: which group is active and how full its ring is (0..1, fills then empties). */
export function pointState(move: MoveDef, motionTime: number): {group: number; fill: number; pressing: boolean} {
  const n = Math.max(1, move.pointGroups.length)
  const total = move.cycleSec * n
  const local = motionTime - Math.floor(motionTime / total) * total
  const group = Math.min(n - 1, Math.floor(local / move.cycleSec))
  const t = local - group * move.cycleSec
  const press = Math.min(move.pressSec, move.cycleSec)
  if (t < press) return {group, fill: press > 0 ? t / press : 1, pressing: true}
  const release = Math.max(1e-3, move.cycleSec - press)
  return {group, fill: Math.max(0, 1 - (t - press) / release), pressing: false}
}
