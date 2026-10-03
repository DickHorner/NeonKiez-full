import { GameObjects, Input, Scene } from 'phaser';
import {
    JAM_TARGET_SCORE, STAGES, advanceStage, createAttempt, leaveAttempt, recordLanding,
    retryStage, tickAttempt, type Attempt, type PipeSide, type Trick
} from '../halfpipe-skate/attempt';
import { markDungeonCleared, type Session } from '../session';

const TUNING = {
    pipeHalfWidth: 220,
    pipeAcceleration: 3,
    pipeDrag: 0.08,
    initialSpeed: 0.45,
    pumpBoost: 0.4,
    pumpWindow: 0.18,
    pumpCooldownMs: 250,
    maxPipeSpeed: 2.8,
    launchThreshold: 0.55,
    airBaseVelocity: 260,
    airVelocityGain: 110,
    airGravity: 620,
    apexTrickVelocity: 95,
    spinRate: 15.5,
    landingTolerance: 0.5,
    wipeoutMs: 650
};

type Skater = GameObjects.Container;

export class HalfpipeSkate extends Scene {
    private readonly session: Session;
    private attempt!: Attempt;
    private skater!: Skater;
    private status!: GameObjects.Text;
    private message!: GameObjects.Text;
    private keys!: Record<'LEFT' | 'RIGHT' | 'A' | 'D' | 'SPACE' | 'ENTER' | 'R', Input.Keyboard.Key>;

    private pipeCenterX = 0;
    private pipeBottomY = 0;
    private pipeLipY = 0;
    private pipePosition = 0;
    private pipeVelocity = TUNING.initialSpeed;

    private airborne = false;
    private airSide: PipeSide = 'right';
    private airHeight = 0;
    private airVelocity = 0;
    private launchSpeed = 0;
    private currentTrick: Trick | null = null;
    private spinRemaining = 0;

    private lastPumpAt = -Infinity;
    private wipeoutUntil = 0;

    constructor(session: Session) {
        super('HalfpipeSkate');
        this.session = session;
    }

