/**
 * MasseurMoveLibrary - the massage move library from the design brief.
 *
 * Owns: static move definitions (name, part of the hand, cycle length, stroke
 * shape on the back). Pure data + pure geometry helpers, no scene access.
 *
 * Coordinates: every stroke is written in "back UV" space so it belongs to the
 * body, not to the room:
 *   u = lateral position, -1 .. +1 (0 = spine line, +-1 = edge of the back)
 *   v = position along the spine, 0 = base of the neck, 1 = lower back
 * MasseurBodyMap turns (u, v) into a point on the mannequin's skin.
 *
 * Must not: read session state, create scene objects, or know about UI.
 */

export type HandPose = "palm" | "fist" | "thumb" | "fingertips" | "forearm"
export type StrokeKind = "path" | "points"

export interface BackUV {
  u: number
  v: number
}

export interface MoveDef {
  id: string
  name: string
  /** Text for the step card: which part of the hand to use. */
  handPart: string
  pose: HandPose
  /** Seconds for one full cycle at 100% pace. */
  cycleSec: number
  kind: StrokeKind
  /** "path" moves: polylines in back UV (one per hand / side). */
  paths: BackUV[][]
  /** "points" moves: each entry is a group of points pressed at the same time. */
  pointGroups: BackUV[][]
  /** Press portion of a point cycle in seconds (points moves only). */
  pressSec: number
  /** When true, the second path runs half a cycle behind the first (alternating hands). */
  alternate: boolean
  /** Visual intensity of the stroke, 1 = normal, lower = lighter touch. */
  intensity: number
}

// ---------------------------------------------------------------------------
// Path helpers (pure)
// ---------------------------------------------------------------------------

function mirror(path: BackUV[]): BackUV[] {
  return path.map((p) => ({u: -p.u, v: p.v}))
}

function uv(points: number[][]): BackUV[] {
  return points.map((p) => ({u: p[0], v: p[1]}))
}

/** Catmull-Rom resample so hand-authored control points become a smooth curve. */
export function smoothPath(ctrl: BackUV[], samplesPerSegment: number = 10): BackUV[] {
  if (ctrl.length < 3) return ctrl.slice()
  const out: BackUV[] = []
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)]
    const p1 = ctrl[i]
    const p2 = ctrl[i + 1]
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)]
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push({u: f(p0.u, p1.u, p2.u, p3.u), v: f(p0.v, p1.v, p2.v, p3.v)})
    }
  }
  out.push(ctrl[ctrl.length - 1])
  return out
}

/** Small loops walking along a line: used for thumb circles and kneading. */
function loopsAlong(u0: number, v0: number, u1: number, v1: number, loops: number, radiusU: number, radiusV: number): BackUV[] {
  const out: BackUV[] = []
  const steps = loops * 24
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = t * loops * Math.PI * 2
    out.push({
      u: u0 + (u1 - u0) * t + radiusU * Math.sin(a),
      v: v0 + (v1 - v0) * t + radiusV * (1 - Math.cos(a)) * 0.5 - radiusV * 0.25,
    })
  }
  return out
}

function ellipse(cu: number, cv: number, ru: number, rv: number, startAngle: number): BackUV[] {
  const out: BackUV[] = []
  const steps = 48
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + (i / steps) * Math.PI * 2
    out.push({u: cu + ru * Math.cos(a), v: cv + rv * Math.sin(a)})
  }
  return out
}

function pairs(points: number[][]): BackUV[][] {
  return points.map((p) => [{u: p[0], v: p[1]}, {u: -p[0], v: p[1]}])
}

// ---------------------------------------------------------------------------
// Move library (design brief, "Move library (default)")
// ---------------------------------------------------------------------------

const openingRight = smoothPath(
  uv([
    [0.24, 1.0], [0.24, 0.7], [0.25, 0.35], [0.28, 0.1], [0.45, 0.02],
    [0.75, 0.03], [0.93, 0.12], [0.9, 0.4], [0.82, 0.72], [0.72, 1.0],
  ]),
)

const forearmRight = smoothPath(uv([[0.16, 0.55], [0.2, 0.38], [0.3, 0.2], [0.5, 0.08], [0.78, 0.04]]))

function base(def: Partial<MoveDef> & Pick<MoveDef, "id" | "name" | "handPart" | "pose" | "cycleSec" | "kind">): MoveDef {
  return {
    paths: [],
    pointGroups: [],
    pressSec: 0,
    alternate: false,
    intensity: 1,
    ...def,
  }
}

