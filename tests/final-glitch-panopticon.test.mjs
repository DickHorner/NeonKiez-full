import assert from 'node:assert/strict';
import test from 'node:test';
import {
    INTRO_DURATION_MS, MICRO_STAGE_DURATION_MS, RHYTHM_BEAT_INTERVAL_MS,
    RHYTHM_GOOD_WINDOW_MS, RHYTHM_STREAK_TARGET, SHOOTER_TARGET_COUNT,
    STABILIZE_NODE_COUNT, STAGES, activateNode, beatCountdownMs, beatDistanceMs,
    createAttempt, destroyShooterTarget, leaveAttempt, reachPlatformGoal,
    remainingTimeMs, tapRhythm, tickStage
} from '../src/game/final-glitch-panopticon/attempt.ts';

function enterStage(targetStage) {
    const attempt = createAttempt(1000);
    let now = 1000;

    if (targetStage >= 1) {
        now += INTRO_DURATION_MS;
        assert.equal(tickStage(attempt, now), 'advanced');
    }
    if (targetStage >= 2) {
        assert.equal(reachPlatformGoal(attempt, now + 100), true);
        now += 100;
    }
    if (targetStage >= 3) {
        for (let index = 0; index < SHOOTER_TARGET_COUNT; index++) {
            assert.equal(destroyShooterTarget(attempt, `target-${index}`, now + 100 + index), true);
        }
        now += 100 + SHOOTER_TARGET_COUNT - 1;
    }
    if (targetStage >= 4) {
        for (let index = 0; index < RHYTHM_STREAK_TARGET; index++) {
            const beatAt = attempt.beatOriginAt + index * RHYTHM_BEAT_INTERVAL_MS;
            const result = tapRhythm(attempt, beatAt);
            if (index < RHYTHM_STREAK_TARGET - 1) assert.equal(result, 'good');
            else assert.equal(result, 'advanced');
        }
        now = attempt.stageStartedAt;
    }

    assert.equal(attempt.stage, targetStage);
    return { attempt, now };
}

test('Final Glitch keeps the five Pocket meta stages and limits', () => {
    const attempt = createAttempt(1000);
    assert.deepEqual(STAGES.map(stage => stage.name), [
        'META INTRO', 'MICRO PLATFORM', 'MICRO SHOOTER', 'MICRO RHYTHM', 'STABILIZE'
    ]);
    assert.equal(INTRO_DURATION_MS, 5000);
    assert.equal(MICRO_STAGE_DURATION_MS, 20000);
    assert.equal(SHOOTER_TARGET_COUNT, 10);
    assert.equal(RHYTHM_STREAK_TARGET, 5);
    assert.equal(STABILIZE_NODE_COUNT, 4);
    assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
});

test('meta intro auto-advances after five seconds', () => {
    const attempt = createAttempt(1000);
    assert.equal(remainingTimeMs(attempt, 5999), 1);
    assert.equal(tickStage(attempt, 5999), 'none');
    assert.equal(tickStage(attempt, 6000), 'advanced');
    assert.equal(attempt.stage, 1);
    assert.equal(attempt.stageStartedAt, 6000);
});

test('micro-stage timeout restarts the same stage with fresh state', () => {
    const { attempt, now } = enterStage(1);
    assert.equal(reachPlatformGoal(attempt, now + 1), true);
    assert.equal(attempt.stage, 2);

    assert.equal(destroyShooterTarget(attempt, 'target-0', now + 2), true);
    assert.equal(attempt.destroyedTargetIds.length, 1);

    const timeoutAt = attempt.stageStartedAt + MICRO_STAGE_DURATION_MS;
    assert.equal(tickStage(attempt, timeoutAt), 'restarted');
    assert.equal(attempt.stage, 2);
    assert.deepEqual(attempt.destroyedTargetIds, []);
    assert.equal(attempt.stageStartedAt, timeoutAt);
});

test('platform goal advances directly into the shooter micro-stage', () => {
    const { attempt, now } = enterStage(1);
    assert.equal(reachPlatformGoal(attempt, now + 50), true);
    assert.equal(attempt.stage, 2);
    assert.equal(reachPlatformGoal(attempt, now + 60), false);
});

test('shooter requires ten unique targets and ignores duplicate hits', () => {
    const { attempt, now } = enterStage(2);
    assert.equal(destroyShooterTarget(attempt, 'target-0', now + 1), true);
    assert.equal(destroyShooterTarget(attempt, 'target-0', now + 2), false);

    for (let index = 1; index < SHOOTER_TARGET_COUNT; index++) {
        assert.equal(destroyShooterTarget(attempt, `target-${index}`, now + 2 + index), true);
    }

    assert.equal(attempt.stage, 3);
    assert.equal(attempt.destroyedTargetIds.length, 0);
});

test('rhythm uses the same 120 BPM clock, one hit per beat, and streak five advances', () => {
    const { attempt } = enterStage(3);
    const firstBeat = attempt.beatOriginAt;

    assert.equal(beatCountdownMs(attempt, firstBeat - 250), 250);
    assert.equal(beatDistanceMs(attempt, firstBeat), 0);
    assert.equal(beatDistanceMs(attempt, firstBeat + RHYTHM_GOOD_WINDOW_MS), RHYTHM_GOOD_WINDOW_MS);

    assert.equal(tapRhythm(attempt, firstBeat), 'good');
    assert.equal(tapRhythm(attempt, firstBeat), 'ignored');
    assert.equal(tapRhythm(attempt, firstBeat + RHYTHM_BEAT_INTERVAL_MS + RHYTHM_GOOD_WINDOW_MS + 1), 'miss');
    assert.equal(attempt.rhythmStreak, 0);

    for (let index = 2; index < 2 + RHYTHM_STREAK_TARGET; index++) {
        const beatAt = firstBeat + index * RHYTHM_BEAT_INTERVAL_MS;
        const result = tapRhythm(attempt, beatAt);
        if (index < 2 + RHYTHM_STREAK_TARGET - 1) assert.equal(result, 'good');
        else assert.equal(result, 'advanced');
    }

    assert.equal(attempt.stage, 4);
});

test('stabilize nodes enforce 0→1→2→3 and only the last node clears', () => {
    const { attempt } = enterStage(4);

    assert.equal(activateNode(attempt, 1), 'wrong');
    assert.equal(attempt.currentNodeIndex, 0);

    assert.equal(activateNode(attempt, 0), 'good');
    assert.equal(activateNode(attempt, 2), 'wrong');
    assert.equal(activateNode(attempt, 1), 'good');
    assert.equal(activateNode(attempt, 2), 'good');
    assert.equal(activateNode(attempt, 3), 'cleared');
    assert.equal(attempt.phase, 'cleared');
});

test('leaving freezes all finale progress', () => {
    const { attempt, now } = enterStage(2);
    assert.equal(leaveAttempt(attempt), true);
    assert.equal(leaveAttempt(attempt), false);
    assert.equal(destroyShooterTarget(attempt, 'target-0', now + 1), false);
    assert.equal(tickStage(attempt, now + MICRO_STAGE_DURATION_MS), 'none');
    assert.equal(tapRhythm(attempt, now + 1), 'ignored');
    assert.equal(activateNode(attempt, 0), 'ignored');
});
