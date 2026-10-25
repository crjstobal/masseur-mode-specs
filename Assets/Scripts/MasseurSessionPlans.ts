/**
 * MasseurSessionPlans - the session composer.
 *
 * Owns: the default session plans from the design brief and the pure function
 * that turns a duration into an ordered list of steps. No scene access.
 *
 * Composer rules (brief): every session is an arc (open with palm glides, go
 * deeper, include press-and-hold in longer sessions, close with feather
 * strokes), go light to deep and back, never the same move twice in a row,
 * and duration decides how many moves fit. The plans below are the brief's
 * defaults; composeSession() validates them against those rules.
 *
 * Must not: hold runtime state (MasseurSessionManager owns that).
 */
import {getMove} from "./MasseurMoveLibrary"

export interface StepDef {
  moveId: string
  name: string
  handPart: string
  /** Planned length in seconds (the manager may extend it with +2 min). */
  durationSec: number
}

/** [moveId, minutes] per step, from the design brief "Resulting plans (default)". */
export const SESSION_PLANS: Record<number, [string, number][]> = {
  10: [["opening_glide", 2], ["shoulder_kneading", 3], ["thumb_circles", 3], ["feather_strokes", 2]],
  20: [
    ["opening_glide", 3], ["shoulder_kneading", 4], ["knuckle_glide", 3],
    ["thumb_circles", 4], ["press_hold", 3], ["feather_strokes", 3],
  ],
  40: [
    ["opening_glide", 4], ["shoulder_kneading", 5], ["knuckle_glide", 5], ["forearm_glide", 5],
    ["scapula_circles", 5], ["thumb_circles", 5], ["press_hold", 5], ["palm_presses", 3], ["feather_strokes", 3],
  ],
  60: [
    ["opening_glide", 5], ["shoulder_kneading", 7], ["knuckle_glide", 6], ["forearm_glide", 7],
    ["scapula_circles", 6], ["thumb_circles", 7], ["press_hold", 7], ["palm_presses", 5],
    ["opening_glide", 5], ["feather_strokes", 5],
  ],
}

export const SUPPORTED_DURATIONS: number[] = [10, 20, 40, 60]

/** Builds the ordered step list for a duration. Throws on an unknown duration or a rule violation. */
export function composeSession(minutes: number): StepDef[] {
  const plan = SESSION_PLANS[minutes]
  if (!plan) throw new Error(`MasseurSessionPlans: no plan for ${minutes} min`)
  const steps: StepDef[] = plan.map(([moveId, min]) => {
    const move = getMove(moveId)
    return {moveId, name: move.name, handPart: move.handPart, durationSec: min * 60}
  })
  validatePlan(steps, minutes)
  return steps
}

/** Checks the composer rules. Returns a list of problems (empty = valid). */
export function planProblems(steps: StepDef[], minutes: number): string[] {
  const problems: string[] = []
  const total = steps.reduce((a, s) => a + s.durationSec, 0)
  if (Math.abs(total - minutes * 60) > 0.5) problems.push(`total ${total}s != ${minutes * 60}s`)
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].moveId === steps[i - 1].moveId) problems.push(`repeat at step ${i}`)
  }
  if (steps.length > 0 && steps[0].moveId !== "opening_glide") problems.push("must open with palm glides")
  if (steps.length > 0 && steps[steps.length - 1].moveId !== "feather_strokes") problems.push("must close with feather strokes")
  return problems
}

function validatePlan(steps: StepDef[], minutes: number): void {
  const p = planProblems(steps, minutes)
  if (p.length > 0) throw new Error(`MasseurSessionPlans: plan ${minutes} min invalid: ${p.join("; ")}`)
}
