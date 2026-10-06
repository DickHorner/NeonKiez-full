# Halfpipe Skate vertical slice

Run `npm run dev-nolog`, then open `http://localhost:8080/?dungeon=HalfpipeSkate`.

Controls:
- Space near the bottom of the pipe: pump.
- Space near the apex: perform a grab.
- Hold left or right while pressing Space near the apex: spin in that direction.
- Enter: advance after a cleared stage.
- R: retry Kiez Jam after the timer expires.
- ESC: return to the hub.

## Canon basis

Issue #10 defines a late-1980s-inspired halfpipe score-attack dungeon built around momentum, height, tricks and clean landings.

The dungeon remains strictly halfpipe across four stages:

1. `PUMP`: build enough speed to leave the pipe and land one clean air.
2. `AIR`: land three clean aerials.
3. `TRICKS`: land all three prototype trick types on alternating sides.
4. `KIEZ JAM`: land all three trick variations and reach the score target before the short timer expires.

There are no enemies and no combat. Wipeouts are harmless, comic and immediately reset the skater in the same stage.

## Prototype mechanics

The current slice uses a small deterministic halfpipe motion model rather than authored ramp collision:

- gravity-like acceleration pulls the skater back toward the middle of the pipe;
- pumping near the bottom adds momentum;
- sufficient speed at the lip launches an aerial;
- tricks are accepted only near the apex;
- incomplete spins cause a wipeout on landing;
- clean landings build combo and score.

The Scene owns presentation, input and motion. Stage progression, score/combo rules, trick progression and Kiez Jam timing live in the Phaser-independent attempt module.

## Reward boundary

Final completion records the stable `HalfpipeSkate` dungeon clear in the shared Session. That clear is the canonical prerequisite for the Ollie reward.

The main-Kiez Ollie traversal effect is **not** implemented in this slice. The current overworld has no authored LDtk semantics for jumpable curbs, low barriers, gaps, ramps or rails, and the reward must not bypass generic collision as a fake substitute.

No save system, generic ability framework, new dependency, authored dungeon map or final art is added.

## Verification

```sh
node --experimental-strip-types --test tests/halfpipe-skate.test.mjs
npx tsc --noEmit
npm run build-nolog
git -c core.whitespace=cr-at-eol diff --check
```

Runtime smoke should cover repeated bottom pumps, insufficient-speed lip return, clean no-trick air, grab landing, both spin directions, incomplete-spin wipeout, all four stage clears, Kiez Jam timeout/retry, final Session clear, ESC-to-hub and fresh re-entry.
