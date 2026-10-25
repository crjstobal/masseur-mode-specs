/**
 * MasseurScanController - the simulated back scan.
 *
 * Owns: a soft light band that sweeps over the back from the neck to the
 * lower back, and a glowing dot per landmark that pops in as the band passes
 * it. This fakes body detection for the preview (there is no person to scan);
 * the demo video says so. Emits onLandmarkRevealed (Main shows the label) and
 * onScanComplete; hideMarkers() fades the dots once the first step starts.
 *
 * Must not: change session state (Main calls the manager when the scan ends).
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {MasseurBodyMap} from "./MasseurBodyMap"
import {GLOW_LAYOUT, GLOW_STRIDE, makeGlowMaterial, newBuilder} from "./MasseurMeshUtil"

export interface LandmarkReveal {
  key: string
  label: string
  worldPos: vec3
}

const BAND_COLUMNS = 31
const BAND_ROWS = 5

@component
export class MasseurScanController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurScanController - simulated back scan</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Landmarks and skin mapping")
  bodyMap: MasseurBodyMap
  @input
  @hint("Vertex-color material; an additive glow copy is made at runtime")
  glowMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Seconds for the band to sweep from neck to lower back")
  @widget(new SliderWidget(1, 8, 0.5))
  scanDurationSec: number = 3

  @input("vec3", "{0.55, 1.0, 0.95}")
  @hint("Color of the scan band and landmark dots")
  @widget(new ColorWidget())
  scanColor: vec3
  @ui.group_end

  private _onLandmarkRevealed = new Event<LandmarkReveal>()
  private _onScanComplete = new Event<void>()
  get onLandmarkRevealed(): PublicApi<LandmarkReveal> { return this._onLandmarkRevealed.publicApi() }
  get onScanComplete(): PublicApi<void> { return this._onScanComplete.publicApi() }

  // ---- read state (tests) ----
  get isScanning(): boolean { return this.scanning }
  get progress(): number { return this.t }
  get revealedCount(): number { return this.dots.filter((d) => d.revealed).length }
  get landmarkCount(): number { return this.dots.length }
  get markersVisible(): boolean { return this.dotFade > 0.01 && this.dots.length > 0 }

  private scanning = false
  private t = 0
  private bandFade = 0
  private dotFade = 0
  private dotsFadingOut = false
  private bandObj: SceneObject | null = null
  private bandBuilder: MeshBuilder | null = null
  private dots: {key: string; label: string; obj: SceneObject; builder: MeshBuilder; v: number; local: vec3; revealed: boolean; age: number}[] = []

  private glow: Material | null = null

  onAwake(): void {
    if (this.glowMaterial) this.glow = makeGlowMaterial(this.glowMaterial)
    this.createEvent("UpdateEvent").bind(() => this.onUpdate(getDeltaTime()))
  }

  startScan(): void {
    this.clearAll()
    if (!this.bodyMap) {
      print("MasseurScanController: bodyMap not wired")
      return
    }
    this.bodyMap.init()
    this.t = 0
    this.bandFade = 1
    this.dotFade = 1
    this.dotsFadingOut = false
    this.scanning = true
    this.buildBand()
    for (const lm of this.bodyMap.getLandmarks()) {
      const local = this.toOwnLocal(lm.obj.getTransform().getWorldPosition()).add(new vec3(0, 0.6, 0))
      const {obj, builder} = this.buildDot(local)
      this.dots.push({key: lm.key, label: lm.label, obj, builder, v: lm.v, local, revealed: false, age: 0})
    }
  }

  /** Fades the landmark dots out (after "Back mapped"). */
  hideMarkers(): void {
    this.dotsFadingOut = true
  }

  clearAll(): void {
    if (this.bandObj) this.bandObj.destroy()
    this.bandObj = null
    this.bandBuilder = null
    for (const d of this.dots) d.obj.destroy()
    this.dots = []
    this.scanning = false
  }

  private onUpdate(dt: number): void {
    if (this.scanning) {
      this.t = Math.min(1, this.t + dt / Math.max(0.2, this.scanDurationSec))
      const vb = -0.08 + 1.16 * this.t
      for (const d of this.dots) {
        if (!d.revealed && vb >= d.v) {
          d.revealed = true
          d.age = 0
          this._onLandmarkRevealed.invoke({key: d.key, label: d.label, worldPos: this.getTransform().getWorldTransform().multiplyPoint(d.local)})
        }
      }
      this.updateBand(vb)
      if (this.t >= 1) {
        this.scanning = false
        this._onScanComplete.invoke()
      }
    } else if (this.bandObj) {
      this.bandFade = Math.max(0, this.bandFade - dt / 0.5)
      this.updateBand(1.08)
      if (this.bandFade <= 0) {
        this.bandObj.destroy()
        this.bandObj = null
        this.bandBuilder = null
      }
    }
    if (this.dotsFadingOut) {
      this.dotFade = Math.max(0, this.dotFade - dt / 0.6)
      if (this.dotFade <= 0) {
        for (const d of this.dots) d.obj.destroy()
        this.dots = []
        this.dotsFadingOut = false
      }
    }
    for (const d of this.dots) {
      if (!d.revealed) {
        d.obj.enabled = false
        continue
      }
      d.obj.enabled = true
      d.age += dt
      const pop = d.age < 0.25 ? 1.35 * (d.age / 0.25) : 1 + 0.35 * Math.max(0, 1 - (d.age - 0.25) / 0.2)
      d.obj.getTransform().setLocalScale(vec3.one().uniformScale(Math.max(0.01, pop)))
      this.colorDot(d.builder, this.dotFade)
    }
  }

  private toOwnLocal(world: vec3): vec3 {
    return this.getTransform().getInvertedWorldTransform().multiplyPoint(world)
  }

  private buildBand(): void {
    const b = newBuilder(GLOW_LAYOUT)
    const data: number[] = []
    for (let r = 0; r < BAND_ROWS; r++) for (let c = 0; c < BAND_COLUMNS; c++) data.push(0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
    b.appendVerticesInterleaved(data)
    const idx: number[] = []
    for (let r = 0; r < BAND_ROWS - 1; r++) {
      for (let c = 0; c < BAND_COLUMNS - 1; c++) {
        const a = r * BAND_COLUMNS + c
        idx.push(a, a + BAND_COLUMNS, a + 1, a + 1, a + BAND_COLUMNS, a + BAND_COLUMNS + 1)
      }
    }
    b.appendIndices(idx)
    const obj = global.scene.createSceneObject("ScanBand")
    obj.setParent(this.getSceneObject())
    const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = b.getMesh()
    if (this.glow) rmv.mainMaterial = this.glow
    b.updateMesh()
    this.bandObj = obj
    this.bandBuilder = b
  }

  private updateBand(vb: number): void {
    const b = this.bandBuilder
    if (!b) return
    const col = this.scanColor ?? new vec3(0.55, 1, 0.95)
    const out = new Array(GLOW_STRIDE)
    for (let r = 0; r < BAND_ROWS; r++) {
      const rowT = r / (BAND_ROWS - 1) - 0.5 // -0.5 .. 0.5 across the band
      const v = vb + rowT * 0.1
      const rowGlow = Math.exp(-Math.pow(rowT / 0.22, 2))
      for (let c = 0; c < BAND_COLUMNS; c++) {
        const u = -1.25 + (2.5 * c) / (BAND_COLUMNS - 1)
        const local = this.toOwnLocal(this.bodyMap.uvToWorld({u, v: Math.max(-0.1, Math.min(1.1, v))}, 0.8))
        const edge = Math.max(0, 1 - Math.pow(Math.abs(u) / 1.25, 6))
        const k = 0.8 * rowGlow * edge * this.bandFade
        out[0] = local.x; out[1] = local.y; out[2] = local.z
        out[3] = 0; out[4] = 1; out[5] = 0
        out[6] = col.x * k; out[7] = col.y * k; out[8] = col.z * k; out[9] = 1
        b.setVertexInterleaved(r * BAND_COLUMNS + c, out)
      }
    }
    b.updateMesh()
  }

  private buildDot(local: vec3): {obj: SceneObject; builder: MeshBuilder} {
    const b = newBuilder(GLOW_LAYOUT)
    const data: number[] = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    const seg = 16
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2
      data.push(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1, 0, 1, 0, 0, 0, 0, 1)
    }
    const idx: number[] = []
    for (let k = 0; k < seg; k++) idx.push(0, 1 + k, 2 + k)
    b.appendVerticesInterleaved(data)
    b.appendIndices(idx)
    const obj = global.scene.createSceneObject("LandmarkDot")
    obj.setParent(this.getSceneObject())
    obj.getTransform().setLocalPosition(local)
    const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = b.getMesh()
    if (this.glow) rmv.mainMaterial = this.glow
    b.updateMesh()
    obj.enabled = false
    return {obj, builder: b}
  }

  private colorDot(b: MeshBuilder, fade: number): void {
    const col = this.scanColor ?? new vec3(0.55, 1, 0.95)
    const n = b.getVerticesCount()
    const seg = n - 2
    for (let i = 0; i < n; i++) {
      const center = i === 0
      const k = (center ? 1.2 : 0.35) * fade
      const a = center ? 0 : ((i - 1) / seg) * Math.PI * 2
      const x = center ? 0 : Math.sin(a) * 1.1
      const z = center ? 0 : -Math.cos(a) * 1.1
      b.setVertexInterleaved(i, [x, 0, z, 0, 1, 0, col.x * k, col.y * k, col.z * k, 1])
    }
    b.updateMesh()
  }
}
