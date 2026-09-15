# School Pong Court vertical slice

Run `npm run dev-nolog`, then open `http://localhost:8080/?dungeon=SchoolPongCourt`.
The normal URL still starts the LDtk hub. The dedicated URL starts the court without
requiring a new hub entrance or touching artwork.

- A/D or Left/Right: move the paddle.
- Space: serve one ball; after a stage clear, confirm the next stage.
- ESC: return to the hub at any time.
- Missing a ball preserves destroyed targets and allows another serve.
- Stages 0–3 require 3, 8, 6 and 12 targets. Stage 0 has a slower ball.
- Stage 2 has two solid rectangular reflectors with open routes around them.
- Only clearing stage 3 records `SchoolPongCourt` in the shared session.
  The hub can query `isDungeonCleared('SchoolPongCourt')`.
- Scene re-entry starts stage 0 again while preserving any previous session clear.
  Reloading the browser starts a new session.

## Reference and port decisions

Inspected [NeonKiez-pocket at 6df58f4](https://github.com/DickHorner/NeonKiez-pocket/tree/6df58f43c2f3285e52aea640809f0faa97be66d8):
`DUNGEON_05_IMPLEMENTATION.md`, `DUNGEON_05_TEST_PLAN.md`,
`game_controller_puzzle.ts`, the dungeon specification/constants in `constants.ts`,
`assets_stub.ts`, and collision/input routing in `game_controller.ts`,
`player_modes.ts` and `player_puzzle.ts`.

The port preserves the stage progression, horizontal paddle, hit-position rebound,
repeatable serves and target clearing. Arcade resolves wall/target/reflector bounces;
a bounded paddle angle preserves ball speed and avoids near-horizontal stalls.
The Pocket documentation describes angled reflectors, but its tilemap and controller
provide no angled collision normals. This slice uses simple axis-aligned reflectors.

Intentional local choices: one active ball, Space to serve/confirm stages, speeds
scaled for this court, and primitive layouts instead of Pocket tilemaps. No Pocket
reward, global controller, multiball, audio or save machinery is ported.

As in Asteroids, a Phaser-independent attempt module owns progression rules, the
scene owns disposable physics/rendering objects, and `StartGame` injects one session.
No registry or generic dungeon system is needed.

## Checks

```sh
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build-nolog
git -c core.whitespace=cr-at-eol diff --check
```

`main.ts` retains its existing CRLF endings; the whitespace check accounts for them.
Firefox smoke passed keyboard movement, serves, paddle/wall/target bounces, misses,
all four stages, reflector bounces, early ESC, final session clear, re-entry, and
Court → Hub → Asteroids → Hub. Contacts used controlled ball positions and actual
Arcade collisions. Screenshots were inspected, including the normal application
boot at the standalone URL. The Asteroids regression smoke also passed lives,
preserved split progress, safe respawn, Game Over/Retry, full clear, and hub
WASD/collision/camera. All 18 pure tests, typecheck and build passed.
