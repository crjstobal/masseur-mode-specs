/**
 * Done criterion 1: on the start menu, pinching "Back" selects it, the other
 * body parts show "Coming soon" and can't be started, and pinching each of
 * 10, 20, 40 and 60 min starts a session whose step list matches that
 * duration's plan.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findInteractableByName, isEnabled} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName} from "Leaf.lspkg/Utils/common/Utils"
import {SESSION_PLANS} from "../Scripts/MasseurSessionPlans"
import {app, log, resetToMenu, tap, waitFor, check} from "./MasseurLeafUtils"

@component
export class MasseurC1MenuScenario extends Scenario {
  async run(): Promise<void> {
    await resetToMenu(this)
    const m = app.manager()
    check("findSceneObjectByName(\"StartMenu\").enabled", findSceneObjectByName("StartMenu").enabled)

    // Other body parts: visible, labelled "Coming soon", not pinchable, not selectable
    for (const id of ["neck", "feet", "legs", "arms", "hands"]) {
      const part = findSceneObjectByName(`BodyPart_${id}`)
      check("part !== null && part !== undefined", part !== null && part !== undefined)
      const status = findSceneObject(part, "Status")
      expect(status.text).toBe("Coming soon")
      expect(isEnabled(findInteractableByName(`BodyPart_${id}`))).toBe(false)
      expect(m.selectBodyPart(id)).toBe(false)
    }
    expect(m.selectedBodyPart).toBe("")

    // Durations do nothing until a body part is chosen
    expect(isEnabled(findInteractableByName("Duration_10"))).toBe(false)

    // Pinch Back -> selected
    await tap("BodyPart_back")
    expect(m.selectedBodyPart).toBe("back")

    // Each duration starts a session with that plan
    for (const min of [10, 20, 40, 60]) {
      await resetToMenu()
      await tap("BodyPart_back")
      await tap(`Duration_${min}`)
      await waitFor(`session ${min} started`, () => m.phase === "scanning" || m.phase === "running", 3000)
      const expected = SESSION_PLANS[min].map((p) => p[0])
      expect(m.stepIds.join(",")).toBe(expected.join(","))
      const durations = m.steps.map((s) => s.durationSec / 60)
      expect(durations.join(",")).toBe(SESSION_PLANS[min].map((p) => p[1]).join(","))
      expect(m.sessionMinutes).toBe(min)
      log(`C1 ${min} min -> ${m.stepIds.length} steps: ${m.stepIds.join(", ")}`)
    }
    await resetToMenu()
  }
}

function findSceneObject(root: SceneObject, name: string): Text {
  const stack: SceneObject[] = [root]
  while (stack.length) {
    const so = stack.pop()
    if (so.name === name) return so.getComponent("Component.Text") as Text
    for (let i = 0; i < so.getChildrenCount(); i++) stack.push(so.getChild(i))
  }
  throw new Error(`"${name}" not found under ${root.name}`)
}
