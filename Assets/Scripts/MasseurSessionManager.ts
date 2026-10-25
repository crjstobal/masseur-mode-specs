/**
 * MasseurSessionManager - single owner of the massage session state.
 *
 * Owns: phase (menu / scanning / running / complete), chosen body part and
 * duration, the composed step list, the current step and its time left, pace,
 * pause, the skip-confirm window, and the "motion clock" that drives the pulse
 * and the ghost hands (it advances with pace and stops while paused).
 *
 * Everything is exposed read-only so LEAF scenarios can assert on it, and the
 * Debug group adds a time scale plus fast-forward helpers so step expiry can
 * be tested without waiting minutes.
 *
 * Inputs: tunable rules only (pace step, pace range, +time amount, skip timeout).
 * Must not: touch UI, meshes or audio. Main listens to the events and pushes
 * state into the views.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {composeSession, StepDef, SUPPORTED_DURATIONS} from "./MasseurSessionPlans"

export type SessionPhase = "menu" | "scanning" | "running" | "complete"
export type StepChangeReason = "start" | "timer" | "skip"

export interface StepChange {
  index: number
  previousIndex: number
  reason: StepChangeReason
  step: StepDef
}

/** Body parts shown on the start menu. Only "back" is implemented. */
export const BODY_PARTS: {id: string; label: string; available: boolean}[] = [
  {id: "back", label: "Back", available: true},
  {id: "neck", label: "Neck & shoulders", available: false},
  {id: "feet", label: "Feet", available: false},
  {id: "legs", label: "Legs", available: false},
  {id: "arms", label: "Arms", available: false},
  {id: "hands", label: "Hands", available: false},
]

