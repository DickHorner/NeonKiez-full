export type LdtkTile = {
    px: [number, number];
    src: [number, number];
    f: number;
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

    pxOffsetX: number;
    pxOffsetY: number;

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


export type LdtkProject = {
    levels: LdtkLevel[];
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
