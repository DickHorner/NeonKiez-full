# Laundromat Labyrinth vertical slice

Run `npm run dev-nolog`, then open `http://localhost:8080/?dungeon=LaundromatLabyrinth`.

Controls:
- WASD / arrows: move.
- E: use nearby switch.
- Enter: advance after a cleared stage.
- ESC: return to the hub.

## Source basis

Pocket Dungeon 1 is `DUN_LAUNDROMAT_LABYRINTH`, a four-stage puzzle/maze dungeon:

1. `WARMUP`: activate a switch, open the gate, reach the goal.
2. `DARK_MAZE`: navigate the maze and reach the goal. Pocket's authored map/commentary describes toggleable light switches; the executable completion rule only requires reaching the goal.
3. `TOKEN_RUN`: collect five tokens, avoid a horizontally patrolling Ghost-Bot, then reach the goal. Ghost-Bot contact is harmless knockback with temporary i-frames.
4. `EXIT_ROOM`: activate the final switch, open the gate, reach the goal.

The Full slice keeps those stage roles. Stage 1 starts dark and its switches toggle visibility, but lighting is an aid rather than an extra completion requirement, matching the Pocket completion rule.

## Prototype presentation

The slice uses primitive Phaser geometry only while the authored dungeon map/art is still absent.

- Stage 0 is a switch-and-gate tutorial.
- Stage 1 is a dark snake maze with two light switches.
- Stage 2 has five fixed token positions and one deterministic horizontal Ghost-Bot patrol.
- Stage 3 is the final switch-and-gate room.
- Only Stage 3 completion records `LaundromatLabyrinth` in the shared Session.

No Pocket reward (`TOOL_TAGGER`, cassette), save system, hard-coded hub entrance, audio dependency, or generic puzzle framework is added.

## Verification

```sh
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build-nolog
git -c core.whitespace=cr-at-eol diff --check
```

Runtime smoke should cover both gate switches, the dark-maze light toggle, all five unique tokens, harmless Ghost-Bot knockback/i-frames, token-gated goal completion, final Session clear, ESC-to-hub, and fresh re-entry.
