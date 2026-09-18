import { GameObjects, Input, Physics, Scene } from 'phaser';
import {
    SOKOBAN_LAYOUTS, STAGES, advanceStage, bumpCrate, createAttempt, leaveAttempt,
    moveSokoban, reachGoal, restartStage, type Attempt, type GridPoint, type SokobanLayout
} from '../warehouse-blockworks/attempt';
import { markDungeonCleared, type Session } from '../session';

const TUNING = {
    playerSpeed: 165,
    playerSize: 18,
    arenaInset: 22,
    arenaTop: 54,
    arenaBottomInset: 38,
    gridCell: 38,
    movingCrateSize: 30
};

type Player = GameObjects.Rectangle & { body: Physics.Arcade.Body };
type MovingCrate = GameObjects.Rectangle & { body: Physics.Arcade.Body };

export class WarehouseBlockworks extends Scene {
    private readonly session: Session;
    private attempt!: Attempt;
    private player!: Player;
    private goals!: Physics.Arcade.StaticGroup;
    private movingCrates!: Physics.Arcade.Group;
    private sokobanCrates: GameObjects.Rectangle[] = [];
    private sokobanGate?: GameObjects.Rectangle;
    private stageDecor: GameObjects.GameObject[] = [];
    private status!: GameObjects.Text;
    private message!: GameObjects.Text;
    private keys!: Record<
        'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT' | 'ENTER' | 'R',
        Input.Keyboard.Key
    >;
    private arenaBottom = 0;

    constructor(session: Session) {
        super('WarehouseBlockworks');
        this.session = session;
    }

    create() {
        this.attempt = createAttempt();
        this.physics.world.drawDebug = false;
        this.physics.world.debugGraphic?.clear();
        this.cameras.main.setBackgroundColor('#15120e');

        if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
        this.keys = this.input.keyboard.addKeys(
            'W,A,S,D,UP,LEFT,DOWN,RIGHT,ENTER,R'
        ) as typeof this.keys;

        const leave = () => {
            leaveAttempt(this.attempt);
            this.scene.start('Game');
        };
        this.input.keyboard.once('keydown-ESC', leave);
        this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', leave));

        const { width, height } = this.scale;
        this.arenaBottom = height - TUNING.arenaBottomInset;
        this.physics.world.setBounds(
            TUNING.arenaInset,
            TUNING.arenaTop,
            width - TUNING.arenaInset * 2,
            this.arenaBottom - TUNING.arenaTop,
            true, true, true, true
        );

        this.add.rectangle(
            width / 2,
            (TUNING.arenaTop + this.arenaBottom) / 2,
            width - TUNING.arenaInset * 2,
            this.arenaBottom - TUNING.arenaTop,
            0x252119
        ).setStrokeStyle(2, 0x766d5d);

        this.player = this.add.rectangle(
            58,
            (TUNING.arenaTop + this.arenaBottom) / 2,
            TUNING.playerSize,
            TUNING.playerSize,
            0x72f5cf
        ).setDepth(10) as Player;
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);

        this.goals = this.physics.add.staticGroup();
        this.movingCrates = this.physics.add.group();

        this.physics.add.overlap(this.player, this.goals, () => {
            if (!reachGoal(this.attempt)) return;
            this.player.body.stop();
            this.updateStatus();
        });
        this.physics.add.overlap(this.player, this.movingCrates, (_player, object) => {
            const crate = object as MovingCrate;
            if (!crate.active) return;
            this.handleMovingCrateBump(crate);
        });

