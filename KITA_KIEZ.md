# Kita-Kiez vertical slice

Run `npm run dev-nolog`, then open `http://localhost:8080/?dungeon=KitaKiez`.

Controls:
- WASD / arrows: move the hero.
- E: rotate a nearby route sign, or give a lollipop to a nearby crying child.
- Enter: advance after a cleared stage.
- R: retry after the pickup timer expires.
- ESC: return to the hub.

## Canon basis

GitHub issue #3 defines Kita-Kiez as an early-1990s-inspired crowd-routing puzzle dungeon. Children follow simple readable routing rules while the hero remains physically present in the level. Bad routes never remove or hurt a child: a stuck child sits down and cries until the hero reaches them and gives them a lollipop. Time pressure comes from parents arriving for pickup.

## Prototype presentation

The slice uses primitive Phaser geometry while authored dungeon art/map data is absent.

- Four stages grow from 3 to 6 children.
- Children walk automatically and are redirected by route arrows.
- Bright signs can be rotated by the hero; dim arrows are fixed route turns.
- Puddles and bad exits make a child cry instead of causing damage or removal.
- Giving a lollipop gets the child moving again; the child count never decreases.
- The pickup timer pauses progression when it expires and allows a clean retry of the same stage.
- Pickup cars appear progressively as the timer runs down.
- Only Stage 3 completion records `KitaKiez` in the shared Session.

The main-Kiez lollipop healing interaction remains separate in issue #4. No inventory system, save system, authored LDtk dungeon map, hard-coded hub entrance, audio dependency, or generic crowd-routing framework is added.

## Verification

```sh
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build-nolog
git -c core.whitespace=cr-at-eol diff --check
```

Runtime smoke should cover sign rotation, the intended route in all four stages, wrong-route crying, lollipop recovery, timer expiry/retry, all-child completion, final Session clear, ESC-to-hub, and fresh re-entry.
