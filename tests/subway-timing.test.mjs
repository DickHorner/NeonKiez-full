import assert from 'node:assert/strict';
import test from 'node:test';
import {
    BEAT_INTERVAL_MS, BPM, GOOD_WINDOW_MS, MISS_LIMIT, STAGES,
    advanceStage, beatCountdownMs, beatDistanceMs, createAttempt,
    leaveAttempt, reachGoal, retryStage, tapBeat
} from '../src/game/subway-timing/attempt.ts';

function goodTap(attempt, targetIndex = null) {
    const beatIndex = attempt.lastConsumedBeat + 1;
    return tapBeat(attempt, attempt.beatOriginAt + beatIndex * BEAT_INTERVAL_MS, targetIndex);
}

function reachStage(targetStage) {
    const attempt = createAttempt(0);
    while (attempt.stage < targetStage) {
        if (attempt.stage === 0) {
            while (attempt.phase === 'playing') goodTap(attempt);
        } else if (attempt.stage === 1) {
            while (!attempt.doorsOpen) goodTap(attempt);
            assert.equal(reachGoal(attempt), true);
        } else if (attempt.stage === 2) {
            for (let index = 0; index < STAGES[2].switchCount; index++) {
                assert.equal(goodTap(attempt, index).kind, 'good');
            }
        }
        assert.equal(advanceStage(attempt, 10000 + attempt.stage * 1000), true);
    }
    return attempt;
}

test('Subway Timing keeps the rhythm constants and four-stage progression', () => {
    const attempt = createAttempt(1000);
    assert.equal(BPM, 120);
    assert.equal(BEAT_INTERVAL_MS, 500);
    assert.equal(GOOD_WINDOW_MS, 200);
    assert.equal(MISS_LIMIT, 3);
    assert.deepEqual(STAGES.map(stage => stage.streakTarget), [3, 5, 8, 12]);
    assert.deepEqual(STAGES.map(stage => stage.doorCount), [0, 3, 0, 0]);
    assert.deepEqual(STAGES.map(stage => stage.switchCount), [0, 0, 8, 0]);
    assert.deepEqual(STAGES.map(stage => stage.markerCount), [0, 0, 0, 4]);
    assert.equal(attempt.beatOriginAt, 1500);
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
});

test('beat cue timing is locked to the same beat clock used for tap judgement', () => {
    const attempt = createAttempt(1000);
    assert.equal(beatCountdownMs(attempt, 1000), 500);
    assert.equal(beatCountdownMs(attempt, 1250), 250);
    assert.equal(beatCountdownMs(attempt, 1499), 1);
    assert.equal(beatCountdownMs(attempt, 1500), 0);
    assert.equal(beatDistanceMs(attempt, 1500), 0);
    assert.equal(beatCountdownMs(attempt, 1501), 499);
    assert.equal(beatCountdownMs(attempt, 2000), 0);
});

test('tap judgement consumes one tap per beat and loses at three misses', () => {
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

test('tutorial clears on three consecutive good beats', () => {
    const attempt = createAttempt(0);
    for (let index = 0; index < 3; index++) assert.equal(goodTap(attempt).kind, 'good');
    assert.equal(attempt.phase, 'stage-cleared');
    assert.equal(advanceStage(attempt, 5000), true);
    assert.equal(attempt.stage, 1);
});

test('door stage stays blocked until the full five-beat streak then latches open', () => {
    const attempt = reachStage(1);
    for (let index = 0; index < 4; index++) {
        assert.equal(goodTap(attempt).kind, 'good');
        assert.equal(attempt.doorsOpen, false);
    }
    assert.equal(goodTap(attempt).kind, 'good');
    assert.equal(attempt.streak, 5);
    assert.equal(attempt.doorsOpen, true);
    assert.equal(tapBeat(attempt, attempt.beatOriginAt + 5 * BEAT_INTERVAL_MS).kind, 'ignored');
    assert.equal(attempt.doorsOpen, true);
    assert.equal(reachGoal(attempt), true);
    assert.equal(attempt.phase, 'stage-cleared');
});

test('switch chain ties all eight pads to eight consecutive on-beat hits and clears on pad eight', () => {
    const attempt = reachStage(2);
    assert.equal(goodTap(attempt, 1).kind, 'miss');
    assert.deepEqual(attempt.activatedSwitches, []);
    assert.equal(attempt.streak, 0);

    for (let index = 0; index < STAGES[2].switchCount; index++) {
        assert.equal(goodTap(attempt, index).kind, 'good');
        assert.deepEqual(attempt.activatedSwitches, Array.from({ length: index + 1 }, (_, i) => i));
    }
    assert.equal(attempt.streak, 8);
    assert.equal(attempt.phase, 'stage-cleared');
});

test('final stage requires the lit field on every beat and clears after three four-field laps', () => {
    const attempt = reachStage(3);
    assert.equal(goodTap(attempt, 1).kind, 'miss');
    assert.equal(attempt.streak, 0);

    for (let index = 0; index < STAGES[3].streakTarget; index++) {
        const expectedMarker = index % STAGES[3].markerCount;
        assert.equal(goodTap(attempt, expectedMarker).kind, 'good');
    }
    assert.equal(attempt.streak, 12);
    assert.equal(attempt.phase, 'cleared');
    assert.equal(advanceStage(attempt, 99999), false);

    const leaving = createAttempt();
    assert.equal(leaveAttempt(leaving), true);
    assert.equal(tapBeat(leaving, leaving.beatOriginAt).kind, 'ignored');
});
