/**
 * Done criterion 5: when a step's time ends, the zen chime plays, the card
 * briefly shows the next step's name, and the next stroke and ghost hands
 * appear on the back. Also runs a whole 10 min session at high time scale
 * to the end card and back to the menu.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getMove} from "../Scripts/MasseurMoveLibrary"
import {app, log, startRunning, tap, waitFor, check} from "./MasseurLeafUtils"

@component
export class MasseurC5StepEndScenario extends Scenario {
  async run(): Promise<void> {
    await startRunning(10, this)
    const m = app.manager()
    const audio = app.audio()
    const card = app.stepCard()
    await waitFor("ghost hands at step start", () => app.ghost().isShowing, 3000).catch((e) => {
      const g = app.ghost()
      throw new Error(`${e} (pose="${g.currentPose}", hands=${g.visibleHandCount}, step motion=${m.stepMotionTime.toFixed(2)})`)
    })

    const idx = m.currentStepIndex
    const chimes = audio.stepChimeCount
    m.debugExpireSoon(1)
    await waitFor("step timer ended", () => m.currentStepIndex === idx + 1, 3000)
    const next = m.currentStep
    const move = getMove(next.moveId)
    expect(audio.stepChimeCount).toBe(chimes + 1)
    expect(audio.lastCue).toBe("step")
    expect(card.statusText).toBe(`Next: ${move.name}`)
    expect(card.titleText).toBe(move.name)

    await waitFor("new stroke drawn", () => app.strokes().currentMoveId === next.moveId && app.strokes().isVisible, 3000)
    await sleep(400)
    const ghost = app.ghost()
    check("ghost.isShowing", ghost.isShowing)
    expect(ghost.currentPose).toBe(move.pose)
    expect(ghost.visibleHandCount).toBe(2)
    // the notice is brief
    await sleep(3400)
    expect(card.statusText.indexOf("Next:") === 0).toBe(false)

    // run the rest of the session fast: end card, session chime, back to menu
    const sessionChimes = audio.sessionChimeCount
    m.debugTimeScale = 400
    await waitFor("session complete", () => m.phase === "complete", 15000)
    m.debugTimeScale = 1
    expect(audio.sessionChimeCount).toBe(sessionChimes + 1)
    await sleep(300)
    check("card.endCardVisible", card.endCardVisible)
    await tap("EndCard_BackToMenu")
    await waitFor("menu", () => m.phase === "menu", 2000)
    log(`C5 chime on change ok, next step "${move.name}", end card ok`)
  }
}
