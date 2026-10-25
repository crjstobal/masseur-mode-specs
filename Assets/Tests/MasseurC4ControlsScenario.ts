/**
 * Done criterion 4: every control on the side bar is visible when turning
 * toward it and works: Pause freezes the timer and pulse and Resume continues;
 * Slower and Faster change the pace label and the pulse speed; +2 min adds
 * 2:00 to the step's time left; Next only skips after Confirm, and Cancel (or
 * waiting 4 s) keeps the step.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findInteractableByName, isEnabled} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {app, log, startRunning, tap, waitFor, check} from "./MasseurLeafUtils"

@component
export class MasseurC4ControlsScenario extends Scenario {
  async run(): Promise<void> {
    await startRunning(20, this)
    const m = app.manager()
    const bar = app.controlBar()
    const card = app.stepCard()

    // Visible and facing the user (buttons create their Interactables on the first frame they are shown)
    check("bar.getSceneObject().enabled", bar.getSceneObject().enabled)
    await waitFor("control bar buttons ready", () => ["Ctrl_Pause", "Ctrl_Extend", "Ctrl_Next", "Ctrl_Slower", "Ctrl_Faster"].every((n) => isEnabled(findInteractableByName(n))), 2000)
    for (const n of ["Ctrl_Pause", "Ctrl_Extend", "Ctrl_Next", "Ctrl_Slower", "Ctrl_Faster"]) {
      check("isEnabled(findInteractableByName(n))", isEnabled(findInteractableByName(n)))
    }
    const camPos = findSceneObjectByName("Camera Object").getTransform().getWorldPosition()
    const bt = bar.getSceneObject().getTransform()
    const front = bt.getWorldRotation().multiplyVec3(vec3.forward())
    const toEye = camPos.sub(bt.getWorldPosition()).normalize()
    check("front.dot(toEye) > 0.95", front.dot(toEye) > 0.95)

    // Pause freezes timer and pulse
    await tap("Ctrl_Pause")
    check("m.paused", m.paused)
    expect(card.statusText).toBe("Paused")
    expect(bar.pauseLabelText).toBe("Resume")
    const t0 = m.stepTimeLeftSec
    const motion0 = m.motionTime
    const pulse0 = app.strokes().pulseProgress
    await sleep(1200)
    expect(m.stepTimeLeftSec).toBe(t0)
    expect(m.motionTime).toBe(motion0)
    expect(app.strokes().pulseProgress).toBe(pulse0)
    // Resume continues
    await tap("Ctrl_Pause")
    expect(m.paused).toBe(false)
    expect(bar.pauseLabelText).toBe("Pause")
    await sleep(800)
    check("m.stepTimeLeftSec < t0", m.stepTimeLeftSec < t0)
    check("m.motionTime > motion0", m.motionTime > motion0)

    // Slower / Faster: label and pulse speed
    const pace0 = m.pacePercent
    await tap("Ctrl_Slower")
    expect(m.pacePercent).toBe(pace0 - 15)
    expect(bar.paceLabelText).toBe(`Pace ${pace0 - 15}%`)
    const rateSlow = await this.measureRate()
    await tap("Ctrl_Faster")
    await tap("Ctrl_Faster")
    expect(m.pacePercent).toBe(pace0 + 15)
    expect(bar.paceLabelText).toBe(`Pace ${pace0 + 15}%`)
    const rateFast = await this.measureRate()
    check("Math.abs(rateSlow - 0.85) < 0.12", Math.abs(rateSlow - 0.85) < 0.12)
    check("Math.abs(rateFast - 1.15) < 0.12", Math.abs(rateFast - 1.15) < 0.12)
    check("rateFast > rateSlow", rateFast > rateSlow)
    // limits: 50% .. 150%
    for (let i = 0; i < 10; i++) m.slower()
    expect(m.pacePercent).toBe(50)
    for (let i = 0; i < 10; i++) m.faster()
    expect(m.pacePercent).toBe(150)
    m.setPacePercent(100)

    // +2 min
    const before = m.stepTimeLeftSec
    const tBefore = getTime()
    await tap("Ctrl_Extend")
    // the step clock keeps running during the tap, so allow for the real time it took
    const elapsed = (getTime() - tBefore) * m.debugTimeScale
    const gained = m.stepTimeLeftSec - before + elapsed
    log(`C4 +2 min gained ${gained.toFixed(2)} s (tap took ${elapsed.toFixed(2)} s)`)
    check("+2 min adds 120 s to the step", Math.abs(gained - 120) < 0.6)

    // Next -> Cancel keeps the step (long window so a slow preview frame rate cannot auto-cancel first)
    const idx = m.currentStepIndex
    const timeout0 = m.skipConfirmTimeoutSec
    m.skipConfirmTimeoutSec = 30
    await tap("Ctrl_Next")
    check("m.skipConfirmPending", m.skipConfirmPending)
    check("bar.confirmVisible", bar.confirmVisible)
    expect(m.currentStepIndex).toBe(idx)
    await sleep(300)
    await tap("Ctrl_CancelSkip")
    expect(m.skipConfirmPending).toBe(false)
    expect(m.currentStepIndex).toBe(idx)

    // Next -> waiting 4 s keeps the step (the brief's default timeout, measured from the press)
    m.skipConfirmTimeoutSec = timeout0
    let opened = false
    const unsub = m.onSkipConfirmChanged.add((p) => { if (p) opened = true })
    await tap("Ctrl_Next")
    unsub()
    check("Next opened 'Skip step?'", opened)
    await sleep(4600)
    expect(m.skipConfirmPending).toBe(false)
    expect(bar.confirmVisible).toBe(false)
    expect(m.currentStepIndex).toBe(idx)

    // Next -> Confirm skips
    m.skipConfirmTimeoutSec = 30
    await tap("Ctrl_Next")
    await sleep(300)
    await tap("Ctrl_ConfirmSkip")
    await waitFor("skipped", () => m.currentStepIndex === idx + 1, 3000)
    m.skipConfirmTimeoutSec = timeout0
    expect(m.currentStepIndex).toBe(idx + 1)
    log(`C4 pulse rate slow=${rateSlow.toFixed(2)} fast=${rateFast.toFixed(2)}, skipped to step ${m.currentStepIndex + 1}`)
  }

  /** Motion-clock seconds per real second (= pulse speed relative to 100%). */
  private async measureRate(): Promise<number> {
    const m = app.manager()
    const a = m.motionTime
    const ta = getTime()
    await sleep(1500)
    return (m.motionTime - a) / Math.max(1e-3, getTime() - ta)
  }
}
