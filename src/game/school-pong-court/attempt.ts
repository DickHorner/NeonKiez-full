export const STAGES = [
    { name: 'RALLY', targetScore: 2, ballSpeed: 170, aiSpeed: 125, aiDeadZone: 34 },
    { name: 'MATCH', targetScore: 3, ballSpeed: 200, aiSpeed: 155, aiDeadZone: 28 },
    { name: 'FAST RALLY', targetScore: 4, ballSpeed: 225, aiSpeed: 180, aiDeadZone: 22 },
    { name: 'FINAL MATCH', targetScore: 5, ballSpeed: 250, aiSpeed: 205, aiDeadZone: 16 }
] as const;

const MAX_BOUNCE_ANGLE = Math.PI / 3;
const SERVE_HORIZONTAL_RATIO = 0.32;

export type PointSide = 'player' | 'opponent';
export type VerticalDirection = -1 | 1;

export type Attempt = {
    stage: number;
    playerScore: number;
    opponentScore: number;
    serveDirection: VerticalDirection;
    phase: 'ready' | 'playing' | 'stage-cleared' | 'lost' | 'cleared' | 'leaving';
};

export function createAttempt(): Attempt {
    return {
        stage: 0,
        playerScore: 0,
        opponentScore: 0,
        serveDirection: -1,
        phase: 'ready'
    };
}

export function serveBall(attempt: Attempt): boolean {
    if (attempt.phase !== 'ready') return false;
    attempt.phase = 'playing';
    return true;
}

export function scorePoint(attempt: Attempt, side: PointSide): boolean {
    if (attempt.phase !== 'playing') return false;

    if (side === 'player') attempt.playerScore++;
    else attempt.opponentScore++;

    const targetScore = STAGES[attempt.stage].targetScore;
    if (attempt.playerScore >= targetScore) {
        attempt.phase = attempt.stage === STAGES.length - 1 ? 'cleared' : 'stage-cleared';
    } else if (attempt.opponentScore >= targetScore) {
        attempt.phase = 'lost';
    } else {
        attempt.serveDirection = attempt.serveDirection === -1 ? 1 : -1;
        attempt.phase = 'ready';
    }
    return true;
}

export function advanceStage(attempt: Attempt): boolean {
    if (attempt.phase !== 'stage-cleared' || attempt.stage >= STAGES.length - 1) return false;
    attempt.stage++;
    attempt.playerScore = 0;
    attempt.opponentScore = 0;
    attempt.serveDirection = -1;
    attempt.phase = 'ready';
    return true;
}

export function retryStage(attempt: Attempt): boolean {
    if (attempt.phase !== 'lost') return false;
    attempt.playerScore = 0;
    attempt.opponentScore = 0;
    attempt.serveDirection = -1;
    attempt.phase = 'ready';
    return true;
}

export function leaveAttempt(attempt: Attempt): boolean {
    if (attempt.phase === 'leaving') return false;
    attempt.phase = 'leaving';
    return true;
}

export function paddleBounce(offset: number, halfWidth: number, speed: number,
    verticalDirection: VerticalDirection) {
    const angle = Math.max(-1, Math.min(1, offset / halfWidth)) * MAX_BOUNCE_ANGLE;
    return {
        x: Math.sin(angle) * speed,
        y: Math.cos(angle) * speed * verticalDirection
    };
}

export function serveVelocity(speed: number, verticalDirection: VerticalDirection,
    horizontalDirection: VerticalDirection) {
    const x = speed * SERVE_HORIZONTAL_RATIO * horizontalDirection;
    return {
        x,
        y: Math.sqrt(speed * speed - x * x) * verticalDirection
    };
}

export function aiVelocity(paddleX: number, ballX: number, centerX: number, ballVy: number,
    speed: number, deadZone: number): number {
    const targetX = ballVy < 0 ? ballX : centerX;
    const delta = targetX - paddleX;
    if (Math.abs(delta) <= deadZone) return 0;
    return Math.sign(delta) * speed;
}
