/**
 * MasseurMain - orchestrator for Masseur Mode.
 *
 * Owns: wiring only. UI intent -> MasseurSessionManager; manager events ->
 * views (start menu, step card, control bar, edge hint, labels), visuals
 * (scan, strokes, ghost hands) and audio. Once at start it places the whole
 * massage station relative to where the user sits (the camera) and turns the
 * panels to face the user; after that everything stays anchored in the world.
 *
 * Flow: start menu -> pick Back -> pick 10/20/40/60 min -> simulated scan
 * ("Mapping back..." then "Back mapped") -> steps advance on their own with a
 * zen chime -> "Session complete" -> back to the menu.
 *
 * Inputs: every authored controller / UI module plus the station root and the
 * camera. Must not: hold session state (the manager owns it) or build UI.
 */
import {MasseurAudioController} from "./MasseurAudioController"
import {MasseurBodyMap} from "./MasseurBodyMap"
import {MasseurControlBarUI} from "./MasseurControlBarUI"
import {MasseurEdgeHintUI} from "./MasseurEdgeHintUI"
import {MasseurGhostHands} from "./MasseurGhostHands"
import {MasseurLandmarkLabelsUI} from "./MasseurLandmarkLabelsUI"
import {getMove} from "./MasseurMoveLibrary"
import {MasseurScanController} from "./MasseurScanController"
import {MasseurSessionManager, SessionPhase, StepChange} from "./MasseurSessionManager"
import {MasseurStartMenuUI} from "./MasseurStartMenuUI"
import {MasseurStepCardUI} from "./MasseurStepCardUI"
import {buildStrokeLayout} from "./MasseurStrokeLayout"
import {MasseurStrokeRenderer} from "./MasseurStrokeRenderer"

