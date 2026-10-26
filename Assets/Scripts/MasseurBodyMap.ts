/**
 * MasseurBodyMap - turns "back UV" coordinates into points on the mannequin's skin.
 *
 * Owns: the landmark contract. Landmarks are authored SceneObjects under the
 * mannequin (neck base, shoulders, shoulder blades, spine middle, lower back
 * and its sides) so a human can drag them in the editor; every stroke is
 * computed from them, which is what keeps the guide on the body and not in
 * the room. The real Lens would get these points from body tracking; here
 * they are placed by hand on the stand-in (simulated detection).
 *
 * Inputs: the body root (Mannequin object), the skin grid (2 cm height grid
 * sampled from the client body mesh) and the 9 landmarks. The Snap body and
 * the code-built mannequin are kept only as rollback height sources.
 * Must not: draw anything or read session state.
 */
import {MasseurHumanBody} from "./MasseurHumanBody"
import {MasseurMannequinMesh} from "./MasseurMannequinMesh"
import {MasseurSkinGrid} from "./MasseurSkinGrid"
import {BackUV} from "./MasseurMoveLibrary"

export interface LandmarkInfo {
  key: string
  label: string
  obj: SceneObject
  /** Position along the spine, 0 = neck base, 1 = lower back. */
  v: number
}

