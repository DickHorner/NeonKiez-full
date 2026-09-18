import { GameObjects, Input, Physics, Scene } from 'phaser';
import {
    BARREL_LIFE_MS, STAGES, advanceStage, createAttempt, hitPlayer, leaveAttempt,
    reachGoal, shouldSpawnBarrel, type Attempt
} from '../construction-donkey-tower/attempt';
import { markDungeonCleared, type Session } from '../session';

const TUNING = {
    playerSpeed: 175,
    jumpVelocity: -255,
    gravity: 760,
    ladderSpeed: 120,
    playerWidth: 18,
    playerHeight: 24,
    platformHeight: 12,
    barrelRadius: 10,
    barrelSpeed: 95,
    arenaTop: 44,
    arenaBottom: 318,
    guardWidth: 8,
    guardHeight: 48,
    fallResetY: 390
};

type Player = GameObjects.Rectangle & { body: Physics.Arcade.Body };
type Platform = GameObjects.Rectangle & {
    body: Physics.Arcade.StaticBody;
    tierIndex: number;
};
type Ladder = GameObjects.Rectangle;
type Barrel = GameObjects.Arc & {
    body: Physics.Arcade.Body;
    expiresAt: number;
};

export class ConstructionDonkeyTower extends Scene {
    private readonly session: Session;
    private attempt!: Attempt;
    private player!: Player;
    private platforms!: Physics.Arcade.StaticGroup;
    private goals!: Physics.Arcade.StaticGroup;
    private playerGuards!: Physics.Arcade.StaticGroup;
    private barrels!: Physics.Arcade.Group;
    private ladders: Ladder[] = [];
    private stageDecor: GameObjects.GameObject[] = [];
    private tierYs: number[] = [];
    private status!: GameObjects.Text;
    private message!: GameObjects.Text;
    private keys!: Record<
        'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT' | 'SPACE' | 'ENTER',
        Input.Keyboard.Key
    >;
    private onLadder = false;
    private spawnX = 82;
    private spawnY = 286;

    constructor(session: Session) {
        super('ConstructionDonkeyTower');
        this.session = session;
    }