@component
export class MasseurSessionManager extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurSessionManager - session state, timer and pace</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Pace change per Slower / Faster press, in percent")
  @widget(new SliderWidget(5, 30, 1))
  paceStepPercent: number = 15

  @input
  @hint("Slowest allowed pace, in percent")
  @widget(new SliderWidget(25, 100, 5))
  minPacePercent: number = 50

  @input
  @hint("Fastest allowed pace, in percent")
  @widget(new SliderWidget(100, 200, 5))
  maxPacePercent: number = 150

  @input
  @hint("Minutes added to the current step by the +2 min button")
  @widget(new SliderWidget(1, 5, 1))
  extendMinutes: number = 2

  @input
  @hint("Seconds before an unanswered 'Skip step?' cancels itself")
  @widget(new SliderWidget(2, 10, 0.5))
  skipConfirmTimeoutSec: number = 4
  @ui.group_end

  @ui.separator
  @ui.group_start("Debug")
  @input
  @hint("Multiplies how fast session time passes (tests and demos). 1 = real time")
  @widget(new SliderWidget(1, 120, 1))
  debugTimeScale: number = 1
  @ui.group_end

  // ---- Public read-only state (asserted by LEAF scenarios) ----
  private _phase: SessionPhase = "menu"
  private _selectedBodyPart: string = ""
  private _sessionMinutes: number = 0
  private _steps: StepDef[] = []
  private _currentStepIndex: number = -1
  private _stepTimeLeftSec: number = 0
  private _pacePercent: number = 100
  private _paused: boolean = false
  private _skipConfirmPending: boolean = false
  private _skipConfirmTimeLeftSec: number = 0
  private _motionTime: number = 0
  private _stepMotionTime: number = 0
  private _sessionStartTime: number = 0

  get phase(): SessionPhase { return this._phase }
  get selectedBodyPart(): string { return this._selectedBodyPart }
  get sessionMinutes(): number { return this._sessionMinutes }
  /** Copy of the composed step list (durationSec includes any +2 min extensions). */
  get steps(): StepDef[] { return this._steps.map((s) => ({...s})) }
  get stepIds(): string[] { return this._steps.map((s) => s.moveId) }
  get currentStepIndex(): number { return this._currentStepIndex }
  get currentStep(): StepDef | null { return this._steps[this._currentStepIndex] ?? null }
  get stepTimeLeftSec(): number { return this._stepTimeLeftSec }
  get sessionTimeLeftSec(): number {
    let t = Math.max(0, this._stepTimeLeftSec)
    for (let i = this._currentStepIndex + 1; i < this._steps.length; i++) t += this._steps[i].durationSec
    return this._phase === "running" ? t : 0
  }
  get pacePercent(): number { return this._pacePercent }
  get pace(): number { return this._pacePercent / 100 }
  get paused(): boolean { return this._paused }
  get skipConfirmPending(): boolean { return this._skipConfirmPending }
  get skipConfirmTimeLeftSec(): number { return this._skipConfirmTimeLeftSec }
  /** Clock for pulse and ghost hands: advances with pace, frozen while paused. */
  get motionTime(): number { return this._motionTime }
  /** Motion clock since the current step began. */
  get stepMotionTime(): number { return this._stepMotionTime }
  /** Seconds of session time since the first step began. */
  get sessionElapsedSec(): number { return this._sessionStartTime }

  // ---- Events ----
  private _onPhaseChanged = new Event<SessionPhase>()
  private _onStepChanged = new Event<StepChange>()
  private _onPaceChanged = new Event<number>()
  private _onPausedChanged = new Event<boolean>()
  private _onSkipConfirmChanged = new Event<boolean>()
  private _onStepExtended = new Event<number>()
  private _onBodyPartChanged = new Event<string>()
  get onPhaseChanged(): PublicApi<SessionPhase> { return this._onPhaseChanged.publicApi() }
  get onStepChanged(): PublicApi<StepChange> { return this._onStepChanged.publicApi() }
  get onPaceChanged(): PublicApi<number> { return this._onPaceChanged.publicApi() }
  get onPausedChanged(): PublicApi<boolean> { return this._onPausedChanged.publicApi() }
  get onSkipConfirmChanged(): PublicApi<boolean> { return this._onSkipConfirmChanged.publicApi() }
  get onStepExtended(): PublicApi<number> { return this._onStepExtended.publicApi() }
  get onBodyPartChanged(): PublicApi<string> { return this._onBodyPartChanged.publicApi() }

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => this.tick(getDeltaTime()))
  }

  // ---- Menu ----

  /** Returns true when the body part is available and is now selected. */
  selectBodyPart(id: string): boolean {
    if (this._phase !== "menu") return false
    const part = BODY_PARTS.find((p) => p.id === id)
    if (!part || !part.available) return false
    this._selectedBodyPart = id
    this._onBodyPartChanged.invoke(id)
    return true
  }

  /** Composes the session and enters the scanning phase. Requires "back" to be selected. */
  startSession(minutes: number): boolean {
    if (this._phase !== "menu") return false
    if (this._selectedBodyPart !== "back") return false
    if (SUPPORTED_DURATIONS.indexOf(minutes) < 0) return false
    this._steps = composeSession(minutes)
    this._sessionMinutes = minutes
    this._currentStepIndex = -1
    this._stepTimeLeftSec = 0
    this._pacePercent = 100
    this._paused = false
    this._motionTime = 0
    this._stepMotionTime = 0
    this._sessionStartTime = 0
    this.setSkipPending(false)
    this.setPhase("scanning")
    return true
  }

  /** Called when the simulated scan finished: starts the first step. */
  beginSteps(): void {
    if (this._phase !== "scanning") return
    this.setPhase("running")
    this.goToStep(0, "start")
  }

  /** Back to the start menu from anywhere (end card button, tests). */
  returnToMenu(): void {
    this._steps = []
    this._sessionMinutes = 0
    this._currentStepIndex = -1
    this._stepTimeLeftSec = 0
    this._selectedBodyPart = ""
    this._onBodyPartChanged.invoke("")
    if (this._paused) {
      this._paused = false
      this._onPausedChanged.invoke(false)
    }
    this.setSkipPending(false)
    this.setPhase("menu")
  }

  // ---- Controls ----

  togglePause(): void {
    this.setPaused(!this._paused)
  }

  setPaused(paused: boolean): void {
    if (this._phase !== "running" || this._paused === paused) return
    this._paused = paused
    this._onPausedChanged.invoke(paused)
  }

  slower(): void {
    this.setPacePercent(this._pacePercent - this.paceStepPercent)
  }

  faster(): void {
    this.setPacePercent(this._pacePercent + this.paceStepPercent)
  }

  setPacePercent(pct: number): void {
    if (this._phase !== "running") return
    const clamped = Math.max(this.minPacePercent, Math.min(this.maxPacePercent, Math.round(pct)))
    if (clamped === this._pacePercent) return
    this._pacePercent = clamped
    this._onPaceChanged.invoke(clamped)
  }

  /** Adds extendMinutes to the current step (and therefore to the session). */
  extendStep(): void {
    if (this._phase !== "running" || this._currentStepIndex < 0) return
    const add = this.extendMinutes * 60
    this._stepTimeLeftSec += add
    this._steps[this._currentStepIndex].durationSec += add
    this._onStepExtended.invoke(this._currentStepIndex)
  }

  /** First press of Next: opens the confirm window. */
  requestSkip(): void {
    if (this._phase !== "running") return
    this.setSkipPending(true)
  }

  confirmSkip(): void {
    if (!this._skipConfirmPending) return
    this.setSkipPending(false)
    this.advance("skip")
  }

  cancelSkip(): void {
    this.setSkipPending(false)
  }

  // ---- Debug / test hooks ----

  /** Advances session time by the given seconds (respects pause like real time). */
  debugFastForward(seconds: number): void {
    let remaining = seconds
    while (remaining > 0) {
      const dt = Math.min(remaining, 1)
      this.step(dt, dt)
      remaining -= dt
    }
  }

  /** Puts the current step one second from its end. */
  debugExpireSoon(secondsLeft: number = 1): void {
    if (this._phase === "running") this._stepTimeLeftSec = Math.min(this._stepTimeLeftSec, secondsLeft)
  }

  // ---- Internals ----

  private tick(dt: number): void {
    const scaled = dt * Math.max(0, this.debugTimeScale)
    this.step(scaled, dt)
  }

  /** sessionDt: session seconds to apply. realDt: wall seconds (skip window). */
  private step(sessionDt: number, realDt: number): void {
    if (this._skipConfirmPending) {
      this._skipConfirmTimeLeftSec -= realDt
      if (this._skipConfirmTimeLeftSec <= 0) this.setSkipPending(false)
    }
    if (this._phase !== "running" || this._paused) return
    this._stepTimeLeftSec -= sessionDt
    this._sessionStartTime += sessionDt
    const m = sessionDt * this.pace
    this._motionTime += m
    this._stepMotionTime += m
    if (this._stepTimeLeftSec <= 0) this.advance("timer")
  }

  private advance(reason: StepChangeReason): void {
    const next = this._currentStepIndex + 1
    if (next >= this._steps.length) {
      this._stepTimeLeftSec = 0
      this.setSkipPending(false)
      this.setPhase("complete")
      return
    }
    this.goToStep(next, reason)
  }

  private goToStep(index: number, reason: StepChangeReason): void {
    const prev = this._currentStepIndex
    this._currentStepIndex = index
    this._stepTimeLeftSec = this._steps[index].durationSec
    this._stepMotionTime = 0
    this._onStepChanged.invoke({index, previousIndex: prev, reason, step: {...this._steps[index]}})
  }

  private setSkipPending(pending: boolean): void {
    this._skipConfirmTimeLeftSec = pending ? this.skipConfirmTimeoutSec : 0
    if (this._skipConfirmPending === pending) return
    this._skipConfirmPending = pending
    this._onSkipConfirmChanged.invoke(pending)
  }

  private setPhase(phase: SessionPhase): void {
    if (this._phase === phase) return
    this._phase = phase
    this._onPhaseChanged.invoke(phase)
  }
}
