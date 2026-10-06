export type PipeSide = 'left' | 'right';
export type Trick = 'grab' | 'spin-left' | 'spin-right';

export const JAM_DURATION_MS = 40000;
export const JAM_TARGET_SCORE = 2200;

export const STAGES = [
    { name: 'PUMP' },
    { name: 'AIR' },
    { name: 'TRICKS' },
    { name: 'KIEZ JAM' }
] as const;

const TRICK_POINTS: Record<Trick, number> = {
    grab: 150,
    'spin-left': 250,
    'spin-right': 250
};

export type Attempt = {
    stage: number;
    phase: 'playing' | 'stage-cleared' | 'lost' | 'cleared' | 'leaving';
    score: number;
    combo: number;
    cleanLandings: number;
    landedTricks: Trick[];
    lastTrickSide: PipeSide | null;
    remainingMs: number;
};

function resetStageState(attempt: Attempt) {
    attempt.phase = 'playing';
    attempt.score = 0;
    attempt.combo = 0;
    attempt.cleanLandings = 0;
    attempt.landedTricks = [];
    attempt.lastTrickSide = null;
    attempt.remainingMs = attempt.stage === 3 ? JAM_DURATION_MS : 0;
}

export function createAttempt(): Attempt {
    const attempt: Attempt = {
        stage: 0,
        phase: 'playing',
        score: 0,
        combo: 0,
        cleanLandings: 0,
        landedTricks: [],
        lastTrickSide: null,
        remainingMs: 0
    };
    resetStageState(attempt);
    return attempt;
}

function maybeClearStage(attempt: Attempt) {
    const clear = attempt.stage === 0
        ? attempt.cleanLandings >= 1
        : attempt.stage === 1
            ? attempt.cleanLandings >= 3
            : attempt.stage === 2
                ? attempt.landedTricks.length >= 3
                : attempt.score >= JAM_TARGET_SCORE && attempt.landedTricks.length >= 3;

    if (!clear) return;
    attempt.phase = attempt.stage === STAGES.length - 1 ? 'cleared' : 'stage-cleared';
}

export function recordLanding(
    attempt: Attempt,
    side: PipeSide,
    clean: boolean,
    trick: Trick | null
): boolean {
    if (attempt.phase !== 'playing') return false;

    if (!clean) {
        attempt.combo = 0;
        return true;
    }

    attempt.cleanLandings++;
    attempt.combo++;
    attempt.score += 100 * attempt.combo;

    if (trick) {
        attempt.score += TRICK_POINTS[trick] * attempt.combo;
        const newTrick = !attempt.landedTricks.includes(trick);
        if (attempt.stage === 2 && side !== attempt.lastTrickSide && newTrick) {
            attempt.landedTricks.push(trick);
            attempt.lastTrickSide = side;
        } else if (attempt.stage === 3 && newTrick) {
            attempt.landedTricks.push(trick);
        }
    }

    maybeClearStage(attempt);
    return true;
}

export function tickAttempt(attempt: Attempt, deltaMs: number): boolean {
    if (attempt.phase !== 'playing' || attempt.stage !== 3
        || !Number.isFinite(deltaMs) || deltaMs <= 0) {
        return false;
    }

    attempt.remainingMs = Math.max(0, attempt.remainingMs - deltaMs);
    if (attempt.remainingMs > 0 || attempt.score >= JAM_TARGET_SCORE) return false;

    attempt.phase = 'lost';
    return true;
}

export function retryStage(attempt: Attempt): boolean {
    if (attempt.phase !== 'lost') return false;
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
