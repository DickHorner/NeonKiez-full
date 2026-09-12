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
