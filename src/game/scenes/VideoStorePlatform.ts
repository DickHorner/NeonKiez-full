import { GameObjects, Input, Physics, Scene } from 'phaser';
import {
    STAGES, createAttempt, reachGoal, advanceStage, toggleGates, leaveAttempt, type Attempt
} from '../video-store-platform/attempt';
import { markDungeonCleared, type Session } from '../session';

const TUNING = {
    playerSpeed: 190,
    jumpVelocity: -360,
    gravity: 900,
    playerWidth: 18,
    playerHeight: 24,
    platformHeight: 18,
    fallResetY: 400,
    switchRange: 44
};

type Player = GameObjects.Rectangle & { body: Physics.Arcade.Body };
type StaticRectangle = GameObjects.Rectangle & { body: Physics.Arcade.StaticBody };
type MovingPlatform = GameObjects.Rectangle & {
    body: Physics.Arcade.Body;
    minX: number;
    maxX: number;
    moveSpeed: number;
};

export class VideoStorePlatform extends Scene {
    private readonly session: Session;
    private attempt!: Attempt;
    private player!: Player;
    private platforms!: Physics.Arcade.StaticGroup;
    private movingPlatforms!: Physics.Arcade.Group;
    private gates!: Physics.Arcade.StaticGroup;
    private goals!: Physics.Arcade.StaticGroup;
    private gate?: StaticRectangle;
    private switchMarker?: GameObjects.Rectangle;
    private status!: GameObjects.Text;
    private message!: GameObjects.Text;
    private keys!: Record<'A' | 'D' | 'LEFT' | 'RIGHT' | 'SPACE' | 'ENTER' | 'E', Input.Keyboard.Key>;
    private spawnX = 60;
    private spawnY = 290;

    constructor(session: Session) {
        super('VideoStorePlatform');
        this.session = session;
    }

