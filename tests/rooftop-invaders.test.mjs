import assert from 'node:assert/strict';
import test from 'node:test';
import {
    STAGES, ENEMY_CAP, createAttempt, hitEnemy, advanceWave, advanceStage,
    spawnAlarm, hitCore, hitPlayer, retryStage
} from '../src/game/rooftop-invaders/attempt.ts';
import { createSession, markDungeonCleared, isDungeonCleared } from '../src/game/session.ts';

function clearWave(attempt, now = 0) {
    for (const id of [...attempt.remainingEnemies]) assert.equal(hitEnemy(attempt, id, now), true);
}
function reachStage(stage) {
    const attempt = createAttempt();
    while (attempt.stage < stage) {
        clearWave(attempt);
        if (!advanceWave(attempt, 1000)) assert.equal(advanceStage(attempt, 1000), true);
    }
    return attempt;
}

test('fresh serializable attempt has three range enemies and exact wave counts', () => {
    const attempt = createAttempt();
    assert.deepEqual(STAGES.map(s => s.enemiesPerWave.length), [1, 3, 4, 1]);
    assert.equal(attempt.stage, 0);
    assert.equal(attempt.wave, 0);
    assert.equal(attempt.phase, 'playing');
    assert.deepEqual(attempt.remainingEnemies, [0, 1, 2]);
    assert.equal(attempt.coreHP, 30);
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
    hitEnemy(attempt, 0, 0);
    assert.equal(createAttempt().remainingEnemies.length, 3);
});

test('all eight normal waves are required; live waves and duplicate hits cannot advance', () => {
    const attempt = createAttempt();
    let waves = 0;
    for (let stage = 0; stage < 3; stage++) {
        for (let wave = 0; wave < STAGES[stage].enemiesPerWave.length; wave++) {
            assert.equal(attempt.stage, stage);
            assert.equal(attempt.wave, wave);
            assert.equal(advanceWave(attempt, 99999), false);
            assert.equal(advanceStage(attempt, 99999), false);
            assert.equal(hitCore(attempt), false);
            assert.equal(hitEnemy(attempt, -1, 0), false);
            const first = attempt.remainingEnemies[0];
            assert.equal(hitEnemy(attempt, first, 0), true);
            assert.equal(hitEnemy(attempt, first, 0), false);
            clearWave(attempt);
            waves++;
            if (wave + 1 < STAGES[stage].enemiesPerWave.length) {
                assert.equal(attempt.phase, 'wave-wait');
                assert.equal(advanceWave(attempt, 999), false);
                assert.equal(advanceWave(attempt, 1000), true);
            } else {
                assert.equal(attempt.phase, 'stage-cleared');
                assert.equal(advanceStage(attempt, 1000), true);
            }
        }
    }
    assert.equal(waves, 8);
    assert.equal(attempt.stage, 3);
    assert.equal(attempt.coreHP, 30);
    assert.deepEqual(attempt.remainingEnemies, []);
});

test('alarm ticks every five seconds, respects cap, and blocks progression until bonus bots clear', () => {
    const attempt = reachStage(2);
    assert.equal(spawnAlarm(attempt, 5999), null);
    const alarm = spawnAlarm(attempt, 6000);
    assert.equal(typeof alarm, 'number');
    assert.equal(spawnAlarm(attempt, 6000), null);
    for (const id of [...attempt.remainingEnemies].filter(id => id !== alarm)) hitEnemy(attempt, id, 6000);
    assert.equal(advanceWave(attempt, 99999), false);
    assert.equal(hitEnemy(attempt, alarm, 6000), true);
    assert.equal(spawnAlarm(attempt, 99999), null);
    advanceWave(attempt, 7000);
    for (let now = 11000; now <= 60000; now += 5000) spawnAlarm(attempt, now);
    assert.equal(attempt.remainingEnemies.length, ENEMY_CAP);
    assert.equal(spawnAlarm(attempt, 61000), null);
    assert.equal(attempt.remainingEnemies.length, ENEMY_CAP);
    clearWave(attempt, 61000);
    assert.equal(spawnAlarm(attempt, 99999), null);
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
    assert.equal(spawnAlarm(createAttempt(), 99999), null);
});

test('only thirty valid core hits clear; terminal hits clamp at zero and session is independent', () => {
    const attempt = reachStage(3);
    const session = createSession();
    for (let hp = 30; hp > 0; hp--) {
        assert.equal(attempt.coreHP, hp);
        assert.equal(attempt.phase, 'playing');
        assert.equal(hitCore(attempt), true);
    }
    assert.equal(attempt.phase, 'cleared');
    assert.equal(attempt.coreHP, 0);
    assert.equal(hitCore(attempt), false);
    assert.equal(advanceStage(attempt, 0), false);
    markDungeonCleared(session, 'RooftopInvaders');
    markDungeonCleared(session, 'RooftopInvaders');
    assert.deepEqual(session.clearedDungeonIds, ['RooftopInvaders']);
    assert.equal(isDungeonCleared(session, 'Asteroids'), false);
    assert.equal(isDungeonCleared(session, 'SchoolPongCourt'), false);
    assert.equal(createAttempt().phase, 'playing');
    assert.equal(isDungeonCleared(session, 'RooftopInvaders'), true);
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
});

test('contact protection, stage retry, and leaving never produce completion', () => {
    for (let stage = 0; stage < 4; stage++) {
        const attempt = reachStage(stage);
        assert.equal(hitPlayer(attempt, 0), true);
        assert.equal(hitPlayer(attempt, 999), false);
        assert.equal(hitPlayer(attempt, 1000), true);
        assert.equal(hitPlayer(attempt, 2000), true);
        assert.equal(attempt.phase, 'lost');
        assert.equal(hitCore(attempt), false);
        assert.equal(spawnAlarm(attempt, 99999), null);
        assert.equal(retryStage(attempt, 3000), true);
        assert.equal(attempt.stage, stage);
        assert.equal(attempt.wave, 0);
        assert.equal(attempt.hearts, 3);
        assert.equal(attempt.coreHP, 30);
        attempt.phase = 'leaving';
        assert.equal(hitCore(attempt), false);
        assert.equal(hitEnemy(attempt, attempt.remainingEnemies[0], 0), false);
        assert.equal(advanceWave(attempt, 99999), false);
        assert.equal(advanceStage(attempt, 99999), false);
        assert.equal(spawnAlarm(attempt, 99999), null);
        assert.equal(retryStage(attempt, 99999), false);
        assert.equal(hitPlayer(attempt, 99999), false);
    }
});
