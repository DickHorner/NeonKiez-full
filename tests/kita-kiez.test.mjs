import assert from 'node:assert/strict';
import test from 'node:test';
import {
    STAGES, advanceStage, childArrives, createAttempt, giveLollipop, leaveAttempt,
    makeChildCry, retryStage, tickAttempt
} from '../src/game/kita-kiez/attempt.ts';

function clearStage(attempt) {
    for (let childIndex = 0; childIndex < attempt.childStates.length; childIndex++) {
        assert.equal(childArrives(attempt, childIndex), true);
    }
}

test('Kita-Kiez grows from three to six children across four timed stages', () => {
    const attempt = createAttempt();
    assert.deepEqual(STAGES.map(stage => stage.childCount), [3, 4, 5, 6]);
    assert.deepEqual(STAGES.map(stage => stage.name), [
        'ONE SIGN', 'TWO TURNS', 'PUDDLE ROUTE', 'PICKUP RUSH'
    ]);
    assert.equal(attempt.stage, 0);
    assert.equal(attempt.remainingMs, STAGES[0].timeLimitMs);
    assert.deepEqual(attempt.childStates, ['walking', 'walking', 'walking']);
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
});

test('a stuck child cries until the hero gives a lollipop and is never removed', () => {
    const attempt = createAttempt();
    assert.equal(makeChildCry(attempt, 1), true);
    assert.equal(makeChildCry(attempt, 1), false);
    assert.equal(childArrives(attempt, 1), false);
    assert.deepEqual(attempt.childStates, ['walking', 'crying', 'walking']);
    assert.equal(giveLollipop(attempt, 1), true);
    assert.equal(giveLollipop(attempt, 1), false);
    assert.deepEqual(attempt.childStates, ['walking', 'walking', 'walking']);
    assert.equal(attempt.childStates.length, STAGES[0].childCount);
});

test('all children must arrive and only the fourth stage clears the dungeon', () => {
    const attempt = createAttempt();

    for (let stage = 0; stage < STAGES.length; stage++) {
        assert.equal(attempt.stage, stage);
        clearStage(attempt);
        const final = stage === STAGES.length - 1;
        assert.equal(attempt.phase, final ? 'cleared' : 'stage-cleared');
        assert.equal(advanceStage(attempt), !final);
        if (!final) {
            assert.equal(attempt.phase, 'playing');
            assert.equal(attempt.remainingMs, STAGES[stage + 1].timeLimitMs);
            assert.equal(attempt.childStates.length, STAGES[stage + 1].childCount);
        }
    }
});

test('pickup timer times out without losing children and retry resets the same stage', () => {
    const attempt = createAttempt();
    assert.equal(tickAttempt(attempt, 1000), false);
    assert.equal(attempt.remainingMs, STAGES[0].timeLimitMs - 1000);
    assert.equal(makeChildCry(attempt, 0), true);
    assert.equal(tickAttempt(attempt, STAGES[0].timeLimitMs), true);
    assert.equal(attempt.phase, 'timed-out');
    assert.equal(attempt.remainingMs, 0);
    assert.equal(attempt.childStates.length, STAGES[0].childCount);
    assert.equal(giveLollipop(attempt, 0), false);
    assert.equal(retryStage(attempt), true);
    assert.equal(attempt.phase, 'playing');
    assert.equal(attempt.remainingMs, STAGES[0].timeLimitMs);
    assert.deepEqual(attempt.childStates, ['walking', 'walking', 'walking']);
});

test('invalid child indices and leaving freeze further progress', () => {
    const attempt = createAttempt();
    assert.equal(makeChildCry(attempt, -1), false);
    assert.equal(giveLollipop(attempt, 99), false);
    assert.equal(childArrives(attempt, 99), false);
    assert.equal(tickAttempt(attempt, Number.NaN), false);
    assert.equal(leaveAttempt(attempt), true);
    assert.equal(leaveAttempt(attempt), false);
    assert.equal(tickAttempt(attempt, 1000), false);
    assert.equal(makeChildCry(attempt, 0), false);
    assert.equal(childArrives(attempt, 0), false);
    assert.equal(retryStage(attempt), false);
});
