import assert from 'node:assert/strict';
import test from 'node:test';
import {
    BEAT_INTERVAL_MS, BPM, GOOD_WINDOW_MS, MISS_LIMIT, STAGES,
    activateSwitch, advanceStage, createAttempt, leaveAttempt, reachGoal, retryStage, tapBeat
} from '../src/game/subway-timing/attempt.ts';

function goodTap(attempt) {
    const beatIndex = attempt.lastConsumedBeat + 1;
    return tapBeat(attempt, attempt.beatOriginAt + beatIndex * BEAT_INTERVAL_MS);
}

function reachStage(targetStage) {
    const attempt = createAttempt(0);
    while (attempt.stage < targetStage) {
        if (attempt.stage === 0) {
            while (attempt.phase === 'playing') goodTap(attempt);
        } else if (attempt.stage === 1) {
            while (attempt.streak < STAGES[1].streakTarget) goodTap(attempt);
            assert.equal(reachGoal(attempt), true);
        } else if (attempt.stage === 2) {
            for (let index = 0; index < STAGES[2].switchCount; index++) {
                const result = goodTap(attempt);
                assert.equal(result.kind, 'good');
                assert.equal(activateSwitch(attempt, index, result.beatIndex), true);
            }
            while (attempt.phase === 'playing') goodTap(attempt);
        }
        assert.equal(advanceStage(attempt, 10000 + attempt.stage * 1000), true);
    }
    return attempt;
}

test('Subway Timing keeps the Pocket rhythm constants and four-stage shape', () => {
    const attempt = createAttempt(1000);
    assert.equal(BPM, 120);
    assert.equal(BEAT_INTERVAL_MS, 500);
    assert.equal(GOOD_WINDOW_MS, 200);
    assert.equal(MISS_LIMIT, 3);
    assert.deepEqual(STAGES.map(stage => stage.streakTarget), [3, 5, 8, 12]);
    assert.deepEqual(STAGES.map(stage => stage.doorCount), [0, 3, 0, 0]);
    assert.deepEqual(STAGES.map(stage => stage.switchCount), [0, 0, 6, 0]);
    assert.equal(attempt.beatOriginAt, 1500);
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
});

test('tap judgement has a symmetric 200 ms window, consumes one tap per beat and loses at three misses', () => {
    const attempt = createAttempt(1000);
    assert.equal(tapBeat(attempt, 1300).kind, 'good');
    assert.equal(attempt.streak, 1);
    assert.equal(tapBeat(attempt, 1500).kind, 'ignored');
    assert.equal(attempt.streak, 1);

    assert.equal(tapBeat(attempt, 1750).kind, 'miss');
    assert.equal(attempt.streak, 0);
    assert.equal(attempt.misses, 1);
    assert.equal(tapBeat(attempt, 2250).kind, 'miss');
    assert.equal(tapBeat(attempt, 2750).kind, 'miss');
    assert.equal(attempt.phase, 'lost');
    assert.equal(tapBeat(attempt, 3000).kind, 'ignored');

    assert.equal(retryStage(attempt, 4000), true);
    assert.equal(attempt.phase, 'playing');
    assert.equal(attempt.streak, 0);
    assert.equal(attempt.misses, 0);
    assert.equal(attempt.beatOriginAt, 4500);
});

test('tutorial clears on three consecutive good beats and stage advance resets timing state', () => {
    const attempt = createAttempt(0);
    for (let index = 0; index < 3; index++) assert.equal(goodTap(attempt).kind, 'good');
    assert.equal(attempt.phase, 'stage-cleared');
    assert.equal(advanceStage(attempt, 5000), true);
    assert.equal(attempt.stage, 1);
    assert.equal(attempt.phase, 'playing');
    assert.equal(attempt.streak, 0);
    assert.equal(attempt.misses, 0);
    assert.equal(attempt.doorsOpen, false);
    assert.equal(attempt.beatOriginAt, 5500);
});

test('door stage opens on good timing, closes on miss and requires both streak and goal', () => {
    const attempt = reachStage(1);
    const first = goodTap(attempt);
    assert.equal(first.kind, 'good');
    assert.equal(attempt.doorsOpen, true);
    assert.equal(reachGoal(attempt), false);

    assert.equal(tapBeat(attempt, attempt.beatOriginAt + 750).kind, 'miss');
    assert.equal(attempt.doorsOpen, false);
    assert.equal(attempt.streak, 0);

    while (attempt.streak < STAGES[1].streakTarget) goodTap(attempt);
    assert.equal(attempt.phase, 'playing');
    assert.equal(attempt.doorsOpen, true);
    assert.equal(reachGoal(attempt), true);
    assert.equal(attempt.phase, 'stage-cleared');
});

test('switch chain requires six ordered on-beat activations plus an eight-beat streak', () => {
    const attempt = reachStage(2);
    let result = goodTap(attempt);
    assert.equal(result.kind, 'good');
    assert.equal(activateSwitch(attempt, 1, result.beatIndex), false);
    assert.equal(activateSwitch(attempt, 0, result.beatIndex), true);
    assert.equal(activateSwitch(attempt, 0, result.beatIndex), false);
    assert.equal(attempt.activatedSwitches.length, 1);

    for (let index = 1; index < STAGES[2].switchCount; index++) {
        result = goodTap(attempt);
        assert.equal(result.kind, 'good');
        assert.equal(activateSwitch(attempt, index, result.beatIndex), true);
    }
    assert.deepEqual(attempt.activatedSwitches, [0, 1, 2, 3, 4, 5]);
    assert.equal(attempt.streak, 6);
    assert.equal(attempt.phase, 'playing');

    goodTap(attempt);
    goodTap(attempt);
    assert.equal(attempt.streak, 8);
    assert.equal(attempt.phase, 'stage-cleared');
});

test('final stage clears only at twelve clean beats and leaving blocks further play', () => {
    const attempt = reachStage(3);
    for (let index = 0; index < 11; index++) goodTap(attempt);
    assert.equal(attempt.phase, 'playing');
    goodTap(attempt);
    assert.equal(attempt.phase, 'cleared');
    assert.equal(advanceStage(attempt, 99999), false);
    assert.equal(retryStage(attempt, 99999), false);

    const leaving = createAttempt();
    assert.equal(leaveAttempt(leaving), true);
    assert.equal(leaveAttempt(leaving), false);
    assert.equal(tapBeat(leaving, leaving.beatOriginAt).kind, 'ignored');
});