@component
export class MasseurMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurMain - Masseur Mode orchestrator</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Session state owner")
  sessionManager: MasseurSessionManager
  @input
  @hint("Start menu above the upper back")
  startMenu: MasseurStartMenuUI
  @input
  @hint("Step card beyond the hips")
  stepCard: MasseurStepCardUI
  @input
  @hint("Control bar on the right side of the table")
  controlBar: MasseurControlBarUI
  @input
  @hint("Edge-of-view hint toward the control bar")
  edgeHint: MasseurEdgeHintUI
  @input
  @hint("Scan landmark labels")
  landmarkLabels: MasseurLandmarkLabelsUI
  @input
  @hint("Simulated back scan")
  scan: MasseurScanController
  @input
  @hint("Neon strokes on the back")
  strokes: MasseurStrokeRenderer
  @input
  @hint("Ghost hands demonstrating each move")
  ghostHands: MasseurGhostHands
  @input
  @hint("Step and session chimes")
  audioController: MasseurAudioController
  @input
  @hint("Landmarks to skin mapping")
  bodyMap: MasseurBodyMap
  @input
  @hint("Root of the massage station (table, mannequin, panels); placed relative to the user at start")
  station: SceneObject
  @input
  @hint("Main camera (the user's eyes)")
  cameraObject: SceneObject
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Place the station relative to where the user's eyes are when the Lens starts")
  placeStationAtCamera: boolean = true
  @input
  @hint("Turn the start menu, step card and control bar to face the user at start")
  facePanelsToUser: boolean = true
  @input
  @hint("Seconds 'Back mapped' stays before the first step begins")
  @widget(new SliderWidget(0.2, 4, 0.1))
  backMappedHoldSec: number = 1.2
  @input
  @hint("Seconds at the start of a session during which the edge hint points to the controls")
  @widget(new SliderWidget(0, 15, 0.5))
  introHintSec: number = 5
  @input
  @hint("The control bar counts as 'in view' within this angle from the view centre (degrees)")
  @widget(new SliderWidget(10, 40, 1))
  barInViewDegrees: number = 20
  @input
  @hint("Height of the strokes above the skin, cm")
  @widget(new SliderWidget(0.1, 3, 0.1))
  strokeLiftCm: number = 0.5
  @ui.group_end

  @ui.separator
  @ui.group_start("Debug")
  @input
  @hint("Preview captures only: tilt the camera down by this many degrees at start (pauses device tracking). 0 = off")
  @widget(new SliderWidget(0, 80, 1))
  debugLookDownDeg: number = 0
  @input
  @hint("Preview captures only: move the camera this many cm back from the seat at start. 0 = off")
  @widget(new SliderWidget(0, 100, 1))
  debugCameraBackCm: number = 0
  @ui.group_end
  private ready = false

  // read state (tests)
  get isReady(): boolean { return this.ready }
  get edgeHintWanted(): boolean { return this.hintWanted }
  get controlBarInView(): boolean { return this.barInView }

  private introUntil = 0
  private hintWanted = false
  private barInView = false

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start())
    this.createEvent("UpdateEvent").bind(() => this.update())
  }

  private start(): void {
    const required = [this.sessionManager, this.startMenu, this.stepCard, this.controlBar, this.edgeHint, this.landmarkLabels, this.scan, this.strokes, this.ghostHands, this.audioController, this.bodyMap, this.station, this.cameraObject]
    if (required.some((r) => !r)) {
      print("MasseurMain: a required @input is not wired (check the scene bootstrap)")
      return
    }
    if (this.placeStationAtCamera) this.placeStation()
    if (this.facePanelsToUser) this.facePanels()
    if (this.debugLookDownDeg !== 0 || this.debugCameraBackCm !== 0) this.applyDebugView()
    this.bodyMap.init()
    this.wire()
    this.enterPhase(this.sessionManager.phase)
    this.ready = true
    print("MasseurMain: ready")
  }

  private wire(): void {
    const m = this.sessionManager
    this.startMenu.onBodyPartSelected.add((id) => {
      m.selectBodyPart(id)
      this.syncMenu()
    })
    this.startMenu.onDurationSelected.add((min) => m.startSession(min))
    this.stepCard.onBackToMenu.add(() => m.returnToMenu())

    this.controlBar.onPauseToggle.add(() => m.togglePause())
    this.controlBar.onSlower.add(() => m.slower())
    this.controlBar.onFaster.add(() => m.faster())
    this.controlBar.onExtend.add(() => m.extendStep())
    this.controlBar.onNext.add(() => m.requestSkip())
    this.controlBar.onConfirmSkip.add(() => m.confirmSkip())
    this.controlBar.onCancelSkip.add(() => m.cancelSkip())

    m.onPhaseChanged.add((p) => this.enterPhase(p))
    m.onStepChanged.add((c) => this.onStep(c))
    m.onPausedChanged.add((p) => {
      this.stepCard.setPaused(p)
      this.controlBar.setPaused(p)
    })
    m.onPaceChanged.add(() => this.syncPace())
    m.onSkipConfirmChanged.add((p) => this.controlBar.setSkipConfirm(p))
    m.onStepExtended.add(() => this.stepCard.showNotice(`${m.extendMinutes} min added`))
    m.onBodyPartChanged.add(() => this.syncMenu())

    this.scan.onLandmarkRevealed.add((r) => this.landmarkLabels.showLabel(r.label, r.worldPos))
    this.scan.onScanComplete.add(() => this.onScanComplete())
  }

  private enterPhase(phase: SessionPhase): void {
    const m = this.sessionManager
    switch (phase) {
      case "menu":
        this.strokes.clear()
        this.ghostHands.hide()
        this.scan.clearAll()
        this.landmarkLabels.clear()
        this.stepCard.setPaused(false)
        this.stepCard.setVisible(false)
        this.controlBar.setVisible(false)
        this.startMenu.setVisible(true)
        this.syncMenu()
        break
      case "scanning":
        this.startMenu.setVisible(false)
        this.controlBar.setVisible(false)
        this.stepCard.setVisible(true)
        this.stepCard.setPaused(false)
        this.stepCard.showScan("Mapping back...", "Simulated scan")
        this.strokes.clear()
        this.ghostHands.hide()
        this.scan.startScan()
        break
      case "running":
        this.controlBar.setVisible(true)
        this.controlBar.setPaused(m.paused)
        this.controlBar.setSkipConfirm(m.skipConfirmPending)
        this.syncPace()
        this.introUntil = getTime() + this.introHintSec
        break
      case "complete": {
        this.strokes.clear()
        this.ghostHands.hide()
        this.controlBar.setVisible(false)
        this.audioController.playSessionChime()
        const minutes = Math.round(m.steps.reduce((a, s) => a + s.durationSec, 0) / 60)
        this.stepCard.showEndCard(`${minutes} min, ${m.steps.length} moves. Thank you.`)
        break
      }
    }
  }

  private onScanComplete(): void {
    this.stepCard.showScan("Back mapped", "Simulated scan")
    const ev = this.createEvent("DelayedCallbackEvent")
    ev.bind(() => {
      if (this.sessionManager.phase !== "scanning") return
      this.landmarkLabels.clear()
      this.scan.hideMarkers()
      this.sessionManager.beginSteps()
    })
    ev.reset(this.backMappedHoldSec)
  }

  private onStep(c: StepChange): void {
    const move = getMove(c.step.moveId)
    const layout = buildStrokeLayout(move, this.bodyMap, this.strokeLiftCm)
    this.strokes.showMove(layout)
    this.ghostHands.showMove(layout)
    this.stepCard.setStep(c.index, this.sessionManager.steps.length, move.name, move.handPart)
    this.stepCard.setTimeLeft(this.sessionManager.stepTimeLeftSec)
    if (c.reason !== "start") {
      this.audioController.playStepChime()
      this.stepCard.showNotice(`Next: ${move.name}`)
    }
  }

  private syncMenu(): void {
    const id = this.sessionManager.selectedBodyPart
    this.startMenu.setSelectedBodyPart(id)
    this.startMenu.setDurationsEnabled(id === "back")
  }

  private syncPace(): void {
    const m = this.sessionManager
    this.controlBar.setPace(m.pacePercent, m.pacePercent > m.minPacePercent, m.pacePercent < m.maxPacePercent)
  }

  private update(): void {
    if (!this.ready) return
    const m = this.sessionManager
    if (m.phase === "running") {
      this.stepCard.setTimeLeft(m.stepTimeLeftSec)
      this.strokes.setMotion(m.stepMotionTime)
      this.ghostHands.setMotion(m.stepMotionTime)
    }
    // edge hint: point toward the controls when they need attention and are out of view
    const ct = this.cameraObject.getTransform()
    const rot = ct.getWorldRotation()
    const camPos = ct.getWorldPosition()
    const fwd = rot.multiplyVec3(new vec3(0, 0, -1))
    const right = rot.multiplyVec3(new vec3(1, 0, 0))
    const toBar = this.controlBar.getSceneObject().getTransform().getWorldPosition().sub(camPos).normalize()
    const angle = (Math.acos(Math.max(-1, Math.min(1, fwd.dot(toBar)))) * 180) / Math.PI
    this.barInView = angle < this.barInViewDegrees
    const attention = m.phase === "running" && (m.paused || m.skipConfirmPending || getTime() < this.introUntil)
    const want = attention && !this.barInView
    if (want !== this.hintWanted || (want && Math.sign(right.dot(toBar)) !== this.edgeHint.side)) {
      this.hintWanted = want
      this.edgeHint.setVisible(want, right.dot(toBar) >= 0 ? 1 : -1)
    }
  }

  /** Puts the station's origin at the user's eyes, turned to the user's heading (yaw only). */
  private placeStation(): void {
    const ct = this.cameraObject.getTransform()
    const fwd = ct.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const flat = new vec3(fwd.x, 0, fwd.z)
    const yaw = flat.length > 1e-3 ? Math.atan2(-flat.x, -flat.z) : 0
    const st = this.station.getTransform()
    st.setWorldPosition(ct.getWorldPosition())
    st.setWorldRotation(quat.angleAxis(yaw, vec3.up()))
  }

  /** Debug: fixed seated camera pose for captures (applied after the station is placed). */
  private applyDebugView(): void {
    const cam = this.cameraObject
    const tracking = cam.getComponent("Component.DeviceTracking") as DeviceTracking
    if (tracking) tracking.enabled = false
    const t = cam.getTransform()
    const st = this.station.getTransform()
    const yaw = st.getWorldRotation()
    const back = yaw.multiplyVec3(new vec3(0, 0, 1)).uniformScale(this.debugCameraBackCm)
    t.setWorldPosition(st.getWorldPosition().add(back))
    t.setWorldRotation(yaw.multiply(quat.angleAxis((-this.debugLookDownDeg * Math.PI) / 180, vec3.right())))
  }

  /** Turns each panel so its front (+Z) faces the user's eyes. */
  private facePanels(): void {
    const eye = this.cameraObject.getTransform().getWorldPosition()
    for (const comp of [this.startMenu, this.stepCard, this.controlBar] as BaseScriptComponent[]) {
      const t = comp.getSceneObject().getTransform()
      const d = eye.sub(t.getWorldPosition())
      const horiz = Math.sqrt(d.x * d.x + d.z * d.z)
      const yaw = Math.atan2(d.x, d.z)
      const pitch = -Math.atan2(d.y, horiz)
      t.setWorldRotation(quat.angleAxis(yaw, vec3.up()).multiply(quat.angleAxis(pitch, vec3.right())))
    }
  }
}
