/**
 * Reachability check (supports criteria 1 and 4): an IK avatar physically
 * reaches for the start menu and the side control bar and pinches them the
 * way a seated user would. A reach that fails or does not converge is a real
 * finding about placement, not a test bug. Each reach has its own timeout so
 * the report says exactly which control could not be reached.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {findSceneObjectByName, sleep, withTimeout} from "Leaf.lspkg/Utils/common/Utils"
import {app, check, log, resetToMenu, waitFor} from "./MasseurLeafUtils"

@component
export class MasseurReachScenario extends Scenario {
  private readonly ik = createIKInteractor()
  private reached: string[] = []
  private missed: string[] = []

  async run(): Promise<void> {
    await resetToMenu(this)
    const m = app.manager()

    await this.reach("BodyPart_back")
    check("Back selected by IK pinch", m.selectedBodyPart === "back")
    await this.reach("Duration_10")
    if (m.phase === "menu") m.startSession(10) // keep going so the side bar can be checked
    await waitFor("running", () => m.phase === "running", 12000)
    await sleep(1000)
    for (const name of ["Ctrl_Pause", "Ctrl_Next", "Ctrl_Slower", "Ctrl_Faster"]) await this.reach(name)

    log(`Reach: reached=[${this.reached.join(", ")}] missed=[${this.missed.join(", ")}]`)
    m.cancelSkip()
    m.setPaused(false)
    await resetToMenu()
    check(`all controls reachable (missed: ${this.missed.join(", ")})`, this.missed.length === 0)
  }

  private async reach(name: string): Promise<void> {
    const target = findInteractableByName(name, undefined, true)
    if (!target) {
      this.missed.push(`${name} (not enabled)`)
      return
    }
    // a seated user pinches with the hand on the target's side (no cross-body reaches)
    const cam = findSceneObjectByName("Camera Object").getTransform()
    const right = cam.getWorldRotation().multiplyVec3(new vec3(1, 0, 0))
    const side = target.getSceneObject().getTransform().getWorldPosition().sub(cam.getWorldPosition()).dot(right)
    const hand = side < -3 ? "left" : "right"
    try {
      await withTimeout(this.ik.trigger(target, hand), 15000, `IK reach to ${name} did not converge`)
      this.reached.push(`${name} (${hand})`)
    } catch (e) {
      this.missed.push(name)
      log(`Reach: ${e}`)
    }
    await sleep(1200) // let the arm settle before the next reach
  }
}
