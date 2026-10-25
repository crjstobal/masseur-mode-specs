/**
 * Done criterion 3: the neon strokes and the pulse stay anchored on the
 * mannequin's back while the camera moves a little (small steps and look
 * around): they don't slide with the view.
 *
 * The test moves and turns the camera, then checks that the stroke's world
 * position and its position relative to the mannequin did not change, and
 * that the stroke is not parented under the camera.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {app, log, startRunning, check} from "./MasseurLeafUtils"

@component
export class MasseurC3AnchorScenario extends Scenario {
  async run(): Promise<void> {
    await startRunning(10, this)
    await sleep(1200)
    const strokes = app.strokes()
    const mannequin = findSceneObjectByName("Mannequin").getTransform()
    const cam = findSceneObjectByName("Camera Object").getTransform()

    // not attached to the camera
    let p = strokes.getSceneObject().getParent()
    while (p) {
      expect(p.name === "Camera Object").toBe(false)
      p = p.getParent()
    }

    const a0 = strokes.getAnchorWorldPoint()
    check("a0 !== null", a0 !== null)
    const local0 = mannequin.getInvertedWorldTransform().multiplyPoint(a0)
    const pulse0 = strokes.pulseProgress

    // DeviceTracking drives the camera every frame in the preview; pause it so the
    // scripted head movement actually moves the camera, then restore it.
    const tracking = findSceneObjectByName("Camera Object").getComponent("Component.DeviceTracking") as DeviceTracking
    const trackingWasEnabled = tracking ? tracking.enabled : false
    if (tracking) tracking.enabled = false
    const camPos0 = cam.getWorldPosition()
    const camRot0 = cam.getWorldRotation()
    const offsets = [new vec3(6, 0, 0), new vec3(-6, 0, 4), new vec3(0, 3, -4)]
    let maxDrift = 0
    let camMoved = 0
    for (const o of offsets) {
      cam.setWorldPosition(camPos0.add(o))
      cam.setWorldRotation(camRot0.multiply(quat.angleAxis(0.15, vec3.up())))
      await sleep(400)
      camMoved = Math.max(camMoved, cam.getWorldPosition().distance(camPos0))
      const a = strokes.getAnchorWorldPoint()
      maxDrift = Math.max(maxDrift, a.distance(a0))
      const local = mannequin.getInvertedWorldTransform().multiplyPoint(a)
      check("local.distance(local0) < 0.01", local.distance(local0) < 0.01)
    }
    cam.setWorldPosition(camPos0)
    cam.setWorldRotation(camRot0)
    if (tracking) tracking.enabled = trackingWasEnabled
    check("camMoved > 3", camMoved > 3)
    check("maxDrift < 0.01", maxDrift < 0.01)
    // the pulse keeps travelling along the same stroke
    check("strokes.pulseProgress !== pulse0", strokes.pulseProgress !== pulse0)
    log(`C3 camera moved up to ${camMoved.toFixed(1)} cm, stroke drift ${maxDrift.toFixed(4)} cm`)
  }
}
