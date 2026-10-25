/**
 * MasseurControlBarUI - the control bar on the right side of the table.
 *
 * Passive view. Row 1: Pause/Resume, +2 min, Next. Pressing Next swaps row 1
 * for "Skip step?" with Confirm and Cancel (the 4 s auto-cancel lives in the
 * session manager). Row 2: Slower, the pace label ("Pace 85%"), Faster.
 * Buttons are 9 cm wide with icon + label and highlight when aimed at.
 *
 * LEAF names: Ctrl_Pause, Ctrl_Extend, Ctrl_Next, Ctrl_ConfirmSkip,
 * Ctrl_CancelSkip, Ctrl_Slower, Ctrl_Faster, Ctrl_PaceLabel.
 * Must not: change session state (emit events only).
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {addToFlex, CONTENT_Z, makeButton, makeFlex, makeObj, makeText, TEXT_ACCENT, TEXT_PRIMARY} from "./MasseurSharedUI"

const ICON_PAUSE = requireAsset("../Icons/pause.png") as Texture
const ICON_PLAY = requireAsset("../Icons/play_arrow.png") as Texture
const ICON_SLOWER = requireAsset("../Icons/remove.png") as Texture
const ICON_FASTER = requireAsset("../Icons/add.png") as Texture
const ICON_EXTEND = requireAsset("../Icons/more_time.png") as Texture
const ICON_NEXT = requireAsset("../Icons/skip_next.png") as Texture
const ICON_CHECK = requireAsset("../Icons/check.png") as Texture
const ICON_CLOSE = requireAsset("../Icons/close.png") as Texture

const BTN_W = 10
const BTN_H = 7
const GAP = 1.0
const PAD = 1.4

const ROW_W = BTN_W * 3 + GAP * 2
const PANEL_W = ROW_W + PAD * 2
const PANEL_H = BTN_H * 2 + GAP + PAD * 2

@component
export class MasseurControlBarUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurControlBarUI - pause, pace, +2 min, next</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Distance from the user's eyes in cm; scales text to stay readable")
  @widget(new SliderWidget(40, 150, 1))
  viewingDistanceCm: number = 81
  @input
  @hint("Label of the extend button")
  extendLabel: string = "+2 min"
  @ui.group_end

  private _onPauseToggle = new Event<void>()
  private _onSlower = new Event<void>()
  private _onFaster = new Event<void>()
  private _onExtend = new Event<void>()
  private _onNext = new Event<void>()
  private _onConfirmSkip = new Event<void>()
  private _onCancelSkip = new Event<void>()
  get onPauseToggle(): PublicApi<void> { return this._onPauseToggle.publicApi() }
  get onSlower(): PublicApi<void> { return this._onSlower.publicApi() }
  get onFaster(): PublicApi<void> { return this._onFaster.publicApi() }
  get onExtend(): PublicApi<void> { return this._onExtend.publicApi() }
  get onNext(): PublicApi<void> { return this._onNext.publicApi() }
  get onConfirmSkip(): PublicApi<void> { return this._onConfirmSkip.publicApi() }
  get onCancelSkip(): PublicApi<void> { return this._onCancelSkip.publicApi() }

  // read state (tests)
  get paceLabelText(): string { return this.paceText ? this.paceText.text : "" }
  get pauseLabelText(): string { return this.pauseContent ? this.pauseContent.text : "" }
  get confirmVisible(): boolean { return !!this.confirmRow && this.confirmRow.enabled }

  private pauseContent: ElementContent | null = null
  private paceText: Text | null = null
  private slowerBtn: Button | null = null
  private fasterBtn: Button | null = null
  private normalRow: SceneObject | null = null
  private confirmRow: SceneObject | null = null

  onAwake(): void {
    this.build()
  }

  setVisible(visible: boolean): void {
    this.getSceneObject().enabled = visible
  }

  setPaused(paused: boolean): void {
    if (!this.pauseContent) return
    this.pauseContent.text = paused ? "Resume" : "Pause"
    this.pauseContent.leadingIcon = paused ? ICON_PLAY : ICON_PAUSE
  }

  setPace(percent: number, canSlower: boolean, canFaster: boolean): void {
    if (this.paceText) this.paceText.text = `Pace ${percent}%`
    if (this.slowerBtn) this.slowerBtn.inactive = !canSlower
    if (this.fasterBtn) this.fasterBtn.inactive = !canFaster
  }

  /** Swaps the top row between [Pause, +2 min, Next] and [Skip step?, Confirm, Cancel]. */
  setSkipConfirm(pending: boolean): void {
    if (this.normalRow) this.normalRow.enabled = !pending
    if (this.confirmRow) this.confirmRow.enabled = pending
  }

  private build(): void {
    const D = this.viewingDistanceCm
    const root = this.getSceneObject()
    root.createComponent("Component.Canvas")
    const plate = root.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(PANEL_W, PANEL_H)

    const content = makeObj(root, "Content", new vec3(0, 0, CONTENT_Z))
    makeFlex(content, FlexDirection.Column, PANEL_W, PANEL_H, {gap: GAP, padX: PAD, padY: PAD, justify: FlexJustify.Center, align: FlexAlign.Center})

    // Row 1 slot: two alternative rows stacked in the same slot, one enabled at a time.
    const slot = makeObj(content, "TopRowSlot")
    addToFlex(content, slot, ROW_W, BTN_H)

    const normal = makeObj(slot, "NormalRow")
    makeFlex(normal, FlexDirection.Row, ROW_W, BTN_H, {gap: GAP})
    const pause = makeButton(normal, "Ctrl_Pause", BTN_W, BTN_H, {label: "Pause", icon: ICON_PAUSE, iconLayout: "top", distanceCm: D, iconSize: 2.4})
    pause.btn.onTriggerUp.add(() => this._onPauseToggle.invoke())
    addToFlex(normal, pause.btn.getSceneObject(), BTN_W, BTN_H)
    this.pauseContent = pause.content
    const ext = makeButton(normal, "Ctrl_Extend", BTN_W, BTN_H, {label: this.extendLabel, icon: ICON_EXTEND, iconLayout: "top", distanceCm: D, iconSize: 2.4})
    ext.btn.onTriggerUp.add(() => this._onExtend.invoke())
    addToFlex(normal, ext.btn.getSceneObject(), BTN_W, BTN_H)
    const next = makeButton(normal, "Ctrl_Next", BTN_W, BTN_H, {label: "Next", icon: ICON_NEXT, iconLayout: "top", distanceCm: D, iconSize: 2.4})
    next.btn.onTriggerUp.add(() => this._onNext.invoke())
    addToFlex(normal, next.btn.getSceneObject(), BTN_W, BTN_H)
    this.normalRow = normal

    const confirm = makeObj(slot, "ConfirmRow")
    makeFlex(confirm, FlexDirection.Row, ROW_W, BTN_H, {gap: GAP})
    const q = makeText(confirm, "Ctrl_SkipQuestion", "Skip step?", "Subheadline", D, BTN_W, BTN_H, TEXT_ACCENT)
    addToFlex(confirm, q.getSceneObject(), BTN_W, BTN_H)
    const yes = makeButton(confirm, "Ctrl_ConfirmSkip", BTN_W, BTN_H, {label: "Confirm", icon: ICON_CHECK, iconLayout: "top", distanceCm: D, iconSize: 2.4})
    yes.btn.onTriggerUp.add(() => this._onConfirmSkip.invoke())
    addToFlex(confirm, yes.btn.getSceneObject(), BTN_W, BTN_H)
    const no = makeButton(confirm, "Ctrl_CancelSkip", BTN_W, BTN_H, {label: "Cancel", icon: ICON_CLOSE, iconLayout: "top", distanceCm: D, iconSize: 2.4})
    no.btn.onTriggerUp.add(() => this._onCancelSkip.invoke())
    addToFlex(confirm, no.btn.getSceneObject(), BTN_W, BTN_H)
    confirm.enabled = false
    this.confirmRow = confirm

    // Row 2: pace
    const paceRow = makeObj(content, "PaceRow")
    makeFlex(paceRow, FlexDirection.Row, ROW_W, BTN_H, {gap: GAP})
    addToFlex(content, paceRow, ROW_W, BTN_H)
    const slower = makeButton(paceRow, "Ctrl_Slower", BTN_W, BTN_H, {label: "Slower", icon: ICON_SLOWER, iconLayout: "top", distanceCm: D, iconSize: 2.4})
    slower.btn.onTriggerUp.add(() => this._onSlower.invoke())
    addToFlex(paceRow, slower.btn.getSceneObject(), BTN_W, BTN_H)
    this.slowerBtn = slower.btn
    this.paceText = makeText(paceRow, "Ctrl_PaceLabel", "Pace 100%", "Subheadline", D, BTN_W, BTN_H, TEXT_PRIMARY)
    addToFlex(paceRow, this.paceText.getSceneObject(), BTN_W, BTN_H)
    const faster = makeButton(paceRow, "Ctrl_Faster", BTN_W, BTN_H, {label: "Faster", icon: ICON_FASTER, iconLayout: "top", distanceCm: D, iconSize: 2.4})
    faster.btn.onTriggerUp.add(() => this._onFaster.invoke())
    addToFlex(paceRow, faster.btn.getSceneObject(), BTN_W, BTN_H)
    this.fasterBtn = faster.btn
  }
}
