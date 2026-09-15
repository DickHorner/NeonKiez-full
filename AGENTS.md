# NeonKiez – Agent Engineering Rules

## Prime directive

Work repo-first, not prompt-first.

Before changing code, inspect the existing implementation and understand how the repository already solves adjacent problems.

"Repo-native" must be supported by evidence, not intuition.

## Before editing

For every non-trivial change:

1. Read the relevant files completely.
2. Inspect 2–3 nearby precedents or analogous implementations when they exist.
3. Identify the smallest meaningful slice that solves the requested problem.
4. State any important assumption that cannot be verified from the repository.

Do not begin by inventing a new architecture.

## Change discipline

Prefer the smallest local patch that preserves existing behavior.

Do not introduce:

- speculative abstractions
- generic frameworks for one current use case
- unnecessary helpers
- new dependencies without a concrete need
- configuration options "for later"
- drive-by refactors
- unrelated renames
- formatting waves
- parallel implementations of an existing mechanism

Use the repository's existing patterns unless there is clear evidence they are harmful.

When changing architecture, make the reason explicit.

## Separate concerns

Do not mix these unless necessary:

- feature work
- refactoring
- formatting
- dependency changes

A feature patch should primarily contain the feature.

A refactor should preserve behavior.

## Delete the weird

Before adding machinery, look for ways to remove special cases or simplify the data model.

Prefer:

- one clear invariant
- one source of truth
- explicit data
- obvious control flow

over:

- stitched conditional logic
- hidden coupling
- duplicated state
- fragile ordering assumptions
- clever syntax

If a design requires several exceptions, reconsider the design first.

## NeonKiez architecture invariants

LDtk is the source of truth for world authoring.

Do not hard-code world positions, dungeon entrances, collision geometry, or map-specific gameplay data in Phaser when that data belongs in LDtk.

Current pipeline:

LDtk
→ level/layer/entity data
→ Phaser renderer / physics adapter
→ gameplay

Keep gameplay state separate from renderer state where practical.

Phaser Scenes should remain thin. Do not allow `Game.ts` to become the permanent home for every subsystem.

Stable game IDs are preferable to file paths or display strings.

Do not couple gameplay rules to asset filenames.

## Current behavior that must not regress

The current prototype can:

- load `public/assets/ldtk/neonkiez-ldtk.ldtk`
- load `Kiez_Center` as the authored hub level
- render visible non-empty LDtk tile/auto-layer output using each layer's referenced tileset
- support mixed 16 px semantic layers and 32 px LimeZu visual layers
- keep `Collision` semantic-only and build physics from its IntGrid
- spawn the player from `Player_Spawn`
- move the player using WASD
- follow the player with the camera
- run Asteroids, School Pong Court, and Rooftop Invaders as separate Phaser scenes sharing one Session

`DungeonEntrance` remains an authored LDtk entity type, but `Kiez_Center` currently has no placed entrance instances. Do not invent hard-coded entrances in Phaser.

Preserve these behaviors unless the task explicitly changes them.

## Testing and proof

Do not report a task as complete merely because the code looks correct.

Use the cheapest meaningful proof available:

1. syntax / formatting
2. TypeScript type check
3. relevant automated test
4. build
5. targeted runtime check when required

Add a focused regression test when the changed behavior can reasonably be tested.

Test relevant edge cases, especially:

- missing LDtk data
- invalid IDs
- absent entities or layers
- transition state
- duplicated triggers

Do not create broad test infrastructure just to test a trivial patch.

## Machine costs

Be conscious of runtime and maintenance cost.

Avoid:

- per-frame work that can happen during scene creation
- unnecessary object creation in update loops
- duplicate parsing of static LDtk data
- loading unused assets
- hidden global mutable state

Optimize only where the architecture makes the cost obvious; do not prematurely micro-optimize.

## Dependencies

Do not add a package merely because it makes a small task convenient.

Before adding a dependency, explain:

- what problem it solves
- why existing code or platform APIs are insufficient
- its runtime/build impact

## Agent workflow

For a substantial task:

### 1. Inspect

Report briefly:

- relevant existing files
- existing precedent/pattern
- invariant to preserve
- proposed smallest slice

### 2. Implement

Make only the requested slice.

### 3. Delete-the-Weird pass

Before finishing, check whether the patch introduced:

- a special case
- duplicated state
- unnecessary abstraction
- fragile ordering
- unnecessary configuration

Simplify if possible.

### 4. Verify

Run the relevant checks.

### 5. Report

Use this format:

DONE
- what changed

CHECKS
- exact checks/tests run and their results

NOT DONE
- anything requested but not completed
- anything that could not be verified

READY FOR NEXT STEP
- yes/no
- one short sentence explaining why

Stop when the requested slice is complete.

Do not continue into adjacent improvements without being asked.