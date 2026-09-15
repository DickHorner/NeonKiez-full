import {
    Scene,
    GameObjects,
    Physics,
    Input
} from 'phaser';


import {
    readProject,
    requireLevel,
    requireLayer,
    requireEntity,
    findEntities,
    tileLayers,
    requireTileset,
    tilesetPath,
    type LdtkTile,
    type LdtkLayer,
    type LdtkTileset
} from '../ldtk/read';
import { isDungeonCleared, type Session } from '../session';


type PhysicsRectangle =
    GameObjects.Rectangle & {
        body: Physics.Arcade.Body;
    };


export class Game extends Scene {
    private readonly session: Session;
    private player!: PhysicsRectangle;

    private keys!: {
        W: Input.Keyboard.Key;
        A: Input.Keyboard.Key;
        S: Input.Keyboard.Key;
        D: Input.Keyboard.Key;
    };
    private dungeonTriggered = false;

    constructor(session: Session) {
        super('Game');
        this.session = session;
    }

    isDungeonCleared(dungeonId: string): boolean {
        return isDungeonCleared(this.session, dungeonId);
    }


    preload() {
        // Queue only the visible, non-empty hub layers' images after JSON loads.
        this.load.setPath('assets/ldtk/');
        const loadTilesets = () => {
            const project = readProject(this.cache.json.get('neonkiez'));
            const level = requireLevel(project, 'Kiez_Center');
            requireEntity(requireLayer(level, 'Entities'), 'Player_Spawn');
            const collision = requireLayer(level, 'Collision');
            if (!Array.isArray(collision.intGridCsv) ||
                collision.intGridCsv.length !== collision.__cWid * collision.__cHei) {
                throw new Error('LDtk Collision layer has inconsistent intGridCsv dimensions');
            }
            const queued = new Set<number>();
            for (const layer of tileLayers(level)) {
                const tileset = requireTileset(project, layer.__tilesetDefUid);
                const path = tilesetPath(tileset, layer);
                if (!queued.has(tileset.uid) && !this.textures.exists(`ldtk-${tileset.uid}`)) {
                    this.load.image(`ldtk-${tileset.uid}`, path);
                    queued.add(tileset.uid);
                }
            }
        };
        if (this.cache.json.exists('neonkiez')) {
            loadTilesets();
        } else {
            this.load.once('filecomplete-json-neonkiez', loadTilesets);
            this.load.json('neonkiez', 'neonkiez-ldtk.ldtk');
        }
    }

