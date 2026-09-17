import assert from 'node:assert/strict';
import test from 'node:test';
import {
    STAGES, createAttempt, serveBall, scorePoint, advanceStage, retryStage, leaveAttempt,
    paddleBounce, serveVelocity, aiVelocity
} from '../src/game/school-pong-court/attempt.ts';

test('court starts as familiar horizontal Pong and hides a vertical final stage', () => {
    const attempt = createAttempt();
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
    assert.deepEqual(STAGES.map(stage => stage.axis), [
        'horizontal', 'horizontal', 'horizontal', 'vertical'
    ]);
    assert.equal(attempt.stage, 0);
    assert.equal(attempt.playerScore, 0);
    assert.equal(attempt.opponentScore, 0);
    assert.equal(attempt.serveToward, 'opponent');
    assert.equal(attempt.phase, 'ready');
});

test('next serve always travels toward the side that conceded the previous point', () => {
    const attempt = createAttempt();

    assert.equal(serveBall(attempt), true);
    assert.equal(scorePoint(attempt, 'player'), true);
    assert.equal(attempt.playerScore, 1);
    assert.equal(attempt.serveToward, 'opponent');
    assert.equal(attempt.phase, 'ready');

    assert.equal(serveBall(attempt), true);
    assert.equal(scorePoint(attempt, 'opponent'), true);
    assert.equal(attempt.opponentScore, 1);
    assert.equal(attempt.serveToward, 'player');
    assert.equal(attempt.phase, 'ready');

    assert.equal(scorePoint(attempt, 'player'), false);
});

test('winning each score-based match advances through all four stages', () => {
    const attempt = createAttempt();

    for (let stage = 0; stage < STAGES.length; stage++) {
        assert.equal(attempt.stage, stage);
        for (let point = 0; point < STAGES[stage].targetScore; point++) {
            assert.equal(serveBall(attempt), true);
            assert.equal(scorePoint(attempt, 'player'), true);
        }
        const final = stage === STAGES.length - 1;
        assert.equal(attempt.phase, final ? 'cleared' : 'stage-cleared');
        assert.equal(advanceStage(attempt), !final);
        if (!final) {
            assert.equal(attempt.playerScore, 0);
            assert.equal(attempt.opponentScore, 0);
            assert.equal(attempt.serveToward, 'opponent');
            assert.equal(attempt.phase, 'ready');
        }
    }

    assert.equal(attempt.stage, 3);
    assert.equal(STAGES[attempt.stage].axis, 'vertical');
    assert.equal(attempt.phase, 'cleared');
});

test('losing a match requires an explicit retry and leaving blocks play', () => {
    const attempt = createAttempt();

    for (let point = 0; point < STAGES[0].targetScore; point++) {
        assert.equal(serveBall(attempt), true);
        assert.equal(scorePoint(attempt, 'opponent'), true);
    }
    assert.equal(attempt.phase, 'lost');
    assert.equal(serveBall(attempt), false);
    assert.equal(advanceStage(attempt), false);
    assert.equal(retryStage(attempt), true);
    assert.equal(attempt.playerScore, 0);
    assert.equal(attempt.opponentScore, 0);
    assert.equal(attempt.serveToward, 'opponent');
    assert.equal(attempt.phase, 'ready');

    assert.equal(leaveAttempt(attempt), true);
    assert.equal(leaveAttempt(attempt), false);
    assert.equal(serveBall(attempt), false);
    assert.equal(retryStage(attempt), false);
});

test('paddle rebound preserves speed on both court orientations', () => {
    assert.deepEqual(paddleBounce(0, 45, 200, 'horizontal', 1), { x: 200, y: 0 });
    assert.deepEqual(paddleBounce(0, 45, 200, 'vertical', -1), { x: 0, y: -200 });

    for (const axis of ['horizontal', 'vertical']) {
        for (const direction of [-1, 1]) {
            for (const offset of [-90, -20, 20, 90]) {
                const velocity = paddleBounce(offset, 45, 240, axis, direction);
                assert.ok(Math.abs(Math.hypot(velocity.x, velocity.y) - 240) < 0.0001);
                const primary = axis === 'horizontal' ? velocity.x : velocity.y;
                const secondary = axis === 'horizontal' ? velocity.y : velocity.x;
                assert.equal(Math.sign(primary), direction);
                assert.equal(Math.sign(secondary), Math.sign(offset));
            }
        }
    }
});

test('serve vectors follow the active court axis and AI only tracks an incoming ball', () => {
    const horizontal = serveVelocity(200, 'horizontal', 1, -1);
    assert.ok(horizontal.x > 0);
    assert.ok(horizontal.y < 0);
    assert.ok(Math.abs(Math.hypot(horizontal.x, horizontal.y) - 200) < 0.0001);

    const vertical = serveVelocity(200, 'vertical', -1, 1);
    assert.ok(vertical.x > 0);
    assert.ok(vertical.y < 0);
    assert.ok(Math.abs(Math.hypot(vertical.x, vertical.y) - 200) < 0.0001);

    assert.equal(aiVelocity(100, 180, 120, true, 80, 10), 80);
    assert.equal(aiVelocity(100, 180, 120, false, 80, 10), 80);
    assert.equal(aiVelocity(119, 180, 120, false, 80, 10), 0);
    assert.equal(aiVelocity(140, 80, 120, false, 80, 10), -80);
});
