/**
 * MasseurAudioController - the only sounds in the Lens: a soft zen chime on
 * step change and a longer chime when the session ends. By design there is no
 * sound during the massage itself (the pace follows the person, not a beat)
 * and no UI click sounds.
 *
 * Inputs: the two chime tracks and their volume. Counters are exposed so LEAF
 * scenarios can check that a chime fired.
 * Must not: decide when to play (Main calls it on session events).
 */
@component
export class MasseurAudioController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MasseurAudioController - step and session chimes</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Soft zen chime played when a step changes")
  stepChime: AudioTrackAsset
  @input
  @hint("Longer chime played when the session is complete")
  sessionChime: AudioTrackAsset
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Chime volume")
  @widget(new SliderWidget(0, 1, 0.05))
  chimeVolume: number = 0.7
  @ui.group_end

  private stepAudio: AudioComponent | null = null
  private sessionAudio: AudioComponent | null = null
  private _stepChimeCount = 0
  private _sessionChimeCount = 0
  private _lastCue = ""

  get stepChimeCount(): number { return this._stepChimeCount }
  get sessionChimeCount(): number { return this._sessionChimeCount }
  get lastCue(): string { return this._lastCue }

  onAwake(): void {
    this.stepAudio = this.makeAudio("StepChime", this.stepChime)
    this.sessionAudio = this.makeAudio("SessionChime", this.sessionChime)
  }

  playStepChime(): void {
    this._stepChimeCount++
    this._lastCue = "step"
    this.play(this.stepAudio)
  }

  playSessionChime(): void {
    this._sessionChimeCount++
    this._lastCue = "session"
    this.play(this.sessionAudio)
  }

  private makeAudio(name: string, track: AudioTrackAsset): AudioComponent | null {
    if (!track) {
      print(`MasseurAudioController: ${name} track not wired`)
      return null
    }
    const obj = global.scene.createSceneObject(name)
    obj.setParent(this.getSceneObject())
    const a = obj.createComponent("Component.AudioComponent") as AudioComponent
    a.audioTrack = track
    a.volume = this.chimeVolume
    return a
  }

  private play(a: AudioComponent | null): void {
    if (!a) return
    a.volume = this.chimeVolume
    if (a.isPlaying()) a.stop(false)
    a.play(1)
  }
}
