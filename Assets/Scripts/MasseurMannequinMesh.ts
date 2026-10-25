/**
 * MasseurMannequinMesh - code-authored stand-in body: an adult mannequin lying
 * face down, head toward the user, arms resting by its sides.
 *
 * This is the preview stand-in the design brief asks for (there is no person
 * in Lens Studio's preview). It is built with MeshBuilder so the back has real
 * proportions (about 42 cm across the shoulders), a soft spine groove and
 * shoulder-blade relief, and so its skin height is known analytically:
 * surfaceTopLocal() lets the neon strokes sit exactly on the skin.
 *
 * Local frame: origin on the table top, under the crown of the head.
 *   +Z points toward the user (the head end), the body extends along -Z.
 *   +Y is up, away from the table. "s" below = distance from the crown (cm).
 *
 * Inputs: the skin material. Must not: know about the session or strokes.
 */
import {appendLoft, keyed, LIT_LAYOUT, newBuilder} from "./MasseurMeshUtil"

// Torso + head profile: [s, half width], [s, height above the table]
const TORSO_HW = [[0, 2], [2, 5.5], [6, 7.8], [12, 8.3], [18, 7.6], [22, 5.8], [24, 6.5], [26, 10], [28, 16], [30, 19.5], [33, 21], [42, 20], [55, 17.5], [68, 15], [76, 15.2], [86, 17.5], [96, 18], [103, 16.5], [107, 13]]
const TORSO_H = [[0, 7], [2, 13], [6, 18], [12, 20], [18, 18.5], [22, 13], [24, 13.2], [26, 15], [29, 18.2], [40, 19.5], [55, 18.5], [70, 16.5], [80, 17.5], [90, 21], [97, 20], [103, 17], [107, 13]]
const LEG_XC = [[100, 8.5], [172, 10]]
const LEG_HW = [[100, 8.5], [115, 7.8], [135, 6], [145, 5.2], [158, 4.6], [165, 4], [168, 4.6], [172, 3]]
const LEG_H = [[100, 17], [115, 15], [135, 11.5], [145, 10], [158, 9], [165, 8.5], [168, 10], [172, 5]]
const ARM_XC = [[29, 25], [50, 25.5], [75, 24.2], [102, 23.6]]
const ARM_HW = [[29, 5.5], [45, 5], [58, 4.2], [62, 4.4], [80, 3.6], [88, 3.2], [92, 4], [98, 3.6], [102, 1.5]]
const ARM_H = [[29, 11], [45, 9.5], [58, 8], [62, 8], [80, 6.5], [88, 5], [92, 4.5], [98, 4], [102, 2]]

const TORSO_P = 2.6
const LIMB_P = 2.2

function window01(s: number, a: number, b: number, ramp: number): number {
  if (s < a || s > b) return 0
  return Math.min(1, (s - a) / ramp, (b - s) / ramp)
}

/** Back relief on top of the torso cross-section: spine groove + shoulder blades. */
function backFeatures(x: number, s: number, hw: number): number {
  const edge = Math.max(0, 1 - Math.pow(Math.abs(x) / hw, 4))
  const groove = -0.9 * Math.exp(-Math.pow(x / 1.8, 2)) * window01(s, 29, 90, 6)
  const ax = Math.abs(x)
  const blades = 1.2 * Math.exp(-Math.pow((ax - 10) / 5.5, 2) - Math.pow((s - 42) / 8, 2))
  return (groove + blades) * edge
}

function superHeight(x: number, hw: number, h: number, p: number): number {
  const r = Math.abs(x) / hw
  if (r >= 1) return 0
  return h * Math.pow(1 - Math.pow(r, p), 1 / p)
}

