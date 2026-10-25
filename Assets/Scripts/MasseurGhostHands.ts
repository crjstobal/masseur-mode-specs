/**
 * MasseurGhostHands - a translucent pair of hands that demonstrates each move.
 *
 * Owns: one left + right instance per hand pose (palms, soft fists, thumbs,
 * fingertips, forearm), recolored with a light ghost material. At the start
 * of every step the matching pose rides the stroke (same timing as the pulse)
 * for `cyclesToShow` cycles, then fades out, leaving only stroke and pulse.
 * For press moves the hands sit on the active points and sink while pressing.
 *
 * Driven by Main: showMove(layout) on step change, setMotion(stepMotionTime)
 * every frame, hide() at session end. Lives under the mannequin, so the hands
 * stay on the body when the camera moves.
 *
 * Must not: own session state.
 */
import {HandPose} from "./MasseurMoveLibrary"
import {pathPhase, pointState, samplePath, StrokeLayout} from "./MasseurStrokeLayout"

interface HandInstance {
  root: SceneObject
  mats: Material[]
}

/** Height of each pose's pivot above the skin (the GLBs are centred on their bounds). */
const POSE_LIFT: Record<HandPose, number> = {palm: 3.0, fist: 3.3, thumb: 5.2, fingertips: 5.6, forearm: 4.4}
const POSES: HandPose[] = ["palm", "fist", "thumb", "fingertips", "forearm"]

@component
export class MasseurGhostHands extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurGhostHands - demo hands per move</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Translucent material applied to every ghost hand")
  ghostMaterial: Material
  @input
  @hint("Hand pose: open palm, palm down")
  palmPrefab: ObjectPrefab
  @input
  @hint("Hand pose: soft fist (knuckles)")
  fistPrefab: ObjectPrefab
  @input
  @hint("Hand pose: thumb pressing down")
  thumbPrefab: ObjectPrefab
  @input
  @hint("Hand pose: curved fingertips")
  fingertipsPrefab: ObjectPrefab
  @input
  @hint("Hand pose: flat forearm")
  forearmPrefab: ObjectPrefab
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input("vec4", "{0.85, 0.97, 1.0, 0.38}")
  @hint("Ghost hand tint and opacity")
  @widget(new ColorWidget())
  ghostColor: vec4

  @input
  @hint("How many times the hands perform the move before fading out")
  @widget(new SliderWidget(1, 5, 1))
  cyclesToShow: number = 2

  @input
  @hint("Fade in / out time in seconds")
  @widget(new SliderWidget(0.1, 2, 0.1))
  fadeSec: number = 0.6
  @ui.group_end
  private hands: Record<string, HandInstance[]> = {}

  // ---- read state (tests) ----
  get isShowing(): boolean { return this.alpha > 0.01 }
  get currentPose(): string { return this.pose ?? "" }
  get visibleHandCount(): number {
    if (!this.pose || !this.isShowing) return 0
    return this.hands[this.pose].filter((h) => h.root.enabled).length
  }

  private layout: StrokeLayout | null = null
  private pose: HandPose | null = null
  private alpha = 0
  private motion = 0
  private built = false

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate(getDeltaTime()))
  }

  showMove(layout: StrokeLayout): void {
    this.build()
    this.setPoseEnabled(this.pose, false)
    this.layout = layout
    this.pose = layout.move.pose
    this.alpha = 0
    this.motion = 0
    this.setPoseEnabled(this.pose, true)
  }

  hide(): void {
    this.setPoseEnabled(this.pose, false)
    this.layout = null
    this.pose = null
    this.alpha = 0
  }

  setMotion(stepMotionTime: number): void {
    this.motion = stepMotionTime
  }

  // ---- internals ----

  private build(): void {
    if (this.built) return
    this.built = true
    const prefabs: Record<HandPose, ObjectPrefab> = {
      palm: this.palmPrefab, fist: this.fistPrefab, thumb: this.thumbPrefab,
      fingertips: this.fingertipsPrefab, forearm: this.forearmPrefab,
    }
    for (const pose of POSES) {
      this.hands[pose] = []
      for (const mirrorX of [false, true]) {
        const root = global.scene.createSceneObject(`Ghost_${pose}_${mirrorX ? "L" : "R"}`)
        root.setParent(this.getSceneObject())
        const mats: Material[] = []
        const prefab = prefabs[pose]
        if (prefab) {
          const inst = prefab.instantiate(root)
          const s = inst.getTransform().getLocalScale()
          if (mirrorX) inst.getTransform().setLocalScale(new vec3(-Math.abs(s.x), s.y, s.z))
          this.applyGhost(inst, mats)
        }
        root.enabled = false
        this.hands[pose].push({root, mats})
      }
    }
  }

  private applyGhost(obj: SceneObject, mats: Material[]): void {
    const rmv = obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    if (rmv && this.ghostMaterial) {
      const m = this.ghostMaterial.clone()
      rmv.clearMaterials()
      rmv.addMaterial(m)
      mats.push(m)
    }
    for (let i = 0; i < obj.getChildrenCount(); i++) this.applyGhost(obj.getChild(i), mats)
  }

  private setPoseEnabled(pose: HandPose | null, on: boolean): void {
    if (!pose || !this.hands[pose]) return
    for (const h of this.hands[pose]) h.root.enabled = on
  }

  private onUpdate(dt: number): void {
    if (!this.layout || !this.pose) return
    const move = this.layout.move
    const showFor = move.cycleSec * Math.max(1, this.cyclesToShow)
    const target = this.motion < showFor ? 1 : 0
    const rate = dt / Math.max(0.05, this.fadeSec)
    this.alpha = target > this.alpha ? Math.min(1, this.alpha + rate) : Math.max(0, this.alpha - rate)
    const hands = this.hands[this.pose]
    if (this.alpha <= 0.001 && target === 0) {
      for (const h of hands) h.root.enabled = false
      return
    }
    const parentT = this.getTransform()
    const toWorld = parentT.getWorldTransform()
    const worldRot = parentT.getWorldRotation()
    const lift = POSE_LIFT[this.pose]
    for (let i = 0; i < hands.length; i++) {
      const h = hands[i]
      // hand 0 (right) on the -X path, hand 1 (left, mirrored) on the +X path
      let local: vec3
      let tan: vec3
      if (move.kind === "points" && this.layout.groups.length) {
        const ps = pointState(move, this.motion)
        const g = this.layout.groups[ps.group]
        const p = g[Math.min(g.length - 1, i === 0 ? 1 : 0)]
        local = p.add(new vec3(0, lift - 1.0 * ps.fill, 0))
        tan = new vec3(0, 0, -1)
      } else if (this.layout.paths.length) {
        const path = this.layout.paths[Math.min(this.layout.paths.length - 1, i === 0 ? 1 : 0)]
        const pi = this.layout.paths.indexOf(path)
        const smp = samplePath(path, pathPhase(move, pi, this.motion) * path.length)
        local = smp.pos.add(new vec3(0, lift, 0))
        tan = new vec3(smp.tan.x, 0, smp.tan.z)
        if (tan.length < 1e-3) tan = new vec3(0, 0, -1)
        tan = tan.normalize()
      } else {
        continue
      }
      h.root.enabled = true
      const t = h.root.getTransform()
      t.setWorldPosition(toWorld.multiplyPoint(local))
      t.setWorldRotation(worldRot.multiply(quat.lookAt(tan, vec3.up())))
      const c = this.ghostColor ?? new vec4(0.85, 0.97, 1, 0.38)
      for (const m of h.mats) m.mainPass.baseColor = new vec4(c.x, c.y, c.z, c.w * this.alpha)
    }
  }
}
