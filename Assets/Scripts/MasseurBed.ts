/**
 * MasseurBed - a low double bed for the at-home massage setup, built once
 * with MeshBuilder: a light oak frame, a mattress with a plain white sheet, a
 * folded light duvet along one side (no pillow: the client lies face down)
 *
 * Local frame: origin on the floor at the centre of the bed, +Y up, the head
 * end toward -Z. Everything is light-coloured for the additive display.
 * Inputs: the lit base material and the sizes. Must not: know about the session.
 */
import {appendLoft, LIT_LAYOUT, newBuilder} from "./MasseurMeshUtil"

@component
export class MasseurBed extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurBed - low double bed, sheet, duvet, pillow</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Lit material; tinted copies are made for each part")
  baseMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Bed width in cm")
  @widget(new SliderWidget(90, 200, 1))
  widthCm: number = 160
  @input
  @hint("Bed length in cm")
  @widget(new SliderWidget(180, 220, 1))
  lengthCm: number = 200
  @input
  @hint("Height of the mattress top above the floor in cm")
  @widget(new SliderWidget(30, 70, 1))
  mattressTopCm: number = 50
  @input("vec3", "{0.96, 0.96, 0.94}")
  @hint("Sheet color")
  @widget(new ColorWidget())
  sheetColor: vec3
  @input("vec3", "{0.98, 0.93, 0.84}")
  @hint("Duvet color")
  @widget(new ColorWidget())
  duvetColor: vec3
  @ui.group_end
  private built = false

  get isBuilt(): boolean { return this.built }

  onAwake(): void {
    this.build()
  }

  private build(): void {
    if (this.built) return
    this.built = true
    const W = this.widthCm, L = this.lengthCm, top = this.mattressTopCm
    const mattressH = 22
    const frameTop = top - mattressH
    const oak = new vec3(0.86, 0.72, 0.55)

    // frame: a low plinth plus a short headboard
    this.part("BedFrame", oak, (b) => {
      roundedBox(b, 0, frameTop / 2, 0, W / 2 + 3, frameTop / 2, L / 2 + 3, 2)
      roundedBox(b, 0, frameTop + 22, -L / 2 - 2.5, W / 2 + 3, 22, 2.5, 1.5)
    })
    // mattress with the sheet on it (rounded edges)
    this.part("Mattress", this.sheetColor ?? new vec3(0.96, 0.96, 0.94), (b) => {
      roundedBox(b, 0, frameTop + mattressH / 2, 0, W / 2, mattressH / 2, L / 2, 6)
    })
    // folded duvet along the client's left side (out of the work area)
    this.part("Duvet", this.duvetColor ?? new vec3(0.98, 0.93, 0.84), (b) => {
      roundedBox(b, -W / 2 + 24, top + 5, 10, 20, 5, L / 2 - 20, 4.5)
    })
    // no pillow: the client lies face down without one, and it only distracted at the edge of the view
  }

  private part(name: string, color: vec3, fill: (b: MeshBuilder) => void): void {
    const b = newBuilder(LIT_LAYOUT)
    fill(b)
    const obj = global.scene.createSceneObject(name)
    obj.setParent(this.getSceneObject())
    const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = b.getMesh()
    if (this.baseMaterial) {
      const m = this.baseMaterial.clone()
      m.mainPass.baseColor = new vec4(color.x, color.y, color.z, 1)
      m.mainPass.roughness = 0.9
      m.mainPass.metallic = 0
      rmv.mainMaterial = m
    }
    b.updateMesh()
  }
}

/** A box with rounded vertical edges and a rounded top, as a loft of superellipse rings along Z. */
function roundedBox(b: MeshBuilder, cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, r: number): void {
  const rings: vec3[][] = []
  const steps = 10
  const p = 2 + 8 / Math.max(1, r) // larger radius -> rounder corners
  for (let i = 0; i <= steps; i++) {
    // ease the ends so the box gets rounded ends too
    const t = i / steps
    const zz = -hz + 2 * hz * t
    const endT = Math.min(t, 1 - t) * 2 * hz
    const shrink = endT < r ? Math.sqrt(Math.max(0, 1 - Math.pow((r - endT) / r, 2))) : 1
    const ring: vec3[] = []
    const n = 32
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      const c = Math.cos(a), s = Math.sin(a)
      const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / p) * (hx - r * (1 - shrink))
      const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / p) * (hy - r * (1 - shrink) * 0.5)
      ring.push(new vec3(cx + x, cy + y, cz + zz))
    }
    rings.push(ring)
  }
  appendLoft(b, rings, true, true)
}