@component
export class MasseurBodyMap extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurBodyMap - landmarks to skin points</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Rollback only: the old code-built mannequin (its SceneObject is the body root)")
  mannequin: MasseurMannequinMesh
  @input
  @hint("Rollback only: the Snap Asset Library body (used when no skin grid is wired)")
  @allowUndefined
  humanBody: MasseurHumanBody
  @input
  @hint("Skin height grid sampled from the client body mesh (preferred height source)")
  @allowUndefined
  skinGrid: MasseurSkinGrid
  @input
  @hint("Base of the neck (top of the spine line, v = 0)")
  neckBase: SceneObject
  @input
  @hint("Middle of the spine")
  spineMid: SceneObject
  @input
  @hint("Lower back on the spine (bottom of the spine line, v = 1)")
  lowerBack: SceneObject
  @input
  @hint("Top of the shoulder, +X side")
  shoulderL: SceneObject
  @input
  @hint("Top of the shoulder, -X side")
  shoulderR: SceneObject
  @input
  @hint("Shoulder blade centre, +X side")
  scapulaL: SceneObject
  @input
  @hint("Shoulder blade centre, -X side")
  scapulaR: SceneObject
  @input
  @hint("Side of the lower back, +X side")
  lowerBackL: SceneObject
  @input
  @hint("Side of the lower back, -X side")
  lowerBackR: SceneObject
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Move the landmark objects onto the skin when the Lens starts")
  snapLandmarksToSkin: boolean = true
  @ui.group_end

  private ready = false

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.init())
  }

  isReady(): boolean {
    return this.ready
  }

  init(): void {
    if (this.ready) return
    const required = [this.mannequin, this.neckBase, this.spineMid, this.lowerBack, this.shoulderL, this.shoulderR, this.scapulaL, this.scapulaR, this.lowerBackL, this.lowerBackR]
    if (required.some((r) => !r)) {
      print("MasseurBodyMap: a landmark @input is not wired")
      return
    }
    if (this.skinGrid) this.skinGrid.ensureBaked()
    else if (this.humanBody) this.humanBody.ensureBaked()
    if (this.snapLandmarksToSkin) {
      for (const lm of this.allLandmarkObjects()) {
        const p = this.toLocal(lm)
        this.setLocal(lm, new vec3(p.x, this.skinHeight(p.x, p.z), p.z))
      }
    }
    this.ready = true
  }

  /** Landmarks with display labels and their v along the spine (scan reveal order). */
  getLandmarks(): LandmarkInfo[] {
    const list: [string, string, SceneObject][] = [
      ["neckBase", "Neck", this.neckBase],
      ["shoulderL", "Shoulder", this.shoulderL],
      ["shoulderR", "Shoulder", this.shoulderR],
      ["scapulaL", "Shoulder blade", this.scapulaL],
      ["scapulaR", "Shoulder blade", this.scapulaR],
      ["spineMid", "Spine", this.spineMid],
      ["lowerBack", "Lower back", this.lowerBack],
      ["lowerBackL", "", this.lowerBackL],
      ["lowerBackR", "", this.lowerBackR],
    ]
    return list.map(([key, label, obj]) => ({key, label, obj, v: this.vOf(this.toLocal(obj))}))
  }

  /** Mannequin-local point on the skin for a back UV, lifted along +Y by `lift` cm. */
  uvToLocal(p: BackUV, lift: number): vec3 {
    const spine = this.spinePoint(p.v)
    const side = this.lateralAxis(p.v)
    const hw = this.halfWidth(p.v)
    const x = spine.x + side.x * p.u * hw
    const z = spine.z + side.z * p.u * hw
    return new vec3(x, this.skinHeight(x, z) + lift, z)
  }

  uvToWorld(p: BackUV, lift: number): vec3 {
    return this.localToWorld(this.uvToLocal(p, lift))
  }

  localToWorld(p: vec3): vec3 {
    return this.mannequinTransform().getWorldTransform().multiplyPoint(p)
  }

  /** Approximate skin normal in world space (for orienting rings and hands). */
  worldUp(): vec3 {
    return this.mannequinTransform().getWorldRotation().multiplyVec3(vec3.up())
  }

  /** Spine-aligned "down the back" direction in world space (toward the lower back). */
  worldDownBack(): vec3 {
    const a = this.localToWorld(this.spinePoint(0))
    const b = this.localToWorld(this.spinePoint(1))
    return b.sub(a).normalize()
  }

  skinHeight(x: number, z: number): number {
    if (this.skinGrid && this.skinGrid.isBaked) return this.skinGrid.heightAt(x, z)
    if (!this.skinGrid && this.humanBody && this.humanBody.isBaked) return this.humanBody.heightAt(x, z)
    if (this.mannequin) return this.mannequin.surfaceTopLocal(x, z)
    return this.toLocal(this.spineMid).y
  }

  // ---- internals ----

  private allLandmarkObjects(): SceneObject[] {
    return [this.neckBase, this.spineMid, this.lowerBack, this.shoulderL, this.shoulderR, this.scapulaL, this.scapulaR, this.lowerBackL, this.lowerBackR]
  }

  private mannequinTransform(): Transform {
    return this.mannequin.getSceneObject().getTransform()
  }

  private toLocal(obj: SceneObject): vec3 {
    const w = obj.getTransform().getWorldPosition()
    return this.mannequinTransform().getInvertedWorldTransform().multiplyPoint(w)
  }

  private setLocal(obj: SceneObject, p: vec3): void {
    obj.getTransform().setWorldPosition(this.localToWorld(p))
  }

  /** Piecewise-linear spine through neck base, spine middle and lower back. */
  private spinePoint(v: number): vec3 {
    const a = this.toLocal(this.neckBase)
    const m = this.toLocal(this.spineMid)
    const b = this.toLocal(this.lowerBack)
    const vm = this.midV()
    if (v <= vm) return vec3.lerp(a, m, vm > 0 ? v / vm : 0)
    return vec3.lerp(m, b, (v - vm) / Math.max(1e-3, 1 - vm))
  }

  private midV(): number {
    const a = this.toLocal(this.neckBase)
    const m = this.toLocal(this.spineMid)
    const b = this.toLocal(this.lowerBack)
    const d1 = m.sub(a).length
    const d2 = b.sub(m).length
    return d1 / Math.max(1e-3, d1 + d2)
  }

  /** Unit vector across the back (toward the +X / "L" side) in the table plane. */
  private lateralAxis(v: number): vec3 {
    const t = this.spinePoint(Math.min(1, v + 0.02)).sub(this.spinePoint(Math.max(0, v - 0.02)))
    const flat = new vec3(t.x, 0, t.z).normalize()
    // spine runs toward -Z; up x down-the-back gives +X
    const lat = vec3.up().cross(flat).uniformScale(-1)
    return lat.x < 0 ? lat.uniformScale(-1) : lat
  }

  /** Half width of the back at v, from the shoulder and lower-back landmarks. */
  private halfWidth(v: number): number {
    const sh = 0.5 * this.toLocal(this.shoulderL).sub(this.toLocal(this.shoulderR)).length
    const lb = 0.5 * this.toLocal(this.lowerBackL).sub(this.toLocal(this.lowerBackR)).length
    const sc = this.toLocal(this.scapulaL).sub(this.toLocal(this.scapulaR)).length * 0.5
    const scV = this.vOf(this.toLocal(this.scapulaL))
    // shoulders at the top, widest across the shoulder blades, narrowing to the lower back
    const upper = Math.max(sh, sc * 1.75)
    if (v <= scV) return sh + (upper - sh) * (v / Math.max(1e-3, scV))
    const t = (v - scV) / Math.max(1e-3, 1 - scV)
    const s = t * t * (3 - 2 * t)
    return upper + (lb - upper) * s
  }

  private vOf(p: vec3): number {
    const a = this.toLocal(this.neckBase)
    const b = this.toLocal(this.lowerBack)
    const ab = b.sub(a)
    const len2 = Math.max(1e-3, ab.dot(ab))
    return Math.max(0, Math.min(1, p.sub(a).dot(ab) / len2))
  }
}
