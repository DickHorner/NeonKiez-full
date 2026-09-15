import assert from 'node:assert/strict';
import test from 'node:test';
import {
    STAGES, createAttempt, reachGoal, advanceStage, toggleGates, leaveAttempt
} from '../src/game/video-store-platform/attempt.ts';

test('video store starts at the jump tutorial with serializable state', () => {
    const attempt = createAttempt();
    assert.equal(STAGES.length, 4);
    assert.deepEqual(attempt, { stage: 0, phase: 'playing', gatesOpen: false });
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
});

test('goals advance exactly four stages and only the final goal clears', () => {
    const attempt = createAttempt();
    for (let stage = 0; stage < STAGES.length; stage++) {
        assert.equal(attempt.stage, stage);
        assert.equal(attempt.phase, 'playing');
        assert.equal(reachGoal(attempt), true);
        const final = stage === STAGES.length - 1;
        assert.equal(attempt.phase, final ? 'cleared' : 'stage-cleared');
        assert.equal(reachGoal(attempt), false);
        assert.equal(advanceStage(attempt), !final);
    }
    assert.equal(attempt.stage, 3);
    assert.equal(attempt.phase, 'cleared');
});

test('switch gates toggle only during active stage 2 and reset on progression', () => {
    const attempt = createAttempt();
    assert.equal(toggleGates(attempt), false);
    reachGoal(attempt);
    advanceStage(attempt);
    assert.equal(toggleGates(attempt), false);
    reachGoal(attempt);
    advanceStage(attempt);
    assert.equal(attempt.stage, 2);
    assert.equal(toggleGates(attempt), true);
    assert.equal(attempt.gatesOpen, true);
    assert.equal(toggleGates(attempt), true);
    assert.equal(attempt.gatesOpen, false);
    assert.equal(toggleGates(attempt), true);
    assert.equal(attempt.gatesOpen, true);
    reachGoal(attempt);
    assert.equal(toggleGates(attempt), false);
    assert.equal(advanceStage(attempt), true);
    assert.equal(attempt.stage, 3);
    assert.equal(attempt.gatesOpen, false);
});

test('leaving blocks goals, gate changes and stage progression', () => {
    const attempt = createAttempt();
    assert.equal(leaveAttempt(attempt), true);
    assert.equal(leaveAttempt(attempt), false);
    assert.equal(reachGoal(attempt), false);
    assert.equal(toggleGates(attempt), false);
    assert.equal(advanceStage(attempt), false);
    assert.deepEqual(attempt, { stage: 0, phase: 'leaving', gatesOpen: false });
});
