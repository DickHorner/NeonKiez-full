// Pocket's stage progression, tuned for the Full prototype's 640 × 360 court.
export const STAGES = [
    { name: 'PADDLE LEARN', targetCount: 3, columns: 3, ballSpeed: 160 },
    { name: 'TARGETS', targetCount: 8, columns: 4, ballSpeed: 240 },
    { name: 'REFLECTORS', targetCount: 6, columns: 3, ballSpeed: 240 },
    { name: 'FINAL CLEAR', targetCount: 12, columns: 4, ballSpeed: 240 }
] as const;

const MAX_BOUNCE_ANGLE = Math.PI / 3;

export type Attempt = {
    stage: number;
    remainingTargets: number[];
    phase: 'ready' | 'playing' | 'stage-cleared' | 'cleared' | 'leaving';
};

function targetIds(stage: number): number[] {
    return Array.from({ length: STAGES[stage].targetCount }, (_, id) => id);
}

export function createAttempt(): Attempt {
    return { stage: 0, remainingTargets: targetIds(0), phase: 'ready' };
}

export function serveBall(attempt: Attempt): boolean {
    if (attempt.phase !== 'ready') return false;
    attempt.phase = 'playing';
    return true;
}

export function missBall(attempt: Attempt): boolean {
    if (attempt.phase !== 'playing') return false;
    attempt.phase = 'ready';
    return true;
}

export function hitTarget(attempt: Attempt, id: number): boolean {
    if (attempt.phase !== 'playing') return false;
    const index = attempt.remainingTargets.indexOf(id);
    if (index === -1) return false;
    attempt.remainingTargets.splice(index, 1);
    if (attempt.remainingTargets.length === 0) {
        attempt.phase = attempt.stage === STAGES.length - 1 ? 'cleared' : 'stage-cleared';
    }
    return true;
}

export function advanceStage(attempt: Attempt): boolean {
    if (attempt.phase !== 'stage-cleared') return false;
    attempt.stage++;
    attempt.remainingTargets = targetIds(attempt.stage);
    attempt.phase = 'ready';
    return true;
}

export function paddleBounce(offset: number, halfWidth: number, speed: number) {
    const angle = Math.max(-1, Math.min(1, offset / halfWidth)) * MAX_BOUNCE_ANGLE;
    return { x: Math.sin(angle) * speed, y: -Math.cos(angle) * speed };
}
