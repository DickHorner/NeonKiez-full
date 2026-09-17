export type CourtAxis = 'horizontal' | 'vertical';
export type PointSide = 'player' | 'opponent';
export type Direction = -1 | 1;

export const STAGES = [
    { name: 'RALLY', targetScore: 2, ballSpeed: 170, aiSpeed: 125, aiDeadZone: 34, axis: 'horizontal' as CourtAxis },
    { name: 'MATCH', targetScore: 3, ballSpeed: 200, aiSpeed: 155, aiDeadZone: 28, axis: 'horizontal' as CourtAxis },
    { name: 'FAST RALLY', targetScore: 4, ballSpeed: 225, aiSpeed: 180, aiDeadZone: 22, axis: 'horizontal' as CourtAxis },
    { name: 'FINAL MATCH', targetScore: 5, ballSpeed: 250, aiSpeed: 205, aiDeadZone: 16, axis: 'vertical' as CourtAxis }
] as const;

const MAX_BOUNCE_ANGLE = Math.PI / 3;
const SERVE_OFF_AXIS_RATIO = 0.32;

export type Attempt = {
    stage: number;
    playerScore: number;
    opponentScore: number;
    serveToward: PointSide;
    phase: 'ready' | 'playing' | 'stage-cleared' | 'lost' | 'cleared' | 'leaving';
};

export function createAttempt(): Attempt {
    return {
        stage: 0,
        playerScore: 0,
        opponentScore: 0,
        serveToward: 'opponent',
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
        // The next serve travels toward the side that conceded the point.
        // This avoids an alternating serve turning a won point into an immediate own goal.
        attempt.serveToward = side === 'player' ? 'opponent' : 'player';
        attempt.phase = 'ready';
    }
    return true;
}

export function advanceStage(attempt: Attempt): boolean {
    if (attempt.phase !== 'stage-cleared' || attempt.stage >= STAGES.length - 1) return false;
    attempt.stage++;
    attempt.playerScore = 0;
    attempt.opponentScore = 0;
    attempt.serveToward = 'opponent';
    attempt.phase = 'ready';
    return true;
}

export function retryStage(attempt: Attempt): boolean {
    if (attempt.phase !== 'lost') return false;
    attempt.playerScore = 0;
    attempt.opponentScore = 0;
    attempt.serveToward = 'opponent';
    attempt.phase = 'ready';
    return true;
}

export function leaveAttempt(attempt: Attempt): boolean {
    if (attempt.phase === 'leaving') return false;
    attempt.phase = 'leaving';
    return true;
}

export function paddleBounce(offset: number, halfLength: number, speed: number,
    axis: CourtAxis, primaryDirection: Direction) {
    const angle = Math.max(-1, Math.min(1, offset / halfLength)) * MAX_BOUNCE_ANGLE;
    const primary = Math.cos(angle) * speed * primaryDirection;
    const secondary = Math.sin(angle) * speed;
    return axis === 'horizontal'
        ? { x: primary, y: secondary }
        : { x: secondary, y: primary };
}

export function serveVelocity(speed: number, axis: CourtAxis, primaryDirection: Direction,
    secondaryDirection: Direction) {
    const secondary = speed * SERVE_OFF_AXIS_RATIO * secondaryDirection;
    const primary = Math.sqrt(speed * speed - secondary * secondary) * primaryDirection;
    return axis === 'horizontal'
        ? { x: primary, y: secondary }
        : { x: secondary, y: primary };
}

export function aiVelocity(paddlePosition: number, ballPosition: number, centerPosition: number,
    trackBall: boolean, speed: number, deadZone: number): number {
    const target = trackBall ? ballPosition : centerPosition;
    const delta = target - paddlePosition;
    if (Math.abs(delta) <= deadZone) return 0;
    return Math.sign(delta) * speed;
}
