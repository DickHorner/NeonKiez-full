export const INTRO_DURATION_MS = 5000;
export const MICRO_STAGE_DURATION_MS = 20000;
export const SHOOTER_TARGET_COUNT = 10;
export const PROJECTILE_CAP = 20;
export const PROJECTILE_LIFETIME_MS = 2000;
export const RHYTHM_BPM = 120;
export const RHYTHM_BEAT_INTERVAL_MS = 60000 / RHYTHM_BPM;
export const RHYTHM_GOOD_WINDOW_MS = 200;
export const RHYTHM_STREAK_TARGET = 5;
export const STABILIZE_NODE_COUNT = 4;

export const STAGES = [
    { name: 'META INTRO', timeLimitMs: INTRO_DURATION_MS },
    { name: 'MICRO PLATFORM', timeLimitMs: MICRO_STAGE_DURATION_MS },
    { name: 'MICRO SHOOTER', timeLimitMs: MICRO_STAGE_DURATION_MS },
    { name: 'MICRO RHYTHM', timeLimitMs: MICRO_STAGE_DURATION_MS },
    { name: 'STABILIZE', timeLimitMs: 0 }
] as const;

export type Attempt = {
    stage: number;
    phase: 'playing' | 'cleared' | 'leaving';
    stageStartedAt: number;
    destroyedTargetIds: string[];
    rhythmStreak: number;
    rhythmMisses: number;
    beatOriginAt: number;
    lastConsumedBeat: number;
    currentNodeIndex: number;
};

export type StageTick = 'none' | 'advanced' | 'restarted';
export type RhythmTap = 'ignored' | 'good' | 'miss' | 'advanced';
export type NodeActivation = 'ignored' | 'wrong' | 'good' | 'cleared';

function resetStageState(attempt: Attempt, now: number) {
    attempt.stageStartedAt = now;
    attempt.destroyedTargetIds = [];
    attempt.rhythmStreak = 0;
    attempt.rhythmMisses = 0;
    attempt.beatOriginAt = attempt.stage === 3 ? now + RHYTHM_BEAT_INTERVAL_MS : 0;
    attempt.lastConsumedBeat = -1;
    attempt.currentNodeIndex = 0;
}

function advanceStage(attempt: Attempt, now: number): boolean {
    if (attempt.phase !== 'playing' || attempt.stage >= STAGES.length - 1) return false;
    attempt.stage++;
    resetStageState(attempt, now);
    return true;
}

export function createAttempt(now = 0): Attempt {
    const attempt: Attempt = {
        stage: 0,
        phase: 'playing',
        stageStartedAt: now,
        destroyedTargetIds: [],
        rhythmStreak: 0,
        rhythmMisses: 0,
        beatOriginAt: 0,
        lastConsumedBeat: -1,
        currentNodeIndex: 0
    };
    resetStageState(attempt, now);
    return attempt;
}

export function remainingTimeMs(attempt: Attempt, now: number): number | null {
    if (attempt.phase !== 'playing') return null;
    const limit = STAGES[attempt.stage].timeLimitMs;
    if (limit === 0) return null;
    return Math.max(0, limit - (now - attempt.stageStartedAt));
}

export function tickStage(attempt: Attempt, now: number): StageTick {
    if (attempt.phase !== 'playing') return 'none';

    if (attempt.stage === 0 && now - attempt.stageStartedAt >= INTRO_DURATION_MS) {
        return advanceStage(attempt, now) ? 'advanced' : 'none';
    }

    if (attempt.stage >= 1 && attempt.stage <= 3
        && now - attempt.stageStartedAt >= MICRO_STAGE_DURATION_MS) {
        resetStageState(attempt, now);
        return 'restarted';
    }

    return 'none';
}

export function reachPlatformGoal(attempt: Attempt, now: number): boolean {
    return attempt.stage === 1 && attempt.phase === 'playing' && advanceStage(attempt, now);
}

export function destroyShooterTarget(attempt: Attempt, targetId: string, now: number): boolean {
    if (attempt.stage !== 2 || attempt.phase !== 'playing' || targetId.length === 0) return false;
    if (attempt.destroyedTargetIds.includes(targetId)) return false;

    attempt.destroyedTargetIds.push(targetId);
    if (attempt.destroyedTargetIds.length >= SHOOTER_TARGET_COUNT) {
        advanceStage(attempt, now);
    }
    return true;
}

function nearestBeat(attempt: Attempt, now: number) {
    const raw = (now - attempt.beatOriginAt) / RHYTHM_BEAT_INTERVAL_MS;
    const beatIndex = Math.max(0, Math.round(raw));
    const beatAt = attempt.beatOriginAt + beatIndex * RHYTHM_BEAT_INTERVAL_MS;
    return { beatIndex, distanceMs: Math.abs(now - beatAt) };
}

export function beatDistanceMs(attempt: Attempt, now: number): number {
    if (attempt.stage !== 3) return Infinity;
    return nearestBeat(attempt, now).distanceMs;
}

export function beatCountdownMs(attempt: Attempt, now: number): number {
    if (attempt.stage !== 3) return RHYTHM_BEAT_INTERVAL_MS;
    if (now <= attempt.beatOriginAt) return attempt.beatOriginAt - now;

    const phase = (now - attempt.beatOriginAt) % RHYTHM_BEAT_INTERVAL_MS;
    return phase === 0 ? 0 : RHYTHM_BEAT_INTERVAL_MS - phase;
}

export function tapRhythm(attempt: Attempt, now: number): RhythmTap {
    if (attempt.stage !== 3 || attempt.phase !== 'playing') return 'ignored';

    const beat = nearestBeat(attempt, now);
    if (beat.distanceMs > RHYTHM_GOOD_WINDOW_MS) {
        attempt.rhythmMisses++;
        attempt.rhythmStreak = 0;
        return 'miss';
    }
    if (beat.beatIndex === attempt.lastConsumedBeat) return 'ignored';

    attempt.lastConsumedBeat = beat.beatIndex;
    attempt.rhythmStreak++;
    if (attempt.rhythmStreak >= RHYTHM_STREAK_TARGET) {
        advanceStage(attempt, now);
        return 'advanced';
    }
    return 'good';
}

export function activateNode(attempt: Attempt, nodeIndex: number): NodeActivation {
    if (attempt.stage !== 4 || attempt.phase !== 'playing') return 'ignored';
    if (nodeIndex !== attempt.currentNodeIndex) return 'wrong';

    attempt.currentNodeIndex++;
    if (attempt.currentNodeIndex >= STABILIZE_NODE_COUNT) {
        attempt.phase = 'cleared';
        return 'cleared';
    }
    return 'good';
}

export function leaveAttempt(attempt: Attempt): boolean {
    if (attempt.phase === 'leaving') return false;
    attempt.phase = 'leaving';
    return true;
}
