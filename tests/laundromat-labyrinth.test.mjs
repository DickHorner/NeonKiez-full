import assert from 'node:assert/strict';
import test from 'node:test';
import {
    GHOST_IFRAME_MS, GHOST_STUN_MS, STAGES, TOKEN_TARGET,
    advanceStage, bumpGhost, collectToken, createAttempt, interactSwitch, leaveAttempt, reachGoal
} from '../src/game/laundromat-labyrinth/attempt.ts';

function reachStage(targetStage) {
    const attempt = createAttempt();
    while (attempt.stage < targetStage) {
        if (attempt.stage === 0) {
            assert.equal(interactSwitch(attempt), true);
            assert.equal(reachGoal(attempt), true);
        } else if (attempt.stage === 1) {
            assert.equal(reachGoal(attempt), true);
        } else if (attempt.stage === 2) {
            for (let index = 0; index < TOKEN_TARGET; index++) {
                assert.equal(collectToken(attempt, `token-${index + 1}`), true);
            }
            assert.equal(reachGoal(attempt), true);
        }
        assert.equal(advanceStage(attempt), true);
    }
    return attempt;
}

test('Laundromat Labyrinth keeps the four Pocket stage roles', () => {
    const attempt = createAttempt();
    assert.deepEqual(STAGES.map(stage => stage.name), [
        'WARMUP', 'DARK MAZE', 'TOKEN RUN', 'EXIT ROOM'
    ]);
    assert.equal(TOKEN_TARGET, 5);
    assert.equal(attempt.stage, 0);
    assert.equal(attempt.phase, 'playing');
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
});

test('warmup switch toggles the gate and the goal only clears while it is open', () => {
    const attempt = createAttempt();
    assert.equal(reachGoal(attempt), false);
    assert.equal(interactSwitch(attempt), true);
    assert.equal(attempt.switchesActivated, 1);
    assert.equal(attempt.gatesOpen, true);
    assert.equal(interactSwitch(attempt), true);
    assert.equal(attempt.gatesOpen, false);
    assert.equal(reachGoal(attempt), false);
    assert.equal(interactSwitch(attempt), true);
    assert.equal(reachGoal(attempt), true);
    assert.equal(attempt.phase, 'stage-cleared');
});

test('dark maze light switches only change visibility; reaching the goal clears the stage', () => {
    const attempt = reachStage(1);
    assert.equal(attempt.lightsOn, false);
    assert.equal(interactSwitch(attempt), true);
    assert.equal(attempt.lightsOn, true);
    assert.equal(interactSwitch(attempt), true);
    assert.equal(attempt.lightsOn, false);
    assert.equal(reachGoal(attempt), true);
    assert.equal(attempt.phase, 'stage-cleared');
});

test('token run requires five unique tokens before the goal', () => {
    const attempt = reachStage(2);
    assert.equal(reachGoal(attempt), false);
    for (let index = 0; index < TOKEN_TARGET - 1; index++) {
        assert.equal(collectToken(attempt, `token-${index + 1}`), true);
    }
    assert.equal(collectToken(attempt, 'token-1'), false);
    assert.equal(reachGoal(attempt), false);
    assert.equal(collectToken(attempt, 'token-5'), true);
    assert.equal(attempt.collectedTokenIds.length, TOKEN_TARGET);
    assert.equal(reachGoal(attempt), true);
});

test('Ghost-Bot bumps are harmless and respect stun and i-frame timing', () => {
    const attempt = reachStage(2);
    assert.equal(bumpGhost(attempt, 1000), true);
    assert.equal(attempt.phase, 'playing');
    assert.equal(attempt.stunnedUntil, 1000 + GHOST_STUN_MS);
    assert.equal(attempt.protectedUntil, 1000 + GHOST_IFRAME_MS);
    assert.equal(bumpGhost(attempt, 1500), false);
    assert.equal(bumpGhost(attempt, 1900), true);
    assert.equal(attempt.phase, 'playing');
});

test('final gate requires a switch and the final goal clears the dungeon', () => {
    const attempt = reachStage(3);
    assert.equal(reachGoal(attempt), false);
    assert.equal(interactSwitch(attempt), true);
    assert.equal(attempt.gatesOpen, true);
    assert.equal(reachGoal(attempt), true);
    assert.equal(attempt.phase, 'cleared');
    assert.equal(advanceStage(attempt), false);
});

test('leaving freezes further puzzle progress', () => {
    const attempt = createAttempt();
    assert.equal(leaveAttempt(attempt), true);
    assert.equal(leaveAttempt(attempt), false);
    assert.equal(interactSwitch(attempt), false);
    assert.equal(collectToken(attempt, 'token-1'), false);
    assert.equal(reachGoal(attempt), false);
});
