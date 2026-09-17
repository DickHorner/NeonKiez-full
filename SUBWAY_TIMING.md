# Subway Timing vertical slice

Run `npm run dev-nolog`, then open `http://localhost:8080/?dungeon=SubwayTiming`.
The normal URL still starts the LDtk hub; this standalone route does not add a hard-coded hub entrance.

Controls:

- WASD / arrows: move in the rhythm arena.
- Space: tap the beat.
- Enter: advance after a cleared stage.
- R: retry the current stage after three misses.
- ESC: return to the hub.

## Source reconciliation

Pocket Dungeon 4 is `DUN_SUBWAY_TIMING`, a 120 BPM rhythm/timing dungeon with a
500 ms beat interval, a 200 ms good window, a three-miss limit and four streak targets:
3 / 5 / 8 / 12.

The current refactored Pocket files retain the basic beat timer and tap judgement, but
most stage progression was stripped during the controller split. The recoverable source
is the earlier Dungeon 4 implementation commit `b562bf8` plus `DUNGEON_04_TEST_PLAN.md`.

The first Full playtest exposed three problems in that recovered design: doors opened on
the first successful hit instead of after the requested streak, Stage 2 separated its
spatial targets from the eight-hit rhythm objective, and the final stage's four fields
were decorative. Full now treats the playtest corrections as the active design for this
slice:

1. `BEAT_TUTORIAL`: three clean beats.
2. `DOORS`: three gates stay closed until a five-beat streak is complete, then latch open;
   reaching the goal finishes the stage.
3. `SWITCH_CHAIN`: eight numbered pads form one eight-beat chain. The player must stand on
   the next pad and hit the beat; the eighth pad completes the stage with no extra beat.
   A miss resets the chain.
4. `FINAL_STREAK`: four lit fields form a loop. Each successful beat requires the player
   to stand on the currently lit field. Twelve clean hits means three complete laps.

One beat can score only once. Pocket's old repeated-tap loophole remains closed.
Pocket automatically reloaded a stage after the third miss; Full keeps the visible `R`
retry convention used by the other fail-state dungeon slices.

## Prototype presentation

The slice uses primitive Phaser geometry only. There is no final music, sound design or
authored subway art yet.

The rhythm cue and tap judgement now use the same Scene clock. The cue is a countdown:
it contracts toward the center of the beat, flashes at the beat, then resets for the next
500 ms cycle.

- Stage 1 uses three physical gate bodies and a goal zone.
- Stage 2 uses eight numbered on-beat pads.
- Stage 3 uses four spatial beat fields that must actually be touched.
- Only final Stage 3 completion records `SubwayTiming` in the shared Session.

No Pocket rewards (`TOOL_FREEZECAM`, cassette), save system, LDtk dungeon map, hub door,
audio dependency or generic rhythm framework is added by this slice.

## Verification

```sh
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build-nolog
git -c core.whitespace=cr-at-eol diff --check
```

Runtime smoke should cover cue/beat synchronization, duplicate taps on one beat,
three-miss retry, Stage 1 gates staying closed through hits 1-4 and opening on hit 5,
Stage 2 pads 1-8 on consecutive beats, Stage 3 requiring the lit field for every hit,
final session clear, ESC to hub and fresh re-entry.
