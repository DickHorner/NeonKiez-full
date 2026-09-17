// DUN_ROOFTOP_INVADERS: Pocket constants + DUNGEON_2_IMPLEMENTATION.md.
export const STAGES = [
    { name: 'RANGE', enemiesPerWave: [3] },
    { name: 'FORMATIONS', enemiesPerWave: [4, 5, 6] },
    // Recovered from Pocket c8aa95f: 5 + floor(one-based wave / 2).
    { name: 'ALARM', enemiesPerWave: [5, 6, 6, 7] },
    { name: 'CORE', enemiesPerWave: [0] }
] as const;
export const ENEMY_CAP = 12;
// Classic Space Invaders timing: the player may only have one shot in flight.
export const PROJECTILE_CAP = 1;
export const PROJECTILE_LIFETIME = 2000;
export const ALARM_INTERVAL = 5000;

export type FormationDirection = -1 | 1;

export type FormationMotion = {
    dx: number;
    dy: number;
    direction: FormationDirection;
};

export function formationMotion(left: number, right: number, direction: FormationDirection,
    distance: number, minX: number, maxX: number, drop: number): FormationMotion {
    if (direction > 0 && right + distance >= maxX) {
        return { dx: 0, dy: drop, direction: -1 };
    }
    if (direction < 0 && left - distance <= minX) {
        return { dx: 0, dy: drop, direction: 1 };
    }
    return { dx: distance * direction, dy: 0, direction };
}

export type Attempt = {
    stage: number;
    wave: number;
    phase: 'playing' | 'wave-wait' | 'stage-cleared' | 'lost' | 'cleared' | 'leaving';
    remainingEnemies: number[];
    nextEnemyId: number;
    nextWaveAt: number;
    nextAlarmAt: number;
    coreHP: number;
    hearts: number;
    protectedUntil: number;
};

function startWave(attempt: Attempt) {
    const count = STAGES[attempt.stage].enemiesPerWave[attempt.wave];
    attempt.remainingEnemies = Array.from({ length: count }, () => attempt.nextEnemyId++);
    attempt.phase = 'playing';
}

export function createAttempt(now = 0): Attempt {
    const attempt: Attempt = { stage: 0, wave: 0, phase: 'playing', remainingEnemies: [],
        nextEnemyId: 0, nextWaveAt: 0, nextAlarmAt: now + ALARM_INTERVAL,
        coreHP: 30, hearts: 3, protectedUntil: 0 };
    startWave(attempt);
    return attempt;
}

export function hitEnemy(attempt: Attempt, id: number, now: number): boolean {
    if (attempt.phase !== 'playing') return false;
    const index = attempt.remainingEnemies.indexOf(id);
    if (index < 0) return false;
    attempt.remainingEnemies.splice(index, 1);
    if (attempt.remainingEnemies.length === 0) {
        attempt.phase = attempt.wave + 1 < STAGES[attempt.stage].enemiesPerWave.length
            ? 'wave-wait' : 'stage-cleared';
        attempt.nextWaveAt = now + 1000;
    }
    return true;
}

export function advanceWave(attempt: Attempt, now: number): boolean {
    if (attempt.phase !== 'wave-wait' || attempt.remainingEnemies.length !== 0
        || now < attempt.nextWaveAt) return false;
    attempt.wave++;
    startWave(attempt);
    return true;
}

export function advanceStage(attempt: Attempt, now: number): boolean {
    if (attempt.phase !== 'stage-cleared' || attempt.stage >= 3) return false;
    attempt.stage++;
    attempt.wave = 0;
    attempt.nextAlarmAt = now + ALARM_INTERVAL;
    startWave(attempt);
    return true;
}

export function spawnAlarm(attempt: Attempt, now: number): number | null {
    if (attempt.stage !== 2 || attempt.phase !== 'playing' || now < attempt.nextAlarmAt) return null;
    // A capped tick is consumed; no backlog or burst after an inactive interval.
    attempt.nextAlarmAt = now + ALARM_INTERVAL;
    if (attempt.remainingEnemies.length >= ENEMY_CAP) return null;
    const id = attempt.nextEnemyId++;
    attempt.remainingEnemies.push(id);
    return id;
}

export function hitCore(attempt: Attempt): boolean {
    if (attempt.stage !== 3 || attempt.phase !== 'playing' || attempt.coreHP <= 0) return false;
    attempt.coreHP = Math.max(0, attempt.coreHP - 1);
    if (attempt.coreHP === 0) attempt.phase = 'cleared';
    return true;
}

export function hitPlayer(attempt: Attempt, now: number): boolean {
    if (attempt.phase !== 'playing' || now < attempt.protectedUntil) return false;
    attempt.hearts--;
    attempt.protectedUntil = now + 1000;
    if (attempt.hearts === 0) attempt.phase = 'lost';
    return true;
}

export function retryStage(attempt: Attempt, now: number): boolean {
    if (attempt.phase !== 'lost') return false;
    attempt.wave = 0;
    attempt.hearts = 3;
    attempt.coreHP = 30;
    attempt.protectedUntil = 0;
    attempt.nextAlarmAt = now + ALARM_INTERVAL;
    startWave(attempt);
    return true;
}
