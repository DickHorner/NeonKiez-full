export const STAGES = [
    { name: 'JUMP' },
    { name: 'MOVING SHELVES' },
    { name: 'SWITCH GATES' },
    { name: 'FINAL RUN' }
] as const;

export type Attempt = {
    stage: number;
    phase: 'playing' | 'stage-cleared' | 'cleared' | 'leaving';
    gatesOpen: boolean;
};

export function createAttempt(): Attempt {
    return { stage: 0, phase: 'playing', gatesOpen: false };
}

export function reachGoal(attempt: Attempt): boolean {
    if (attempt.phase !== 'playing') return false;
    attempt.phase = attempt.stage === STAGES.length - 1 ? 'cleared' : 'stage-cleared';
    return true;
}

export function advanceStage(attempt: Attempt): boolean {
    if (attempt.phase !== 'stage-cleared' || attempt.stage >= STAGES.length - 1) return false;
    attempt.stage++;
    attempt.gatesOpen = false;
    attempt.phase = 'playing';
    return true;
}

export function toggleGates(attempt: Attempt): boolean {
    if (attempt.phase !== 'playing' || attempt.stage !== 2) return false;
    attempt.gatesOpen = !attempt.gatesOpen;
    return true;
}

export function leaveAttempt(attempt: Attempt): boolean {
    if (attempt.phase === 'leaving') return false;
    attempt.phase = 'leaving';
    return true;
}
