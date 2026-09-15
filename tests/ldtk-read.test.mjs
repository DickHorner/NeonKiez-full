import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
    readProject,
    requireLevel,
    requireLayer,
    requireEntity,
    findEntities,
    tileLayers,
    requireTileset,
    tilesetPath
} from '../src/game/ldtk/read.ts';

const loadFixture = () => JSON.parse(readFileSync(
    new URL('../public/assets/ldtk/neonkiez-ldtk.ldtk', import.meta.url),
    'utf8'
));

test('selects the authored Kiez_Center spawn and semantic collision without mutating data', () => {
    const data = loadFixture();
    const before = JSON.stringify(data);
    const project = readProject(data);
    const level = requireLevel(project, 'Kiez_Center');
    const collision = requireLayer(level, 'Collision');
    const entities = requireLayer(level, 'Entities');
    const spawn = requireEntity(entities, 'Player_Spawn');
    assert.equal(project, data);
    assert.equal(level, data.levels.find(l => l.identifier === 'Kiez_Center'));
    assert.equal(collision.intGridCsv.length, collision.__cWid * collision.__cHei);
    assert.equal(collision.__gridSize, 16);
    assert.equal(spawn, entities.entityInstances.find(e => e.__identifier === 'Player_Spawn'));
    assert.ok(spawn.px[0] >= 0 && spawn.px[0] + spawn.width <= level.pxWid);
    assert.ok(spawn.px[1] >= 0 && spawn.px[1] + spawn.height <= level.pxHei);
    assert.deepEqual(findEntities(entities, 'DungeonEntrance'), []);
    assert.equal(JSON.stringify(data), before);
});

test('reports missing project data and levels collection', () => {
    for (const value of [undefined, null, false, '', {}, { levels: null }, { levels: {} }]) {
        assert.throws(() => readProject(value), /LDtk project is missing or has no levels array/);
    }
    assert.throws(() => requireLevel(readProject({ levels: [] }), 'Kiez_Center'), /LDtk level "Kiez_Center" not found/);
    assert.throws(() => requireLevel(readProject(loadFixture()), 'Unknown'), /LDtk level "Unknown" not found/);
});

test('reports missing required layers and layer collections with level context', () => {
    for (const identifier of ['Collision', 'Entities']) {
        const level = requireLevel(readProject(loadFixture()), 'Kiez_Center');
        level.layerInstances = level.layerInstances.filter(l => l.__identifier !== identifier);
        assert.throws(() => requireLayer(level, identifier), {
            message: `LDtk layer "${identifier}" not found in level "Kiez_Center"`
        });
    }
    for (const layerInstances of [undefined, null]) {
        assert.throws(() => requireLayer({ identifier: 'Kiez_Center', layerInstances }, 'Floor'),
            /LDtk level "Kiez_Center" has no layerInstances array/);
    }
});

test('requires spawn but permits absent optional entrances and unknown entity IDs', () => {
    const layer = { __identifier: 'Entities', entityInstances: [] };
    assert.throws(() => requireEntity(layer, 'Player_Spawn'),
        /LDtk entity "Player_Spawn" not found in layer "Entities"/);
    assert.deepEqual(findEntities(layer, 'DungeonEntrance'), []);
    assert.deepEqual(findEntities(layer, 'Unknown'), []);
    for (const entityInstances of [undefined, null]) {
        const missing = { __identifier: 'Entities', entityInstances };
        assert.throws(() => requireEntity(missing, 'Player_Spawn'), /has no entityInstances array/);
        assert.throws(() => findEntities(missing, 'DungeonEntrance'), /has no entityInstances array/);
    }
});

test('preserves first-match and all-match selection, including duplicate entities', () => {
    const first = { __identifier: 'Player_Spawn', px: [16, 32] };
    const second = { __identifier: 'Player_Spawn', px: [48, 64] };
    const entranceA = { __identifier: 'DungeonEntrance' };
    const entranceB = { __identifier: 'DungeonEntrance' };
    const layer = { __identifier: 'Entities', entityInstances: [first, entranceA, second, entranceB] };
    const level = { identifier: 'Kiez_Center', layerInstances: [layer, { __identifier: 'Entities' }] };
    const project = { levels: [level, { identifier: 'Kiez_Center' }] };
    assert.equal(requireLevel(project, 'Kiez_Center'), level);
    assert.equal(requireLayer(level, 'Entities'), layer);
    assert.equal(requireEntity(layer, 'Player_Spawn'), first);
    assert.deepEqual(findEntities(layer, 'DungeonEntrance'), [entranceA, entranceB]);
});

