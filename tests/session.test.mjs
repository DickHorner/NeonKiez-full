import assert from 'node:assert/strict';
import test from 'node:test';
import { createSession, isDungeonCleared, markDungeonCleared } from '../src/game/session.ts';

test('new sessions are uncleared and independent', () => {
    const first = createSession();
    const second = createSession();
    assert.equal(isDungeonCleared(first, 'Asteroids'), false);
    markDungeonCleared(first, 'Asteroids');
    assert.equal(isDungeonCleared(first, 'Asteroids'), true);
    assert.equal(isDungeonCleared(second, 'Asteroids'), false);
    assert.equal(isDungeonCleared(createSession(), 'Asteroids'), false);
});

test('repeated clears store the stable ID once; queries do not mutate state', () => {
    const session = createSession();
    markDungeonCleared(session, 'Asteroids');
    markDungeonCleared(session, 'Asteroids');
    assert.equal(isDungeonCleared(session, 'Unknown'), false);
    assert.equal(isDungeonCleared(session, 'assets/Asteroids.ts'), false);
    assert.deepEqual(session, { clearedDungeonIds: ['Asteroids'] });
});

test('session state round-trips through JSON and remains queryable', () => {
    const session = createSession();
    markDungeonCleared(session, 'Asteroids');
    const restored = JSON.parse(JSON.stringify(session));
    assert.deepEqual(restored, session);
    assert.equal(isDungeonCleared(restored, 'Asteroids'), true);
    markDungeonCleared(restored, 'Asteroids');
    assert.deepEqual(restored.clearedDungeonIds, ['Asteroids']);
});

test('School Pong Court clear is independent from Asteroids and serializable', () => {
    const session = createSession();
    assert.equal(isDungeonCleared(session, 'SchoolPongCourt'), false);
    markDungeonCleared(session, 'SchoolPongCourt');
    markDungeonCleared(session, 'SchoolPongCourt');
    assert.equal(isDungeonCleared(session, 'Asteroids'), false);
    const restored = JSON.parse(JSON.stringify(session));
    assert.equal(isDungeonCleared(restored, 'SchoolPongCourt'), true);
    markDungeonCleared(restored, 'Asteroids');
    assert.deepEqual(restored.clearedDungeonIds, ['SchoolPongCourt', 'Asteroids']);
});

test('Video Store clear is independent and stores the stable ID once', () => {
    const session = createSession();
    assert.equal(isDungeonCleared(session, 'VideoStorePlatform'), false);
    markDungeonCleared(session, 'VideoStorePlatform');
    markDungeonCleared(session, 'VideoStorePlatform');
    assert.equal(isDungeonCleared(session, 'RooftopInvaders'), false);
    assert.deepEqual(session.clearedDungeonIds, ['VideoStorePlatform']);
    assert.deepEqual(JSON.parse(JSON.stringify(session)), session);
});

test('Subway Timing clear is independent and stores the stable ID once', () => {
    const session = createSession();
    assert.equal(isDungeonCleared(session, 'SubwayTiming'), false);
    markDungeonCleared(session, 'SubwayTiming');
    markDungeonCleared(session, 'SubwayTiming');
    assert.equal(isDungeonCleared(session, 'VideoStorePlatform'), false);
    assert.deepEqual(session.clearedDungeonIds, ['SubwayTiming']);
    assert.deepEqual(JSON.parse(JSON.stringify(session)), session);
});


test('Laundromat Labyrinth clear is independent and stores the stable ID once', () => {
    const session = createSession();
    assert.equal(isDungeonCleared(session, 'LaundromatLabyrinth'), false);
    markDungeonCleared(session, 'LaundromatLabyrinth');
    markDungeonCleared(session, 'LaundromatLabyrinth');
    assert.equal(isDungeonCleared(session, 'SubwayTiming'), false);
    assert.deepEqual(session.clearedDungeonIds, ['LaundromatLabyrinth']);
    assert.deepEqual(JSON.parse(JSON.stringify(session)), session);
});


test('Warehouse Blockworks clear is independent and stores the stable ID once', () => {
    const session = createSession();
    assert.equal(isDungeonCleared(session, 'WarehouseBlockworks'), false);
    markDungeonCleared(session, 'WarehouseBlockworks');
    markDungeonCleared(session, 'WarehouseBlockworks');
    assert.equal(isDungeonCleared(session, 'LaundromatLabyrinth'), false);
    assert.deepEqual(session.clearedDungeonIds, ['WarehouseBlockworks']);
    assert.deepEqual(JSON.parse(JSON.stringify(session)), session);
});


test('Construction Donkey Tower clear is independent and stores the stable ID once', () => {
    const session = createSession();
    assert.equal(isDungeonCleared(session, 'ConstructionDonkeyTower'), false);
    markDungeonCleared(session, 'ConstructionDonkeyTower');
    markDungeonCleared(session, 'ConstructionDonkeyTower');
    assert.equal(isDungeonCleared(session, 'WarehouseBlockworks'), false);
    assert.deepEqual(session.clearedDungeonIds, ['ConstructionDonkeyTower']);
    assert.deepEqual(JSON.parse(JSON.stringify(session)), session);
});


test('Final Glitch Panopticon clear is independent and stores the stable ID once', () => {
    const session = createSession();
    assert.equal(isDungeonCleared(session, 'FinalGlitchPanopticon'), false);
    markDungeonCleared(session, 'FinalGlitchPanopticon');
    markDungeonCleared(session, 'FinalGlitchPanopticon');
    assert.equal(isDungeonCleared(session, 'ConstructionDonkeyTower'), false);
    assert.deepEqual(session.clearedDungeonIds, ['FinalGlitchPanopticon']);
    assert.deepEqual(JSON.parse(JSON.stringify(session)), session);
});
