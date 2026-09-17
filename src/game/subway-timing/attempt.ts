export const BPM = 120;
export const BEAT_INTERVAL_MS = 60000 / BPM;
export const GOOD_WINDOW_MS = 200;
export const MISS_LIMIT = 3;

export const STAGES = [
    { name: 'BEAT TUTORIAL', streakTarget: 3, doorCount: 0, switchCount: 0, markerCount: 0 },
    { name: 'DOORS', streakTarget: 5, doorCount: 3, switchCount: 0, markerCount: 0 },
    { name: 'SWITCH CHAIN', streakTarget: 8, doorCount: 0, switchCount: 6, markerCount: 0 },
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
    lastSwitchBeat: number;
    doorsOpen: boolean;
    activatedSwitches: number[];
};

function resetStageState(attempt: Attempt, now: number) {
    attempt.phase = 'playing';
    attempt.streak = 0;
    attempt.misses = 0;
    attempt.beatOriginAt = now + BEAT_INTERVAL_MS;
    attempt.lastConsumedBeat = -1;
    attempt.lastSwitchBeat = -1;
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
        lastSwitchBeat: -1,
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

function completeStageIfReady(attempt: Attempt) {
    const stage = STAGES[attempt.stage];
    if (attempt.streak < stage.streakTarget) return;

    if (attempt.stage === 1) return;
    if (attempt.stage === 2 && attempt.activatedSwitches.length < stage.switchCount) return;

    attempt.phase = attempt.stage === STAGES.length - 1 ? 'cleared' : 'stage-cleared';
}

export function tapBeat(attempt: Attempt, now: number): TapResult {
    if (attempt.phase !== 'playing') return { kind: 'ignored' };

    const beat = nearestBeat(attempt, now);
    if (beat.distanceMs <= GOOD_WINDOW_MS) {
        if (beat.beatIndex === attempt.lastConsumedBeat) return { kind: 'ignored' };
        attempt.lastConsumedBeat = beat.beatIndex;
        attempt.streak++;
        if (attempt.stage === 1) attempt.doorsOpen = true;
        completeStageIfReady(attempt);
        return { kind: 'good', beatIndex: beat.beatIndex };
    }

    attempt.misses++;
    attempt.streak = 0;
    if (attempt.stage === 1) attempt.doorsOpen = false;
    if (attempt.misses >= MISS_LIMIT) {
        attempt.doorsOpen = false;
        attempt.phase = 'lost';
    }
    return { kind: 'miss' };
}

export function reachGoal(attempt: Attempt): boolean {
    if (attempt.phase !== 'playing' || attempt.stage !== 1) return false;
    if (!attempt.doorsOpen || attempt.streak < STAGES[1].streakTarget) return false;
    attempt.phase = 'stage-cleared';
    return true;
}

export function activateSwitch(attempt: Attempt, switchIndex: number, beatIndex: number): boolean {
    if (attempt.phase !== 'playing' || attempt.stage !== 2) return false;
    if (!Number.isInteger(switchIndex) || switchIndex < 0 || switchIndex >= STAGES[2].switchCount) {
        return false;
    }
    if (beatIndex !== attempt.lastConsumedBeat || beatIndex === attempt.lastSwitchBeat) return false;
    if (attempt.activatedSwitches.includes(switchIndex)) return false;

    attempt.activatedSwitches.push(switchIndex);
    attempt.lastSwitchBeat = beatIndex;
    completeStageIfReady(attempt);
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
