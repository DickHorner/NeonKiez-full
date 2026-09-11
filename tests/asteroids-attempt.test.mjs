import assert from 'node:assert/strict';
import test from 'node:test';
import { createAttempt, loseLife, respawn, clearAttempt } from '../src/game/asteroids/attempt.ts';

test('an attempt is serializable and duplicate death callbacks consume only one life', () => {
    const attempt = createAttempt(3);
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
    assert.equal(loseLife(attempt, 100, 900), true);
    assert.equal(attempt.lives, 2);
    assert.equal(attempt.phase, 'respawning');
    assert.equal(loseLife(attempt, 101, 900), false);
    assert.equal(attempt.lives, 2);
});

test('respawn waits for both delay and safety; protection blocks immediate repeated death', () => {
    const attempt = createAttempt(3);
    loseLife(attempt, 100, 900);
    assert.equal(respawn(attempt, 999, true, 1200), false);
    assert.equal(respawn(attempt, 1000, false, 1200), false);
    assert.equal(respawn(attempt, 1100, true, 1200), true);
    assert.equal(respawn(attempt, 1101, true, 1200), false);
    assert.equal(loseLife(attempt, 2299, 900), false);
    assert.equal(loseLife(attempt, 2300, 900), true);
    assert.equal(attempt.lives, 1);
});

test('third death loses the attempt; retry starts an independent fresh attempt', () => {
    const attempt = createAttempt(3);
    for (let life = 3; life > 0; life--) {
        assert.equal(loseLife(attempt, 10000 * (4 - life), 900), true);
        if (life > 1) respawn(attempt, 10000 * (4 - life) + 900, true, 1200);
    }
    assert.equal(attempt.lives, 0);
    assert.equal(attempt.phase, 'lost');
    assert.equal(loseLife(attempt, 50000, 900), false);
    assert.equal(respawn(attempt, 50000, true, 1200), false);
    assert.equal(clearAttempt(attempt), false);
    assert.equal(createAttempt(3).lives, 3);
    assert.equal(attempt.lives, 0);
});

test('clear is terminal and also resolves an otherwise live respawn state', () => {
    for (const phase of ['playing', 'respawning']) {
        const attempt = createAttempt(3);
        attempt.phase = phase;
        assert.equal(clearAttempt(attempt), true);
        assert.equal(attempt.phase, 'cleared');
        assert.equal(loseLife(attempt, 5000, 900), false);
        assert.equal(respawn(attempt, 5000, true, 1200), false);
        assert.equal(clearAttempt(attempt), false);
    }
    const leaving = createAttempt(3);
    leaving.phase = 'leaving';
    assert.equal(clearAttempt(leaving), false);
    assert.equal(loseLife(leaving, 5000, 900), false);
});
