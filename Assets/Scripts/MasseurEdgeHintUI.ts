/**
 * MasseurEdgeHintUI - a small hint at the edge of the view pointing toward the
 * control bar when something there needs attention (paused, a pending
 * "Skip step?", or the first seconds of a session) and the bar is out of view.
 *
 * Passive view: Main decides when it shows and on which side. The only thing
 * it does on its own is follow the camera so it stays at the edge of the view.
 * LEAF name: EdgeHint (root), read `isShowing`.
 */
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexDirection} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {addToFlex, CONTENT_Z, makeFlex, makeObj, makeText, TEXT_ACCENT} from "./MasseurSharedUI"

const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material
const ICON_CHEVRON = requireAsset("../Icons/chevron_right.png") as Texture

const W = 13
const H = 4

@component
export class MasseurEdgeHintUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurEdgeHintUI - edge-of-view hint toward the controls</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("The camera the hint stays in front of")
  cameraObject: SceneObject
  @ui.group_end
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Text next to the arrow")
  hintText: string = "Controls"
  @input
  @hint("Distance in front of the eyes, cm")
  @widget(new SliderWidget(40, 120, 1))
  distanceCm: number = 60
  @input
  @hint("Sideways offset from the centre of the view, cm")
  @widget(new SliderWidget(5, 30, 0.5))
  sideOffsetCm: number = 15
  @ui.group_end
  private visible = false

  get isShowing(): boolean { return this.visible }
  get side(): number { return this._side }

  private _side = 1
  private inner: SceneObject | null = null
  private iconObj: SceneObject | null = null

  onAwake(): void {
    this.build()
    this.createEvent("UpdateEvent").bind(() => this.follow())
  }

  /** side: +1 = control bar is to the right, -1 = to the left. */
  setVisible(visible: boolean, side: number): void {
    this.visible = visible
    this._side = side >= 0 ? 1 : -1
    if (this.inner) this.inner.enabled = visible
    if (this.iconObj) this.iconObj.getTransform().setLocalRotation(quat.angleAxis(this._side > 0 ? 0 : Math.PI, vec3.forward()))
  }

  private follow(): void {
    if (!this.visible || !this.cameraObject) return
    const ct = this.cameraObject.getTransform()
    const camPos = ct.getWorldPosition()
    const rot = ct.getWorldRotation()
    const fwd = rot.multiplyVec3(new vec3(0, 0, -1)) // camera looks down its local -Z
    const right = rot.multiplyVec3(new vec3(1, 0, 0))
    const up = rot.multiplyVec3(new vec3(0, 1, 0))
    const pos = camPos.add(fwd.uniformScale(this.distanceCm)).add(right.uniformScale(this._side * this.sideOffsetCm)).add(up.uniformScale(-3))
    const t = this.getTransform()
    t.setWorldPosition(pos)
    t.setWorldRotation(quat.lookAt(camPos.sub(pos).normalize(), up))
  }

  private build(): void {
    const root = this.getSceneObject()
    const inner = makeObj(root, "HintPanel")
    inner.createComponent("Component.Canvas")
    const plate = inner.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(W, H)
    const content = makeObj(inner, "Content", new vec3(0, 0, CONTENT_Z))
    makeFlex(content, FlexDirection.Row, W, H, {gap: 0.4, padX: 0.6})
    const label = makeText(content, "HintText", this.hintText, "Body", this.distanceCm, W - 3.8, 2.6, TEXT_ACCENT)
    addToFlex(content, label.getSceneObject(), W - 3.8, 2.6)
    const icon = makeObj(content, "Arrow")
    const img = icon.createComponent("Component.Image") as Image
    const mat = imageMaterial.clone()
    mat.mainPass.baseTex = ICON_CHEVRON
    mat.mainPass.depthTest = true
    mat.mainPass.depthWrite = false
    img.clearMaterials()
    img.addMaterial(mat)
    icon.getTransform().setLocalScale(new vec3(2.2, 2.2, 1))
    addToFlex(content, icon, 2.2, 2.2)
    this.iconObj = icon
    this.inner = inner
    inner.enabled = false
  }
}
