export const BPM = 120;
export const BEAT_INTERVAL_MS = 60000 / BPM;
export const GOOD_WINDOW_MS = 200;
export const MISS_LIMIT = 3;

export const STAGES = [
    { name: 'BEAT TUTORIAL', streakTarget: 3, doorCount: 0, switchCount: 0, markerCount: 0 },
    { name: 'DOORS', streakTarget: 5, doorCount: 3, switchCount: 0, markerCount: 0 },
    { name: 'SWITCH CHAIN', streakTarget: 8, doorCount: 0, switchCount: 8, markerCount: 0 },
    { name: 'FINAL STREAK', streakTarget: 12, doorCount: 0, switchCount: 0, markerCount: 4 }
] as const;

export type TapResult =
    | { kind: 'good'; beatIndex: number }
    | { kind: 'miss' }
    | { kind: 'ignored' };

export type Attempt = {
    stage: number;
    phase: 'playing' | 'stage-cleared' | 'lost' | 'cleared' | 'leaving';
    streak: number;
    misses: number;
    beatOriginAt: number;
    lastConsumedBeat: number;
    doorsOpen: boolean;
    activatedSwitches: number[];
};

function resetStageState(attempt: Attempt, now: number) {
    attempt.phase = 'playing';
    attempt.streak = 0;
    attempt.misses = 0;
    attempt.beatOriginAt = now + BEAT_INTERVAL_MS;
    attempt.lastConsumedBeat = -1;
    attempt.doorsOpen = false;
    attempt.activatedSwitches = [];
}

export function createAttempt(now = 0): Attempt {
    const attempt: Attempt = {
        stage: 0,
        phase: 'playing',
        streak: 0,
        misses: 0,
        beatOriginAt: 0,
        lastConsumedBeat: -1,
        doorsOpen: false,
        activatedSwitches: []
    };
    resetStageState(attempt, now);
    return attempt;
}

function nearestBeat(attempt: Attempt, now: number) {
    const beatIndex = Math.max(0, Math.round((now - attempt.beatOriginAt) / BEAT_INTERVAL_MS));
    const beatAt = attempt.beatOriginAt + beatIndex * BEAT_INTERVAL_MS;
    return { beatIndex, distanceMs: Math.abs(now - beatAt) };
}

export function beatDistanceMs(attempt: Attempt, now: number): number {
    return nearestBeat(attempt, now).distanceMs;
}

export function beatCountdownMs(attempt: Attempt, now: number): number {
    if (now <= attempt.beatOriginAt) return attempt.beatOriginAt - now;
    const elapsed = now - attempt.beatOriginAt;
    const phase = elapsed % BEAT_INTERVAL_MS;
    return phase === 0 ? 0 : BEAT_INTERVAL_MS - phase;
}

function registerMiss(attempt: Attempt): TapResult {
    attempt.misses++;
    attempt.streak = 0;
    if (attempt.stage === 1 && !attempt.doorsOpen) attempt.doorsOpen = false;
    if (attempt.stage === 2) attempt.activatedSwitches = [];
    if (attempt.misses >= MISS_LIMIT) {
        attempt.doorsOpen = false;
        attempt.phase = 'lost';
    }
    return { kind: 'miss' };
}

function acceptStageProgress(attempt: Attempt, targetIndex: number | null): boolean {
    const stage = STAGES[attempt.stage];

    if (attempt.stage === 2) {
        const expected = attempt.activatedSwitches.length;
        if (targetIndex !== expected) return false;
        attempt.activatedSwitches.push(expected);
        attempt.streak = attempt.activatedSwitches.length;
        if (attempt.streak >= stage.streakTarget) attempt.phase = 'stage-cleared';
        return true;
    }

    if (attempt.stage === 3) {
        const expected = attempt.streak % stage.markerCount;
        if (targetIndex !== expected) return false;
        attempt.streak++;
        if (attempt.streak >= stage.streakTarget) attempt.phase = 'cleared';
        return true;
    }

    attempt.streak++;
    if (attempt.stage === 0 && attempt.streak >= stage.streakTarget) {
        attempt.phase = 'stage-cleared';
    } else if (attempt.stage === 1 && attempt.streak >= stage.streakTarget) {
        attempt.doorsOpen = true;
    }
    return true;
}

export function tapBeat(attempt: Attempt, now: number, targetIndex: number | null = null): TapResult {
    if (attempt.phase !== 'playing') return { kind: 'ignored' };
    if (attempt.stage === 1 && attempt.doorsOpen) return { kind: 'ignored' };

    const beat = nearestBeat(attempt, now);
    if (beat.distanceMs > GOOD_WINDOW_MS) return registerMiss(attempt);
    if (beat.beatIndex === attempt.lastConsumedBeat) return { kind: 'ignored' };

    attempt.lastConsumedBeat = beat.beatIndex;
    if (!acceptStageProgress(attempt, targetIndex)) return registerMiss(attempt);
    return { kind: 'good', beatIndex: beat.beatIndex };
}

export function reachGoal(attempt: Attempt): boolean {
    if (attempt.phase !== 'playing' || attempt.stage !== 1 || !attempt.doorsOpen) return false;
    attempt.phase = 'stage-cleared';
    return true;
}

export function advanceStage(attempt: Attempt, now: number): boolean {
    if (attempt.phase !== 'stage-cleared' || attempt.stage >= STAGES.length - 1) return false;
    attempt.stage++;
    resetStageState(attempt, now);
    return true;
}

export function retryStage(attempt: Attempt, now: number): boolean {
    if (attempt.phase !== 'lost') return false;
    resetStageState(attempt, now);
    return true;
}

export function leaveAttempt(attempt: Attempt): boolean {
    if (attempt.phase === 'leaving') return false;
    attempt.phase = 'leaving';
    return true;
}
