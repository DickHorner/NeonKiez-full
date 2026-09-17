# Rooftop Invaders vertical slice

Start with `?dungeon=RooftopInvaders`.

Controls:
- A/D or Left/Right: move horizontally
- Space: fire
- Enter: advance after a cleared stage
- R: retry a failed stage
- Escape: return to Game

Re-entering creates a fresh attempt. Only the final core hit records
`RooftopInvaders` in the shared Session.

## Source reconciliation

Pocket source keeps the stage structure and progression facts:

- `DUN_ROOFTOP_INVADERS`
- RANGE / FORMATIONS / ALARM / CORE
- waves `[1, 3, 4, 1]`
- core HP 30
- enemy cap 12
- alarm every 5 seconds in Stage 2
- one HP normal enemies

Pocket's later refactor does not contain a complete executable shooter controller,
and the older implementation used free X/Y movement, independent enemy drift and
a projectile cap of 20. Those behaviors are not authoritative for NeonKiez Full.

## Full gameplay direction

Rooftop Invaders is the Space-Invaders-like dungeon, so the current Full slice
uses the defining fixed-shooter rules instead of the earlier generic shooter
behavior:

- player movement is horizontal only
- player fires straight upward
- only one player projectile may be active at a time
- invaders move as one formation in horizontal scans
- at a screen edge the formation drops one step and reverses direction
- invaders fire downward
- four destructible shields sit between player and formation
- both player and enemy projectiles erode shield chunks, allowing holes to be
  opened through the cover

The existing NeonKiez-specific stage flow remains:

- Stage 0: RANGE — 1 wave
- Stage 1: FORMATIONS — 3 waves
- Stage 2: ALARM — 4 waves plus periodic capped bonus invaders
- Stage 3: CORE — stationary 30 HP antenna/core

The core is a NeonKiez dungeon-specific finale rather than a claim of exact
Space Invaders parity.

## Prototype-only tuning

The current 640x360 arena, formation speeds, shield chunk geometry, enemy-shot
interval, colors and geometric sprites are placeholder tuning. They are not final
art or difficulty canon.

No final artwork, LDtk dungeon map, reward system, savegame or sound is part of
this slice.

## Verification

Pure rule tests cover:
- exact stage/wave progression
- alarm cap/progression
- core HP and completion
- retry/leaving behavior
- one-player-projectile cap
- scan -> drop -> reverse formation motion

Runtime verification still requires the local browser smoke because Phaser and
the project dependencies are not available in the isolated connector runtime.
