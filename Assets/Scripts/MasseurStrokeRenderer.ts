/**
 * MasseurStrokeRenderer - the soft neon strokes drawn on the mannequin's back.
 *
 * Owns: one vertex-colored mesh per step. Path moves render as a 1.5 cm neon
 * ribbon with arrowheads and a brighter pulse travelling along it at the
 * current pace; press moves render a ring per pressure point that fills while
 * you press and empties while you release. Between steps the stroke fades out
 * and the next one draws in.
 *
 * Driven by Main: showMove(layout) on step change, setMotion(stepMotionTime)
 * every frame (that clock is frozen while paused and scaled by pace).
 * Geometry lives in mannequin-local space under this SceneObject, so the
 * strokes move with the body and never with the camera.
 *
 * Must not: own session state or read other controllers.
 */
import {GLOW_LAYOUT, GLOW_STRIDE, makeGlowMaterial, newBuilder} from "./MasseurMeshUtil"
import {pathPhase, pointState, StrokeLayout} from "./MasseurStrokeLayout"

interface VRec {
  pos: vec3
  /** arc length along the path (paths) or ring angle fraction (points) */
  d: number
  edge: number
  path: number
  kind: number // 0 ribbon, 1 arrow, 2 ring, 3 dot
}

type StrokeState = "idle" | "fadingOut" | "drawingIn" | "shown"

const ARROW_SPACING_CM = 14
const RING_SEGMENTS = 48

