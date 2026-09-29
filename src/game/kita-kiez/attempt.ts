export const STAGES = [
    { name: 'ONE SIGN', childCount: 3, timeLimitMs: 40000 },
    { name: 'TWO TURNS', childCount: 4, timeLimitMs: 45000 },
    { name: 'PUDDLE ROUTE', childCount: 5, timeLimitMs: 50000 },
    { name: 'PICKUP RUSH', childCount: 6, timeLimitMs: 55000 }
] as const;

export type ChildState = 'walking' | 'crying' | 'arrived';

export type Attempt = {
    stage: number;
    phase: 'playing' | 'stage-cleared' | 'timed-out' | 'cleared' | 'leaving';
    remainingMs: number;
    childStates: ChildState[];
};

function resetStageState(attempt: Attempt) {
    const stage = STAGES[attempt.stage];
    attempt.phase = 'playing';
    attempt.remainingMs = stage.timeLimitMs;
    attempt.childStates = Array.from({ length: stage.childCount }, () => 'walking');
}

export function createAttempt(): Attempt {
    const attempt: Attempt = {
        stage: 0,
        phase: 'playing',
        remainingMs: STAGES[0].timeLimitMs,
        childStates: []
    };
    resetStageState(attempt);
    return attempt;
}

function childState(attempt: Attempt, childIndex: number): ChildState | undefined {
    return Number.isInteger(childIndex) && childIndex >= 0
        ? attempt.childStates[childIndex]
        : undefined;
}

export function makeChildCry(attempt: Attempt, childIndex: number): boolean {
    if (attempt.phase !== 'playing' || childState(attempt, childIndex) !== 'walking') return false;
    attempt.childStates[childIndex] = 'crying';
    return true;
}

export function giveLollipop(attempt: Attempt, childIndex: number): boolean {
    if (attempt.phase !== 'playing' || childState(attempt, childIndex) !== 'crying') return false;
    attempt.childStates[childIndex] = 'walking';
    return true;
}

export function childArrives(attempt: Attempt, childIndex: number): boolean {
    if (attempt.phase !== 'playing' || childState(attempt, childIndex) !== 'walking') return false;
    attempt.childStates[childIndex] = 'arrived';
    if (attempt.childStates.every(state => state === 'arrived')) {
        attempt.phase = attempt.stage === STAGES.length - 1 ? 'cleared' : 'stage-cleared';
    }
    return true;
}

export function tickAttempt(attempt: Attempt, deltaMs: number): boolean {
    if (attempt.phase !== 'playing' || !Number.isFinite(deltaMs) || deltaMs <= 0) return false;
    attempt.remainingMs = Math.max(0, attempt.remainingMs - deltaMs);
    if (attempt.remainingMs > 0) return false;
    attempt.phase = 'timed-out';
    return true;
}

export function retryStage(attempt: Attempt): boolean {
    if (attempt.phase !== 'timed-out') return false;
    resetStageState(attempt);
    return true;
}

export function advanceStage(attempt: Attempt): boolean {
    if (attempt.phase !== 'stage-cleared' || attempt.stage >= STAGES.length - 1) return false;
    attempt.stage++;
    resetStageState(attempt);
    return true;
}

export function leaveAttempt(attempt: Attempt): boolean {
    if (attempt.phase === 'leaving') return false;
    attempt.phase = 'leaving';
    return true;
}
