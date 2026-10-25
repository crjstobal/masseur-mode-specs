/**
 * MasseurScenarioClient - runs the registered LEAF scenarios in the preview
 * one after another and prints a PASSED / FAILED line for each, plus a
 * summary. Keep its SceneObject disabled for normal use; enable it (or set
 * autoRun) to run the suite when the preview starts.
 */
import {DefaultScenarioManager} from "Leaf.lspkg/Scenarios/scenario/manager/DefaultLeafScenarioManager"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"

@component
export class MasseurScenarioClient extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurScenarioClient - runs the LEAF suite in preview</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Run all scenarios when the preview starts")
  autoRun: boolean = true
  @input
  @hint("Only run scenarios whose id contains one of these comma-separated words (empty = all)")
  filter: string = ""
  @ui.group_end
  private manager = DefaultScenarioManager.getInstance()

  onAwake(): void {
    if (!this.autoRun) return
    this.runAll()
      .then((r) => print(`[MasseurLeaf] SUMMARY passed=${r.passed.join(",")} failed=${r.failed.join(",")}`))
      .catch((e) => print(`[MasseurLeaf] SUMMARY error ${e}`))
  }

  private async runAll(): Promise<{passed: string[]; failed: string[]}> {
    const passed: string[] = []
    const failed: string[] = []
    await sleep(2500)
    for (const id of this.manager.listScenarioIds()) {
      const words = this.filter.split(",").map((w) => w.trim()).filter((w) => w.length > 0)
      if (words.length && !words.some((w) => id.indexOf(w) >= 0)) continue
      await sleep(500)
      try {
        await this.manager.startScenario(id)
        passed.push(id)
        print(`[MasseurLeaf] RESULT PASSED ${id}`)
      } catch (e) {
        failed.push(id)
        print(`[MasseurLeaf] RESULT FAILED ${id}: ${e}`)
      }
    }
    return {passed, failed}
  }
}
