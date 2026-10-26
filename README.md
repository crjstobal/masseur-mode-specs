# Masseur Mode

A Lens for SPECS that guides a relaxation back massage by drawing on the body itself: neon strokes show where your hands go, a pulse of light sets the pace, and ghost hands show which part of the hand to use. Steps advance on their own, so your hands never leave the back.

Built for [Learn AR with SPECS](https://learn-specs.devpost.com/) (Devpost, 2026). Relaxation massage only, not a substitute for a physiotherapist.

<!-- TODO: hero screenshot from the Lens Studio preview, and the YouTube link -->

## How it works

1. Pick **Back** and a session length: 10, 20, 40 or 60 minutes.
2. A short scan maps the back. In the Lens Studio preview the body is a 3D stand-in, so **this detection is simulated**.
3. The session runs as an arc of real moves (glides, kneading, thumb circles, press and hold, feather strokes), from light to deep and back to light.
4. A control bar at your right side: Pause or Resume, Slower or Faster (50 to 150 %), +2 min, and Next (with a confirm).

Every stroke is anchored to landmarks on the body (neck, shoulders, shoulder blades, spine, lower back), not to the room.

## Run it

You don't need SPECS glasses.

1. Install [Lens Studio](https://ar.snap.com/download) 5.22 or newer (built and tested with 5.23.2).
2. Clone this repo and open `Masseur Mode.esproj`.
3. In the Preview panel, use Interactive Preview with the SPECS device. Look down at the back. Clicking acts as a pinch; WASD moves, right-drag looks around.

## How it was made

- **Planned** with the Devpost Learn skill pack (`plan-lens`). The design brief is in [`devpost/design-brief.md`](devpost/design-brief.md), including the design changes made after the first build.
- **Built** by an AI coding agent (Claude Code) through **CLAD** and the **Lens Studio MCP**.
- **Tested** with LEAF scenarios in [`Assets/Tests/`](Assets/Tests/), one per done criterion in the brief.

## Project layout

| Path | What |
|---|---|
| `Assets/Scripts/` | Lens logic: session manager and plans, move library, body map and skin grid, strokes, ghost hands, scan, UI panels, audio |
| `Assets/Tests/` | LEAF scenarios (`c1` to `c5` for the done criteria, plus a reach check) |
| `Assets/GeneratedMeshes/` | The 3D person, hand poses and furniture |
| `Assets/GeneratedSFX/` | The two chimes (locally synthesized) |
| `art/` | Source of the 3D person: MakeHuman recipe, Blender file, credits and the decimation script |
| `devpost/` | Planning documents written by the skill pack |

## Credits

- 3D person: [MakeHuman](http://www.makehumancommunity.org/) assets (CC0) through MPFB2 for Blender.
- Towel fabric: [Poly Haven](https://polyhaven.com/) terry_cloth (CC0).
- Icons: [Google Material Symbols](https://fonts.google.com/icons) (Apache 2.0).
- Spectacles Interaction Kit, Spectacles UI Kit and LEAF by Snap Inc.

## License

[MIT](LICENSE)