    create() {
        this.attempt = createAttempt();
        this.physics.resume();
        this.physics.world.drawDebug = false;
        this.physics.world.debugGraphic?.clear();
        this.cameras.main.setBackgroundColor('#120d1d');

        if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
        this.keys = this.input.keyboard.addKeys('A,D,LEFT,RIGHT,SPACE,ENTER,E') as typeof this.keys;
        const leave = () => {
            leaveAttempt(this.attempt);
            this.scene.start('Game');
        };
        this.input.keyboard.once('keydown-ESC', leave);
        this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', leave));

        this.player = this.add.rectangle(this.spawnX, this.spawnY,
            TUNING.playerWidth, TUNING.playerHeight, 0x72f5cf) as Player;
        this.physics.add.existing(this.player);
        this.player.body.setGravityY(TUNING.gravity).setCollideWorldBounds(true);

        this.platforms = this.physics.add.staticGroup();
        this.movingPlatforms = this.physics.add.group();
        this.gates = this.physics.add.staticGroup();
        this.goals = this.physics.add.staticGroup();
        this.physics.add.collider(this.player, this.platforms);
        this.physics.add.collider(this.player, this.movingPlatforms);
        this.physics.add.collider(this.player, this.gates);
        this.physics.add.overlap(this.player, this.goals, () => {
            if (!reachGoal(this.attempt)) return;
            this.player.body.stop();
            if (this.attempt.phase === 'cleared') {
                markDungeonCleared(this.session, 'VideoStorePlatform');
            }
            this.updateStatus();
        });

        this.status = this.add.text(16, 12, '', {
            fontFamily: 'monospace', fontSize: 13, color: '#ffffff',
            backgroundColor: '#120d1d', padding: { x: 5, y: 3 }
        }).setScrollFactor(0).setDepth(20);
        this.message = this.add.text(this.scale.width / 2, this.scale.height * 0.68, '', {
            fontFamily: 'monospace', fontSize: 18, color: '#ffffff', align: 'center',
            backgroundColor: '#120d1d', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
        this.add.text(this.scale.width / 2, this.scale.height - 13,
            'A/D or ←/→ MOVE · SPACE JUMP · E SWITCH · ENTER NEXT · ESC HUB', {
                fontFamily: 'monospace', fontSize: 11, color: '#b8adc9',
                backgroundColor: '#120d1d', padding: { x: 4, y: 2 }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(20);

        this.buildStage();
    }

    private addPlatform(x: number, y: number, width: number, height = TUNING.platformHeight) {
        this.platforms.add(this.add.rectangle(x, y, width, height, 0x5f4b7a)
            .setStrokeStyle(1, 0xbfa7e8));
    }

    private addMovingPlatform(x: number, y: number, width: number,
        minX: number, maxX: number, speed: number) {
        const platform = this.add.rectangle(x, y, width, 14, 0x9a75cf)
            .setStrokeStyle(1, 0xffffff) as MovingPlatform;
        platform.minX = Math.min(minX, maxX);
        platform.maxX = Math.max(minX, maxX);
        platform.moveSpeed = Math.abs(speed);
        this.movingPlatforms.add(platform);
        platform.body.setAllowGravity(false).setImmovable(true).setFriction(1, 0);
        platform.body.pushable = false;
        platform.body.setVelocityX(minX <= maxX ? platform.moveSpeed : -platform.moveSpeed);
    }

    private addGoal(x: number, y: number) {
        this.goals.add(this.add.rectangle(x, y, 24, 42, 0xf7df72, 0.22)
            .setStrokeStyle(2, 0xf7df72));
    }

    private buildStage() {
        this.physics.resume();
        this.platforms.clear(true, true);
        this.movingPlatforms.clear(true, true);
        this.gates.clear(true, true);
        this.goals.clear(true, true);
        this.gate = undefined;
        this.switchMarker?.destroy();
        this.switchMarker = undefined;

        const height = this.scale.height;
        const width = this.attempt.stage === 3 ? 960 : this.scale.width;
        this.physics.world.setBounds(0, 0, width, height + 80, true, true, true, false);
        this.cameras.main.setBounds(0, 0, width, height);
        this.cameras.main.setScroll(0, 0);

        this.spawnX = 60;
        this.spawnY = 290;
        this.player.body.reset(this.spawnX, this.spawnY);
        this.player.body.setVelocity(0, 0);
        this.player.body.setGravityY(TUNING.gravity).setCollideWorldBounds(true);
        this.player.setVisible(true);

        if (this.attempt.stage === 0) {
            this.addPlatform(80, 330, 160);
            this.addPlatform(270, 300, 140);
            this.addPlatform(455, 260, 140);
            this.addPlatform(590, 220, 100);
            this.addGoal(600, 186);
        } else if (this.attempt.stage === 1) {
            this.addPlatform(85, 330, 170);
            this.addMovingPlatform(225, 282, 100, 190, 310, 80);
            this.addMovingPlatform(410, 228, 96, 350, 470, 55);
            this.addPlatform(565, 184, 150);
            this.addGoal(595, 150);
        } else if (this.attempt.stage === 2) {
            this.addPlatform(320, 330, 640);
            this.addPlatform(255, 270, 130);
            this.switchMarker = this.add.rectangle(255, 246, 28, 12, 0x72f5cf)
                .setStrokeStyle(1, 0xffffff);
            this.gate = this.add.rectangle(420, 244, 26, 154, 0xff7d9d)
                .setStrokeStyle(2, 0xffffff) as StaticRectangle;
            this.gates.add(this.gate);
            this.addGoal(570, 294);
            this.applyGateState();
        } else {
            this.addPlatform(90, 330, 180);
            this.addPlatform(270, 286, 120);
            this.addPlatform(430, 242, 120);
            this.addPlatform(590, 302, 120);
            this.addPlatform(750, 252, 120);
            this.addPlatform(900, 206, 120);
            this.addGoal(915, 172);
        }

        this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
        this.updateStatus();
    }

    private applyGateState() {
        if (!this.gate) return;
        this.gate.setVisible(!this.attempt.gatesOpen);
        this.gate.body.enable = !this.attempt.gatesOpen;
    }

    private canUseSwitch(): boolean {
        if (!this.switchMarker || this.attempt.stage !== 2 || this.attempt.phase !== 'playing') return false;
        return Math.abs(this.player.x - this.switchMarker.x) <= TUNING.switchRange
            && Math.abs(this.player.y - this.switchMarker.y) <= TUNING.switchRange;
    }

    private resetAfterFall() {
        this.player.body.reset(this.spawnX, this.spawnY);
        this.player.body.setVelocity(0, 0);
    }

    private updateStatus() {
        this.status.setText(`VIDEO STORE · ${this.attempt.stage}/3 ${STAGES[this.attempt.stage].name}`
            + (this.attempt.stage === 2 ? ` · GATE ${this.attempt.gatesOpen ? 'OPEN' : 'CLOSED'}` : ''));
        this.message.setText(this.attempt.phase === 'cleared' ? 'VIDEO STORE CLEARED!\nESC — HUB'
            : this.attempt.phase === 'stage-cleared' ? 'STAGE CLEARED\nENTER — NEXT STAGE'
            : this.attempt.stage === 2 && this.canUseSwitch() ? 'E — TOGGLE GATE' : '');
        this.message.setVisible(this.message.text.length > 0);
        if (this.attempt.phase === 'stage-cleared' || this.attempt.phase === 'cleared') {
            this.physics.pause();
        }
    }

    update() {
        if (this.attempt.phase === 'leaving') return;

        if (Input.Keyboard.JustDown(this.keys.ENTER) && advanceStage(this.attempt)) {
            this.buildStage();
            return;
        }
        if (this.attempt.phase !== 'playing') return;

        for (const child of this.movingPlatforms.getChildren() as MovingPlatform[]) {
            if (child.body.velocity.x > 0 && child.x >= child.maxX) {
                child.body.setVelocityX(-child.moveSpeed);
            } else if (child.body.velocity.x < 0 && child.x <= child.minX) {
                child.body.setVelocityX(child.moveSpeed);
            }
        }

        const left = this.keys.A.isDown || this.keys.LEFT.isDown;
        const right = this.keys.D.isDown || this.keys.RIGHT.isDown;
        this.player.body.setVelocityX((Number(right) - Number(left)) * TUNING.playerSpeed);

        if (Input.Keyboard.JustDown(this.keys.SPACE)
            && (this.player.body.blocked.down || this.player.body.touching.down)) {
            this.player.body.setVelocityY(TUNING.jumpVelocity);
        }

        if (Input.Keyboard.JustDown(this.keys.E) && this.canUseSwitch() && toggleGates(this.attempt)) {
            this.applyGateState();
        }

        if (this.player.y > TUNING.fallResetY) {
            this.resetAfterFall();
        }

        if (this.attempt.stage === 2) this.updateStatus();
    }
}
