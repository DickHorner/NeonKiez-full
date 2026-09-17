# School Pong Court vertical slice

Run `npm run dev-nolog`, then open `http://localhost:8080/?dungeon=SchoolPongCourt`.
The dedicated URL starts the court without requiring a hub entrance or touching artwork.

- A/D or Left/Right: move the lower paddle.
- Space: serve; after a match win, start the next stage.
- R: retry the current stage after losing a match.
- ESC: return to the hub.
- The upper paddle is AI controlled.
- A point is scored when the opponent misses the ball.
- Stages 0–3 are first to 2, 3, 4 and 5 points, with increasing ball and AI speed.
- Only winning stage 3 records `SchoolPongCourt` in the shared session.
- Scene re-entry starts stage 0 again while preserving any previous session clear.

## Source reconciliation

Pocket Dungeon 5 was named `DUN_SCHOOL_PONG_COURT`, but its implemented gameplay was
explicitly Pong/Breakout hybrid: one player paddle at the bottom, destructible targets,
reflectors and target-count progression. Pocket asset notes also mention an optional
`SPR_PONG_PADDLE_AI`, so a true opposing paddle was contemplated but not implemented.

For NeonKiez Full, the current project decision is that School Pong Court should actually
play like Pong/table tennis rather than Breakout. Full therefore intentionally diverges
from the Pocket target-clearing implementation:

- two opposing paddles instead of bricks/targets;
- player versus AI rallies;
- score-based match progression;
- open top/bottom scoring edges;
- hit-position paddle rebounds on both sides.

The four-stage dungeon structure and stable `SchoolPongCourt` session ID remain. The
2/3/4/5 target scores, ball speeds and AI tuning are prototype tuning, not broader game
progression canon.

Gameplay rules remain in the Phaser-independent attempt module. The Scene owns Phaser
physics, rendering, input and the disposable AI paddle/ball objects. No reward, save,
audio, LDtk dungeon map, generic Pong framework or unrelated architecture is added.

## Checks

```sh
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build-nolog
git -c core.whitespace=cr-at-eol diff --check
```

Runtime smoke should cover serving, both paddle rebounds, player and AI scoring, stage
win/advance, stage loss/retry, final session clear, ESC to hub and fresh re-entry.
