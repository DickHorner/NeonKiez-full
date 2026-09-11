export type Attempt = {
    lives: number;
    phase: 'playing' | 'respawning' | 'lost' | 'cleared' | 'leaving';
    respawnAt: number;
    protectedUntil: number;
};

export function createAttempt(lives: number): Attempt {
    return { lives, phase: 'playing', respawnAt: 0, protectedUntil: 0 };
}

export function loseLife(attempt: Attempt, now: number, respawnDelay: number): boolean {
    if (attempt.phase !== 'playing' || now < attempt.protectedUntil) {
        return false;
    }
    attempt.lives--;
    attempt.phase = attempt.lives === 0 ? 'lost' : 'respawning';
    attempt.respawnAt = now + respawnDelay;
    return true;
}

export function respawn(attempt: Attempt, now: number, safe: boolean, protectionDuration: number): boolean {
    if (attempt.phase !== 'respawning' || now < attempt.respawnAt || !safe) {
        return false;
    }
    attempt.phase = 'playing';
    attempt.protectedUntil = now + protectionDuration;
    return true;
}

export function clearAttempt(attempt: Attempt): boolean {
    // A live attempt may clear while waiting for respawn; a lost attempt is final.
    if (attempt.phase !== 'playing' && attempt.phase !== 'respawning') {
        return false;
    }
    attempt.phase = 'cleared';
    return true;
}
