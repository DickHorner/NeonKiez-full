import assert from 'node:assert/strict';
import test from 'node:test';
import {
    CRATE_IFRAME_MS, CRATE_STUN_MS, SOKOBAN_LAYOUTS, STAGES,
    advanceStage, bumpCrate, createAttempt, leaveAttempt, moveSokoban, reachGoal, restartStage
} from '../src/game/warehouse-blockworks/attempt.ts';

function move(attempt, dx, dy, count = 1) {
    let result = 'blocked';
    for (let index = 0; index < count; index++) result = moveSokoban(attempt, dx, dy);
    return result;
}

function solveStage0(attempt) {
    move(attempt, 1, 0);
    move(attempt, 1, 0, 3);
    assert.equal(attempt.gatesOpen, true);
    move(attempt, 0, -1);
    move(attempt, 1, 0, 2);
    move(attempt, 0, 1);
    return move(attempt, 1, 0, 3);
}

function solveStage1(attempt) {
    move(attempt, 0, -1);
    move(attempt, 1, 0);
    move(attempt, 1, 0, 3);

    move(attempt, -1, 0, 3);
    move(attempt, 0, 1, 2);
    move(attempt, 1, 0, 3);
    assert.equal(attempt.gatesOpen, true);

    move(attempt, 0, -1);
    move(attempt, 1, 0, 3);
    return move(attempt, 1, 0, 2);
}

function solveStage3(attempt) {
    move(attempt, 0, -1, 2);
    move(attempt, 1, 0);
    move(attempt, 1, 0, 4);

    move(attempt, -1, 0, 4);
    move(attempt, 0, 1, 2);
    move(attempt, 1, 0, 4);

    move(attempt, -1, 0, 4);
    move(attempt, 0, 1, 2);
    move(attempt, 1, 0, 4);
    assert.equal(attempt.gatesOpen, true);

    move(attempt, 0, -1);
    move(attempt, 1, 0, 2);
    move(attempt, 0, -1);
    move(attempt, 1, 0, 2);
    return move(attempt, 1, 0, 3);
}

function reachStage(targetStage) {
    const attempt = createAttempt();
    while (attempt.stage < targetStage) {
        if (attempt.stage === 0) {
            assert.equal(solveStage0(attempt), 'cleared');
        } else if (attempt.stage === 1) {
            assert.equal(solveStage1(attempt), 'cleared');
        } else if (attempt.stage === 2) {
            assert.equal(reachGoal(attempt), true);
        }
        assert.equal(advanceStage(attempt), true);
    }
    return attempt;
}

test('Warehouse Blockworks now uses Sokoban layouts for its three block stages', () => {
    const attempt = createAttempt();
    assert.deepEqual(STAGES.map(stage => stage.name), [
        'CONVEYOR INTRO', 'BLOCK ROWS', 'MOVING CRATES', 'FINAL PATTERN'
    ]);
    assert.deepEqual(STAGES.map(stage => stage.crateTargetCount), [1, 2, 0, 3]);
    assert.deepEqual(Object.keys(SOKOBAN_LAYOUTS), ['0', '1', '3']);
    assert.deepEqual(attempt.sokoban.crates, [{ x: 3, y: 3 }]);
    assert.equal(attempt.gatesOpen, false);
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
});

test('a Sokoban crate only moves when pushed into a free cardinal cell', () => {
    const attempt = createAttempt();
    assert.equal(moveSokoban(attempt, 1, 1), 'blocked');
    assert.equal(moveSokoban(attempt, 1, 0), 'moved');
    assert.equal(moveSokoban(attempt, 1, 0), 'pushed');
    assert.deepEqual(attempt.sokoban.player, { x: 3, y: 3 });
    assert.deepEqual(attempt.sokoban.crates, [{ x: 4, y: 3 }]);

    assert.equal(moveSokoban(attempt, -1, 0), 'moved');
    assert.deepEqual(attempt.sokoban.crates, [{ x: 4, y: 3 }]);
});

test('conveyor intro opens the gate only when its crate reaches the target', () => {
    const attempt = createAttempt();
    move(attempt, 1, 0);
    assert.equal(attempt.gatesOpen, false);
    move(attempt, 1, 0, 2);
    assert.equal(attempt.gatesOpen, false);
    assert.equal(moveSokoban(attempt, 1, 0), 'pushed');
    assert.equal(attempt.gatesOpen, true);
    assert.equal(solveStage0(createAttempt()), 'cleared');
});

test('block rows requires both crates on their targets before the gate opens', () => {
    const attempt = reachStage(1);

    move(attempt, 0, -1);
    move(attempt, 1, 0);
    move(attempt, 1, 0, 3);
    assert.equal(attempt.gatesOpen, false);

    move(attempt, -1, 0, 3);
    move(attempt, 0, 1, 2);
    move(attempt, 1, 0, 3);
    assert.equal(attempt.gatesOpen, true);
});

test('R-style restart restores player, crates and gate after a bad Sokoban push', () => {
    const attempt = reachStage(1);
    move(attempt, 0, -1);
    move(attempt, 1, 0);
    move(attempt, 1, 0);
    assert.notDeepEqual(attempt.sokoban.crates, SOKOBAN_LAYOUTS[1].crateStarts);

    assert.equal(restartStage(attempt), true);
    assert.deepEqual(attempt.sokoban.player, SOKOBAN_LAYOUTS[1].playerStart);
    assert.deepEqual(attempt.sokoban.crates, SOKOBAN_LAYOUTS[1].crateStarts);
    assert.equal(attempt.gatesOpen, false);
});

test('moving-crate stage stays the Pocket dodge variation with harmless i-frames', () => {
    const attempt = reachStage(2);
    assert.equal(attempt.sokoban, null);
    assert.equal(bumpCrate(attempt, 1000), true);
    assert.equal(attempt.phase, 'playing');
    assert.equal(attempt.stunnedUntil, 1000 + CRATE_STUN_MS);
    assert.equal(attempt.protectedUntil, 1000 + CRATE_IFRAME_MS);
    assert.equal(bumpCrate(attempt, 1500), false);
    assert.equal(bumpCrate(attempt, 1900), true);
    assert.equal(reachGoal(attempt), true);
    assert.equal(attempt.phase, 'stage-cleared');
});

test('final pattern requires all three crates and then clears through the exit', () => {
    const attempt = reachStage(3);
    assert.equal(attempt.gatesOpen, false);
    assert.equal(solveStage3(attempt), 'cleared');
    assert.equal(attempt.phase, 'cleared');
    assert.equal(advanceStage(attempt), false);
});

test('leaving freezes Sokoban progress', () => {
    const attempt = createAttempt();
    assert.equal(leaveAttempt(attempt), true);
    assert.equal(leaveAttempt(attempt), false);
    assert.equal(moveSokoban(attempt, 1, 0), 'blocked');
    assert.equal(restartStage(attempt), false);
});