    create() {
        // Scene instances survive shutdown; reset the guard on every hub visit.
        this.dungeonTriggered = false;

        const project = readProject(this.cache.json.get('neonkiez'));
        const level = requireLevel(project, 'Kiez_Center');

        const collision = requireLayer(level, 'Collision');
        const entities = requireLayer(level, 'Entities');


        //
        // RENDER LDtk TILES
        //

        const drawTile = (tile: LdtkTile, layer: LdtkLayer, tileset: LdtkTileset) => {
            const textureKey = `ldtk-${tileset.uid}`;
            if (!this.textures.exists(textureKey)) {
                throw new Error(`LDtk tileset image failed to load: ${tilesetPath(tileset, layer)}`);
            }
            const texture = this.textures.get(textureKey);
            const size = tileset.tileGridSize;
            const frameName = `${tile.src[0]}-${tile.src[1]}-${size}`;
            if (!texture.has(frameName)) {
                const source = texture.getSourceImage();
                if (tile.src[0] < 0 || tile.src[1] < 0 ||
                    tile.src[0] + size > source.width || tile.src[1] + size > source.height) {
                    throw new Error(`LDtk tile source outside tileset UID ${tileset.uid}: ${frameName}`);
                }
                // Exported src already includes tileset spacing and padding.
                texture.add(frameName, 0, tile.src[0], tile.src[1], size, size);
            }
            this.add.image(tile.px[0] + layer.__pxTotalOffsetX,
                tile.px[1] + layer.__pxTotalOffsetY, textureKey, frameName)
                .setOrigin(0)
                .setFlip((tile.f & 1) !== 0, (tile.f & 2) !== 0)
                .setAlpha(layer.__opacity * (tile.a ?? 1))
                .setDepth(level.layerInstances.length - 1 - level.layerInstances.indexOf(layer));
        };
        for (const layer of tileLayers(level)) {
            const tileset = requireTileset(project, layer.__tilesetDefUid);
            layer.autoLayerTiles.forEach(tile => drawTile(tile, layer, tileset));
            layer.gridTiles.forEach(tile => drawTile(tile, layer, tileset));
        }


        //
        // PLAYER SPAWN
        //

        const spawn = requireEntity(entities, 'Player_Spawn');


        const player =
            this.add.rectangle(
                spawn.px[0] + entities.__pxTotalOffsetX + spawn.width / 2,
                spawn.px[1] + entities.__pxTotalOffsetY + spawn.height / 2,

                14,
                14,

                0xff00ff
            ) as PhysicsRectangle;


        this.physics.add.existing(
            player,
            false
        );

        this.player = player;
        player.setDepth(level.layerInstances.length - 1 - level.layerInstances.indexOf(entities));

        //
        // DUNGEON ENTRANCES FROM LDtk
        //

        const dungeonEntrances = findEntities(entities, 'DungeonEntrance');

        dungeonEntrances.forEach(entrance => {
            const dungeonField =
                entrance.fieldInstances.find(
                    field =>
                        field.__identifier === 'DungeonID'
                );

            const dungeonId =
                typeof dungeonField?.__value === 'string'
                    ? dungeonField.__value
                    : null;

            if (!dungeonId) {
                return;
            }

            const trigger = this.add.zone(
                entrance.px[0] + entrance.width / 2,
                entrance.px[1] + entrance.height / 2,
                entrance.width,
                entrance.height
            );

            this.physics.add.existing(
                trigger,
                true
            );

            this.physics.add.overlap(
                this.player,
                trigger,
                () => {
                    if (this.dungeonTriggered) {
                        return;
                    }

                    this.dungeonTriggered = true;

                    console.log(
                        `Dungeon entered: ${dungeonId}`
                    );

                    this.scene.start('Asteroids');
                }
            );
        });


        //
        // COLLISION FROM LDtk INTGRID
        //

        const walls: GameObjects.Zone[] = [];

        const gridSize =
            collision.__gridSize;


        collision.intGridCsv.forEach(
            (value, index) => {
                // 0 = empty
                // everything else currently means Solid
                if (value === 0) {
                    return;
                }


                const gridX =
                    index % collision.__cWid;

                const gridY =
                    Math.floor(
                        index / collision.__cWid
                    );


                const x =
                    collision.__pxTotalOffsetX +
                    gridX * gridSize +
                    gridSize / 2;

                const y =
                    collision.__pxTotalOffsetY +
                    gridY * gridSize +
                    gridSize / 2;


                const wall =
                    this.add.zone(
                        x,
                        y,
                        gridSize,
                        gridSize
                    );


                this.physics.add.existing(
                    wall,
                    true
                );


                walls.push(wall);
            }
        );


        this.physics.add.collider(
            this.player,
            walls
        );


        //
        // WORLD
        //

        this.physics.world.setBounds(
            0,
            0,
            level.pxWid,
            level.pxHei
        );


        this.player.body.setCollideWorldBounds(
            true
        );


        //
        // CAMERA
        //

        this.cameras.main.setBounds(
            0,
            0,
            level.pxWid,
            level.pxHei
        );


        this.cameras.main.startFollow(
            this.player,
            true,
            0.12,
            0.12
        );


        //
        // INPUT
        //

        if (!this.input.keyboard) {
            throw new Error(
                'Keyboard input unavailable'
            );
        }


        this.keys = this.input.keyboard.addKeys({
            W: Input.Keyboard.KeyCodes.W,
            A: Input.Keyboard.KeyCodes.A,
            S: Input.Keyboard.KeyCodes.S,
            D: Input.Keyboard.KeyCodes.D
        }) as typeof this.keys;
    }


    update() {
        const speed = 150;

        const body =
            this.player.body;

        body.setVelocity(0);

        if (this.keys.A.isDown) {
            body.setVelocityX(-speed);
        }
        else if (this.keys.D.isDown) {
            body.setVelocityX(speed);
        }

        if (this.keys.W.isDown) {
            body.setVelocityY(-speed);
        }
        else if (this.keys.S.isDown) {
            body.setVelocityY(speed);
        }

        if (body.velocity.lengthSq() > 0) {
            body.velocity
                .normalize()
                .scale(speed);
        }
    }
}       