export const MOVES: Record<string, MoveDef> = {
  opening_glide: base({
    id: "opening_glide",
    name: "Opening glide",
    handPart: "Both palms",
    pose: "palm",
    cycleSec: 8,
    kind: "path",
    paths: [openingRight, mirror(openingRight)],
  }),
  shoulder_kneading: base({
    id: "shoulder_kneading",
    name: "Shoulder kneading",
    handPart: "Palms and fingers",
    pose: "fingertips",
    cycleSec: 4,
    kind: "path",
    paths: [loopsAlong(0.3, 0.03, 0.92, 0.07, 3, 0.07, 0.07), mirror(loopsAlong(0.3, 0.03, 0.92, 0.07, 3, 0.07, 0.07))],
    alternate: true,
  }),
  thumb_circles: base({
    id: "thumb_circles",
    name: "Thumb circles",
    handPart: "Thumbs",
    pose: "thumb",
    cycleSec: 30,
    kind: "path",
    paths: [loopsAlong(0.2, 0.08, 0.2, 0.95, 9, 0.08, 0.05), mirror(loopsAlong(0.2, 0.08, 0.2, 0.95, 9, 0.08, 0.05))],
  }),
  knuckle_glide: base({
    id: "knuckle_glide",
    name: "Knuckle glide",
    handPart: "Soft fists (knuckles)",
    pose: "fist",
    cycleSec: 6,
    kind: "path",
    paths: [smoothPath(uv([[0.22, 0.05], [0.24, 0.5], [0.22, 0.96]])), mirror(smoothPath(uv([[0.22, 0.05], [0.24, 0.5], [0.22, 0.96]])))],
  }),
  scapula_circles: base({
    id: "scapula_circles",
    name: "Shoulder blade circles",
    handPart: "Fingertips",
    pose: "fingertips",
    cycleSec: 5,
    kind: "path",
    paths: [ellipse(0.5, 0.3, 0.3, 0.2, -Math.PI / 2), mirror(ellipse(0.5, 0.3, 0.3, 0.2, -Math.PI / 2))],
  }),
  forearm_glide: base({
    id: "forearm_glide",
    name: "Forearm glide",
    handPart: "Flat forearm, not elbow",
    pose: "forearm",
    cycleSec: 8,
    kind: "path",
    paths: [forearmRight, mirror(forearmRight)],
  }),
  press_hold: base({
    id: "press_hold",
    name: "Press and hold",
    handPart: "Thumbs or palms",
    pose: "thumb",
    cycleSec: 8,
    kind: "points",
    pressSec: 5,
    pointGroups: pairs([[0.45, 0.03], [0.75, 0.06], [0.2, 0.2], [0.2, 0.4], [0.2, 0.6], [0.2, 0.8]]),
  }),
  palm_presses: base({
    id: "palm_presses",
    name: "Palm presses",
    handPart: "Both palms",
    pose: "palm",
    cycleSec: 3,
    kind: "points",
    pressSec: 1.8,
    pointGroups: pairs([[0.5, 0.12], [0.5, 0.3], [0.5, 0.48], [0.5, 0.66], [0.5, 0.84]]),
  }),
  feather_strokes: base({
    id: "feather_strokes",
    name: "Closing feather strokes",
    handPart: "Fingertips, very light",
    pose: "fingertips",
    cycleSec: 6,
    kind: "path",
    intensity: 0.65,
    paths: [
      smoothPath(uv([[0.16, 0.02], [0.17, 0.5], [0.16, 1.0]])),
      mirror(smoothPath(uv([[0.16, 0.02], [0.17, 0.5], [0.16, 1.0]]))),
      smoothPath(uv([[0.5, 0.02], [0.52, 0.5], [0.48, 1.0]])),
      mirror(smoothPath(uv([[0.5, 0.02], [0.52, 0.5], [0.48, 1.0]]))),
      smoothPath(uv([[0.85, 0.06], [0.82, 0.5], [0.72, 1.0]])),
      mirror(smoothPath(uv([[0.85, 0.06], [0.82, 0.5], [0.72, 1.0]]))),
    ],
  }),
}

export function getMove(id: string): MoveDef {
  const m = MOVES[id]
  if (!m) throw new Error(`MasseurMoveLibrary: unknown move "${id}"`)
  return m
}