    create() {
        this.attempt = createAttempt();
        this.cameras.main.setBackgroundColor('#101225');

        if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
        this.keys = this.input.keyboard.addKeys(
            'LEFT,RIGHT,A,D,SPACE,ENTER,R'
        ) as typeof this.keys;

        const leave = () => {
            leaveAttempt(this.attempt);
            this.scene.start('Game');
        };
        this.input.keyboard.once('keydown-ESC', leave);
        this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', leave));

        this.pipeCenterX = this.scale.width / 2;
        this.pipeBottomY = this.scale.height - 54;
        this.pipeLipY = 118;

        this.drawHalfpipe();
        this.createSkater();

        this.status = this.add.text(16, 10, '', {
            fontFamily: 'monospace', fontSize: 13, color: '#ffffff',
            backgroundColor: '#101225', padding: { x: 5, y: 3 }
        }).setDepth(20);
        this.message = this.add.text(this.scale.width / 2, this.scale.height * 0.58, '', {
            fontFamily: 'monospace', fontSize: 17, color: '#ffffff', align: 'center',
            backgroundColor: '#101225', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setDepth(20);
        this.add.text(
            this.scale.width / 2,
            this.scale.height - 13,
            'SPACE PUMP / TRICK · HOLD ←/→ + SPACE TO SPIN · ENTER NEXT · R RETRY · ESC HUB',
            {
                fontFamily: 'monospace', fontSize: 10, color: '#b7bbd2',
                backgroundColor: '#101225', padding: { x: 4, y: 2 }
            }
        ).setOrigin(0.5).setDepth(20);

        this.buildStage();
    }

    private drawHalfpipe() {
        const graphics = this.add.graphics();
        graphics.lineStyle(6, 0xff5ea8, 1);
        graphics.beginPath();

        for (let index = 0; index <= 40; index++) {
            const position = -1 + index / 20;
            const point = this.pipePoint(position);
            if (index === 0) graphics.moveTo(point.x, point.y);
            else graphics.lineTo(point.x, point.y);
        }

        graphics.strokePath();

        this.add.rectangle(
            this.pipeCenterX - TUNING.pipeHalfWidth - 20,
            this.pipeLipY - 10,
            80,
            12,
            0x42d9ff
        ).setStrokeStyle(2, 0xffffff);
        this.add.rectangle(
            this.pipeCenterX + TUNING.pipeHalfWidth + 20,
            this.pipeLipY - 10,
            80,
            12,
            0x42d9ff
        ).setStrokeStyle(2, 0xffffff);

        for (let index = 0; index < 7; index++) {
            const x = 72 + index * 82;
            this.add.rectangle(x, 78 + (index % 2) * 8, 18, 28, 0x7867a8)
                .setStrokeStyle(1, 0xffffff, 0.65);
        }
    }

    private createSkater() {
        const board = this.add.rectangle(0, 9, 30, 5, 0xffd65c)
            .setStrokeStyle(1, 0xffffff);
        const body = this.add.rectangle(0, -4, 12, 24, 0x72f5cf)
            .setStrokeStyle(1, 0xffffff);
        const helmet = this.add.circle(0, -19, 6, 0xff6d8f)
            .setStrokeStyle(1, 0xffffff);

        this.skater = this.add.container(this.pipeCenterX, this.pipeBottomY, [board, body, helmet])
            .setDepth(10);
    }

    private pipePoint(position: number) {
        const clamped = Math.max(-1, Math.min(1, position));
        const height = this.pipeBottomY - this.pipeLipY;
        return {
            x: this.pipeCenterX + clamped * TUNING.pipeHalfWidth,
            y: this.pipeBottomY - clamped * clamped * height
        };
    }

    private buildStage() {
        this.pipePosition = 0;
        this.pipeVelocity = TUNING.initialSpeed;
        this.airborne = false;
        this.airHeight = 0;
        this.airVelocity = 0;
        this.launchSpeed = 0;
        this.currentTrick = null;
        this.spinRemaining = 0;
        this.lastPumpAt = -Infinity;
        this.wipeoutUntil = 0;
        this.skater.setAlpha(1).setRotation(0);
        this.placeSkaterOnPipe();
        this.updateStatus();
    }

    private placeSkaterOnPipe() {
        const point = this.pipePoint(this.pipePosition);
        this.skater.setPosition(point.x, point.y - 14);

        const slope = -2 * this.pipePosition
            * (this.pipeBottomY - this.pipeLipY) / TUNING.pipeHalfWidth;
        this.skater.setRotation(Math.atan(slope));
    }

    private tryPump() {
        if (this.airborne || Math.abs(this.pipePosition) > TUNING.pumpWindow) return;
        if (this.time.now - this.lastPumpAt < TUNING.pumpCooldownMs) return;

        const direction = Math.sign(this.pipeVelocity) || 1;
        this.pipeVelocity = direction * Math.min(
            TUNING.maxPipeSpeed,
            Math.abs(this.pipeVelocity) + TUNING.pumpBoost
        );
        this.lastPumpAt = this.time.now;
    }

    private selectedTrick(): Trick {
        const left = this.keys.LEFT.isDown || this.keys.A.isDown;
        const right = this.keys.RIGHT.isDown || this.keys.D.isDown;
        if (left && !right) return 'spin-left';
        if (right && !left) return 'spin-right';
        return 'grab';
    }

    private tryTrick() {
        if (!this.airborne || this.currentTrick
            || Math.abs(this.airVelocity) > TUNING.apexTrickVelocity) {
            return;
        }

        this.currentTrick = this.selectedTrick();
        if (this.currentTrick === 'spin-left') this.spinRemaining = -Math.PI * 2;
        if (this.currentTrick === 'spin-right') this.spinRemaining = Math.PI * 2;
        this.updateStatus();
    }

    private launch(side: PipeSide) {
        this.airborne = true;
        this.airSide = side;
        this.airHeight = 0;
        this.launchSpeed = Math.abs(this.pipeVelocity);
        this.airVelocity = TUNING.airBaseVelocity
            + Math.max(0, this.launchSpeed - TUNING.launchThreshold) * TUNING.airVelocityGain;
        this.currentTrick = null;
        this.spinRemaining = 0;
        this.skater.setRotation(0);
        this.pipePosition = side === 'left' ? -1 : 1;
    }

    private updatePipe(deltaSeconds: number) {
        this.pipeVelocity += -this.pipePosition * TUNING.pipeAcceleration * deltaSeconds;
        this.pipeVelocity *= Math.exp(-TUNING.pipeDrag * deltaSeconds);
        this.pipePosition += this.pipeVelocity * deltaSeconds;

        if (Math.abs(this.pipePosition) >= 1) {
            const side: PipeSide = this.pipePosition < 0 ? 'left' : 'right';
            const movingOutward = side === 'left' ? this.pipeVelocity < 0 : this.pipeVelocity > 0;
            this.pipePosition = side === 'left' ? -1 : 1;

            if (movingOutward && Math.abs(this.pipeVelocity) >= TUNING.launchThreshold) {
                this.launch(side);
                return;
            }

            if (movingOutward) this.pipeVelocity *= -0.92;
        }

        this.placeSkaterOnPipe();
    }

    private normalizeAngle(angle: number) {
        return Math.atan2(Math.sin(angle), Math.cos(angle));
    }

    private updateAir(deltaSeconds: number) {
        this.airHeight += this.airVelocity * deltaSeconds;
        this.airVelocity -= TUNING.airGravity * deltaSeconds;

        if (this.spinRemaining !== 0) {
            const direction = Math.sign(this.spinRemaining);
            const step = Math.min(Math.abs(this.spinRemaining), TUNING.spinRate * deltaSeconds);
            this.spinRemaining -= direction * step;
            this.skater.rotation += direction * step;
        } else if (this.currentTrick === 'grab') {
            this.skater.setRotation(this.airSide === 'left' ? -0.18 : 0.18);
        }

        const lipX = this.pipeCenterX
            + (this.airSide === 'left' ? -TUNING.pipeHalfWidth : TUNING.pipeHalfWidth);
        this.skater.setPosition(lipX, this.pipeLipY - this.airHeight - 14);

        if (this.airHeight > 0 || this.airVelocity >= 0) return;

        const clean = Math.abs(this.normalizeAngle(this.skater.rotation)) <= TUNING.landingTolerance
            && this.spinRemaining === 0;
        this.land(clean);
    }

    private land(clean: boolean) {
        const trick = this.currentTrick;
        recordLanding(this.attempt, this.airSide, clean, trick);

        if (!clean) {
            this.startWipeout();
            this.updateStatus();
            return;
        }

        this.airborne = false;
        this.currentTrick = null;
        this.spinRemaining = 0;
        this.pipePosition = this.airSide === 'left' ? -0.99 : 0.99;
        this.pipeVelocity = (this.airSide === 'left' ? 1 : -1)
            * Math.min(TUNING.maxPipeSpeed, Math.max(0.9, this.launchSpeed));
        this.skater.setRotation(0);
        this.placeSkaterOnPipe();

        if (this.attempt.phase === 'cleared') {
            markDungeonCleared(this.session, 'HalfpipeSkate');
        }
        this.updateStatus();
    }

    private startWipeout() {
        this.airborne = false;
        this.currentTrick = null;
        this.spinRemaining = 0;
        this.wipeoutUntil = this.time.now + TUNING.wipeoutMs;
        this.skater.setAlpha(0.55).setRotation(0.75);

        const stars = this.add.text(this.skater.x, this.skater.y - 22, '✦ ✦ ✦', {
            fontFamily: 'monospace', fontSize: 16, color: '#ffd65c'
        }).setOrigin(0.5).setDepth(15);
        this.tweens.add({
            targets: stars,
            y: stars.y - 18,
            alpha: 0,
            duration: TUNING.wipeoutMs,
            onComplete: () => stars.destroy()
        });
    }

    private resetAfterWipeout() {
        this.wipeoutUntil = 0;
        this.pipePosition = 0;
        this.pipeVelocity = TUNING.initialSpeed;
        this.skater.setAlpha(1).setRotation(0);
        this.placeSkaterOnPipe();
    }

    private updateStatus() {
        const stage = STAGES[this.attempt.stage];
        const speed = this.airborne ? this.launchSpeed : Math.abs(this.pipeVelocity);
        const jam = this.attempt.stage === 3
            ? ` · TIME ${Math.ceil(this.attempt.remainingMs / 1000)}s / TARGET ${JAM_TARGET_SCORE}`
            : '';
        const tricks = this.attempt.stage >= 2
            ? ` · TRICKS ${this.attempt.landedTricks.length}/3`
            : '';

        this.status.setText(
            `HALFPIPE · ${this.attempt.stage}/3 ${stage.name} · SCORE ${this.attempt.score}`
            + ` · COMBO x${this.attempt.combo} · SPEED ${speed.toFixed(1)}${tricks}${jam}`
        );

        this.message.setText(this.attempt.phase === 'cleared'
            ? 'KIEZ JAM CLEARED!\nOLLIE UNLOCKED · ESC — HUB'
            : this.attempt.phase === 'stage-cleared'
                ? 'STAGE CLEARED\nENTER — NEXT STAGE'
                : this.attempt.phase === 'lost'
                    ? 'JAM OVER\nR — RETRY'
                    : this.wipeoutUntil > 0
                        ? 'WIPEOUT!'
                        : this.airborne && !this.currentTrick
                            && Math.abs(this.airVelocity) <= TUNING.apexTrickVelocity
                            ? 'SPACE — TRICK · HOLD ←/→ TO SPIN'
                            : this.attempt.stage === 0
                                ? 'PUMP WITH SPACE NEAR THE BOTTOM'
                                : '');
        this.message.setVisible(this.message.text.length > 0);
    }

    update(_time: number, delta: number) {
        if (this.attempt.phase === 'leaving') return;

        if (Input.Keyboard.JustDown(this.keys.R) && retryStage(this.attempt)) {
            this.buildStage();
            return;
        }
        if (Input.Keyboard.JustDown(this.keys.ENTER) && advanceStage(this.attempt)) {
            this.buildStage();
            return;
        }
        if (this.attempt.phase !== 'playing') return;

        if (this.wipeoutUntil > 0) {
            tickAttempt(this.attempt, delta);
            if (this.attempt.phase !== 'playing') {
                this.updateStatus();
                return;
            }
            if (this.time.now >= this.wipeoutUntil) {
                this.resetAfterWipeout();
                this.updateStatus();
            }
            return;
        }

        if (Input.Keyboard.JustDown(this.keys.SPACE)) {
            if (this.airborne) this.tryTrick();
            else this.tryPump();
        }

        const deltaSeconds = Math.min(delta, 50) / 1000;
        if (this.airborne) this.updateAir(deltaSeconds);
        else this.updatePipe(deltaSeconds);

        if (this.attempt.phase !== 'playing') return;
        tickAttempt(this.attempt, delta);
        this.updateStatus();
    }
}
