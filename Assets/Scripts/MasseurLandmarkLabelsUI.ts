/**
 * MasseurLandmarkLabelsUI - small labels that pop in next to each landmark dot
 * during the simulated scan ("Neck", "Shoulder", "Shoulder blade", ...).
 *
 * Passive view: Main calls showLabel() as the scan reveals a landmark and
 * clear() when the first step starts. Labels are world-anchored (they sit on
 * the body) and turn to face the user so they stay readable.
 */
import {makeObj, makeText} from "./MasseurSharedUI"

@component
export class MasseurLandmarkLabelsUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurLandmarkLabelsUI - scan landmark labels</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("The camera the labels turn toward")
  cameraObject: SceneObject
  @ui.group_end
  @ui.separator
  @ui.group_start("Settings")
  @input("vec4", "{0.8, 1.0, 0.97, 0.95}")
  @hint("Label color")
  @widget(new ColorWidget())
  labelColor: vec4
  @input
  @hint("Height of the label above its landmark, cm")
  @widget(new SliderWidget(0.5, 6, 0.1))
  liftCm: number = 2.4
  @ui.group_end
  private labels: {obj: SceneObject; text: Text; fade: number; out: boolean}[] = []

  get labelCount(): number { return this.labels.length }
  get labelTexts(): string[] { return this.labels.map((l) => l.text.text) }


  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => this.tick(getDeltaTime()))
  }

  showLabel(text: string, worldPos: vec3): void {
    if (!text) return
    const obj = makeObj(this.getSceneObject(), `Label_${text}`)
    const t = makeText(obj, "Text", text, "Caption", 75, 16, 2.2, this.labelColor ?? new vec4(0.8, 1, 0.97, 0.95))
    obj.getTransform().setWorldPosition(worldPos.add(vec3.up().uniformScale(this.liftCm)))
    this.labels.push({obj, text: t, fade: 0, out: false})
  }

  clear(): void {
    for (const l of this.labels) l.out = true
  }

  private tick(dt: number): void {
    const cam = this.cameraObject ? this.cameraObject.getTransform().getWorldPosition() : null
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const l = this.labels[i]
      l.fade = l.out ? Math.max(0, l.fade - dt / 0.5) : Math.min(1, l.fade + dt / 0.25)
      const c = this.labelColor ?? new vec4(0.8, 1, 0.97, 0.95)
      l.text.textFill.color = new vec4(c.x, c.y, c.z, c.w * l.fade)
      if (cam) {
        const t = l.obj.getTransform()
        const p = t.getWorldPosition()
        t.setWorldRotation(quat.lookAt(cam.sub(p).normalize(), vec3.up()))
      }
      if (l.out && l.fade <= 0) {
        l.obj.destroy()
        this.labels.splice(i, 1)
      }
    }
  }
}
