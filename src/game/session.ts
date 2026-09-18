export type DungeonId = 'Asteroids' | 'SchoolPongCourt' | 'RooftopInvaders' | 'VideoStorePlatform' | 'SubwayTiming' | 'LaundromatLabyrinth' | 'WarehouseBlockworks' | 'ConstructionDonkeyTower';

export type Session = {
    clearedDungeonIds: DungeonId[];
};

export function createSession(): Session {
    return { clearedDungeonIds: [] };
}

export function isDungeonCleared(session: Session, dungeonId: string): boolean {
    return session.clearedDungeonIds.some(id => id === dungeonId);
}

export function markDungeonCleared(session: Session, dungeonId: DungeonId): void {
    if (!isDungeonCleared(session, dungeonId)) {
        session.clearedDungeonIds.push(dungeonId);
    }
}
