/**
 * Demo run for the submission video (not a done-criterion test).
 *
 * Plays one scripted session from the user's seat: start menu, Back, 10 min,
 * the simulated scan, the first step with its ghost hands, every control on
 * the side bar, a step change with the chime, and the end card. The camera is
 * moved smoothly by script (DeviceTracking paused, as in the C3 test) so the
 * screen recording reads like a person turning their head. Step changes are
 * brought forward with the session manager's debug hooks so the video does not
 * wait out whole steps.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {app, log, resetToMenu, tap, waitFor} from "./MasseurLeafUtils"

const DEG = Math.PI / 180

/** Head pose from the seat: yaw > 0 turns right, pitch < 0 looks down (degrees). */
function headRot(yawDeg: number, pitchDeg: number): quat {
  return quat.angleAxis(-yawDeg * DEG, vec3.up()).multiply(quat.angleAxis(pitchDeg * DEG, vec3.right()))
}

@component
export class MasseurDemoScenario extends Scenario {
  private cam: Transform

  async run(): Promise<void> {
    await resetToMenu(this)
    const m = app.manager()
    const camObj = findSceneObjectByName("Camera Object")
    this.cam = camObj.getTransform()
    const tracking = camObj.getComponent("Component.DeviceTracking") as DeviceTracking
    const trackingWasEnabled = tracking ? tracking.enabled : false
    if (tracking) tracking.enabled = false

    try {
      // Start menu
      this.cam.setWorldRotation(headRot(0, -22))
      log("DEMO menu")
      await sleep(4000)
      await tap("BodyPart_back")
      await sleep(1500)
      await tap("Duration_10")

      // Scan, then the first step on the back (ghost hands do the move twice)
      log("DEMO scan")
      await this.turn(0, -40, 2500)
      await waitFor("first step running", () => m.phase === "running", 12000)
      log("DEMO step1")
      await sleep(17000)

      // Side bar
      log("DEMO controls")
      await this.turn(64, -48, 2000)
      await sleep(1500)
      await tap("Ctrl_Slower")
      await sleep(1200)
      await tap("Ctrl_Slower")
      await sleep(1800)
      await tap("Ctrl_Pause")
      await sleep(2500)
      await tap("Ctrl_Pause")
      await sleep(1500)
      await tap("Ctrl_Extend")
      await sleep(2500)
      await tap("Ctrl_Next")
      await sleep(1800)
      await tap("Ctrl_ConfirmSkip")
      await sleep(1000)

      // Step 2 with its ghost hands
      log("DEMO step2")
      await this.turn(0, -40, 2000)
      await sleep(12000)

      // A step ending on its own: chime and "Next: ..." notice
      log("DEMO stepchange")
      m.debugExpireSoon(2.5)
      await sleep(8000)

      // Jump to the last step and let it end: end card
      log("DEMO end")
      m.requestSkip()
      m.confirmSkip()
      await sleep(3000)
      m.debugExpireSoon(2)
      await waitFor("session complete", () => m.phase === "complete", 8000)
      await sleep(7000)
      log("DEMO done")
    } finally {
      if (tracking) tracking.enabled = trackingWasEnabled
    }
  }

  /** Smoothly turns the head to the given pose over durationMs (ease in and out). */
  private async turn(yawDeg: number, pitchDeg: number, durationMs: number): Promise<void> {
    const from = this.cam.getWorldRotation()
    const to = headRot(yawDeg, pitchDeg)
    const steps = Math.max(1, Math.round(durationMs / 33))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const e = t * t * (3 - 2 * t)
      this.cam.setWorldRotation(quat.slerp(from, to, e))
      await sleep(33)
    }
  }
}
