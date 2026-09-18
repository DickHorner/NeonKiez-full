export const BARREL_CAP = 4;
export const BARREL_SPAWN_INTERVAL_MS = 3000;
export const BARREL_LIFE_MS = 10000;
export const HIT_IFRAME_MS = 900;
export const HIT_STUN_MS = 220;

export const STAGES = [
    { name: 'LADDERS', barrels: false },
    { name: 'BARRELS', barrels: true },
    { name: 'TRICK LADDERS', barrels: true },
    { name: 'TOP PLATFORM', barrels: true }
] as const;

export type Attempt = {
    stage: number;
    phase: 'playing' | 'stage-cleared' | 'cleared' | 'leaving';
    lastBarrelSpawnAt: number;
    protectedUntil: number;
    stunnedUntil: number;
};

function resetStageState(attempt: Attempt, now: number) {
    attempt.phase = 'playing';
    attempt.lastBarrelSpawnAt = now;
    attempt.protectedUntil = 0;
    attempt.stunnedUntil = 0;
}

export function createAttempt(now = 0): Attempt {
    const attempt: Attempt = {
        stage: 0,
        phase: 'playing',
        lastBarrelSpawnAt: now,
        protectedUntil: 0,
        stunnedUntil: 0
    };
    resetStageState(attempt, now);
    return attempt;
}

export function shouldSpawnBarrel(attempt: Attempt, now: number, activeBarrels: number): boolean {
    if (attempt.phase !== 'playing' || !STAGES[attempt.stage].barrels) return false;
    if (activeBarrels >= BARREL_CAP) return false;
    if (now - attempt.lastBarrelSpawnAt < BARREL_SPAWN_INTERVAL_MS) return false;
    attempt.lastBarrelSpawnAt = now;
    return true;
}

export function hitPlayer(attempt: Attempt, now: number): boolean {
    if (attempt.phase !== 'playing' || !STAGES[attempt.stage].barrels
        || now < attempt.protectedUntil) {
        return false;
    }
    attempt.protectedUntil = now + HIT_IFRAME_MS;
    attempt.stunnedUntil = now + HIT_STUN_MS;
    return true;
}

export function reachGoal(attempt: Attempt): boolean {
    if (attempt.phase !== 'playing') return false;
    attempt.phase = attempt.stage === STAGES.length - 1 ? 'cleared' : 'stage-cleared';
    return true;
}

export function advanceStage(attempt: Attempt, now: number): boolean {
    if (attempt.phase !== 'stage-cleared' || attempt.stage >= STAGES.length - 1) return false;
    attempt.stage++;
    resetStageState(attempt, now);
    return true;
}

export function leaveAttempt(attempt: Attempt): boolean {
    if (attempt.phase === 'leaving') return false;
    attempt.phase = 'leaving';
    return true;
}
