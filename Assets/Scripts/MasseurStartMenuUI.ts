/**
 * MasseurStartMenuUI - start menu floating above the mannequin's upper back.
 *
 * Passive view. Shows the body-part buttons ("Back" works, the rest are greyed
 * out with "Coming soon" and cannot be pinched), the four session lengths and
 * the disclaimer. Reports intent through onBodyPartSelected / onDurationSelected;
 * Main decides and pushes state back with setSelectedBodyPart / setDurationsEnabled.
 *
 * LEAF names: BodyPart_<id> (back, neck, feet, legs, arms, hands), Duration_<min>.
 * Must not: start sessions or hold domain state.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BODY_PARTS} from "./MasseurSessionManager"
import {SUPPORTED_DURATIONS} from "./MasseurSessionPlans"
import {
  addToFlex, BUTTON_LABEL_Z, CONTENT_Z, makeButton, makeFlex, makeObj, makeText,
  TEXT_ACCENT, TEXT_CAPTION, TEXT_PRIMARY, TEXT_SECONDARY,
} from "./MasseurSharedUI"

const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material
const ICON_BACK = requireAsset("../Icons/airline_seat_flat.png") as Texture
const ICON_LOCK = requireAsset("../Icons/lock.png") as Texture
const ICON_TIME = requireAsset("../Icons/schedule.png") as Texture
const ICON_INFO = requireAsset("../Icons/info.png") as Texture

const PANEL_W = 44
const PANEL_H = 36
const PAD = 1.6
const INNER_W = PANEL_W - PAD * 2
const PART_W = 13.0
const PART_H = 5.6
const DUR_W = 9.6
const DUR_H = 5.2

@component
export class MasseurStartMenuUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurStartMenuUI - body part, duration, disclaimer</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Title at the top of the menu")
  titleText: string = "Masseur Mode"
  @input
  @hint("One-line instruction under the title")
  subtitleText: string = "Pick a body part, then a session length"
  @input
  @hint("Safety disclaimer shown at the bottom of the menu")
  disclaimerText: string = "Relaxation massage. Not a substitute for a physiotherapist."
  @input
  @hint("Distance from the user's eyes in cm; scales text to stay readable")
  @widget(new SliderWidget(40, 150, 1))
  viewingDistanceCm: number = 70
  @ui.group_end

  private _onBodyPartSelected = new Event<string>()
  private _onDurationSelected = new Event<number>()
  get onBodyPartSelected(): PublicApi<string> { return this._onBodyPartSelected.publicApi() }
  get onDurationSelected(): PublicApi<number> { return this._onDurationSelected.publicApi() }

  private partButtons: Record<string, Button> = {}
  private durationButtons: Button[] = []
  private durationHint: Text | null = null
  private selected = ""
  private durationsEnabled = false

  onAwake(): void {
    this.build()
  }

  setVisible(visible: boolean): void {
    this.getSceneObject().enabled = visible
  }

  setSelectedBodyPart(id: string): void {
    this.selected = id
    for (const key of Object.keys(this.partButtons)) {
      const b = this.partButtons[key]
      if (key === "back") b.isOn = id === "back"
    }
  }

  setDurationsEnabled(enabled: boolean): void {
    this.durationsEnabled = enabled
    for (const b of this.durationButtons) b.inactive = !enabled
    if (this.durationHint) this.durationHint.text = enabled ? "Session length" : "Session length (pick a body part first)"
  }

  private build(): void {
    const D = this.viewingDistanceCm
    const root = this.getSceneObject()
    root.createComponent("Component.Canvas")
    const plate = root.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(PANEL_W, PANEL_H)

    const content = makeObj(root, "Content", new vec3(0, 0, CONTENT_Z))
    makeFlex(content, FlexDirection.Column, PANEL_W, PANEL_H, {gap: 0.9, padX: PAD, padY: PAD, justify: FlexJustify.Start, align: FlexAlign.Center})

    const title = makeText(content, "Title", this.titleText, "Headline1", D, INNER_W, 3.0, TEXT_PRIMARY)
    addToFlex(content, title.getSceneObject(), INNER_W, 3.0)
    const sub = makeText(content, "Subtitle", this.subtitleText, "Body", D, INNER_W, 1.8, TEXT_SECONDARY)
    addToFlex(content, sub.getSceneObject(), INNER_W, 1.8)

    // Body parts: two rows of three
    for (let row = 0; row < 2; row++) {
      const rowObj = makeObj(content, `PartsRow${row}`)
      makeFlex(rowObj, FlexDirection.Row, INNER_W, PART_H, {gap: 0.8})
      addToFlex(content, rowObj, INNER_W, PART_H)
      for (const part of BODY_PARTS.slice(row * 3, row * 3 + 3)) this.addPartButton(rowObj, part.id, part.label, part.available)
    }

    this.durationHint = makeText(content, "DurationLabel", "", "Caption", D, INNER_W, 1.5, TEXT_CAPTION)
    addToFlex(content, this.durationHint.getSceneObject(), INNER_W, 1.5)

    const durRow = makeObj(content, "DurationRow")
    makeFlex(durRow, FlexDirection.Row, INNER_W, DUR_H, {gap: 0.8})
    addToFlex(content, durRow, INNER_W, DUR_H)
    for (const min of SUPPORTED_DURATIONS) {
      const {btn} = makeButton(durRow, `Duration_${min}`, DUR_W, DUR_H, {label: `${min} min`, icon: ICON_TIME, iconLayout: "left", distanceCm: D, iconSize: 1.6})
      btn.inactive = true
      btn.onTriggerUp.add(() => {
        if (this.durationsEnabled) this._onDurationSelected.invoke(min)
      })
      addToFlex(durRow, btn.getSceneObject(), DUR_W, DUR_H)
      this.durationButtons.push(btn)
    }

    const disc = makeObj(content, "Disclaimer")
    makeFlex(disc, FlexDirection.Row, INNER_W, 2.2, {gap: 0.5})
    addToFlex(content, disc, INNER_W, 2.2)
    const icon = this.addIcon(disc, ICON_INFO, 1.3)
    addToFlex(disc, icon, 1.3, 1.3)
    const dt = makeText(disc, "DisclaimerText", this.disclaimerText, "Caption", D, INNER_W - 3, 1.8, TEXT_ACCENT, HorizontalAlignment.Left)
    addToFlex(disc, dt.getSceneObject(), INNER_W - 3, 1.8)

    this.setDurationsEnabled(false)
  }

  /** Two-line body part button: name + "Ready" / "Coming soon". */
  private addPartButton(row: SceneObject, id: string, label: string, available: boolean): void {
    const D = this.viewingDistanceCm
    const so = makeObj(row, `BodyPart_${id}`)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(PART_W, PART_H, 1)
    if (available) btn.setIsToggleable(true)
    else btn.inactive = true

    const face = makeObj(so, "Face", new vec3(0, 0, BUTTON_LABEL_Z))
    makeFlex(face, FlexDirection.Column, PART_W - 0.6, PART_H - 0.6, {gap: 0.15})
    const nameRow = makeObj(face, "NameRow")
    makeFlex(nameRow, FlexDirection.Row, PART_W - 0.8, 2.0, {gap: 0.4})
    addToFlex(face, nameRow, PART_W - 0.8, 2.0)
    const ic = this.addIcon(nameRow, available ? ICON_BACK : ICON_LOCK, available ? 1.6 : 1.1, available ? 1 : 0.85)
    addToFlex(nameRow, ic, available ? 1.6 : 1.1, available ? 1.6 : 1.1)
    const name = makeText(nameRow, "Name", label, "Subheadline", D, PART_W - 3.2, 1.8, available ? TEXT_PRIMARY : TEXT_SECONDARY)
    addToFlex(nameRow, name.getSceneObject(), PART_W - 3.2, 1.8)
    const sub = makeText(face, "Status", available ? "Ready" : "Coming soon", "Caption", D, PART_W - 0.8, 1.4, available ? TEXT_ACCENT : TEXT_CAPTION)
    addToFlex(face, sub.getSceneObject(), PART_W - 0.8, 1.4)

    btn.onTriggerUp.add(() => {
      if (!available) return
      this._onBodyPartSelected.invoke(id)
      // keep the toggle lit for the selected part (a second pinch must not un-select it)
      btn.isOn = this.selected === id
    })
    addToFlex(row, so, PART_W, PART_H)
    this.partButtons[id] = btn
  }

  private addIcon(parent: SceneObject, tex: Texture, sizeCm: number, alpha: number = 1): SceneObject {
    const so = makeObj(parent, "Icon")
    const img = so.createComponent("Component.Image") as Image
    const mat = imageMaterial.clone()
    mat.mainPass.baseTex = tex
    mat.mainPass.baseColor = new vec4(1, 1, 1, alpha)
    mat.mainPass.depthTest = true
    mat.mainPass.depthWrite = false
    img.clearMaterials()
    img.addMaterial(mat)
    so.getTransform().setLocalScale(new vec3(sizeCm, sizeCm, 1))
    return so
  }
}