    create() {
        this.attempt = createAttempt(this.time.now);
        this.physics.world.drawDebug = false;
        this.physics.world.debugGraphic?.clear();
        this.cameras.main.setBackgroundColor('#17120f');

        if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
        this.keys = this.input.keyboard.addKeys(
            'W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE,ENTER'
        ) as typeof this.keys;

        const leave = () => {
            leaveAttempt(this.attempt);
            this.scene.start('Game');
        };
        this.input.keyboard.once('keydown-ESC', leave);
        this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', leave));

        this.physics.world.setBounds(20, 34, this.scale.width - 40, 360, true, true, true, false);

        this.player = this.add.rectangle(
            this.spawnX, this.spawnY,
            TUNING.playerWidth, TUNING.playerHeight,
            0x72f5cf
        ).setDepth(10) as Player;
        this.physics.add.existing(this.player);
        this.player.body.setGravityY(TUNING.gravity).setCollideWorldBounds(true);

        this.platforms = this.physics.add.staticGroup();
        this.goals = this.physics.add.staticGroup();
        this.playerGuards = this.physics.add.staticGroup();
        this.barrels = this.physics.add.group();

        this.physics.add.collider(
            this.player,
            this.platforms,
            undefined,
            (_player, platform) => this.canPlayerLand(platform as Platform),
            this
        );
        this.physics.add.collider(this.player, this.playerGuards);
        this.physics.add.collider(this.barrels, this.platforms);
        this.physics.add.overlap(this.player, this.goals, () => this.handleGoal());
        this.physics.add.overlap(this.player, this.barrels, (_player, object) => {
            const barrel = object as Barrel;
            if (!barrel.active) return;
            this.handleBarrelHit(barrel);
        });

        this.status = this.add.text(16, 10, '', {
            fontFamily: 'monospace', fontSize: 13, color: '#ffffff',
            backgroundColor: '#17120f', padding: { x: 5, y: 3 }
        }).setDepth(20);
        this.message = this.add.text(this.scale.width / 2, this.scale.height * 0.67, '', {
            fontFamily: 'monospace', fontSize: 17, color: '#ffffff', align: 'center',
            backgroundColor: '#17120f', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setDepth(20);
        this.add.text(
            this.scale.width / 2,
            this.scale.height - 13,
            'A/D MOVE · W/S LADDERS · SPACE JUMP · ENTER NEXT · ESC HUB',
            {
                fontFamily: 'monospace', fontSize: 11, color: '#c5b9ad',
                backgroundColor: '#17120f', padding: { x: 4, y: 2 }
            }
        ).setOrigin(0.5).setDepth(20);

        this.buildStage();
    }

    private track<T extends GameObjects.GameObject>(object: T): T {
        this.stageDecor.push(object);
        return object;
    }

    private addPlatform(
        left: number,
        right: number,
        y: number,
        tierIndex: number,
        guardLeft = true,
        guardRight = true
    ) {
        const platform = this.add.rectangle(
            (left + right) / 2,
            y,
            right - left,
            TUNING.platformHeight,
            0xa75743
        ).setStrokeStyle(2, 0xe08967) as Platform;
        platform.tierIndex = tierIndex;
        this.platforms.add(platform);
        if (guardLeft) this.addPlayerGuard(left, y);
        if (guardRight) this.addPlayerGuard(right, y);
        return platform;
    }

    private addPlayerGuard(x: number, platformY: number) {
        this.playerGuards.add(this.add.rectangle(
            x,
            platformY - TUNING.guardHeight / 2 - TUNING.platformHeight / 2,
            TUNING.guardWidth,
            TUNING.guardHeight,
            0xf3cc6b,
            0.82
        ).setStrokeStyle(1, 0xffffff));
    }

    private addLadder(x: number, upperY: number, lowerY: number) {
        const height = lowerY - upperY + 12;
        const ladder = this.track(this.add.rectangle(
            x,
            (upperY + lowerY) / 2,
            25,
            height,
            0x000000,
            0
        ).setStrokeStyle(2, 0xf3cc6b, 0.9));
        this.ladders.push(ladder);

        for (let y = upperY + 8; y < lowerY - 4; y += 12) {
            this.track(this.add.rectangle(x, y, 20, 3, 0xf3cc6b, 0.9));
        }
    }

    private addGoal(x: number, platformY: number) {
        this.goals.add(this.add.rectangle(
            x,
            platformY - 27,
            30,
            42,
            0x72f5cf,
            0.2
        ).setStrokeStyle(2, 0x72f5cf));
    }

    private addTowerGeometry(trickGap: boolean) {
        this.tierYs = [306, 246, 186, 126, 76];

        this.addPlatform(44, 596, this.tierYs[0], 0);
        this.addPlatform(84, 596, this.tierYs[1], 1);

        if (trickGap) {
            this.addPlatform(44, 286, this.tierYs[2], 2, true, false);
            this.addPlatform(346, 556, this.tierYs[2], 2, false, true);
        } else {
            this.addPlatform(44, 556, this.tierYs[2], 2);
        }

        this.addPlatform(84, 596, this.tierYs[3], 3);
        this.addPlatform(44, 556, this.tierYs[4], 4);

        this.addLadder(520, this.tierYs[1], this.tierYs[0]);
        this.addLadder(130, this.tierYs[2], this.tierYs[1]);
        this.addLadder(500, this.tierYs[3], this.tierYs[2]);
        this.addLadder(130, this.tierYs[4], this.tierYs[3]);

        this.addGoal(500, this.tierYs[4]);
    }

    private buildStage() {
        this.physics.resume();
        this.platforms.clear(true, true);
        this.goals.clear(true, true);
        this.playerGuards.clear(true, true);
        this.barrels.clear(true, true);
        for (const object of this.stageDecor) object.destroy();
        this.stageDecor = [];
        this.ladders = [];
        this.tierYs = [];
        this.onLadder = false;

        this.addTowerGeometry(this.attempt.stage === 2);

        this.spawnX = 82;
        this.spawnY = this.tierYs[0] - TUNING.playerHeight / 2 - TUNING.platformHeight / 2;
        this.player.body.enable = true;
        this.player.body.reset(this.spawnX, this.spawnY);
        this.player.body.setGravityY(TUNING.gravity).setVelocity(0, 0).setCollideWorldBounds(true);
        this.player.setAlpha(1);

        this.updateStatus();
    }

    private canPlayerLand(platform: Platform): boolean {
        if (this.onLadder) return false;
        return this.player.body.velocity.y >= 0
            && this.player.body.bottom <= platform.body.top + 14;
    }

    private nearbyLadder(): Ladder | undefined {
        return this.ladders.find(ladder => {
            const halfHeight = ladder.displayHeight / 2;
            return Math.abs(this.player.x - ladder.x) <= ladder.displayWidth / 2 + 8
                && this.player.y >= ladder.y - halfHeight - 14
                && this.player.y <= ladder.y + halfHeight + 14;
        });
    }

    private updatePlayerMovement() {
        const left = this.keys.A.isDown || this.keys.LEFT.isDown;
        const right = this.keys.D.isDown || this.keys.RIGHT.isDown;
        const up = this.keys.W.isDown || this.keys.UP.isDown;
        const down = this.keys.S.isDown || this.keys.DOWN.isDown;
        const ladder = this.nearbyLadder();

        if (!this.onLadder && ladder && (up || down)) {
            this.onLadder = true;
            this.player.body.setGravityY(0);
            this.player.setX(ladder.x);
        } else if (this.onLadder && !ladder) {
            this.onLadder = false;
            this.player.body.setGravityY(TUNING.gravity);
        }

        if (this.onLadder) {
            this.player.body.setGravityY(0);
            this.player.body.setVelocity(
                (Number(right) - Number(left)) * TUNING.playerSpeed * 0.65,
                (Number(down) - Number(up)) * TUNING.ladderSpeed
            );
            return;
        }

        this.player.body.setGravityY(TUNING.gravity);
        this.player.body.setVelocityX((Number(right) - Number(left)) * TUNING.playerSpeed);

        if (Input.Keyboard.JustDown(this.keys.SPACE)
            && (this.player.body.blocked.down || this.player.body.touching.down)) {
            this.player.body.setVelocityY(TUNING.jumpVelocity);
        }
    }

    private spawnBarrel(now: number) {
        const barrel = this.add.circle(
            72,
            52,
            TUNING.barrelRadius,
            0xe1a24e
        ).setStrokeStyle(2, 0x6f4027) as Barrel;
        barrel.expiresAt = now + BARREL_LIFE_MS;
        this.barrels.add(barrel);
        barrel.body
            .setGravityY(TUNING.gravity)
            .setCollideWorldBounds(true)
            .setBounce(1, 0)
            .setVelocityX(TUNING.barrelSpeed);
    }

    private updateBarrels(now: number) {
        const barrels = this.barrels.getChildren() as Barrel[];
        for (const barrel of barrels) {
            if (!barrel.active) continue;
            if (now >= barrel.expiresAt) {
                barrel.destroy();
                continue;
            }

            if (barrel.body.blocked.down || barrel.body.touching.down) {
                let closestTier = 0;
                let closestDistance = Infinity;
                this.tierYs.forEach((y, index) => {
                    const distance = Math.abs(barrel.y - y);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestTier = index;
                    }
                });
                const direction = closestTier % 2 === 0 ? 1 : -1;
                barrel.body.setVelocityX(direction * TUNING.barrelSpeed);
            }
        }

        const active = barrels.filter(barrel => barrel.active).length;
        if (shouldSpawnBarrel(this.attempt, now, active)) {
            this.spawnBarrel(now);
        }
    }

    private resetAfterFall() {
        this.onLadder = false;
        this.player.body.reset(this.spawnX, this.spawnY);
        this.player.body.setGravityY(TUNING.gravity).setVelocity(0, 0);
        this.player.setAlpha(1);
    }

    private handleBarrelHit(barrel: Barrel) {
        const now = this.time.now;
        if (!hitPlayer(this.attempt, now)) return;

        const direction = this.player.x < barrel.x ? -1 : 1;
        this.player.body.setVelocityX(direction * 190);
        this.player.setAlpha(0.55);
        this.updateStatus();
    }

    private handleGoal() {
        if (!reachGoal(this.attempt)) return;
        this.player.body.stop();
        if (this.attempt.phase === 'cleared') {
            markDungeonCleared(this.session, 'ConstructionDonkeyTower');
        }
        this.updateStatus();
    }

    private updateStatus() {
        const stage = STAGES[this.attempt.stage];
        const activeBarrels = this.barrels?.getChildren()
            .filter(child => child.active).length ?? 0;

        this.status.setText(
            `DONKEY TOWER · ${this.attempt.stage}/3 ${stage.name}`
            + (stage.barrels ? ` · BARRELS ${activeBarrels}/4` : '')
        );

        this.message.setText(this.attempt.phase === 'cleared'
            ? 'TOWER CLEARED!\nESC — HUB'
            : this.attempt.phase === 'stage-cleared'
                ? 'STAGE CLEARED\nENTER — NEXT STAGE'
                : this.attempt.stage === 0
                    ? 'CLIMB THE LADDERS · SPACE JUMPS'
                    : this.attempt.stage === 2
                        ? 'BROKEN ROUTE · JUMP THE PLATFORM GAP'
                        : 'CLIMB · JUMP THE BARRELS · REACH THE TOP');
        this.message.setVisible(this.attempt.phase !== 'playing' || this.attempt.stage === 0);

        if (this.attempt.phase !== 'playing') this.physics.pause();
    }

    update() {
        if (this.attempt.phase === 'leaving') return;

        const now = this.time.now;

        if (Input.Keyboard.JustDown(this.keys.ENTER) && advanceStage(this.attempt, now)) {
            this.buildStage();
            return;
        }
        if (this.attempt.phase !== 'playing') return;

        if (now >= this.attempt.protectedUntil) this.player.setAlpha(1);

        if (this.player.y > TUNING.fallResetY) {
            this.resetAfterFall();
            return;
        }

        if (now >= this.attempt.stunnedUntil) {
            this.updatePlayerMovement();
        }

        if (STAGES[this.attempt.stage].barrels) {
            this.updateBarrels(now);
            this.updateStatus();
        }
    }
}
