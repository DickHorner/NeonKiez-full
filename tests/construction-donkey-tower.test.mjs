import assert from 'node:assert/strict';
import test from 'node:test';
import {
    BARREL_CAP, BARREL_LIFE_MS, BARREL_SPAWN_INTERVAL_MS, HIT_IFRAME_MS, HIT_STUN_MS, STAGES,
    advanceStage, createAttempt, hitPlayer, leaveAttempt, reachGoal, shouldSpawnBarrel
} from '../src/game/construction-donkey-tower/attempt.ts';

function reachStage(targetStage) {
    const attempt = createAttempt(0);
    let now = 0;
    while (attempt.stage < targetStage) {
        assert.equal(reachGoal(attempt), true);
        now += 100;
        assert.equal(advanceStage(attempt, now), true);
    }
    return { attempt, now };
}

test('Donkey Tower keeps four stages with barrels starting after the ladder tutorial', () => {
    const attempt = createAttempt(100);
    assert.deepEqual(STAGES.map(stage => stage.name), [
        'LADDERS', 'BARRELS', 'TRICK LADDERS', 'TOP PLATFORM'
    ]);
    assert.deepEqual(STAGES.map(stage => stage.barrels), [false, true, true, true]);
    assert.equal(BARREL_CAP, 4);
    assert.equal(BARREL_SPAWN_INTERVAL_MS, 3000);
    assert.equal(BARREL_LIFE_MS, 10000);
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
});

test('ladder tutorial never spawns barrels', () => {
    const attempt = createAttempt(0);
    assert.equal(shouldSpawnBarrel(attempt, 10000, 0), false);
    assert.equal(hitPlayer(attempt, 10000), false);
});

test('barrels spawn every three seconds and respect the cap', () => {
    const { attempt, now } = reachStage(1);
    assert.equal(shouldSpawnBarrel(attempt, now + 2999, 0), false);
    assert.equal(shouldSpawnBarrel(attempt, now + 3000, 0), true);
    assert.equal(shouldSpawnBarrel(attempt, now + 3000, 1), false);
    assert.equal(shouldSpawnBarrel(attempt, now + 6000, BARREL_CAP), false);
    assert.equal(shouldSpawnBarrel(attempt, now + 6000, BARREL_CAP - 1), true);
});

test('barrel hits are harmless stun plus temporary i-frames', () => {
    const { attempt } = reachStage(1);
    assert.equal(hitPlayer(attempt, 1000), true);
    assert.equal(attempt.phase, 'playing');
    assert.equal(attempt.stunnedUntil, 1000 + HIT_STUN_MS);
    assert.equal(attempt.protectedUntil, 1000 + HIT_IFRAME_MS);
    assert.equal(hitPlayer(attempt, 1500), false);
    assert.equal(hitPlayer(attempt, 1900), true);
    assert.equal(attempt.phase, 'playing');
});

test('all four goals are required and only the final goal clears the dungeon', () => {
    const attempt = createAttempt(0);
    for (let stage = 0; stage < STAGES.length; stage++) {
        assert.equal(attempt.stage, stage);
        assert.equal(reachGoal(attempt), true);
        if (stage === STAGES.length - 1) {
            assert.equal(attempt.phase, 'cleared');
            assert.equal(advanceStage(attempt, stage + 1), false);
        } else {
            assert.equal(attempt.phase, 'stage-cleared');
            assert.equal(advanceStage(attempt, stage + 1), true);
            assert.equal(attempt.phase, 'playing');
        }
    }
});

test('leaving freezes goal, hit and spawn progression', () => {
    const { attempt } = reachStage(1);
    assert.equal(leaveAttempt(attempt), true);
    assert.equal(leaveAttempt(attempt), false);
    assert.equal(reachGoal(attempt), false);
    assert.equal(hitPlayer(attempt, 10000), false);
    assert.equal(shouldSpawnBarrel(attempt, 10000, 0), false);
});