@component
export class MasseurMannequinMesh extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurMannequinMesh - stand-in body (simulated person)</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Lit material for the mannequin skin; a tinted copy is made at runtime")
  skinMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input("vec3", "{0.86, 0.76, 0.66}")
  @hint("Skin tint of the stand-in body (keep it light: the display is additive)")
  @widget(new ColorWidget())
  skinColor: vec3
  @input
  @hint("Surface roughness, 0 = glossy, 1 = matte")
  @widget(new SliderWidget(0, 1, 0.05))
  skinRoughness: number = 0.75
  @ui.group_end

  private built = false

  onAwake(): void {
    this.build()
  }

  /** Height of the skin above the table at a local (x, z) point, or 0 off the body. */
  surfaceTopLocal(x: number, z: number): number {
    const s = -z
    let best = 0
    if (s >= 0 && s <= 107) {
      const hw = keyed(TORSO_HW, s)
      const y = superHeight(x, hw, keyed(TORSO_H, s), TORSO_P)
      if (y > 0) best = Math.max(best, y + backFeatures(x, s, hw))
    }
    if (s >= 100 && s <= 172) {
      const xc = keyed(LEG_XC, s)
      best = Math.max(best, superHeight(Math.abs(x) - xc, keyed(LEG_HW, s), keyed(LEG_H, s), LIMB_P))
    }
    if (s >= 29 && s <= 102) {
      const xc = keyed(ARM_XC, s)
      best = Math.max(best, superHeight(Math.abs(x) - xc, keyed(ARM_HW, s), keyed(ARM_H, s), LIMB_P))
    }
    return best
  }

  private build(): void {
    if (this.built) return
    this.built = true
    const builder = newBuilder(LIT_LAYOUT)

    // Torso + head (one loft so neck and shoulders blend smoothly).
    appendLoft(builder, this.rings(0.2, 107, 1.25, (s) => ({xc: 0, hw: keyed(TORSO_HW, s), h: keyed(TORSO_H, s)}), TORSO_P, 38, true), true, true)
    // Legs and arms, mirrored.
    for (const side of [-1, 1]) {
      appendLoft(builder, this.rings(100, 172, 2, (s) => ({xc: side * keyed(LEG_XC, s), hw: keyed(LEG_HW, s), h: keyed(LEG_H, s)}), LIMB_P, 24, false), true, true)
      appendLoft(builder, this.rings(29, 102, 2, (s) => ({xc: side * keyed(ARM_XC, s), hw: keyed(ARM_HW, s), h: keyed(ARM_H, s)}), LIMB_P, 24, false), true, true)
    }

    const rmv = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = builder.getMesh()
    if (this.skinMaterial) {
      const m = this.skinMaterial.clone()
      const c = this.skinColor ?? new vec3(0.86, 0.76, 0.66)
      m.mainPass.baseColor = new vec4(c.x, c.y, c.z, 1)
      m.mainPass.roughness = this.skinRoughness
      m.mainPass.metallic = 0
      rmv.mainMaterial = m
    }
    builder.updateMesh()
  }

  /** Cross-section rings: top superellipse arc from +x to -x, then a flat bottom on the table. */
  private rings(s0: number, s1: number, step: number, profile: (s: number) => {xc: number; hw: number; h: number}, p: number, arcPoints: number, withFeatures: boolean): vec3[][] {
    const out: vec3[][] = []
    for (let s = s0; s <= s1 + 1e-6; s += step) {
      const {xc, hw, h} = profile(s)
      const ring: vec3[] = []
      for (let k = 0; k < arcPoints; k++) {
        const th = (Math.PI * k) / (arcPoints - 1)
        const c = Math.cos(th)
        const sn = Math.sin(th)
        const lx = hw * Math.sign(c) * Math.pow(Math.abs(c), 2 / p)
        let y = h * Math.pow(Math.abs(sn), 2 / p)
        if (withFeatures) y += backFeatures(lx, s, hw)
        ring.push(new vec3(xc + lx, Math.max(0, y), -s))
      }
      ring.push(new vec3(xc - hw * 0.5, 0, -s))
      ring.push(new vec3(xc, 0, -s))
      ring.push(new vec3(xc + hw * 0.5, 0, -s))
      out.push(ring)
    }
    return out
  }
}