test('authored tile layers retain bottom-to-top order, mixed grids, and tileset paths', () => {
    const project = readProject(loadFixture());
    const level = requireLevel(project, 'Kiez_Center');
    const order = level.layerInstances.map(l => l.__identifier);
    const layers = tileLayers(level);
    assert.deepEqual(layers.map(l => l.__identifier), ['Floor', 'Floor_Decorations', 'Structures']);
    assert.deepEqual(level.layerInstances.map(l => l.__identifier), order);
    assert.equal(requireLayer(level, 'Entities').__gridSize, 16);
    assert.equal(requireLayer(level, 'Collision').__gridSize, 16);
    const uids = new Set();
    for (const layer of layers) {
        const tileset = requireTileset(project, layer.__tilesetDefUid);
        assert.equal(tileset, project.defs.tilesets.find(t => t.uid === layer.__tilesetDefUid));
        assert.equal(tileset.tileGridSize, 32);
        assert.equal(layer.__gridSize, 32);
        assert.equal(layer.__cWid, Math.ceil(level.pxWid / 32));
        assert.equal(layer.__cHei, Math.ceil(level.pxHei / 32));
        assert.equal(tilesetPath(tileset, layer), layer.__tilesetRelPath);
        assert.match(tilesetPath(tileset, layer), /^\.\.\/vendor\/limezu\/.*\.png$/);
        uids.add(tileset.uid);
    }
    assert.equal(uids.size, 3);
    assert.ok(requireLayer(level, 'Floor').autoLayerTiles.length > 0);
    assert.ok(requireLayer(level, 'Structures').gridTiles.length > 0);
    for (const name of ['Overhead', 'Ground_Detail']) {
        const layer = requireLayer(level, name);
        assert.equal(layer.gridTiles.length + layer.autoLayerTiles.length, 0);
        assert.equal(layer.__tilesetDefUid, null);
        assert.ok(!layers.includes(layer));
    }
});

test('tileset lookup fails clearly and supports exported path fallback without changing source pixels', () => {
    const project = readProject(loadFixture());
    assert.throws(() => requireTileset(project, -1), /LDtk tileset UID -1 not found/);
    assert.throws(() => requireTileset(project, null), /LDtk tileset UID null not found/);
    assert.throws(() => requireTileset({ levels: [] }, 1), /LDtk tileset UID 1 not found/);
    const tileset = { uid: 1, tileGridSize: 16, relPath: '../tilesets/spaced.png', spacing: 2, padding: 1 };
    const layer = { __identifier: 'Test', __tilesetRelPath: '../tilesets/fallback.png' };
    assert.equal(requireTileset({ defs: { tilesets: [tileset] } }, 1), tileset);
    assert.equal(tilesetPath(tileset, layer), '../tilesets/spaced.png');
    assert.equal(tilesetPath({ ...tileset, relPath: null }, layer), '../tilesets/fallback.png');
    assert.throws(() => tilesetPath({ ...tileset, relPath: null }, { ...layer, __tilesetRelPath: null }), /no image path/);
    for (const tileGridSize of [0, -1, 1.5, undefined]) {
        assert.throws(() => requireTileset({ defs: { tilesets: [{ ...tileset, tileGridSize }] } }, 1), /invalid tileGridSize/);
    }
});

test('empty and hidden layers are valid; malformed dimensions and tile arrays fail clearly', () => {
    const level = requireLevel(readProject(loadFixture()), 'Kiez_Center');
    level.layerInstances.forEach(layer => { layer.gridTiles = []; layer.autoLayerTiles = []; });
    assert.deepEqual(tileLayers(level), []);
    const layer = level.layerInstances[0];
    layer.gridTiles = [{ px: [0, 0], src: [19, 37], f: 3 }];
    layer.visible = false;
    assert.deepEqual(tileLayers(level), []);
    layer.visible = true;
    assert.deepEqual(tileLayers(level), [layer]);
    assert.deepEqual(layer.gridTiles[0], { px: [0, 0], src: [19, 37], f: 3 });
    layer.__cWid++;
    assert.throws(() => tileLayers(level), /inconsistent grid dimensions/);
    layer.__cWid--;
    layer.autoLayerTiles = null;
    assert.throws(() => tileLayers(level), /missing tile arrays/);
    assert.throws(() => tileLayers({ ...level, pxWid: 0 }), /invalid pixel dimensions/);
    assert.throws(() => tileLayers({ ...level, layerInstances: null }), /no layerInstances array/);
});
