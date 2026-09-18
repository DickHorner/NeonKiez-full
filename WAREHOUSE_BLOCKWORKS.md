# Warehouse Blockworks vertical slice

Run `npm run dev-nolog`, then open `http://localhost:8080/?dungeon=WarehouseBlockworks`.

Controls:
- WASD / arrows: move.
- E: activate a nearby switch.
- Enter: advance after a cleared stage.
- ESC: return to the hub.

## Source basis

Pocket Dungeon 3 is `DUN_WAREHOUSE_BLOCKWORKS`, a four-stage block/conveyor puzzle:

1. `CONVEYOR_INTRO`: one switch opens the gate; reach the goal.
2. `BLOCK_ROWS`: two distinct switches use latch behavior. The first does not open the gate; the second opens it permanently; then reach the goal.
3. `MOVING_CRATES`: three crates move with fixed velocities and bounce at the arena edges. Contact is a harmless bump; reaching the goal clears the stage.
4. `FINAL_PATTERN`: one final switch opens the full gate barrier; reach the goal.

The current Pocket implementation explicitly describes conveyors as visual-only, has no block pushing, and uses switches instead of actual block-pattern validation. Its own future-enhancement notes mention Sokoban-style pushing, real conveyor movement, and pattern validation. Those future ideas are not silently promoted to the Full implementation in this slice.

## Prototype presentation

The Full mechanics slice preserves the current executable Pocket behavior with primitive Phaser geometry:

- Stage 0 shows a conveyor lane and warehouse crates but uses the source switch/gate tutorial.
- Stage 1 uses two one-shot switches with a true latch: the gate opens only after both have been activated and never closes again.
- Stage 2 uses three deterministic moving crates; collision causes knockback/stun plus temporary i-frames, never damage.
- Stage 3 uses the final switch/gate/goal flow.
- Only Stage 3 completion records `WarehouseBlockworks` in the shared Session.

No Pocket rewards (`TOOL_SOAP_SLIDE`, keycard), save system, authored LDtk dungeon map, hard-coded hub entrance, audio dependency, block-pushing system, or generic puzzle framework is added.

## Verification

```sh
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build-nolog
git -c core.whitespace=cr-at-eol diff --check
```

Runtime smoke should cover the Stage 0 gate, Stage 1 two-switch latch, all three moving crates and harmless collision behavior, the final gate, final Session clear, ESC-to-hub, and fresh re-entry.
