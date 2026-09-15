import assert from 'node:assert/strict';
import test from 'node:test';
import {
    STAGES, createAttempt, serveBall, missBall, hitTarget, advanceStage, paddleBounce
} from '../src/game/school-pong-court/attempt.ts';

test('court starts independently with three tutorial targets and a slower ball', () => {
    const attempt = createAttempt();
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
    assert.deepEqual(STAGES.map(stage => stage.targetCount), [3, 8, 6, 12]);
    assert.ok(STAGES[0].ballSpeed < STAGES[1].ballSpeed);
    assert.equal(attempt.phase, 'ready');
    assert.equal(hitTarget(attempt, 0), false);
    assert.equal(advanceStage(attempt), false);
    serveBall(attempt);
    hitTarget(attempt, 0);
    assert.deepEqual(createAttempt().remainingTargets, [0, 1, 2]);
});

test('single ball, duplicate hits and misses cannot reset progress or skip stages', () => {
    const attempt = createAttempt();
    assert.equal(serveBall(attempt), true);
    assert.equal(serveBall(attempt), false);
    assert.equal(hitTarget(attempt, 99), false);
    assert.equal(hitTarget(attempt, 0), true);
    assert.equal(hitTarget(attempt, 0), false);
    assert.equal(missBall(attempt), true);
    assert.equal(missBall(attempt), false);
    assert.deepEqual(attempt.remainingTargets, [1, 2]);
    assert.equal(hitTarget(attempt, 1), false);
    assert.equal(advanceStage(attempt), false);
    assert.equal(serveBall(attempt), true);
    assert.deepEqual(attempt.remainingTargets, [1, 2]);
});

test('only all 29 targets across all four stages produce a final clear', () => {
    const attempt = createAttempt();
    let hits = 0;
    for (let stage = 0; stage < STAGES.length; stage++) {
        assert.equal(attempt.stage, stage);
        assert.equal(attempt.remainingTargets.length, STAGES[stage].targetCount);
        assert.equal(serveBall(attempt), true);
        for (const id of [...attempt.remainingTargets]) {
            assert.equal(attempt.phase, 'playing');
            assert.equal(hitTarget(attempt, id), true);
            hits++;
        }
        const final = stage === STAGES.length - 1;
        assert.equal(attempt.phase, final ? 'cleared' : 'stage-cleared');
        assert.equal(hitTarget(attempt, 0), false);
        assert.equal(missBall(attempt), false);
        assert.equal(serveBall(attempt), false);
        assert.equal(advanceStage(attempt), !final);
    }
    assert.equal(hits, 29);
    assert.equal(attempt.phase, 'cleared');
});

test('leaving blocks further serve, hit and stage progression', () => {
    const attempt = createAttempt();
    serveBall(attempt);
    attempt.phase = 'leaving';
    assert.equal(serveBall(attempt), false);
    assert.equal(missBall(attempt), false);
    assert.equal(hitTarget(attempt, 0), false);
    assert.equal(advanceStage(attempt), false);
    assert.deepEqual(attempt.remainingTargets, [0, 1, 2]);
});

test('paddle hit position controls direction, preserves speed and prevents flat rebounds', () => {
    assert.deepEqual(paddleBounce(0, 45, 240), { x: 0, y: -240 });
    for (const offset of [-90, -45, -20, 20, 45, 90]) {
        const velocity = paddleBounce(offset, 45, 240);
        assert.equal(Math.sign(velocity.x), Math.sign(offset));
        assert.ok(velocity.y <= -120);
        assert.ok(Math.abs(Math.hypot(velocity.x, velocity.y) - 240) < 0.0001);
    }
    assert.deepEqual(paddleBounce(90, 45, 240), paddleBounce(45, 45, 240));
});
