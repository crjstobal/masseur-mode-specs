/**
 * Done criterion 2: after picking a duration, the scan sweeps over the
 * mannequin's back, the landmark dots appear, the card reads "Back mapped",
 * and the first neon stroke appears on the back.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {app, log, resetToMenu, tap, waitFor, check} from "./MasseurLeafUtils"

@component
export class MasseurC2ScanScenario extends Scenario {
  async run(): Promise<void> {
    await resetToMenu(this)
    await tap("BodyPart_back")
    await tap("Duration_10")
    const m = app.manager()
    const scan = app.scan()
    const card = app.stepCard()

    expect(m.phase).toBe("scanning")
    check("scan.isScanning", scan.isScanning)
    expect(card.titleText).toBe("Mapping back...")

    // the band sweeps: progress grows, dots and labels appear one by one
    const p0 = scan.progress
    await sleep(1200)
    check("scan.progress > p0", scan.progress > p0)
    check("scan.revealedCount > 0", scan.revealedCount > 0)
    check("scan.revealedCount < scan.landmarkCount", scan.revealedCount < scan.landmarkCount)
    check("app.labels().labelCount > 0", app.labels().labelCount > 0)

    let sawBackMapped = false
    let maxRevealed = 0
    await waitFor("first step", () => {
      maxRevealed = Math.max(maxRevealed, scan.revealedCount)
      if (card.titleText === "Back mapped") sawBackMapped = true
      return m.phase === "running"
    }, 8000)
    expect(maxRevealed).toBe(9)
    check("sawBackMapped", sawBackMapped)

    await waitFor("stroke drawn", () => app.strokes().isVisible, 3000)
    expect(app.strokes().currentMoveId).toBe("opening_glide")
    expect(m.currentStepIndex).toBe(0)
    expect(card.titleText).toBe("Opening glide")
    log(`C2 landmarks revealed: ${maxRevealed}, first stroke: ${app.strokes().currentMoveId}`)
    await resetToMenu()
  }
}
