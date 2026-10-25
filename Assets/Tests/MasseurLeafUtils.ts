/**
 * MasseurLeafUtils - shared helpers for the Masseur Mode LEAF scenarios.
 * Looks components up by the SceneObject names authored in the scene, taps
 * UIKit buttons by name through the LEAF interactor, and polls for state.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {MasseurAudioController} from "../Scripts/MasseurAudioController"
import {MasseurControlBarUI} from "../Scripts/MasseurControlBarUI"
import {MasseurGhostHands} from "../Scripts/MasseurGhostHands"
import {MasseurLandmarkLabelsUI} from "../Scripts/MasseurLandmarkLabelsUI"
import {MasseurMain} from "../Scripts/MasseurMain"
import {MasseurScanController} from "../Scripts/MasseurScanController"
import {MasseurSessionManager} from "../Scripts/MasseurSessionManager"
import {MasseurStepCardUI} from "../Scripts/MasseurStepCardUI"
import {MasseurStrokeRenderer} from "../Scripts/MasseurStrokeRenderer"

function comp<T>(objectName: string, typeName: any): T {
  const so = findSceneObjectByName(objectName)
  if (!so) throw new Error(`SceneObject "${objectName}" not found`)
  const c = so.getComponent(typeName) as unknown as T
  if (!c) throw new Error(`Component ${typeName} not found on "${objectName}"`)
  return c
}

export const app = {
  manager: () => comp<MasseurSessionManager>("SessionManager", MasseurSessionManager.getTypeName()),
  main: () => comp<MasseurMain>("MasseurMode", MasseurMain.getTypeName()),
  stepCard: () => comp<MasseurStepCardUI>("StepCard", MasseurStepCardUI.getTypeName()),
  controlBar: () => comp<MasseurControlBarUI>("ControlBar", MasseurControlBarUI.getTypeName()),
  strokes: () => comp<MasseurStrokeRenderer>("Strokes", MasseurStrokeRenderer.getTypeName()),
  scan: () => comp<MasseurScanController>("ScanOverlay", MasseurScanController.getTypeName()),
  ghost: () => comp<MasseurGhostHands>("GhostHands", MasseurGhostHands.getTypeName()),
  audio: () => comp<MasseurAudioController>("AudioController", MasseurAudioController.getTypeName()),
  labels: () => comp<MasseurLandmarkLabelsUI>("LandmarkLabels", MasseurLandmarkLabelsUI.getTypeName()),
}

// LEAF destroys interactors when a scenario ends, so each scenario gets a fresh one.
let interactor: DefaultLeafInteractor | null = null
let interactorScenario: object | null = null

/** Call first in every scenario (resetToMenu / startRunning do it for you). */
export function beginScenario(owner: object): void {
  if (interactorScenario !== owner) {
    interactor = new DefaultLeafInteractor("MasseurLeaf")
    interactorScenario = owner
  }
}

/** Pinch a UIKit button by its SceneObject name (must be enabled). */
export async function tap(name: string): Promise<void> {
  const target = findInteractableByName(name, undefined, true)
  if (!target) throw new Error(`Interactable "${name}" not found or not enabled`)
  if (!interactor) throw new Error("beginScenario() was not called")
  await interactor.trigger(target)
  await sleep(250)
}

export async function waitFor(what: string, pred: () => boolean, timeoutMs: number): Promise<void> {
  const start = getTime()
  while (!pred()) {
    if ((getTime() - start) * 1000 > timeoutMs) throw new Error(`Timed out waiting for: ${what}`)
    await sleep(50)
  }
}

export async function waitForReady(): Promise<void> {
  await waitFor("MasseurMain ready", () => app.main().isReady, 8000)
}

/** Back to the start menu at normal speed, whatever the previous scenario left. */
export async function resetToMenu(owner?: object): Promise<void> {
  if (owner) beginScenario(owner)
  await waitForReady()
  const m = app.manager()
  m.debugTimeScale = 1
  m.returnToMenu()
  await sleep(400)
}

/** Menu -> Back -> duration -> waits until the first step is running. */
export async function startRunning(minutes: number, owner: object): Promise<void> {
  await resetToMenu(owner)
  await tap("BodyPart_back")
  await tap(`Duration_${minutes}`)
  await waitFor("first step running", () => app.manager().phase === "running" && app.strokes().isVisible, 12000)
}

export function log(msg: string): void {
  print(`[MasseurLeaf] ${msg}`)
}

/** Boolean assertion with a readable failure message. */
export function check(label: string, cond: boolean): void {
  if (!cond) throw new Error(`Check failed: ${label}`)
}
