# Warehouse Blockworks vertical slice

Run `npm run dev-nolog`, then open `http://localhost:8080/?dungeon=WarehouseBlockworks`.

Controls:
- WASD / arrows: move.
- In Sokoban stages movement is grid-based; walking into a crate pushes it one cell if the cell beyond is free.
- R: reset the current stage after a deadlock or bad push.
- Enter: advance after a cleared stage.
- ESC: return to the hub.

## Source basis and playtest correction

Pocket Dungeon 3 is `DUN_WAREHOUSE_BLOCKWORKS`, a four-stage block/conveyor puzzle. Its implementation notes say the current Pocket build used switch placeholders and explicitly listed Sokoban-style block pushing and real pattern validation as future work.

The Full playtest established that this does not communicate the intended videogame mechanic: if Warehouse Blockworks is the Sokoban dungeon, the crates must actually be pushable. Full therefore promotes that previously deferred mechanic for the block stages while preserving the four-stage shape:

1. `CONVEYOR_INTRO`: push one crate onto one target pad. The gate opens only while the target is occupied; reach the exit.
2. `BLOCK_ROWS`: push two crates onto two target pads. Both targets must be occupied before the gate opens.
3. `MOVING_CRATES`: keep the Pocket dodge variation with three moving crates. Contact is harmless knockback/stun with temporary i-frames; reach the exit.
4. `FINAL_PATTERN`: push three crates onto three target pads to build the final pattern, opening the exit gate.

Sokoban movement is cardinal and push-only: crates cannot be pulled, cannot be pushed through walls or other crates, and move exactly one grid cell per push.

## Prototype presentation

The slice uses primitive Phaser geometry only while authored warehouse art/map data is absent.

- Stages 0, 1 and 3 are deterministic grid puzzles backed by Phaser-independent state.
- Target pads change the crate display when occupied.
- Gates derive directly from target occupancy rather than switch counters.
- `R` resets the current stage because Sokoban positions can deadlock.
- Stage 2 remains the separate moving-crate navigation variation.
- Only Stage 3 completion records `WarehouseBlockworks` in the shared Session.

No Pocket rewards (`TOOL_SOAP_SLIDE`, keycard), save system, authored LDtk dungeon map, hard-coded hub entrance, audio dependency, or generic puzzle framework is added.

## Verification

```sh
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build-nolog
git -c core.whitespace=cr-at-eol diff --check
```

Runtime smoke should cover single-cell crate pushing, blocked pushes, Stage 0 target/gate flow, both Stage 1 crate targets, `R` reset, all three moving Stage 2 crates, the three-crate final pattern, final Session clear, ESC-to-hub, and fresh re-entry.
