export const CRATE_IFRAME_MS = 900;
export const CRATE_STUN_MS = 220;

export type GridPoint = { x: number; y: number };

export type SokobanLayout = {
    width: number;
    height: number;
    playerStart: GridPoint;
    crateStarts: GridPoint[];
    targets: GridPoint[];
    walls: GridPoint[];
    gate: GridPoint;
    goal: GridPoint;
    conveyor: GridPoint[];
};

export const STAGES = [
    { name: 'CONVEYOR INTRO', crateTargetCount: 1 },
    { name: 'BLOCK ROWS', crateTargetCount: 2 },
    { name: 'MOVING CRATES', crateTargetCount: 0 },
    { name: 'FINAL PATTERN', crateTargetCount: 3 }
] as const;

const barrier = (x: number, height: number, gateY: number): GridPoint[] => {
    const walls: GridPoint[] = [];
    for (let y = 1; y < height - 1; y++) {
        if (y !== gateY) walls.push({ x, y });
    }
    return walls;
};

export const SOKOBAN_LAYOUTS: Record<number, SokobanLayout> = {
    0: {
        width: 12,
        height: 7,
        playerStart: { x: 1, y: 3 },
        crateStarts: [{ x: 3, y: 3 }],
        targets: [{ x: 6, y: 3 }],
        walls: barrier(8, 7, 3),
        gate: { x: 8, y: 3 },
        goal: { x: 10, y: 3 },
        conveyor: [
            { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 },
            { x: 5, y: 3 }, { x: 6, y: 3 }
        ]
    },
    1: {
        width: 12,
        height: 7,
        playerStart: { x: 1, y: 3 },
        crateStarts: [{ x: 3, y: 2 }, { x: 3, y: 4 }],
        targets: [{ x: 6, y: 2 }, { x: 6, y: 4 }],
        walls: barrier(8, 7, 3),
        gate: { x: 8, y: 3 },
        goal: { x: 10, y: 3 },
        conveyor: []
    },
    3: {
        width: 13,
        height: 7,
        playerStart: { x: 1, y: 3 },
        crateStarts: [{ x: 3, y: 1 }, { x: 3, y: 3 }, { x: 3, y: 5 }],
        targets: [{ x: 7, y: 1 }, { x: 7, y: 3 }, { x: 7, y: 5 }],
        walls: barrier(9, 7, 3),
        gate: { x: 9, y: 3 },
        goal: { x: 11, y: 3 },
        conveyor: []
    }
};

export type SokobanState = {
    player: GridPoint;
    crates: GridPoint[];
};

export type Attempt = {
    stage: number;
    phase: 'playing' | 'stage-cleared' | 'cleared' | 'leaving';
    gatesOpen: boolean;
    sokoban: SokobanState | null;
    protectedUntil: number;
    stunnedUntil: number;
};

export type SokobanMove = 'blocked' | 'moved' | 'pushed' | 'cleared';

function clonePoint(point: GridPoint): GridPoint {
    return { x: point.x, y: point.y };
}

function samePoint(a: GridPoint, b: GridPoint): boolean {
    return a.x === b.x && a.y === b.y;
}

function layoutForStage(stage: number): SokobanLayout | undefined {
    return SOKOBAN_LAYOUTS[stage];
}

function resetStageState(attempt: Attempt) {
    attempt.phase = 'playing';
    attempt.gatesOpen = false;
    attempt.protectedUntil = 0;
    attempt.stunnedUntil = 0;

    const layout = layoutForStage(attempt.stage);
    attempt.sokoban = layout ? {
        player: clonePoint(layout.playerStart),
        crates: layout.crateStarts.map(clonePoint)
    } : null;
}

export function createAttempt(): Attempt {
    const attempt: Attempt = {
        stage: 0,
        phase: 'playing',
        gatesOpen: false,
        sokoban: null,
        protectedUntil: 0,
        stunnedUntil: 0
    };
    resetStageState(attempt);
    return attempt;
}

function insideBoard(layout: SokobanLayout, point: GridPoint): boolean {
    return point.x > 0 && point.x < layout.width - 1
        && point.y > 0 && point.y < layout.height - 1;
}

function occupiedByWall(layout: SokobanLayout, point: GridPoint): boolean {
    return layout.walls.some(wall => samePoint(wall, point));
}

function crateIndexAt(state: SokobanState, point: GridPoint): number {
    return state.crates.findIndex(crate => samePoint(crate, point));
}

function updateGateState(attempt: Attempt, layout: SokobanLayout, state: SokobanState) {
    attempt.gatesOpen = layout.targets.every(target =>
        state.crates.some(crate => samePoint(crate, target))
    );
}

export function moveSokoban(attempt: Attempt, dx: number, dy: number): SokobanMove {
    if (attempt.phase !== 'playing' || !attempt.sokoban) return 'blocked';
    if (Math.abs(dx) + Math.abs(dy) !== 1) return 'blocked';

    const layout = layoutForStage(attempt.stage);
    if (!layout) return 'blocked';

    const state = attempt.sokoban;
    const next = { x: state.player.x + dx, y: state.player.y + dy };
    if (!insideBoard(layout, next) || occupiedByWall(layout, next)) return 'blocked';
    if (!attempt.gatesOpen && samePoint(next, layout.gate)) return 'blocked';

    const crateIndex = crateIndexAt(state, next);
    let pushed = false;
    if (crateIndex >= 0) {
        const beyond = { x: next.x + dx, y: next.y + dy };
        if (!insideBoard(layout, beyond)
            || occupiedByWall(layout, beyond)
            || (!attempt.gatesOpen && samePoint(beyond, layout.gate))
            || crateIndexAt(state, beyond) >= 0) {
            return 'blocked';
        }
        state.crates[crateIndex] = beyond;
        pushed = true;
        updateGateState(attempt, layout, state);
    }

    state.player = next;
    if (attempt.gatesOpen && samePoint(state.player, layout.goal)) {
        attempt.phase = attempt.stage === STAGES.length - 1 ? 'cleared' : 'stage-cleared';
        return 'cleared';
    }

    return pushed ? 'pushed' : 'moved';
}

export function bumpCrate(attempt: Attempt, now: number): boolean {
    if (attempt.phase !== 'playing' || attempt.stage !== 2 || now < attempt.protectedUntil) return false;
    attempt.protectedUntil = now + CRATE_IFRAME_MS;
    attempt.stunnedUntil = now + CRATE_STUN_MS;
    return true;
}

export function reachGoal(attempt: Attempt): boolean {
    if (attempt.phase !== 'playing' || attempt.stage !== 2) return false;
    attempt.phase = 'stage-cleared';
    return true;
}

export function restartStage(attempt: Attempt): boolean {
    if (attempt.phase === 'leaving' || attempt.phase === 'cleared') return false;
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
