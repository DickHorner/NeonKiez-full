import assert from 'node:assert/strict';
import test from 'node:test';
import {
    CRATE_IFRAME_MS, CRATE_STUN_MS, STAGES,
    activateSwitch, advanceStage, bumpCrate, createAttempt, leaveAttempt, reachGoal
} from '../src/game/warehouse-blockworks/attempt.ts';

function reachStage(targetStage) {
    const attempt = createAttempt();
    while (attempt.stage < targetStage) {
        if (attempt.stage === 0) {
            assert.equal(activateSwitch(attempt, 'intro-switch'), true);
            assert.equal(reachGoal(attempt), true);
        } else if (attempt.stage === 1) {
            assert.equal(activateSwitch(attempt, 'row-a'), true);
            assert.equal(activateSwitch(attempt, 'row-b'), true);
            assert.equal(reachGoal(attempt), true);
        } else if (attempt.stage === 2) {
            assert.equal(reachGoal(attempt), true);
        }
        assert.equal(advanceStage(attempt), true);
    }
    return attempt;
}

test('Warehouse Blockworks keeps the four Pocket stage roles', () => {
    const attempt = createAttempt();
    assert.deepEqual(STAGES.map(stage => stage.name), [
        'CONVEYOR INTRO', 'BLOCK ROWS', 'MOVING CRATES', 'FINAL PATTERN'
    ]);
    assert.deepEqual(STAGES.map(stage => stage.switchesRequired), [1, 2, 0, 1]);
    assert.equal(attempt.stage, 0);
    assert.equal(attempt.phase, 'playing');
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
});

test('intro switch opens the gate and the goal requires it', () => {
    const attempt = createAttempt();
    assert.equal(reachGoal(attempt), false);
    assert.equal(activateSwitch(attempt, 'intro-switch'), true);
    assert.equal(attempt.gatesOpen, true);
    assert.equal(activateSwitch(attempt, 'intro-switch'), false);
    assert.equal(reachGoal(attempt), true);
    assert.equal(attempt.phase, 'stage-cleared');
});

test('block rows latch only after two distinct switches and stay open', () => {
    const attempt = reachStage(1);
    assert.equal(attempt.gatesOpen, false);
    assert.equal(activateSwitch(attempt, 'row-a'), true);
    assert.equal(attempt.gatesOpen, false);
    assert.equal(activateSwitch(attempt, 'row-a'), false);
    assert.equal(activateSwitch(attempt, 'row-b'), true);
    assert.equal(attempt.gatesOpen, true);
    assert.equal(reachGoal(attempt), true);
});

test('moving-crate stage needs no switch and crate bumps are harmless with i-frames', () => {
    const attempt = reachStage(2);
    assert.equal(activateSwitch(attempt, 'none'), false);
    assert.equal(bumpCrate(attempt, 1000), true);
    assert.equal(attempt.phase, 'playing');
    assert.equal(attempt.stunnedUntil, 1000 + CRATE_STUN_MS);
    assert.equal(attempt.protectedUntil, 1000 + CRATE_IFRAME_MS);
    assert.equal(bumpCrate(attempt, 1500), false);
    assert.equal(bumpCrate(attempt, 1900), true);
    assert.equal(reachGoal(attempt), true);
    assert.equal(attempt.phase, 'stage-cleared');
});

test('final pattern gate requires its switch and then clears the dungeon', () => {
    const attempt = reachStage(3);
    assert.equal(reachGoal(attempt), false);
    assert.equal(activateSwitch(attempt, 'final-switch'), true);
    assert.equal(attempt.gatesOpen, true);
    assert.equal(reachGoal(attempt), true);
    assert.equal(attempt.phase, 'cleared');
    assert.equal(advanceStage(attempt), false);
});

test('leaving freezes further Warehouse progress', () => {
    const attempt = createAttempt();
    assert.equal(leaveAttempt(attempt), true);
    assert.equal(leaveAttempt(attempt), false);
    assert.equal(activateSwitch(attempt, 'intro-switch'), false);
    assert.equal(reachGoal(attempt), false);
});
