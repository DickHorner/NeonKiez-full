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
Those sources define:

1. `BEAT_TUTORIAL`: three-hit streak.
2. `DOORS`: three rhythm gates; good hits open them, misses close them; five-hit streak
   plus reaching the goal.
3. `SWITCH_CHAIN`: six switches activated on-beat, with an eight-hit streak target.
4. `FINAL_STREAK`: four beat markers and a twelve-hit streak.

The old executable implementation had two inconsistencies: it allowed multiple good taps
inside one beat window, and Stage 2 could complete from streak alone even if its switches
were ignored. Full closes those loopholes: one beat can score once, and Stage 2 requires
all six switches in numbered order as well as the eight-beat streak. This makes the
source-described switch-chain mechanic materially necessary instead of decorative.

Pocket automatically reloaded a stage after the third miss. Full uses the existing local
retry convention (`R`) used by other fail-state dungeon slices, so the failure state is
visible and deterministic before reset.

## Prototype presentation

The slice uses primitive Phaser geometry only. A pulsing cue shows the 120 BPM timing
window; there is no final music, sound design or authored subway art yet.

- Stage 1 uses three physical gate bodies and a goal zone.
- Stage 2 uses six numbered switch markers.
- Stage 3 cycles four visual beat markers.
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

Runtime smoke should cover good/miss timing, duplicate taps on one beat, three-miss retry,
Stage 1 gate opening/closing plus goal, Stage 2 ordered switch activation, the 12-beat
final streak, final session clear, ESC to hub and fresh re-entry.
