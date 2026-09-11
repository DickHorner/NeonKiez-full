import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
    readProject,
    requireLevel,
    requireLayer,
    requireEntity,
    findEntities
} from '../src/game/ldtk/read.ts';

const loadFixture = () => JSON.parse(readFileSync(
    new URL('../public/assets/ldtk/neonkiez-ldtk.ldtk', import.meta.url),
    'utf8'
));

test('selects the existing vertical slice without copying or changing LDtk data', () => {
    const data = loadFixture();
    const before = JSON.stringify(data);
    const project = readProject(data);
    const level = requireLevel(project, 'Hub_Test');
    const ground = requireLayer(level, 'Ground');
    const collision = requireLayer(level, 'Collision');
    const entities = requireLayer(level, 'Entities');
    const spawn = requireEntity(entities, 'Player_Spawn');
    const entrances = findEntities(entities, 'DungeonEntrance');

    assert.equal(project, data);
    assert.equal(level, data.levels[0]);
    assert.equal(ground, level.layerInstances.find(l => l.__identifier === 'Ground'));
    assert.equal(collision, level.layerInstances.find(l => l.__identifier === 'Collision'));
    assert.equal(spawn, entities.entityInstances.find(e => e.__identifier === 'Player_Spawn'));
    assert.deepEqual([level.pxWid, level.pxHei], [768, 512]);
    assert.equal(ground.gridTiles.length, 1536);
    assert.equal(collision.autoLayerTiles.length, 61);
    assert.equal(collision.intGridCsv.length, collision.__cWid * collision.__cHei);
    assert.equal(collision.intGridCsv.filter(value => value !== 0).length, 61);
    assert.deepEqual([spawn.px[0] + spawn.width / 2, spawn.px[1] + spawn.height / 2], [376, 200]);
    assert.equal(entrances.length, 1);
    assert.equal(entrances[0], entities.entityInstances.find(e => e.__identifier === 'DungeonEntrance'));
    assert.equal(entrances[0].fieldInstances.find(f => f.__identifier === 'DungeonID').__value, 'Asteroids');
    assert.equal(JSON.stringify(data), before);
});

test('reports missing project data and levels collection', () => {
    for (const value of [undefined, null, false, '', {}, { levels: null }, { levels: {} }]) {
        assert.throws(() => readProject(value), /LDtk project is missing or has no levels array/);
    }
    assert.throws(() => requireLevel(readProject({ levels: [] }), 'Hub_Test'), /LDtk level "Hub_Test" not found/);
    assert.throws(() => requireLevel(readProject(loadFixture()), 'Unknown'), /LDtk level "Unknown" not found/);
});

test('reports missing required layers and layer collections with level context', () => {
    for (const identifier of ['Ground', 'Collision', 'Entities']) {
        const level = requireLevel(readProject(loadFixture()), 'Hub_Test');
        level.layerInstances = level.layerInstances.filter(l => l.__identifier !== identifier);
        assert.throws(() => requireLayer(level, identifier), {
            message: `LDtk layer "${identifier}" not found in level "Hub_Test"`
        });
    }
    for (const layerInstances of [undefined, null]) {
        assert.throws(() => requireLayer({ identifier: 'Hub_Test', layerInstances }, 'Ground'),
            /LDtk level "Hub_Test" has no layerInstances array/);
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
    const level = { identifier: 'Hub_Test', layerInstances: [layer, { __identifier: 'Entities' }] };
    const project = { levels: [level, { identifier: 'Hub_Test' }] };
    assert.equal(requireLevel(project, 'Hub_Test'), level);
    assert.equal(requireLayer(level, 'Entities'), layer);
    assert.equal(requireEntity(layer, 'Player_Spawn'), first);
    assert.deepEqual(findEntities(layer, 'DungeonEntrance'), [entranceA, entranceB]);
});
