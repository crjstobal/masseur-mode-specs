/**
 * MasseurTowel - a soft, light towel draped over the hips and buttocks down
 * to the upper thighs, so the scene clearly reads as a relaxation massage.
 *
 * Owns: one cloth mesh built once at start. It follows the real skin height
 * of the body (MasseurBodyMap / MasseurHumanBody grid), falls off the sides
 * of the body onto the table, and hangs a little over the table edges. Its
 * top edge starts `gapBelowLowerBackCm` below the lower-back landmark, so the
 * back area where the strokes go always stays uncovered.
 *
 * Must not: read session state.
 */
import {MasseurBodyMap} from "./MasseurBodyMap"
import {LIT_LAYOUT, newBuilder} from "./MasseurMeshUtil"

@component
export class MasseurTowel extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurTowel - towel over the hips</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Skin mapping (gives the lower-back landmark and the skin height)")
  bodyMap: MasseurBodyMap
  @input
  @hint("Lit material for the towel; a tinted copy is made at runtime")
  towelMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input("vec3", "{1.0, 0.97, 0.9}")
  @hint("Towel color (soft and light)")
  @widget(new ColorWidget())
  towelColor: vec3
  @input
  @hint("Gap between the lower-back landmark and the towel's top edge, cm (keeps the back clear)")
  @widget(new SliderWidget(0, 15, 0.5))
  gapBelowLowerBackCm: number = 7
  @input
  @hint("Length of the towel along the body, cm (hips to upper thighs)")
  @widget(new SliderWidget(20, 80, 1))
  lengthCm: number = 50
  @ui.group_end
  private built = false

  get isBuilt(): boolean { return this.built }
  /** Mannequin-local z of the towel's top edge (toward the head). */
  get topEdgeZ(): number { return this.zTop }

  private zTop = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
  }

  build(): void {
    if (this.built || !this.bodyMap) return
    this.bodyMap.init()
    if (!this.bodyMap.isReady()) return
    this.built = true

    const lb = this.bodyMap.getLandmarks().find((l) => l.key === "lowerBack")
    const toLocal = this.getTransform().getInvertedWorldTransform()
    const lbLocal = toLocal.multiplyPoint(lb.obj.getTransform().getWorldPosition())
    const zTop = lbLocal.z - this.gapBelowLowerBackCm
    const zBot = zTop - this.lengthCm
    this.zTop = zTop

    const STEP = 2
    const HALF_W = 26 // body width plus a soft overhang (the table half width is 35)
    const cols = Math.round((2 * HALF_W) / STEP) + 1
    const rows = Math.round((zTop - zBot) / STEP) + 1
    const h: number[][] = []
    for (let r = 0; r < rows; r++) {
      const z = zTop - r * STEP
      const row: number[] = []
      for (let c = 0; c < cols; c++) row.push(this.bodyMap.skinHeight(-HALF_W + c * STEP, z) + 1.2)
      // cloth spans between high points and slopes down the sides (two-pass envelope)
      const drop = 2.2 // cm per 2 cm: the cloth falls off the body's sides
      for (let c = 1; c < cols; c++) row[c] = Math.max(row[c], row[c - 1] - drop)
      for (let c = cols - 2; c >= 0; c--) row[c] = Math.max(row[c], row[c + 1] - drop)
      h.push(row.map((y) => Math.max(0.4, y)))
    }
    // soft folds
    const pts: vec3[][] = []
    for (let r = 0; r < rows; r++) {
      const z = zTop - r * STEP
      const line: vec3[] = []
      for (let c = 0; c < cols; c++) {
        const x = -HALF_W + c * STEP
        const fold = 0.35 * Math.sin(x * 0.32 + z * 0.08) + 0.25 * Math.sin(x * 0.11 - z * 0.21)
        // hem: the top and bottom edges curl slightly down
        const edge = Math.min(r, rows - 1 - r)
        const hem = edge === 0 ? -0.6 : 0
        line.push(new vec3(x, h[r][c] + fold * 0.6 + hem, z))
      }
      // tuck the edges onto the table
      const left = line[0], right = line[cols - 1]
      line.unshift(new vec3(left.x - 0.5, 0.2, left.z))
      line.push(new vec3(right.x + 0.5, 0.2, right.z))
      pts.push(line)
    }
    this.buildMesh(pts)
  }

  private buildMesh(pts: vec3[][]): void {
    const rows = pts.length
    const cols = pts[0].length
    const b = newBuilder(LIT_LAYOUT)
    const data: number[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p = pts[r][c]
        const dx = pts[r][Math.min(cols - 1, c + 1)].sub(pts[r][Math.max(0, c - 1)])
        const dz = pts[Math.min(rows - 1, r + 1)][c].sub(pts[Math.max(0, r - 1)][c])
        let n = dz.cross(dx).normalize()
        if (n.y < 0) n = n.uniformScale(-1)
        data.push(p.x, p.y, p.z, n.x, n.y, n.z)
      }
    }
    b.appendVerticesInterleaved(data)
    const idx: number[] = []
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c
        idx.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols)
      }
    }
    b.appendIndices(idx)
    const obj = global.scene.createSceneObject("TowelMesh")
    obj.setParent(this.getSceneObject())
    const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = b.getMesh()
    if (this.towelMaterial) {
      const m = this.towelMaterial.clone()
      const c = this.towelColor ?? new vec3(0.96, 0.95, 0.9)
      m.mainPass.baseColor = new vec4(c.x, c.y, c.z, 1)
      m.mainPass.roughness = 1
      m.mainPass.metallic = 0
      m.mainPass.twoSided = true
      rmv.mainMaterial = m
    }
    b.updateMesh()
  }
}
