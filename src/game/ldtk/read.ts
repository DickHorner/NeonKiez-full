export type LdtkTile = {
    px: [number, number];
    src: [number, number];
    f: number;
    a?: number;
};


export type LdtkField = {
    __identifier: string;
    __value: unknown;
};

export type LdtkEntity = {
    __identifier: string;
    px: [number, number];
    width: number;
    height: number;
    fieldInstances: LdtkField[];
};


export type LdtkLayer = {
    __identifier: string;

    __gridSize: number;
    __cWid: number;
    __cHei: number;

    __pxTotalOffsetX: number;
    __pxTotalOffsetY: number;
    __tilesetDefUid: number | null;
    __tilesetRelPath: string | null;
    __opacity: number;
    visible: boolean;

    intGridCsv: number[];

    gridTiles: LdtkTile[];
    autoLayerTiles: LdtkTile[];

    entityInstances: LdtkEntity[];
};


export type LdtkLevel = {
    identifier: string;

    pxWid: number;
    pxHei: number;

    layerInstances: LdtkLayer[];
};


export type LdtkTileset = {
    uid: number;
    relPath: string | null;
    tileGridSize: number;
};

export type LdtkProject = {
    levels: LdtkLevel[];
    defs: { tilesets: LdtkTileset[] };
};


// Validate the collections we select from, not the entire LDtk schema.
export function readProject(data: unknown): LdtkProject {
    if (!data || typeof data !== 'object' ||
        !('levels' in data) || !Array.isArray(data.levels)) {
        throw new Error('LDtk project is missing or has no levels array');
    }

    return data as LdtkProject;
}

export function requireLevel(project: LdtkProject, identifier: string): LdtkLevel {
    const level = project.levels.find(level => level.identifier === identifier);

    if (!level) {
        throw new Error(`LDtk level "${identifier}" not found`);
    }

    return level;
}

export function requireLayer(level: LdtkLevel, identifier: string): LdtkLayer {
    if (!Array.isArray(level.layerInstances)) {
        throw new Error(`LDtk level "${level.identifier}" has no layerInstances array`);
    }

    const layer = level.layerInstances.find(layer => layer.__identifier === identifier);

    if (!layer) {
        throw new Error(`LDtk layer "${identifier}" not found in level "${level.identifier}"`);
    }

    return layer;
}

export function findEntities(layer: LdtkLayer, identifier: string): LdtkEntity[] {
    if (!Array.isArray(layer.entityInstances)) {
        throw new Error(`LDtk layer "${layer.__identifier}" has no entityInstances array`);
    }

    return layer.entityInstances.filter(entity => entity.__identifier === identifier);
}

export function requireEntity(layer: LdtkLayer, identifier: string): LdtkEntity {
    if (!Array.isArray(layer.entityInstances)) {
        throw new Error(`LDtk layer "${layer.__identifier}" has no entityInstances array`);
    }

    const entity = layer.entityInstances.find(entity => entity.__identifier === identifier);

    if (!entity) {
        throw new Error(`LDtk entity "${identifier}" not found in layer "${layer.__identifier}"`);
    }

    return entity;
}

// LDtk exports topmost first; Phaser draws bottommost first.
// Collision is semantic-only: its IntGrid drives physics and must never become world art.
export function tileLayers(level: LdtkLevel): LdtkLayer[] {
    if (!Array.isArray(level.layerInstances)) {
        throw new Error(`LDtk level "${level.identifier}" has no layerInstances array`);
    }
    if (!Number.isInteger(level.pxWid) || level.pxWid <= 0 ||
        !Number.isInteger(level.pxHei) || level.pxHei <= 0) {
        throw new Error(`LDtk level "${level.identifier}" has invalid pixel dimensions`);
    }
    for (const layer of level.layerInstances) {
        if (!Number.isInteger(layer.__gridSize) || layer.__gridSize <= 0 ||
            layer.__cWid !== Math.ceil(level.pxWid / layer.__gridSize) ||
            layer.__cHei !== Math.ceil(level.pxHei / layer.__gridSize)) {
            throw new Error(`LDtk layer "${layer.__identifier}" has inconsistent grid dimensions`);
        }
        if (!Array.isArray(layer.gridTiles) || !Array.isArray(layer.autoLayerTiles)) {
            throw new Error(`LDtk layer "${layer.__identifier}" has missing tile arrays`);
        }
    }
    return level.layerInstances.filter(layer => layer.__identifier !== 'Collision' &&
        layer.visible && (layer.gridTiles.length > 0 || layer.autoLayerTiles.length > 0)).reverse();
}

export function requireTileset(project: LdtkProject, uid: number | null): LdtkTileset {
    const tileset = Array.isArray(project.defs?.tilesets)
        ? project.defs.tilesets.find(tileset => tileset.uid === uid) : undefined;
    if (!tileset) throw new Error(`LDtk tileset UID ${uid} not found`);
    if (!Number.isInteger(tileset.tileGridSize) || tileset.tileGridSize <= 0) {
        throw new Error(`LDtk tileset UID ${uid} has invalid tileGridSize`);
    }
    return tileset;
}

export function tilesetPath(tileset: LdtkTileset, layer: LdtkLayer): string {
    const path = tileset.relPath ?? layer.__tilesetRelPath;
    if (!path) throw new Error(`LDtk tileset UID ${tileset.uid} has no image path for layer "${layer.__identifier}"`);
    return path;
}
