# Rooftop Invaders vertical slice

Start with `?dungeon=RooftopInvaders`. WASD/arrows move in X/Y; hold Space
for upward shots; Enter advances a cleared stage; R retries a failed stage;
Escape returns to Game. Re-entering creates a fresh attempt. Only the final
core hit records `RooftopInvaders` in the existing shared Session.

## Source reconciliation

Inspected Pocket at `6df58f43c2f3285e52aea640809f0faa97be66d8`:

- `constants.ts`: `DUN_ROOFTOP_INVADERS`, RANGE / FORMATIONS / ALARM / CORE,
  waves `[1, 3, 4, 1]`, core HP 30, enemy cap 12, projectile cap 20.
- `player_shooter.ts`: X/Y movement, upward shots, 2000 ms projectile lifetime.
- `assets_stub.ts`: four open, bordered arenas; core floor decoration only.
- `game_controller_shooter.ts`: setup exists, but `update()` is a placeholder.
  Current controller collision handlers do not implement Dungeon 2 combat.
- `DUNGEON_2_IMPLEMENTATION.md`: describes the older wave, collision, one-second
  wave pause, alarm, and core behavior; its code-complete claim does not describe
  the current executable implementation. `TESTING.md` supplies a manual shooter
  checklist, not evidence that those checks passed.
- Historical `game_controller.ts` at Pocket `c8aa95f` recovers exact normal wave
  counts: RANGE `[3]`, FORMATIONS `[4, 5, 6]`, ALARM `[5, 6, 6, 7]` from
  `5 + floor(one-based wave / 2)`. Enemies have one HP and drift/bounce; the core
  is stationary. Later `02e995e` contains malformed duplicated spawn code, so
  it is not copied. The old core-mode guard and delayed callbacks also are not
  transplanted: explicit local phases prevent premature or repeated transitions.

Full adaptations: 640×360 geometric arena, readable row/V/staggered layouts,
220 px/s player movement, 300 px/s shots, 120 ms held-fire cadence, deterministic
bot drift, three hearts, a brief protected reset after contact, explicit stage
advance and retry. These are prototype tuning, not claims of exact Pocket parity.
Alarm ticks only during active play, one spawn per due tick, without a queued
burst. Bonus bots must be cleared before a wave can advance.

No Hub renderer, LDtk map, artwork, reward, persistence, sound, dependency, or
other dungeon implementation changes are part of this slice.

## Known integration blocker

At Full baseline `1eac73f`, `Game.ts` and two LDtk tests require `Hub_Test`, but
`public/assets/ldtk/neonkiez-ldtk.ldtk` contains only `Kiez_Center`. Returning to
Game therefore raises `LDtk level "Hub_Test" not found`. The Session object still
retains the clear, but the actual Hub traversal sequence cannot pass until the
separate Hub work resolves this mismatch.

## Verification (2026-09-15)

- `node --experimental-strip-types --test tests/*.test.mjs`: 21/23 pass.
  All five new Rooftop tests and all Asteroids, School Pong and Session tests
  pass. Two LDtk failures are reproduced from an untouched HEAD archive.
- `npx tsc --noEmit`: pass.
- `npm run build-nolog`: pass.
- `git diff --check`: pass.
- Chromium / Playwright smoke: X/Y keyboard movement, upward Space firing,
  projectile cap 20 and in-arena lifetime expiry, contact/failure/retry, all
  eight normal waves, actual five-second alarm tick, enemy cap 12, no alarms
  after stage clear, core 30→0 through 30 individual projectile collisions,
  final Session clear, fresh re-entry retaining the clear, and early ESC
  retaining an uncleared Session: pass.
- Independent School Pong movement/serve and Asteroids thrust/fire: pass.
  All four Scene instances share the identical Session object.
- Screenshots reviewed for RANGE, ALARM, CORE, completion, Pong and Asteroids.
- Browser automation captures the game instance by intercepting the served
  entry module, without adding a production debug hook. Wave collision checks
  freeze and align enemies and protect the player after the separate contact
  check. Cap checks accelerate fire/alarm deadlines; the first alarm uses real
  elapsed time. This is a deterministic smoke check, not a difficulty playtest.
- Rooftop → Hub → School Pong → Hub → Asteroids → Hub: blocked at Hub creation
  by the baseline mismatch above. The Hub Scene can query the retained clear,
  but its renderer does not finish loading. No map substitution was used to
  claim a successful traversal.

Delete-the-Weird review: the slice adds one local attempt module and one Scene;
no generic engine, wave framework, event bus, duplicate completion flag, or
Pocket runtime architecture. Phaser object identity/positions stay in the Scene;
progression and remaining enemy IDs stay in serializable attempt state.
