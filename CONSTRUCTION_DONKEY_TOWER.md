# Construction Donkey Tower vertical slice

Run `npm run dev-nolog`, then open `http://localhost:8080/?dungeon=ConstructionDonkeyTower`.

Controls:
- A/D or left/right: move.
- W/S or up/down: climb ladders while aligned with them.
- Space: jump while off a ladder and grounded.
- Enter: advance after a cleared stage.
- ESC: return to the hub.

## Source basis

Pocket Dungeon 8 is `DUN_CONSTRUCTION_DONKEY_TOWER`, a four-stage platform/ladders dungeon built around the classic arcade ladder-and-barrel loop:

1. `LADDERS`: ladder tutorial, no barrels.
2. `BARRELS`: rolling barrel hazards begin.
3. `TRICK_LADDERS`: ladder route includes a platform gap that requires a jump while barrels continue.
4. `TOP_PLATFORM`: final climb with barrels and the goal at the top.

Pocket's current executable platform controller spawns barrels in every stage from Stage 1 onward at a fixed 3000 ms interval, with a cap of 4 and 10000 ms lifespan. The older test plan says Stage 3 should have a higher rate, but does not specify a value; Full therefore keeps the verified 3000 ms runtime rule rather than inventing a hidden rate.

## Full mechanics slice

This port uses primitive Phaser geometry but implements the actual interaction loop rather than only the labels:

- Five staggered girder tiers create alternating barrel drop edges.
- Ladders connect the tiers; gravity is disabled only while actively climbing.
- Horizontal movement remains available on ladders.
- Jumping is disabled while climbing.
- Stage 2 splits a middle girder, so the route requires an actual jump between ladder sections.
- Barrels spawn above the top tier, roll across each girder, fall at alternating edges, reverse direction on the next tier, and expire after 10 seconds.
- Maximum active barrels: 4.
- Barrel collision causes knockback/stun plus temporary i-frames, never damage.
- Only Stage 3 completion records `ConstructionDonkeyTower` in the shared Session.

No Pocket rewards (`TOOL_DECOY_TOY`, cassette), save system, authored LDtk dungeon map, hub entrance, audio dependency, or generic platform framework is added.

## Verification

```sh
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build-nolog
git -c core.whitespace=cr-at-eol diff --check
```

Runtime smoke should cover ladder entry/exit, no jump while climbing, normal grounded jump, Stage 2 gap traversal, barrel cap/expiry, barrel tier changes, harmless collision/i-frames, all four goals, final Session clear, ESC-to-hub, and fresh re-entry.