        this.status = this.add.text(16, 10, '', {
            fontFamily: 'monospace', fontSize: 13, color: '#ffffff',
            backgroundColor: '#15120e', padding: { x: 5, y: 3 }
        }).setDepth(20);
        this.message = this.add.text(width / 2, height * 0.67, '', {
            fontFamily: 'monospace', fontSize: 17, color: '#ffffff', align: 'center',
            backgroundColor: '#15120e', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setDepth(20);
        this.add.text(
            width / 2,
            height - 13,
            'WASD / ARROWS MOVE · R RESET · ENTER NEXT · ESC HUB',
            {
                fontFamily: 'monospace', fontSize: 11, color: '#c1b7a5',
                backgroundColor: '#15120e', padding: { x: 4, y: 2 }
            }
        ).setOrigin(0.5).setDepth(20);

        this.buildStage();
    }

    private track<T extends GameObjects.GameObject>(object: T): T {
        this.stageDecor.push(object);
        return object;
    }

    private cellToWorld(layout: SokobanLayout, point: GridPoint) {
        const boardWidth = layout.width * TUNING.gridCell;
        const boardHeight = layout.height * TUNING.gridCell;
        const left = (this.scale.width - boardWidth) / 2;
        const top = TUNING.arenaTop + (this.arenaBottom - TUNING.arenaTop - boardHeight) / 2;
        return {
            x: left + point.x * TUNING.gridCell + TUNING.gridCell / 2,
            y: top + point.y * TUNING.gridCell + TUNING.gridCell / 2
        };
    }

    private sameCell(a: GridPoint, b: GridPoint) {
        return a.x === b.x && a.y === b.y;
    }

    private buildSokobanStage(layout: SokobanLayout) {
        if (!this.attempt.sokoban) throw new Error('Sokoban state missing');

        const boardWidth = layout.width * TUNING.gridCell;
        const boardHeight = layout.height * TUNING.gridCell;
        const left = (this.scale.width - boardWidth) / 2;
        const top = TUNING.arenaTop + (this.arenaBottom - TUNING.arenaTop - boardHeight) / 2;

        this.track(this.add.rectangle(
            left + boardWidth / 2,
            top + boardHeight / 2,
            boardWidth,
            boardHeight,
            0x201d18,
            0.9
        ).setStrokeStyle(2, 0x887d6b));

        for (let x = 1; x < layout.width - 1; x++) {
            for (let y = 1; y < layout.height - 1; y++) {
                const world = this.cellToWorld(layout, { x, y });
                this.track(this.add.rectangle(
                    world.x, world.y,
                    TUNING.gridCell - 2,
                    TUNING.gridCell - 2,
                    0x2a261f,
                    0.42
                ));
            }
        }

        for (const cell of layout.conveyor) {
            const world = this.cellToWorld(layout, cell);
            this.track(this.add.rectangle(
                world.x, world.y,
                TUNING.gridCell - 5,
                TUNING.gridCell - 8,
                0x494136,
                0.95
            ).setStrokeStyle(1, 0x7d715e));
            this.track(this.add.rectangle(world.x, world.y, 10, TUNING.gridCell - 12, 0x6b604f));
        }

        for (const wall of layout.walls) {
            const world = this.cellToWorld(layout, wall);
            this.track(this.add.rectangle(
                world.x, world.y,
                TUNING.gridCell - 2,
                TUNING.gridCell - 2,
                0x5d5549
            ).setStrokeStyle(1, 0x918675));
        }

        for (const target of layout.targets) {
            const world = this.cellToWorld(layout, target);
            this.track(this.add.rectangle(
                world.x, world.y,
                TUNING.gridCell - 12,
                TUNING.gridCell - 12,
                0x72f5cf,
                0.18
            ).setStrokeStyle(2, 0x72f5cf));
        }

        const gateWorld = this.cellToWorld(layout, layout.gate);
        this.sokobanGate = this.track(this.add.rectangle(
            gateWorld.x,
            gateWorld.y,
            TUNING.gridCell - 4,
            TUNING.gridCell - 4,
            0xe4a74f,
            0.9
        ).setStrokeStyle(2, 0xffffff));

        const goalWorld = this.cellToWorld(layout, layout.goal);
        this.track(this.add.rectangle(
            goalWorld.x,
            goalWorld.y,
            TUNING.gridCell - 10,
            TUNING.gridCell - 10,
            0x72f5cf,
            0.2
        ).setStrokeStyle(2, 0x72f5cf));

        this.sokobanCrates = this.attempt.sokoban.crates.map(() =>
            this.track(this.add.rectangle(
                0, 0,
                TUNING.gridCell - 8,
                TUNING.gridCell - 8,
                0xa97943
            ).setStrokeStyle(2, 0xf0c88b).setDepth(6))
        );

        this.renderSokobanState();
    }

    private renderSokobanState() {
        const state = this.attempt.sokoban;
        const layout = SOKOBAN_LAYOUTS[this.attempt.stage];
        if (!state || !layout) return;

        const playerWorld = this.cellToWorld(layout, state.player);
        this.player.setPosition(playerWorld.x, playerWorld.y);

        state.crates.forEach((crate, index) => {
            const world = this.cellToWorld(layout, crate);
            const onTarget = layout.targets.some(target => this.sameCell(target, crate));
            this.sokobanCrates[index]
                .setPosition(world.x, world.y)
                .setFillStyle(onTarget ? 0x72b98d : 0xa97943);
        });

        this.sokobanGate?.setVisible(!this.attempt.gatesOpen);
    }

    private addMovingCrate(x: number, y: number, vx: number, vy: number) {
        const crate = this.add.rectangle(
            x, y,
            TUNING.movingCrateSize,
            TUNING.movingCrateSize,
            0xb77a44
        ).setStrokeStyle(2, 0xf4c987) as MovingCrate;
        this.movingCrates.add(crate);
        crate.body
            .setAllowGravity(false)
            .setCollideWorldBounds(true)
            .setBounce(1, 1)
            .setVelocity(vx, vy);
    }

    private buildStage() {
        this.physics.resume();
        this.goals.clear(true, true);
        this.movingCrates.clear(true, true);
        for (const object of this.stageDecor) object.destroy();
        this.stageDecor = [];
        this.sokobanCrates = [];
        this.sokobanGate = undefined;

        this.player.body.setVelocity(0, 0);
        this.player.setAlpha(1);

        const layout = SOKOBAN_LAYOUTS[this.attempt.stage];
        if (layout) {
            this.player.body.enable = false;
            this.buildSokobanStage(layout);
        } else {
            const centerY = (TUNING.arenaTop + this.arenaBottom) / 2;
            this.player.body.enable = true;
            this.player.body.reset(58, centerY);
            this.player.body.setCollideWorldBounds(true);
            this.addMovingCrate(190, 110, 78, 48);
            this.addMovingCrate(345, 185, -66, 58);
            this.addMovingCrate(475, 255, 54, -82);
            this.goals.add(this.track(this.add.rectangle(
                584, centerY, 30, 46, 0x72f5cf, 0.18
            ).setStrokeStyle(2, 0x72f5cf)));
        }

        this.updateStatus();
    }

    private handleMovingCrateBump(crate: MovingCrate) {
        const now = this.time.now;
        if (!bumpCrate(this.attempt, now)) return;

        const dx = this.player.x - crate.x;
        const dy = this.player.y - crate.y;
        const length = Math.hypot(dx, dy) || 1;
        this.player.body.setVelocity(dx / length * 225, dy / length * 225);
        this.player.setAlpha(0.55);
    }

    private handleSokobanMove(dx: number, dy: number) {
        const result = moveSokoban(this.attempt, dx, dy);
        if (result === 'blocked') return;

        this.renderSokobanState();
        if (this.attempt.phase === 'cleared') {
            markDungeonCleared(this.session, 'WarehouseBlockworks');
        }
        this.updateStatus();
    }

    private updateStatus() {
        const stage = STAGES[this.attempt.stage];
        const layout = SOKOBAN_LAYOUTS[this.attempt.stage];
        let progress = ' · MOVING CRATES';

        if (layout && this.attempt.sokoban) {
            const placed = layout.targets.filter(target =>
                this.attempt.sokoban?.crates.some(crate => this.sameCell(crate, target))
            ).length;
            progress = ` · CRATES ${placed}/${stage.crateTargetCount}`;
        }

        this.status.setText(
            `WAREHOUSE BLOCKWORKS · ${this.attempt.stage}/3 ${stage.name}${progress}`
        );

        this.message.setText(this.attempt.phase === 'cleared'
            ? 'WAREHOUSE CLEARED!\nESC — HUB'
            : this.attempt.phase === 'stage-cleared'
                ? 'STAGE CLEARED\nENTER — NEXT STAGE'
                : layout && this.attempt.gatesOpen
                    ? 'EXIT OPEN · REACH THE GOAL'
                    : this.attempt.stage === 0
                        ? 'PUSH THE CRATE ONTO THE PAD'
                        : this.attempt.stage === 1
                            ? 'PUSH BOTH CRATES ONTO THE PADS'
                            : this.attempt.stage === 3
                                ? 'BUILD THE 3-CRATE PATTERN'
                                : 'REACH THE EXIT · MOVING CRATES ONLY BUMP');
        this.message.setVisible(this.message.text.length > 0);

        if (this.attempt.phase !== 'playing') this.physics.pause();
    }

    private handleGridInput() {
        if (Input.Keyboard.JustDown(this.keys.W) || Input.Keyboard.JustDown(this.keys.UP)) {
            this.handleSokobanMove(0, -1);
        } else if (Input.Keyboard.JustDown(this.keys.S) || Input.Keyboard.JustDown(this.keys.DOWN)) {
            this.handleSokobanMove(0, 1);
        } else if (Input.Keyboard.JustDown(this.keys.A) || Input.Keyboard.JustDown(this.keys.LEFT)) {
            this.handleSokobanMove(-1, 0);
        } else if (Input.Keyboard.JustDown(this.keys.D) || Input.Keyboard.JustDown(this.keys.RIGHT)) {
            this.handleSokobanMove(1, 0);
        }
    }

    update() {
        if (this.attempt.phase === 'leaving') return;

        if (Input.Keyboard.JustDown(this.keys.R) && restartStage(this.attempt)) {
            this.buildStage();
            return;
        }
        if (Input.Keyboard.JustDown(this.keys.ENTER) && advanceStage(this.attempt)) {
            this.buildStage();
            return;
        }
        if (this.attempt.phase !== 'playing') return;

        if (this.attempt.sokoban) {
            this.handleGridInput();
            return;
        }

        const now = this.time.now;
        if (now >= this.attempt.protectedUntil) this.player.setAlpha(1);

        if (now >= this.attempt.stunnedUntil) {
            const left = this.keys.A.isDown || this.keys.LEFT.isDown;
            const right = this.keys.D.isDown || this.keys.RIGHT.isDown;
            const up = this.keys.W.isDown || this.keys.UP.isDown;
            const down = this.keys.S.isDown || this.keys.DOWN.isDown;
            this.player.body.setVelocity(
                (Number(right) - Number(left)) * TUNING.playerSpeed,
                (Number(down) - Number(up)) * TUNING.playerSpeed
            );
            this.player.body.velocity.normalize().scale(
                (left || right || up || down) ? TUNING.playerSpeed : 0
            );
        }
    }
}
