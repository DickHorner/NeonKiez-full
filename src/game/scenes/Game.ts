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
    type LdtkTile,
    type LdtkLayer
} from '../ldtk/read';


type PhysicsRectangle =
    GameObjects.Rectangle & {
        body: Physics.Arcade.Body;
    };


export class Game extends Scene {
    private player!: PhysicsRectangle;

    private keys!: {
        W: Input.Keyboard.Key;
        A: Input.Keyboard.Key;
        S: Input.Keyboard.Key;
        D: Input.Keyboard.Key;
    };
    private dungeonTriggered = false;

    constructor() {
        super('Game');
    }


    preload() {
        this.load.setPath('assets');

        this.load.json(
            'neonkiez',
            'ldtk/neonkiez-ldtk.ldtk'
        );

        this.load.image(
            'hub-tiles',
            'tilesets/tilemap.png'
        );
    }


    create() {
        const project = readProject(this.cache.json.get('neonkiez'));
        const level = requireLevel(project, 'Hub_Test');

        const ground = requireLayer(level, 'Ground');
        const collision = requireLayer(level, 'Collision');
        const entities = requireLayer(level, 'Entities');


        //
        // RENDER LDtk TILES
        //

        const texture =
            this.textures.get('hub-tiles');


        const drawTile = (
            tile: LdtkTile,
            layer: LdtkLayer
        ) => {
            const frameName =
                `tile-${tile.src[0]}-${tile.src[1]}`;


            if (!texture.has(frameName)) {
                texture.add(
                    frameName,
                    0,
                    tile.src[0],
                    tile.src[1],
                    16,
                    16
                );
            }


            const image = this.add.image(
                tile.px[0] + layer.pxOffsetX,
                tile.px[1] + layer.pxOffsetY,
                'hub-tiles',
                frameName
            );


            image.setOrigin(0);

            image.setFlip(
                (tile.f & 1) !== 0,
                (tile.f & 2) !== 0
            );
        };


        ground.gridTiles.forEach(
            tile => drawTile(tile, ground)
        );


        collision.autoLayerTiles.forEach(
            tile => drawTile(tile, collision)
        );


        //
        // PLAYER SPAWN
        //

        const spawn = requireEntity(entities, 'Player_Spawn');


        const player =
            this.add.rectangle(
                spawn.px[0] + spawn.width / 2,
                spawn.px[1] + spawn.height / 2,

                14,
                14,

                0xff00ff
            ) as PhysicsRectangle;


        this.physics.add.existing(
            player,
            false
        );

        this.player = player;

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

                    this.add.text(
                        16,
                        16,
                        `DUNGEON: ${dungeonId.toUpperCase()}`,
                        {
                            fontFamily: 'monospace',
                            fontSize: 24,
                            color: '#ffffff',
                            backgroundColor: '#000000'
                        }
                    )
                        .setScrollFactor(0)
                        .setDepth(1000);
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
                    collision.pxOffsetX +
                    gridX * gridSize +
                    gridSize / 2;

                const y =
                    collision.pxOffsetY +
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