@component
export class MasseurStrokeRenderer extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurStrokeRenderer - neon strokes, pulse and press rings</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Vertex-color material; an additive glow copy is made at runtime")
  glowMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input("vec3", "{0.35, 0.95, 0.9}")
  @hint("Neon color of the strokes (calm cyan / soft teal)")
  @widget(new ColorWidget())
  strokeColor: vec3

  @input
  @hint("Line width in cm")
  @widget(new SliderWidget(0.5, 4, 0.1))
  lineWidthCm: number = 1.5

  @input
  @hint("Resting brightness of the stroke (soft, not too bright)")
  @widget(new SliderWidget(0.1, 1, 0.05))
  baseBrightness: number = 0.45

  @input
  @hint("Extra brightness of the travelling pulse")
  @widget(new SliderWidget(0, 2, 0.05))
  pulseBrightness: number = 1.1

  @input
  @hint("Seconds for a new stroke to draw in after a step change")
  @widget(new SliderWidget(0.2, 3, 0.1))
  drawInSec: number = 1.0
  @ui.group_end
  private _state: StrokeState = "idle"

  // ---- public read state (tests) ----
  get state(): StrokeState { return this._state }
  get isVisible(): boolean { return this._state === "shown" || this._state === "drawingIn" }
  get currentMoveId(): string { return this.layout ? this.layout.move.id : "" }
  get revealProgress(): number { return this.reveal }
  /** 0..1 phase of the pulse on the first path (or ring fill for press moves). */
  get pulseProgress(): number { return this.lastPulse }
  get activePointGroup(): number { return this.lastGroup }
  /** World position of the first stroke vertex (used by the anchoring test). */
  getAnchorWorldPoint(): vec3 | null {
    if (!this.verts.length) return null
    return this.getTransform().getWorldTransform().multiplyPoint(this.verts[0].pos)
  }

  private layout: StrokeLayout | null = null
  private pendingLayout: StrokeLayout | null = null
  private meshObj: SceneObject | null = null
  private builder: MeshBuilder | null = null
  private verts: VRec[] = []
  private fade = 0
  private reveal = 0
  private motion = 0
  private lastPulse = 0
  private lastGroup = -1

  private glow: Material | null = null

  onAwake(): void {
    if (this.glowMaterial) this.glow = makeGlowMaterial(this.glowMaterial)
    this.createEvent("UpdateEvent").bind(() => this.onUpdate(getDeltaTime()))
  }

  /** Shows a new move: the current one fades out first, then the new one draws in. */
  showMove(layout: StrokeLayout): void {
    this.pendingLayout = layout
    if (this._state === "idle") this.swapToPending()
    else this._state = "fadingOut"
  }

  /** Fades out and removes the stroke. */
  clear(): void {
    this.pendingLayout = null
    if (this._state !== "idle") this._state = "fadingOut"
  }

  /** Motion clock of the current step (seconds scaled by pace, frozen while paused). */
  setMotion(stepMotionTime: number): void {
    this.motion = stepMotionTime
  }

  // ---- internals ----

  private onUpdate(dt: number): void {
    if (this._state === "fadingOut") {
      this.fade = Math.max(0, this.fade - dt / 0.35)
      if (this.fade <= 0) {
        if (this.pendingLayout) this.swapToPending()
        else this.destroyMesh()
      }
    } else if (this._state === "drawingIn") {
      this.fade = 1
      this.reveal = Math.min(1, this.reveal + dt / Math.max(0.05, this.drawInSec))
      if (this.reveal >= 1) this._state = "shown"
    }
    if (this.builder && this._state !== "idle") this.recolor()
  }

  private swapToPending(): void {
    this.destroyMesh()
    this.layout = this.pendingLayout
    this.pendingLayout = null
    if (!this.layout) return
    this.buildMesh(this.layout)
    this.fade = 1
    this.reveal = 0
    this._state = "drawingIn"
  }

  private destroyMesh(): void {
    if (this.meshObj) this.meshObj.destroy()
    this.meshObj = null
    this.builder = null
    this.verts = []
    this.layout = null
    this._state = "idle"
  }

  private buildMesh(layout: StrokeLayout): void {
    const b = newBuilder(GLOW_LAYOUT)
    const verts: VRec[] = []
    const idx: number[] = []
    const up = vec3.up()
    const hw = this.lineWidthCm / 2

    layout.paths.forEach((path, pi) => {
      const start = verts.length
      for (let i = 0; i < path.points.length; i++) {
        const c = path.points[i]
        const side = up.cross(path.tangents[i]).normalize()
        verts.push({pos: c.add(side.uniformScale(hw)), d: path.cum[i], edge: 1, path: pi, kind: 0})
        verts.push({pos: c, d: path.cum[i], edge: 0, path: pi, kind: 0})
        verts.push({pos: c.sub(side.uniformScale(hw)), d: path.cum[i], edge: 1, path: pi, kind: 0})
      }
      for (let i = 0; i < path.points.length - 1; i++) {
        const a = start + i * 3
        const n = a + 3
        idx.push(a, n, a + 1, a + 1, n, n + 1, a + 1, n + 1, a + 2, a + 2, n + 1, n + 2)
      }
      // arrowheads pointing in the stroke direction
      for (let d = ARROW_SPACING_CM * 0.6; d < path.length - 2; d += ARROW_SPACING_CM) {
        const i = Math.min(path.points.length - 1, Math.round((d / path.length) * (path.points.length - 1)))
        const c = path.points[i].add(up.uniformScale(0.15))
        const t = path.tangents[i]
        const side = up.cross(t).normalize()
        const tip = c.add(t.uniformScale(1.7))
        const inner = c.add(t.uniformScale(0.3))
        const l = c.sub(t.uniformScale(0.5)).add(side.uniformScale(1.4))
        const r = c.sub(t.uniformScale(0.5)).sub(side.uniformScale(1.4))
        const s = verts.length
        for (const p of [tip, l, inner, r]) verts.push({pos: p, d: path.cum[i], edge: 0, path: pi, kind: 1})
        idx.push(s, s + 1, s + 2, s, s + 2, s + 3)
      }
    })

    layout.groups.forEach((group, gi) => {
      for (const center of group) {
        const s = verts.length
        for (let k = 0; k <= RING_SEGMENTS; k++) {
          const a = (k / RING_SEGMENTS) * Math.PI * 2
          const dir = new vec3(Math.sin(a), 0, -Math.cos(a))
          verts.push({pos: center.add(dir.uniformScale(1.7)), d: k / RING_SEGMENTS, edge: 0, path: gi, kind: 2})
          verts.push({pos: center.add(dir.uniformScale(2.6)), d: k / RING_SEGMENTS, edge: 1, path: gi, kind: 2})
        }
        for (let k = 0; k < RING_SEGMENTS; k++) {
          const a = s + k * 2
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
        }
        const c0 = verts.length
        verts.push({pos: center, d: 0, edge: 0, path: gi, kind: 3})
        for (let k = 0; k <= 12; k++) {
          const a = (k / 12) * Math.PI * 2
          verts.push({pos: center.add(new vec3(Math.sin(a), 0, -Math.cos(a)).uniformScale(0.7)), d: 0, edge: 1, path: gi, kind: 3})
        }
        for (let k = 0; k < 12; k++) idx.push(c0, c0 + 1 + k, c0 + 2 + k)
      }
    })

    const data: number[] = []
    for (const v of verts) data.push(v.pos.x, v.pos.y, v.pos.z, 0, 1, 0, 0, 0, 0, 1)
    b.appendVerticesInterleaved(data)
    b.appendIndices(idx)

    const obj = global.scene.createSceneObject("StrokeMesh")
    obj.setParent(this.getSceneObject())
    const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = b.getMesh()
    if (this.glow) rmv.mainMaterial = this.glow
    b.updateMesh()
    this.meshObj = obj
    this.builder = b
    this.verts = verts
  }

  private recolor(): void {
    const layout = this.layout
    const b = this.builder
    if (!layout || !b) return
    const move = layout.move
    const col = this.strokeColor ?? new vec3(0.35, 0.95, 0.9)
    const phases = layout.paths.map((_, pi) => pathPhase(move, pi, this.motion))
    const ps = move.kind === "points" ? pointState(move, this.motion) : null
    this.lastPulse = ps ? ps.fill : phases.length ? phases[0] : 0
    this.lastGroup = ps ? ps.group : -1
    const out: number[] = new Array(GLOW_STRIDE)
    for (let i = 0; i < this.verts.length; i++) {
      const v = this.verts[i]
      let k = 0
      if (v.kind <= 1) {
        const path = layout.paths[v.path]
        const pd = phases[v.path] * path.length
        const dd = (v.d - pd) / 5
        let glow = Math.exp(-dd * dd)
        if (v.d < pd) glow += 0.45 * Math.exp(-(pd - v.d) / 12)
        k = this.baseBrightness + this.pulseBrightness * glow
        if (v.kind === 1) k *= 0.9
        const revealD = this.reveal * path.length * 1.15
        k *= Math.max(0, Math.min(1, (revealD - v.d) / 3))
      } else if (ps) {
        const active = v.path === ps.group
        if (v.kind === 2) k = active ? (v.d <= ps.fill ? this.baseBrightness + this.pulseBrightness : this.baseBrightness * 0.6) : this.baseBrightness * 0.3
        else k = active ? 0.9 : this.baseBrightness * 0.5
        k *= this.reveal
      }
      k *= move.intensity * this.fade * (v.edge ? 0.25 : 1)
      out[0] = v.pos.x; out[1] = v.pos.y; out[2] = v.pos.z
      out[3] = 0; out[4] = 1; out[5] = 0
      out[6] = col.x * k; out[7] = col.y * k; out[8] = col.z * k; out[9] = 1
      b.setVertexInterleaved(i, out)
    }
    b.updateMesh()
  }
}
