/**
 * MasseurStepCardUI - the step card at the far end of the table, beyond the
 * mannequin's hips, so the centre of the view (the back) stays free.
 *
 * Passive view with two faces in the same spot:
 *  - step face: status line ("Step 2 of 6", "Paused", "Next: Knuckle glide",
 *    "Mapping back..."), step name, part of the hand, time left in the step;
 *  - end face: "Session complete" + a button back to the start menu.
 * Ephemeral view state only (the temporary notice timer).
 *
 * LEAF names: StepCard_Status, StepCard_Title, StepCard_HandPart, StepCard_Time,
 * EndCard_BackToMenu.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {
  addToFlex, CONTENT_Z, makeButton, makeFlex, makeObj, makeText,
  TEXT_ACCENT, TEXT_PRIMARY, TEXT_SECONDARY,
} from "./MasseurSharedUI"

const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material
const ICON_HAND = requireAsset("../Icons/back_hand.png") as Texture
const ICON_TIMER = requireAsset("../Icons/timer.png") as Texture
const ICON_HOME = requireAsset("../Icons/home.png") as Texture
const ICON_SPA = requireAsset("../Icons/spa.png") as Texture

const PANEL_W = 44
const PANEL_H = 16
const PAD = 1.2
const INNER_W = PANEL_W - PAD * 2

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r < 10 ? "0" : ""}${r}`
}

@component
export class MasseurStepCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurStepCardUI - step name, hand part, time left, end card</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Distance from the user's eyes in cm; scales text to stay readable")
  @widget(new SliderWidget(60, 200, 1))
  viewingDistanceCm: number = 145
  @input
  @hint("Seconds the 'Next: ...' notice stays on the card after a step change")
  @widget(new SliderWidget(1, 8, 0.5))
  noticeSec: number = 3
  @input("vec4", "{0.55, 1.0, 0.95, 1.0}")
  @hint("Accent color for the status line")
  @widget(new ColorWidget())
  accentColor: vec4
  @ui.group_end

  private _onBackToMenu = new Event<void>()
  get onBackToMenu(): PublicApi<void> { return this._onBackToMenu.publicApi() }

  // read state (tests)
  get statusText(): string { return this.status ? this.status.text : "" }
  get titleText(): string { return this.title ? this.title.text : "" }
  get timeText(): string { return this.time ? this.time.text : "" }
  get handPartText(): string { return this.hand ? this.hand.text : "" }
  get endCardVisible(): boolean { return !!this.endRoot && this.endRoot.enabled && this.getSceneObject().enabled }

  private status: Text | null = null
  private title: Text | null = null
  private hand: Text | null = null
  private time: Text | null = null
  private stepRoot: SceneObject | null = null
  private endRoot: SceneObject | null = null
  private endSummary: Text | null = null
  private baseStatus = ""
  private notice = ""
  private noticeLeft = 0
  private paused = false

  onAwake(): void {
    this.build()
    this.createEvent("UpdateEvent").bind(() => this.tick(getDeltaTime()))
  }

  setVisible(visible: boolean): void {
    this.getSceneObject().enabled = visible
  }

  /** Scan phase: "Mapping back..." then "Back mapped". */
  showScan(titleText: string, statusText: string): void {
    this.showStepFace()
    if (this.title) this.title.text = titleText
    this.baseStatus = statusText
    this.notice = ""
    this.noticeLeft = 0
    if (this.hand) this.hand.text = "Simulated scan"
    if (this.time) this.time.text = "--:--"
    this.refreshStatus()
  }

  setStep(index: number, total: number, name: string, handPart: string): void {
    this.showStepFace()
    if (this.title) this.title.text = name
    if (this.hand) this.hand.text = handPart
    this.baseStatus = `Step ${index + 1} of ${total}`
    this.refreshStatus()
  }

  /** Small temporary notice on the status line ("Next: Knuckle glide"). */
  showNotice(text: string): void {
    this.notice = text
    this.noticeLeft = this.noticeSec
    this.refreshStatus()
  }

  setTimeLeft(sec: number): void {
    if (this.time) this.time.text = formatTime(sec)
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    if (this.time) this.time.textFill.color = paused ? TEXT_SECONDARY : TEXT_PRIMARY
    this.refreshStatus()
  }

  showEndCard(summary: string): void {
    if (this.stepRoot) this.stepRoot.enabled = false
    if (this.endRoot) this.endRoot.enabled = true
    if (this.endSummary) this.endSummary.text = summary
  }

  // ---- internals ----

  private showStepFace(): void {
    if (this.stepRoot) this.stepRoot.enabled = true
    if (this.endRoot) this.endRoot.enabled = false
  }

  private tick(dt: number): void {
    if (this.noticeLeft > 0) {
      this.noticeLeft -= dt
      if (this.noticeLeft <= 0) {
        this.notice = ""
        this.refreshStatus()
      }
    }
  }

  private refreshStatus(): void {
    if (!this.status) return
    this.status.text = this.paused ? "Paused" : this.notice || this.baseStatus
  }

  private build(): void {
    const D = this.viewingDistanceCm
    const root = this.getSceneObject()
    root.createComponent("Component.Canvas")
    const plate = root.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(PANEL_W, PANEL_H)
    const accent = this.accentColor ?? TEXT_ACCENT

    // Step face
    const step = makeObj(root, "StepFace", new vec3(0, 0, CONTENT_Z))
    makeFlex(step, FlexDirection.Column, PANEL_W, PANEL_H, {gap: 0.4, padX: PAD, padY: PAD, justify: FlexJustify.Center, align: FlexAlign.Center})
    this.status = makeText(step, "StepCard_Status", "", "Caption", D, INNER_W, 2.6, accent)
    addToFlex(step, this.status.getSceneObject(), INNER_W, 2.6)
    this.title = makeText(step, "StepCard_Title", "", "Headline2", D, INNER_W, 3.6, TEXT_PRIMARY)
    addToFlex(step, this.title.getSceneObject(), INNER_W, 3.6)
    const info = makeObj(step, "InfoRow")
    makeFlex(info, FlexDirection.Row, INNER_W, 3.4, {gap: 0.6})
    addToFlex(step, info, INNER_W, 3.4)
    addToFlex(info, this.addIcon(info, ICON_HAND, 2.6), 2.6, 2.6)
    this.hand = makeText(info, "StepCard_HandPart", "", "Body", D, 25, 3.0, TEXT_SECONDARY, HorizontalAlignment.Left)
    addToFlex(info, this.hand.getSceneObject(), 25, 3.0)
    addToFlex(info, this.addIcon(info, ICON_TIMER, 2.6), 2.6, 2.6)
    this.time = makeText(info, "StepCard_Time", "--:--", "Headline2", D, 8.6, 3.0, TEXT_PRIMARY, HorizontalAlignment.Left)
    addToFlex(info, this.time.getSceneObject(), 8.6, 3.0)
    this.stepRoot = step

    // End face
    const end = makeObj(root, "EndFace", new vec3(0, 0, CONTENT_Z))
    makeFlex(end, FlexDirection.Column, PANEL_W, PANEL_H, {gap: 0.4, padX: PAD, padY: PAD, justify: FlexJustify.Center, align: FlexAlign.Center})
    const head = makeObj(end, "EndHeader")
    makeFlex(head, FlexDirection.Row, INNER_W, 3.8, {gap: 0.8})
    addToFlex(end, head, INNER_W, 3.8)
    addToFlex(head, this.addIcon(head, ICON_SPA, 3.2), 3.2, 3.2)
    const done = makeText(head, "EndCard_Title", "Session complete", "Headline2", D, 26, 3.6, TEXT_PRIMARY)
    addToFlex(head, done.getSceneObject(), 26, 3.6)
    this.endSummary = makeText(end, "EndCard_Summary", "", "Caption", D, INNER_W, 2.6, accent)
    addToFlex(end, this.endSummary.getSceneObject(), INNER_W, 2.6)
    const {btn} = makeButton(end, "EndCard_BackToMenu", 22, 5.6, {label: "Back to menu", icon: ICON_HOME, iconLayout: "left", distanceCm: D, iconSize: 2.6})
    btn.onTriggerUp.add(() => this._onBackToMenu.invoke())
    addToFlex(end, btn.getSceneObject(), 22, 5.6)
    end.enabled = false
    this.endRoot = end
  }

  private addIcon(parent: SceneObject, tex: Texture, sizeCm: number): SceneObject {
    const so = makeObj(parent, "Icon")
    const img = so.createComponent("Component.Image") as Image
    const mat = imageMaterial.clone()
    mat.mainPass.baseTex = tex
    mat.mainPass.depthTest = true
    mat.mainPass.depthWrite = false
    img.clearMaterials()
    img.addMaterial(mat)
    so.getTransform().setLocalScale(new vec3(sizeCm, sizeCm, 1))
    return so
  }
}
