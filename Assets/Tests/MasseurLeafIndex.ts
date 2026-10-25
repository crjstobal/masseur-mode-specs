/**
 * MasseurLeafIndex - registers the Masseur Mode LEAF scenarios (one per done
 * criterion in devpost/design-brief.md, plus an IK reachability check).
 */
import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {MasseurC1MenuScenario} from "./MasseurC1MenuScenario"
import {MasseurC2ScanScenario} from "./MasseurC2ScanScenario"
import {MasseurC3AnchorScenario} from "./MasseurC3AnchorScenario"
import {MasseurC4ControlsScenario} from "./MasseurC4ControlsScenario"
import {MasseurC5StepEndScenario} from "./MasseurC5StepEndScenario"
import {MasseurReachScenario} from "./MasseurReachScenario"

@component
export class MasseurLeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "c1-start-menu", typename: MasseurC1MenuScenario.getTypeName()},
    {id: "c2-simulated-scan", typename: MasseurC2ScanScenario.getTypeName()},
    {id: "c3-strokes-anchored", typename: MasseurC3AnchorScenario.getTypeName()},
    {id: "c4-control-bar", typename: MasseurC4ControlsScenario.getTypeName()},
    {id: "c5-step-end", typename: MasseurC5StepEndScenario.getTypeName()},
    {id: "reach-ik", typename: MasseurReachScenario.getTypeName()},
  ]
}
