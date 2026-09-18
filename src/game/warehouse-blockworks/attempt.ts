export const CRATE_IFRAME_MS = 900;
export const CRATE_STUN_MS = 220;

export const STAGES = [
    { name: 'CONVEYOR INTRO', switchesRequired: 1 },
    { name: 'BLOCK ROWS', switchesRequired: 2 },
    { name: 'MOVING CRATES', switchesRequired: 0 },
    { name: 'FINAL PATTERN', switchesRequired: 1 }
] as const;

export type Attempt = {
    stage: number;
    phase: 'playing' | 'stage-cleared' | 'cleared' | 'leaving';
    activatedSwitchIds: string[];
    gatesOpen: boolean;
    protectedUntil: number;
    stunnedUntil: number;
};

function resetStageState(attempt: Attempt) {
    attempt.phase = 'playing';
    attempt.activatedSwitchIds = [];
    attempt.gatesOpen = false;
    attempt.protectedUntil = 0;
    attempt.stunnedUntil = 0;
}

export function createAttempt(): Attempt {
    const attempt: Attempt = {
        stage: 0,
        phase: 'playing',
        activatedSwitchIds: [],
        gatesOpen: false,
        protectedUntil: 0,
        stunnedUntil: 0
    };
    resetStageState(attempt);
    return attempt;
}

export function activateSwitch(attempt: Attempt, switchId: string): boolean {
    if (attempt.phase !== 'playing' || switchId.length === 0 || attempt.stage === 2) return false;
    if (attempt.activatedSwitchIds.includes(switchId)) return false;

    attempt.activatedSwitchIds.push(switchId);
    const required = STAGES[attempt.stage].switchesRequired;
    if (!attempt.gatesOpen && attempt.activatedSwitchIds.length >= required) {
        attempt.gatesOpen = true;
    }
    return true;
}

export function bumpCrate(attempt: Attempt, now: number): boolean {
    if (attempt.phase !== 'playing' || attempt.stage !== 2 || now < attempt.protectedUntil) return false;
    attempt.protectedUntil = now + CRATE_IFRAME_MS;
    attempt.stunnedUntil = now + CRATE_STUN_MS;
    return true;
}

export function reachGoal(attempt: Attempt): boolean {
    if (attempt.phase !== 'playing') return false;
    if (attempt.stage !== 2 && !attempt.gatesOpen) return false;

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
