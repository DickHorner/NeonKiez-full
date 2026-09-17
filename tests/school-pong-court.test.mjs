import assert from 'node:assert/strict';
import test from 'node:test';
import {
    STAGES, createAttempt, serveBall, scorePoint, advanceStage, retryStage, leaveAttempt,
    paddleBounce, serveVelocity, aiVelocity
} from '../src/game/school-pong-court/attempt.ts';

function winStage(attempt) {
    const target = STAGES[attempt.stage].targetScore;
    for (let point = 0; point < target; point++) {
        assert.equal(serveBall(attempt), true);
        assert.equal(scorePoint(attempt, 'player'), true);
    }
}

test('court starts as Pong with two-sided score progression and increasing difficulty', () => {
    const attempt = createAttempt();
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
    assert.deepEqual(STAGES.map(stage => stage.targetScore), [2, 3, 4, 5]);
    assert.ok(STAGES[0].ballSpeed < STAGES[3].ballSpeed);
    assert.ok(STAGES[0].aiSpeed < STAGES[3].aiSpeed);
    assert.equal(attempt.phase, 'ready');
    assert.equal(attempt.playerScore, 0);
    assert.equal(attempt.opponentScore, 0);
    assert.equal(attempt.serveDirection, -1);
});

test('points require a live rally, preserve score, and alternate serve direction', () => {
    const attempt = createAttempt();
    assert.equal(scorePoint(attempt, 'player'), false);
    assert.equal(serveBall(attempt), true);
    assert.equal(serveBall(attempt), false);
    assert.equal(scorePoint(attempt, 'player'), true);
    assert.equal(attempt.playerScore, 1);
    assert.equal(attempt.opponentScore, 0);
    assert.equal(attempt.phase, 'ready');
    assert.equal(attempt.serveDirection, 1);
    assert.equal(scorePoint(attempt, 'opponent'), false);
    assert.equal(serveBall(attempt), true);
    assert.equal(scorePoint(attempt, 'opponent'), true);
    assert.deepEqual([attempt.playerScore, attempt.opponentScore], [1, 1]);
    assert.equal(attempt.serveDirection, -1);
});

test('winning all four matches is required for the final clear', () => {
    const attempt = createAttempt();
    for (let stage = 0; stage < STAGES.length; stage++) {
        assert.equal(attempt.stage, stage);
        winStage(attempt);
        const final = stage === STAGES.length - 1;
        assert.equal(attempt.phase, final ? 'cleared' : 'stage-cleared');
        assert.equal(attempt.playerScore, STAGES[stage].targetScore);
        assert.equal(scorePoint(attempt, 'player'), false);
        assert.equal(serveBall(attempt), false);
        assert.equal(advanceStage(attempt), !final);
        if (!final) {
            assert.equal(attempt.playerScore, 0);
            assert.equal(attempt.opponentScore, 0);
            assert.equal(attempt.phase, 'ready');
        }
    }
    assert.equal(attempt.phase, 'cleared');
});

test('AI can win a match; retry resets only the current stage', () => {
    const attempt = createAttempt();
    winStage(attempt);
    assert.equal(advanceStage(attempt), true);
    assert.equal(attempt.stage, 1);
    for (let point = 0; point < STAGES[1].targetScore; point++) {
        assert.equal(serveBall(attempt), true);
        assert.equal(scorePoint(attempt, 'opponent'), true);
    }
    assert.equal(attempt.phase, 'lost');
    assert.equal(retryStage(attempt), true);
    assert.equal(attempt.stage, 1);
    assert.equal(attempt.playerScore, 0);
    assert.equal(attempt.opponentScore, 0);
    assert.equal(attempt.phase, 'ready');
    assert.equal(retryStage(attempt), false);
});

test('leaving blocks scoring, serving, retry and stage progression', () => {
    const attempt = createAttempt();
    assert.equal(leaveAttempt(attempt), true);
    assert.equal(leaveAttempt(attempt), false);
    assert.equal(serveBall(attempt), false);
    assert.equal(scorePoint(attempt, 'player'), false);
    assert.equal(advanceStage(attempt), false);
    assert.equal(retryStage(attempt), false);
});

test('paddle rebounds point away from each paddle and preserve ball speed', () => {
    for (const verticalDirection of [-1, 1]) {
        const center = paddleBounce(0, 45, 240, verticalDirection);
        assert.equal(center.x, 0);
        assert.equal(center.y, 240 * verticalDirection);
        for (const offset of [-90, -45, -20, 20, 45, 90]) {
            const velocity = paddleBounce(offset, 45, 240, verticalDirection);
            assert.equal(Math.sign(velocity.x), Math.sign(offset));
            assert.equal(Math.sign(velocity.y), verticalDirection);
            assert.ok(Math.abs(velocity.y) >= 120);
            assert.ok(Math.abs(Math.hypot(velocity.x, velocity.y) - 240) < 0.0001);
        }
    }
});

test('serves preserve speed and AI tracks only an incoming ball', () => {
    for (const verticalDirection of [-1, 1]) {
        for (const horizontalDirection of [-1, 1]) {
            const velocity = serveVelocity(200, verticalDirection, horizontalDirection);
            assert.equal(Math.sign(velocity.x), horizontalDirection);
            assert.equal(Math.sign(velocity.y), verticalDirection);
            assert.ok(Math.abs(Math.hypot(velocity.x, velocity.y) - 200) < 0.0001);
        }
    }
    assert.equal(aiVelocity(300, 500, 320, -200, 150, 20), 150);
    assert.equal(aiVelocity(340, 100, 320, -200, 150, 20), -150);
    assert.equal(aiVelocity(330, 500, 320, 200, 150, 20), 0);
    assert.equal(aiVelocity(400, 500, 320, 200, 150, 20), -150);
});
