import assert from 'node:assert/strict';
import test from 'node:test';
import {
    JAM_DURATION_MS, JAM_TARGET_SCORE, STAGES, advanceStage, createAttempt, leaveAttempt,
    recordLanding, retryStage, tickAttempt
} from '../src/game/halfpipe-skate/attempt.ts';

test('Halfpipe starts with four serializable stages and no speculative persistent state', () => {
    const attempt = createAttempt();
    assert.deepEqual(STAGES.map(stage => stage.name), ['PUMP', 'AIR', 'TRICKS', 'KIEZ JAM']);
    assert.equal(attempt.stage, 0);
    assert.equal(attempt.phase, 'playing');
    assert.equal(attempt.score, 0);
    assert.equal(attempt.combo, 0);
    assert.equal(attempt.remainingMs, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
});

test('Pump stage clears on the first clean air while a wipeout only resets combo', () => {
    const attempt = createAttempt();

    assert.equal(recordLanding(attempt, 'left', false, null), true);
    assert.equal(attempt.phase, 'playing');
    assert.equal(attempt.cleanLandings, 0);
    assert.equal(attempt.combo, 0);

    assert.equal(recordLanding(attempt, 'right', true, null), true);
    assert.equal(attempt.cleanLandings, 1);
    assert.equal(attempt.phase, 'stage-cleared');
});

test('Air stage requires three clean landings', () => {
    const attempt = createAttempt();
    assert.equal(recordLanding(attempt, 'right', true, null), true);
    assert.equal(advanceStage(attempt), true);
    assert.equal(attempt.stage, 1);

    assert.equal(recordLanding(attempt, 'left', true, null), true);
    assert.equal(recordLanding(attempt, 'right', true, null), true);
    assert.equal(attempt.phase, 'playing');
    assert.equal(recordLanding(attempt, 'left', true, null), true);
    assert.equal(attempt.phase, 'stage-cleared');
});

test('Tricks stage requires three different tricks landed on alternating sides', () => {
    const attempt = createAttempt();
    assert.equal(recordLanding(attempt, 'right', true, null), true);
    assert.equal(advanceStage(attempt), true);
    for (let index = 0; index < 3; index++) {
        assert.equal(recordLanding(attempt, index % 2 === 0 ? 'left' : 'right', true, null), true);
    }
    assert.equal(advanceStage(attempt), true);
    assert.equal(attempt.stage, 2);

    assert.equal(recordLanding(attempt, 'left', true, 'grab'), true);
    assert.deepEqual(attempt.landedTricks, ['grab']);

    assert.equal(recordLanding(attempt, 'left', true, 'spin-left'), true);
    assert.deepEqual(attempt.landedTricks, ['grab']);

    assert.equal(recordLanding(attempt, 'right', true, 'spin-left'), true);
    assert.deepEqual(attempt.landedTricks, ['grab', 'spin-left']);

    assert.equal(recordLanding(attempt, 'left', true, 'spin-right'), true);
    assert.deepEqual(attempt.landedTricks, ['grab', 'spin-left', 'spin-right']);
    assert.equal(attempt.phase, 'stage-cleared');
});

test('Kiez Jam is a timed score attack and only its target clears the dungeon', () => {
    const attempt = createAttempt();
    assert.equal(recordLanding(attempt, 'right', true, null), true);
    assert.equal(advanceStage(attempt), true);
    for (let index = 0; index < 3; index++) recordLanding(attempt, 'left', true, null);
    assert.equal(advanceStage(attempt), true);
    recordLanding(attempt, 'left', true, 'grab');
    recordLanding(attempt, 'right', true, 'spin-left');
    recordLanding(attempt, 'left', true, 'spin-right');
    assert.equal(advanceStage(attempt), true);

    assert.equal(attempt.stage, 3);
    assert.equal(attempt.remainingMs, JAM_DURATION_MS);

    assert.equal(tickAttempt(attempt, 1000), false);
    assert.equal(attempt.remainingMs, JAM_DURATION_MS - 1000);

    recordLanding(attempt, 'right', true, 'grab');
    recordLanding(attempt, 'left', true, 'spin-left');
    assert.equal(attempt.phase, 'playing');
    assert.equal(attempt.landedTricks.length, 2);

    let side = 'right';
    while (attempt.score < JAM_TARGET_SCORE) {
        recordLanding(attempt, side, true, 'spin-right');
        side = side === 'right' ? 'left' : 'right';
    }

    assert.ok(attempt.score >= JAM_TARGET_SCORE);
    assert.deepEqual(attempt.landedTricks.sort(), ['grab', 'spin-left', 'spin-right'].sort());
    assert.equal(attempt.phase, 'cleared');
    assert.equal(advanceStage(attempt), false);
});

test('Kiez Jam times out into retry and leaving freezes progress', () => {
    const attempt = createAttempt();
    assert.equal(recordLanding(attempt, 'right', true, null), true);
    assert.equal(advanceStage(attempt), true);
    for (let index = 0; index < 3; index++) recordLanding(attempt, 'left', true, null);
    assert.equal(advanceStage(attempt), true);
    recordLanding(attempt, 'left', true, 'grab');
    recordLanding(attempt, 'right', true, 'spin-left');
    recordLanding(attempt, 'left', true, 'spin-right');
    assert.equal(advanceStage(attempt), true);

    assert.equal(tickAttempt(attempt, JAM_DURATION_MS), true);
    assert.equal(attempt.phase, 'lost');
    assert.equal(retryStage(attempt), true);
    assert.equal(attempt.phase, 'playing');
    assert.equal(attempt.remainingMs, JAM_DURATION_MS);

    assert.equal(leaveAttempt(attempt), true);
    assert.equal(leaveAttempt(attempt), false);
    assert.equal(recordLanding(attempt, 'left', true, 'grab'), false);
    assert.equal(tickAttempt(attempt, 1000), false);
    assert.equal(retryStage(attempt), false);
});
