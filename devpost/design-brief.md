---
status: approved
---

# Design brief: Masseur Mode

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

## The one spatial moment
I'm sitting at the head of a massage table, centered behind a person lying face down, with my hands on their back. Soft neon lines are drawn right on their back showing where my hands should move, a ghost pair of hands shows which part of the hand to use (palms, knuckles, thumbs, fingertips, forearm, or just pressing and holding), and a light pulse travels along the line at the pace I should follow, over and over, until the step ends and a zen chime moves me on to the next one.

## Why it belongs on glasses
- Uses: draws in the world, leaves your body free (and, in the real version, shares your view).
- Why it's better than the phone or laptop version: your hands are busy and oily and your eyes need to stay on the back. A video or a phone timer makes you look away and guess where on the body the move goes. Here the guide sits on the body itself, at real size, exactly where your hands are.

## Product or overlay
- Type: overlay: it responds to a real person's back.
- What the real version would sense: the person's back and posture (shoulders, spine, shoulder blades, lower back), so the guide adapts to the person, not the other way round (seated, on their side, face down on a bed, etc.).
- Stand-in for the preview: there is no person in the preview, so the body is a **3D mannequin lying face down on a virtual massage table** at real scale. Its landmarks (top of shoulders, both shoulder blades, spine line from neck to lower back, lower back) are authored in advance on the mannequin. Detection is faked with an automatic scan: after the user picks a duration, a soft light band sweeps over the back from neck to lower back (about 3 s (default)), landmark dots pop in one by one with small labels, the step card reads "Mapping back…" then "Back mapped", and the first step starts. All strokes are positioned relative to these landmarks, so they belong to the body, not to the room. The demo video will say the detection is simulated.

## Where things live
- Where the user is looking during the main task: down at their own hands on the mannequin's back, from a seated position at the head of the table (eye height about 115 cm (default)), with the back filling the middle of the view.
- Mannequin and table: table about 185 x 70 cm, top at 70 cm high (default), its head end about 40 cm in front of the user (default), centered on the user. Adult mannequin, face down, arms resting by its sides (default).
- Neon strokes: drawn directly on the skin of the back (floating about 0.5 cm above the surface (default)), soft and not too bright, like neon tubes, in a calm light color such as cyan or soft teal (default). Line width about 1.5 cm (default). Arrowheads show direction.
- Rhythm pulse: a brighter glow that travels along the stroke at the current pace and loops until the step ends. For press-and-hold steps it is instead a ring on each pressure point that fills while you should press and empties while you release.
- Ghost hands: translucent, light-colored hands at real size, resting on the back right on the stroke, performing the move with the right part of the hand.
- Step card (step name, which part of the hand, time left in the step): "al fondo", beyond the mannequin's hips, at the far end of the table, about 110 cm from the user and about 20 cm above the table top (default), tilted to face the user, about 30 x 12 cm (default). It keeps the center of the view (the back) free.
- Control bar (Pause, Slower, Faster, +2 min, Next): on the side of the table, the user's chosen spot, where they must turn their head to see it. Right side (default), about 60 cm to the right of the table centerline, near the user's end, at table height plus about 15 cm (default), angled toward the user. Buttons at least 7 cm (default) across with clear icons and labels.
- Start menu: a panel floating above the mannequin's upper back, about 70 cm from the user, a little below eye level, about 40 x 30 cm (default). It disappears once the session starts.
- Session end card: in the same spot as the step card.

## Hands and input
- Choose body part: pinch a big button on the start menu. "Back" works; "Neck & shoulders", "Feet", "Legs", "Arms", "Hands" are shown greyed out with "Coming soon".
- Choose duration: pinch one of 10, 20, 40 or 60 min. All four work and each starts the scan and then the session.
- Pause / Resume: pinch. Pausing freezes the timer, the pulse and the ghost hands, and the step card says "Paused" (for example, to add more oil). The same button then reads Resume.
- Slower / Faster: pinch. Changes the pace of the pulse and the ghost hands by 15% per press (default), from 50% to 150% (default). The current pace (for example "Pace 85%") shows next to the buttons. This is a free guide that adapts to what the person likes, not "do X 20 times".
- +2 min: pinch to stretch the current step by 2 minutes when the person is enjoying it. The step card's time left updates and the session runs 2 minutes longer.
- Next (skip step): pinch, then confirm. The button turns into "Skip step?" with Confirm and Cancel; if nothing is pressed within 4 s it cancels by itself (default). This prevents skipping by mistake.
- Steps advance on their own when their time ends; the user doesn't need to touch anything while massaging.
- Targets are big and highlight when aimed at.
- Voice (if any) and the button that does the same job: none.

## The session composer
The app builds ("monta") a session for the chosen duration instead of repeating moves at random. Real massage moves only, no props (no rollers, no cups): just palms, fingers, thumbs, knuckles and forearm.

Rules (default):
- Every session is an arc: open with long, gentle palm strokes (warm up, spread the oil), move into deeper work, include a press-and-hold block in longer sessions, and close with light fingertip strokes.
- Go from light to deep and back to light. Never repeat the same move twice in a row.
- Duration decides how many moves fit, not only how long each lasts. 10 minutes is better as four short steps than two 5-minute steps.

