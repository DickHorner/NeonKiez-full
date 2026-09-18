import { GameObjects, Input, Physics, Scene } from 'phaser';
import {
    MICRO_STAGE_DURATION_MS, PROJECTILE_CAP, PROJECTILE_LIFETIME_MS,
    RHYTHM_BEAT_INTERVAL_MS, RHYTHM_STREAK_TARGET, SHOOTER_TARGET_COUNT,
    STABILIZE_NODE_COUNT, STAGES, activateNode, beatCountdownMs, beatDistanceMs,
    createAttempt, destroyShooterTarget, leaveAttempt, reachPlatformGoal,
    remainingTimeMs, tapRhythm, tickStage, type Attempt
} from '../final-glitch-panopticon/attempt';
import { markDungeonCleared, type Session } from '../session';

const TUNING = {
    topDownSpeed: 185,
    platformSpeed: 190,
    platformJumpVelocity: -360,
    platformGravity: 900,
    playerWidth: 18,
    playerHeight: 24,
    projectileSpeed: 310,
    beatFlashMs: 60,
    fallResetY: 400
};

type Player = GameObjects.Rectangle & { body: Physics.Arcade.Body };
type Target = GameObjects.Rectangle & {
    body: Physics.Arcade.StaticBody;
    targetId: string;
};
type Bullet = GameObjects.Arc & {
    body: Physics.Arcade.Body;
    expiresAt: number;
};
type Node = GameObjects.Arc & {
    body: Physics.Arcade.StaticBody;
    nodeIndex: number;
};

export class FinalGlitchPanopticon extends Scene {
    private readonly session: Session;
    private attempt!: Attempt;
    private player!: Player;
    private platforms!: Physics.Arcade.StaticGroup;
    private goals!: Physics.Arcade.StaticGroup;
    private targets!: Physics.Arcade.StaticGroup;
    private bullets!: Physics.Arcade.Group;
    private nodes!: Physics.Arcade.StaticGroup;
    private stageDecor: GameObjects.GameObject[] = [];
    private beatCue!: GameObjects.Arc;
    private status!: GameObjects.Text;
    private message!: GameObjects.Text;
    private feedback!: GameObjects.Text;
    private keys!: Record<
        'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT' | 'SPACE',
        Input.Keyboard.Key
    >;
    private pendingRebuild = false;
    private platformSpawnX = 54;
    private platformSpawnY = 300;

    constructor(session: Session) {
        super('FinalGlitchPanopticon');
        this.session = session;
    }

