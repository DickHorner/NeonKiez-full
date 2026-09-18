export const TOKEN_TARGET = 5;
export const GHOST_IFRAME_MS = 900;
export const GHOST_STUN_MS = 220;

export const STAGES = [
    { name: 'WARMUP' },
    { name: 'DARK MAZE' },
    { name: 'TOKEN RUN' },
    { name: 'EXIT ROOM' }
] as const;

export type Attempt = {
    stage: number;
    phase: 'playing' | 'stage-cleared' | 'cleared' | 'leaving';
    switchesActivated: number;
    gatesOpen: boolean;
    lightsOn: boolean;
    collectedTokenIds: string[];
    protectedUntil: number;
    stunnedUntil: number;
};

function resetStageState(attempt: Attempt) {
    attempt.phase = 'playing';
    attempt.switchesActivated = 0;
    attempt.gatesOpen = false;
    attempt.lightsOn = attempt.stage !== 1;
    attempt.collectedTokenIds = [];
    attempt.protectedUntil = 0;
    attempt.stunnedUntil = 0;
}

export function createAttempt(): Attempt {
    const attempt: Attempt = {
        stage: 0,
        phase: 'playing',
        switchesActivated: 0,
        gatesOpen: false,
        lightsOn: true,
        collectedTokenIds: [],
        protectedUntil: 0,
        stunnedUntil: 0
    };
    resetStageState(attempt);
    return attempt;
}

export function interactSwitch(attempt: Attempt): boolean {
    if (attempt.phase !== 'playing') return false;

    if (attempt.stage === 0 || attempt.stage === 3) {
        attempt.switchesActivated++;
        attempt.gatesOpen = !attempt.gatesOpen;
        return true;
    }

    if (attempt.stage === 1) {
        attempt.switchesActivated++;
        attempt.lightsOn = !attempt.lightsOn;
        return true;
    }

    return false;
}

export function collectToken(attempt: Attempt, tokenId: string): boolean {
    if (attempt.phase !== 'playing' || attempt.stage !== 2 || tokenId.length === 0) return false;
    if (attempt.collectedTokenIds.includes(tokenId)) return false;
    attempt.collectedTokenIds.push(tokenId);
    return true;
}

export function bumpGhost(attempt: Attempt, now: number): boolean {
    if (attempt.phase !== 'playing' || attempt.stage !== 2 || now < attempt.protectedUntil) return false;
    attempt.protectedUntil = now + GHOST_IFRAME_MS;
    attempt.stunnedUntil = now + GHOST_STUN_MS;
    return true;
}

export function reachGoal(attempt: Attempt): boolean {
    if (attempt.phase !== 'playing') return false;

    const ready = attempt.stage === 0
        ? attempt.switchesActivated > 0 && attempt.gatesOpen
        : attempt.stage === 1
            ? true
            : attempt.stage === 2
                ? attempt.collectedTokenIds.length >= TOKEN_TARGET
                : attempt.switchesActivated > 0 && attempt.gatesOpen;

    if (!ready) return false;
    attempt.phase = attempt.stage === STAGES.length - 1 ? 'cleared' : 'stage-cleared';
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