Move library (default):
| Move | Part of the hand | Stroke on the back | One cycle (default) |
|---|---|---|---|
| Opening glide (effleurage) | Both palms | From the lower back up both sides of the spine, fan out over the shoulders, back down the sides | 8 s |
| Shoulder kneading | Palms and fingers | Squeeze and roll the top of the shoulders, alternating hands | 4 s |
| Thumb circles | Thumbs | Small circles walking down the muscles on both sides of the spine, never on the spine itself | 30 s per pass |
| Knuckle glide | Soft fists (knuckles) | Slide from the shoulders down both sides of the spine to the lower back | 6 s |
| Shoulder blade circles | Fingertips | Circle around the edge of each shoulder blade | 5 s |
| Forearm glide | Flat forearm (never the elbow point) | Slow glide along the upper back muscles beside the shoulder blades | 8 s |
| Press and hold | Thumbs or palms | Press points along the top of the shoulders and beside the spine; ring fills to press (5 s), empties to release (3 s), then moves to the next point | 8 s per point |
| Palm presses | Both palms | Rhythmic presses moving down both sides of the back | 3 s |
| Closing feather strokes | Fingertips | Very light strokes from the shoulders down to the lower back | 6 s |

Resulting plans (default):
- 10 min: Opening glide 2, Shoulder kneading 3, Thumb circles 3, Closing feather strokes 2.
- 20 min: Opening glide 3, Shoulder kneading 4, Knuckle glide 3, Thumb circles 4, Press and hold 3, Closing feather strokes 3.
- 40 min: Opening glide 4, Shoulder kneading 5, Knuckle glide 5, Forearm glide 5, Shoulder blade circles 5, Thumb circles 5, Press and hold 5, Palm presses 3, Closing feather strokes 3.
- 60 min: Opening glide 5, Shoulder kneading 7, Knuckle glide 6, Forearm glide 7, Shoulder blade circles 6, Thumb circles 7, Press and hold 7, Palm presses 5, Opening glide 5, Closing feather strokes 5.

## When things show
- Start menu: shows when the Lens starts, hides once a duration is picked.
- Scan and landmark dots: show right after picking a duration, fade out once "Back mapped" appears and the first step starts.
- Ghost hands: show at the start of each step and perform the move twice, then fade out, leaving only the stroke and the pulse.
- Neon stroke and pulse: show for the whole step, hide during the switch to the next step, then the new stroke draws in.
- Step card: always visible at the far end of the table during the session; shows "Paused" while paused.
- Step change: a soft zen chime plus a small visual notice on the step card ("Next: Knuckle glide" for about 3 s (default)). No sound at all during the massage itself, because the pace is adapted to what the person likes.
- Control bar: always there at the side; visible when the user turns their head.
- If something needs attention out of view: a small hint at the edge of the view pointing toward the control bar (default). The step-change chime covers the other case.
- Session end: chime, the end card reads "Session complete" with a button to go back to the start menu.
- Disclaimer on the start menu: "Relaxation massage. Not a substitute for a physiotherapist." (from the project notes).

## Done criteria
Each one can be checked in Lens Studio's preview.
1. On the start menu, pinching "Back" selects it, the other body parts show "Coming soon" and can't be started, and pinching each of 10, 20, 40 and 60 min starts a session whose step list matches that duration's plan.
2. After picking a duration, the scan sweeps over the mannequin's back, the landmark dots appear, the card reads "Back mapped", and the first neon stroke appears on the back.
3. The neon strokes and the pulse stay anchored on the mannequin's back while the camera moves a little (small WASD steps and mouse look): they don't slide with the view.
4. Every control on the side bar is visible when turning toward it and works: Pause freezes the timer and pulse and Resume continues; Slower and Faster change the pace label and the pulse speed; +2 min adds 2:00 to the step's time left; Next only skips after Confirm, and Cancel (or waiting 4 s) keeps the step.
5. When a step's time ends, the zen chime plays, the card briefly shows the next step's name, and the next stroke and ghost hands appear on the back.

## Out of scope
- Other body parts (shown as "Coming soon"), other postures (seated, on the side).
- Real body or posture detection; the mannequin and its landmarks stand in.
- Props such as rollers or vacuum cups.
- Voice control, and any sound during the massage itself.
- Remembering a person's preferences between sessions.
- Therapeutic massage or medical advice.

## Risks and open questions
- Controls on the side, where you have to turn your head (the learner's choice): SPECS' view is narrow, so they're out of view during the massage. Mitigated by the edge hint; keep an eye on it in the preview.
- Usable human body model: if no good face-down mannequin can be found or generated, a simple stylized torso with clear shoulders and spine is acceptable, but the strokes must still read as being on a back.
- Detection is simulated. The real version needs body and posture tracking; "feel unproven".
- Pace, pressure and comfort over a long session, and whether strokes stay readable on real skin with oil and different lighting: "feel unproven".

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