    create() {
        this.attempt = createAttempt(this.time.now);
        this.physics.world.drawDebug = false;
        this.physics.world.debugGraphic?.clear();
        this.cameras.main.setBackgroundColor('#090814');

        if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
        this.keys = this.input.keyboard.addKeys(
            'W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE'
        ) as typeof this.keys;

        const leave = () => {
            leaveAttempt(this.attempt);
            this.scene.start('Game');
        };
        this.input.keyboard.once('keydown-ESC', leave);
        this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', leave));

        this.player = this.add.rectangle(
            this.scale.width / 2,
            this.scale.height / 2,
            TUNING.playerWidth,
            TUNING.playerHeight,
            0x72f5cf
        ).setDepth(10) as Player;
        this.physics.add.existing(this.player);

        this.platforms = this.physics.add.staticGroup();
        this.goals = this.physics.add.staticGroup();
        this.targets = this.physics.add.staticGroup();
        this.bullets = this.physics.add.group();
        this.nodes = this.physics.add.staticGroup();

        this.physics.add.collider(this.player, this.platforms);
        this.physics.add.overlap(this.player, this.goals, () => {
            if (!reachPlatformGoal(this.attempt, this.time.now)) return;
            this.pendingRebuild = true;
        });
        this.physics.add.overlap(this.bullets, this.targets, (shot, object) => {
            const bullet = shot as Bullet;
            const target = object as Target;
            if (!bullet.active || !target.active) return;
            if (!destroyShooterTarget(this.attempt, target.targetId, this.time.now)) return;

            bullet.destroy();
            target.destroy();
            if (this.attempt.stage === 3) this.pendingRebuild = true;
            else this.feedback.setText('TARGET');
        });
        this.physics.add.overlap(this.player, this.nodes, (_player, object) => {
            const node = object as Node;
            if (!node.active) return;

            const result = activateNode(this.attempt, node.nodeIndex);
            if (result === 'wrong') {
                this.feedback.setText(`NEXT NODE: ${this.attempt.currentNodeIndex + 1}`);
                return;
            }
            if (result === 'ignored') return;

            node.destroy();
            this.feedback.setText(result === 'cleared' ? 'STABILIZED' : 'NODE STABLE');
            if (result === 'cleared') {
                markDungeonCleared(this.session, 'FinalGlitchPanopticon');
            }
            this.refreshNodes();
        });

        this.status = this.add.text(16, 10, '', {
            fontFamily: 'monospace', fontSize: 13, color: '#ffffff',
            backgroundColor: '#090814', padding: { x: 5, y: 3 }
        }).setDepth(30);
        this.message = this.add.text(this.scale.width / 2, this.scale.height * 0.68, '', {
            fontFamily: 'monospace', fontSize: 17, color: '#ffffff', align: 'center',
            backgroundColor: '#090814', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setDepth(30);
        this.feedback = this.add.text(this.scale.width / 2, 72, '', {
            fontFamily: 'monospace', fontSize: 15, color: '#ffffff',
            backgroundColor: '#090814', padding: { x: 5, y: 2 }
        }).setOrigin(0.5).setDepth(30);

        this.add.text(
            this.scale.width / 2,
            this.scale.height - 13,
            'WASD / ARROWS MOVE · SPACE ACTION · ESC HUB',
            {
                fontFamily: 'monospace', fontSize: 11, color: '#a9a7c7',
                backgroundColor: '#090814', padding: { x: 4, y: 2 }
            }
        ).setOrigin(0.5).setDepth(30);

        this.beatCue = this.add.circle(
            this.scale.width / 2,
            155,
            14,
            0x59607e,
            0.9
        ).setStrokeStyle(2, 0xd7e1ff, 0.6).setDepth(20).setVisible(false);

        this.buildStage();
    }

    private track<T extends GameObjects.GameObject>(object: T): T {
        this.stageDecor.push(object);
        return object;
    }

    private clearStage() {
        this.physics.resume();
        this.platforms.clear(true, true);
        this.goals.clear(true, true);
        this.targets.clear(true, true);
        this.bullets.clear(true, true);
        this.nodes.clear(true, true);
        for (const object of this.stageDecor) object.destroy();
        this.stageDecor = [];
        this.beatCue.setVisible(false).setScale(1).setFillStyle(0x59607e, 0.9);
        this.feedback.setText('');
        this.player.setVisible(true).setAlpha(1);
        this.player.body.enable = true;
        this.player.body.setVelocity(0, 0).setGravityY(0);
    }

    private buildStage() {
        this.clearStage();
        this.pendingRebuild = false;

        if (this.attempt.stage === 0) {
            this.buildMetaIntro();
        } else if (this.attempt.stage === 1) {
            this.buildMicroPlatform();
        } else if (this.attempt.stage === 2) {
            this.buildMicroShooter();
        } else if (this.attempt.stage === 3) {
            this.buildMicroRhythm();
        } else {
            this.buildStabilize();
        }

        this.updateStatus(this.time.now);
    }

    private buildMetaIntro() {
        this.physics.world.setBounds(20, 48, this.scale.width - 40, 260, true, true, true, true);
        this.player.body.enable = false;
        this.player.setPosition(this.scale.width / 2, 205).setFillStyle(0x72f5cf);

        const bars = [
            { x: 120, y: 112, w: 170 },
            { x: 420, y: 142, w: 250 },
            { x: 250, y: 245, w: 220 },
            { x: 500, y: 275, w: 120 }
        ];
        bars.forEach((bar, index) => {
            this.track(this.add.rectangle(
                bar.x, bar.y, bar.w, 8,
                index % 2 === 0 ? 0xc169ff : 0x58e1ff,
                0.55
            ));
        });
    }

    private addPlatform(x: number, y: number, width: number) {
        this.platforms.add(this.add.rectangle(
            x, y, width, 16, 0x5e587c
        ).setStrokeStyle(1, 0xb9b2ef));
    }

    private buildMicroPlatform() {
        this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height + 80,
            true, true, true, false);

        this.platformSpawnX = 54;
        this.platformSpawnY = 300;
        this.player.body.reset(this.platformSpawnX, this.platformSpawnY);
        this.player.body.setGravityY(TUNING.platformGravity).setCollideWorldBounds(true);
        this.player.setFillStyle(0x72f5cf);

        this.addPlatform(85, 330, 170);
        this.addPlatform(245, 282, 110);
        this.addPlatform(390, 236, 110);
        this.addPlatform(535, 190, 120);
        this.goals.add(this.add.rectangle(
            575, 157, 28, 42, 0xf6dd73, 0.22
        ).setStrokeStyle(2, 0xf6dd73));
    }

    private buildMicroShooter() {
        this.physics.world.setBounds(18, 48, this.scale.width - 36, 270,
            true, true, true, true);

        this.player.body.reset(this.scale.width / 2, 292);
        this.player.body.setGravityY(0).setCollideWorldBounds(true);
        this.player.setFillStyle(0x72f5cf);

        for (let index = 0; index < SHOOTER_TARGET_COUNT; index++) {
            const row = Math.floor(index / 5);
            const col = index % 5;
            const target = this.add.rectangle(
                170 + col * 75,
                95 + row * 58,
                30,
                22,
                0xc169ff,
                0.9
            ).setStrokeStyle(2, 0xffffff) as Target;
            target.targetId = `target-${index}`;
            this.targets.add(target);
        }
    }

    private buildMicroRhythm() {
        this.physics.world.setBounds(20, 48, this.scale.width - 40, 260,
            true, true, true, true);

        this.player.body.enable = false;
        this.player.setPosition(this.scale.width / 2, 235).setFillStyle(0x72f5cf);
        this.beatCue.setVisible(true);

        this.track(this.add.circle(
            this.scale.width / 2,
            155,
            30,
            0x000000,
            0
        ).setStrokeStyle(2, 0xd7e1ff, 0.5));
    }

    private buildStabilize() {
        this.physics.world.setBounds(24, 52, this.scale.width - 48, 255,
            true, true, true, true);

        this.player.body.reset(this.scale.width / 2, this.scale.height / 2);
        this.player.body.setGravityY(0).setCollideWorldBounds(true);
        this.player.setFillStyle(0x72f5cf);

        const positions = [
            { x: 125, y: 105 },
            { x: 515, y: 105 },
            { x: 125, y: 255 },
            { x: 515, y: 255 }
        ];
        positions.forEach((position, nodeIndex) => {
            const node = this.add.circle(
                position.x,
                position.y,
                19,
                0x343550,
                0.95
            ).setStrokeStyle(2, 0xc4c7ef) as Node;
            node.nodeIndex = nodeIndex;
            this.nodes.add(node);
            this.track(this.add.text(position.x, position.y, String(nodeIndex + 1), {
                fontFamily: 'monospace', fontSize: 12, color: '#ffffff'
            }).setOrigin(0.5).setDepth(5));
        });
        this.refreshNodes();
    }

    private refreshNodes() {
        if (this.attempt.stage !== 4) return;
        for (const object of this.nodes.getChildren() as Node[]) {
            if (!object.active) continue;
            object.setFillStyle(
                object.nodeIndex === this.attempt.currentNodeIndex ? 0xffc766 : 0x343550,
                0.95
            );
        }
    }

    private fireBullet(now: number) {
        if (this.attempt.stage !== 2 || this.attempt.phase !== 'playing') return;
        const active = (this.bullets.getChildren() as Bullet[]).filter(bullet => bullet.active).length;
        if (active >= PROJECTILE_CAP) return;

        const bullet = this.add.circle(
            this.player.x,
            this.player.y - 15,
            4,
            0x72f5cf
        ) as Bullet;
        bullet.expiresAt = now + PROJECTILE_LIFETIME_MS;
        this.bullets.add(bullet);
        bullet.body.setAllowGravity(false).setVelocityY(-TUNING.projectileSpeed);
    }

    private updateBullets(now: number) {
        for (const bullet of this.bullets.getChildren() as Bullet[]) {
            if (!bullet.active) continue;
            if (now >= bullet.expiresAt || bullet.y < 45) bullet.destroy();
        }
    }

    private resetPlatformAfterFall() {
        this.player.body.reset(this.platformSpawnX, this.platformSpawnY);
        this.player.body.setVelocity(0, 0).setGravityY(TUNING.platformGravity);
    }

    private updatePlatformInput() {
        const left = this.keys.A.isDown || this.keys.LEFT.isDown;
        const right = this.keys.D.isDown || this.keys.RIGHT.isDown;
        this.player.body.setVelocityX((Number(right) - Number(left)) * TUNING.platformSpeed);

        if (Input.Keyboard.JustDown(this.keys.SPACE)
            && (this.player.body.blocked.down || this.player.body.touching.down)) {
            this.player.body.setVelocityY(TUNING.platformJumpVelocity);
        }

        if (this.player.y > TUNING.fallResetY) this.resetPlatformAfterFall();
    }

    private updateTopDownInput() {
        const left = this.keys.A.isDown || this.keys.LEFT.isDown;
        const right = this.keys.D.isDown || this.keys.RIGHT.isDown;
        const up = this.keys.W.isDown || this.keys.UP.isDown;
        const down = this.keys.S.isDown || this.keys.DOWN.isDown;

        this.player.body.setVelocity(
            (Number(right) - Number(left)) * TUNING.topDownSpeed,
            (Number(down) - Number(up)) * TUNING.topDownSpeed
        );
        this.player.body.velocity.normalize().scale(
            (left || right || up || down) ? TUNING.topDownSpeed : 0
        );
    }

    private handleRhythmTap(now: number) {
        const result = tapRhythm(this.attempt, now);
        if (result === 'ignored') return;
        if (result === 'advanced') {
            this.pendingRebuild = true;
            return;
        }
        this.feedback.setText(result === 'good' ? 'GOOD' : 'MISS');
    }

    private updateBeatCue(now: number) {
        if (this.attempt.stage !== 3) return;

        const countdown = beatCountdownMs(this.attempt, now);
        const progress = 1 - Math.min(countdown / RHYTHM_BEAT_INTERVAL_MS, 1);
        this.beatCue.setScale(2 - progress * 1.35);
        this.beatCue.setFillStyle(
            beatDistanceMs(this.attempt, now) <= TUNING.beatFlashMs ? 0x72f5cf : 0x59607e,
            0.9
        );
    }

    private updateStatus(now: number) {
        const stage = STAGES[this.attempt.stage];
        const remaining = remainingTimeMs(this.attempt, now);
        const timer = remaining === null ? '' : ` · ${(remaining / 1000).toFixed(1)}s`;

        const progress = this.attempt.stage === 2
            ? ` · TARGETS ${this.attempt.destroyedTargetIds.length}/${SHOOTER_TARGET_COUNT}`
            : this.attempt.stage === 3
                ? ` · STREAK ${this.attempt.rhythmStreak}/${RHYTHM_STREAK_TARGET}`
                : this.attempt.stage === 4
                    ? ` · NODES ${this.attempt.currentNodeIndex}/${STABILIZE_NODE_COUNT}`
                    : '';

        this.status.setText(
            `FINAL GLITCH · ${this.attempt.stage}/4 ${stage.name}${progress}${timer}`
        );

        this.message.setText(this.attempt.phase === 'cleared'
            ? 'SYSTEM STABILIZED\nESC — HUB'
            : this.attempt.stage === 0
                ? 'GET READY'
                : this.attempt.stage === 1
                    ? 'REACH THE FLAG BEFORE TIME RUNS OUT'
                    : this.attempt.stage === 2
                        ? 'DESTROY ALL 10 TARGETS'
                        : this.attempt.stage === 3
                            ? 'SPACE ON THE BEAT · STREAK 5'
                            : 'TOUCH NODES 1 → 4');
        this.message.setVisible(this.attempt.phase === 'cleared' || this.attempt.stage === 0);

        if (this.attempt.phase === 'cleared') {
            this.player.body.stop();
            this.physics.pause();
        }
    }

    update() {
        if (this.attempt.phase === 'leaving') return;

        if (this.pendingRebuild) {
            this.buildStage();
            return;
        }

        const now = this.time.now;
        const tick = tickStage(this.attempt, now);
        if (tick !== 'none') {
            this.buildStage();
            if (tick === 'restarted') this.feedback.setText('TIME UP · RETRY');
            return;
        }

        if (this.attempt.phase !== 'playing') {
            this.updateStatus(now);
            return;
        }

        if (this.attempt.stage === 1) {
            this.updatePlatformInput();
        } else if (this.attempt.stage === 2) {
            this.updateTopDownInput();
            this.updateBullets(now);
            if (Input.Keyboard.JustDown(this.keys.SPACE)) this.fireBullet(now);
        } else if (this.attempt.stage === 3) {
            this.updateBeatCue(now);
            if (Input.Keyboard.JustDown(this.keys.SPACE)) this.handleRhythmTap(now);
        } else if (this.attempt.stage === 4) {
            this.updateTopDownInput();
        }

        this.updateStatus(now);
    }
}
