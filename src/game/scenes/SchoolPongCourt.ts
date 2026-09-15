import { GameObjects, Input, Physics, Scene } from 'phaser';
import {
    STAGES, createAttempt, serveBall, missBall, hitTarget, advanceStage,
    paddleBounce, type Attempt
} from '../school-pong-court/attempt';
import { markDungeonCleared, type Session } from '../session';

const TUNING = {
    paddleSpeed: 400,
    paddleWidth: 90,
    paddleHeight: 12,
    paddleBottom: 42,
    ballRadius: 5,
    serveGap: 2,
    wallInset: 16,
    ceiling: 44,
    targetWidth: 68,
    targetHeight: 18,
    targetTop: 80,
    targetRowGap: 32,
    targetColumnGap: 96,
    reflectorWidth: 100,
    reflectorHeight: 10,
    reflectors: [{ x: 0.32, y: 0.53 }, { x: 0.68, y: 0.63 }]
};

type Paddle = GameObjects.Rectangle & { body: Physics.Arcade.Body };
type Ball = GameObjects.Arc & { body: Physics.Arcade.Body };
type Target = GameObjects.Rectangle & { targetId: number };

export class SchoolPongCourt extends Scene {
    private readonly session: Session;
    private attempt!: Attempt;
    private paddle!: Paddle;
    private ball!: Ball;
    private targets!: Physics.Arcade.StaticGroup;
    private reflectors!: Physics.Arcade.StaticGroup;
    private status!: GameObjects.Text;
    private message!: GameObjects.Text;
    private keys!: Record<'A' | 'D' | 'LEFT' | 'RIGHT' | 'SPACE', Input.Keyboard.Key>;

    constructor(session: Session) {
        super('SchoolPongCourt');
        this.session = session;
    }

    create() {
        this.attempt = createAttempt();
        this.physics.resume();
        this.physics.world.drawDebug = false;
        this.physics.world.debugGraphic?.clear();
        this.cameras.main.setBackgroundColor('#000000');
        if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
        this.keys = this.input.keyboard.addKeys('A,D,LEFT,RIGHT,SPACE') as typeof this.keys;
        this.input.keyboard.once('keydown-ESC', () => {
            this.attempt.phase = 'leaving';
            this.scene.start('Game');
        });

        const { width, height } = this.scale;
        this.physics.world.setBounds(TUNING.wallInset, TUNING.ceiling,
            width - TUNING.wallInset * 2, height - TUNING.ceiling, true, true, true, false);
        this.add.graphics().lineStyle(1, 0xaaaaaa)
            .beginPath().moveTo(TUNING.wallInset, height)
            .lineTo(TUNING.wallInset, TUNING.ceiling)
            .lineTo(width - TUNING.wallInset, TUNING.ceiling)
            .lineTo(width - TUNING.wallInset, height).strokePath();

        this.paddle = this.add.rectangle(width / 2, height - TUNING.paddleBottom,
            TUNING.paddleWidth, TUNING.paddleHeight, 0xffffff) as Paddle;
        this.physics.add.existing(this.paddle);
        this.paddle.body.setImmovable(true).setCollideWorldBounds(true);
        this.ball = this.add.circle(0, 0, TUNING.ballRadius, 0xffffff) as Ball;
        this.physics.add.existing(this.ball);
        this.ball.body.setCircle(TUNING.ballRadius);
        this.ball.body.setBounce(1).setCollideWorldBounds(true);
        this.targets = this.physics.add.staticGroup();
        this.reflectors = this.physics.add.staticGroup();

        this.physics.add.collider(this.ball, this.paddle, () => {
            const velocity = paddleBounce(this.ball.body.center.x - this.paddle.body.center.x,
                TUNING.paddleWidth / 2, STAGES[this.attempt.stage].ballSpeed);
            this.ball.body.setVelocity(velocity.x, velocity.y);
        }, () => this.attempt.phase === 'playing' && this.ball.body.velocity.y > 0
            && this.ball.body.center.y < this.paddle.body.center.y);
        this.physics.add.collider(this.ball, this.targets, (_ball, object) => {
            const target = object as Target;
            if (!target.active || !hitTarget(this.attempt, target.targetId)) return;
            target.destroy();
            if (this.attempt.phase !== 'playing') this.removeBall();
            if (this.attempt.phase === 'cleared') {
                markDungeonCleared(this.session, 'SchoolPongCourt');
            }
            this.updateStatus();
        });
        this.physics.add.collider(this.ball, this.reflectors);

        this.status = this.add.text(16, 14, '', {
            fontFamily: 'monospace', fontSize: 14, color: '#ffffff'
        });
        this.message = this.add.text(width / 2, height * 0.73, '', {
            fontFamily: 'monospace', fontSize: 18, color: '#ffffff', align: 'center',
            backgroundColor: '#000000', padding: { x: 8, y: 4 }
        }).setOrigin(0.5).setDepth(10);
        this.add.text(width / 2, height - 12, 'A/D or ←/→ MOVE · SPACE SERVE / NEXT · ESC HUB', {
            fontFamily: 'monospace', fontSize: 12, color: '#aaaaaa'
        }).setOrigin(0.5).setDepth(10);
        this.buildStage();
    }

    private buildStage() {
        this.removeBall();
        this.targets.clear(true, true);
        this.reflectors.clear(true, true);
        this.paddle.body.reset(this.scale.width / 2, this.scale.height - TUNING.paddleBottom);
        const { columns } = STAGES[this.attempt.stage];
        for (const id of this.attempt.remainingTargets) {
            const x = this.scale.width / 2 + (id % columns - (columns - 1) / 2) * TUNING.targetColumnGap;
            const y = TUNING.targetTop + Math.floor(id / columns) * TUNING.targetRowGap;
            const target = this.add.rectangle(x, y, TUNING.targetWidth, TUNING.targetHeight,
                0xffffff, 0.15).setStrokeStyle(2, 0xffffff) as Target;
            target.targetId = id;
            this.targets.add(target);
        }
        if (this.attempt.stage === 2) {
            for (const position of TUNING.reflectors) {
                this.reflectors.add(this.add.rectangle(position.x * this.scale.width,
                    position.y * this.scale.height, TUNING.reflectorWidth, TUNING.reflectorHeight,
                    0xaaaaaa).setStrokeStyle(1, 0xffffff));
            }
        }
        this.updateStatus();
    }

    private removeBall() {
        this.ball.body.stop();
        this.ball.body.enable = false;
        this.ball.setActive(false).setVisible(false);
    }

    private updateStatus() {
        const { stage, phase, remainingTargets } = this.attempt;
        this.status.setText(`SCHOOL PONG · ${stage}/3 ${STAGES[stage].name} · ${remainingTargets.length} TARGETS`);
        this.message.setText(phase === 'cleared' ? 'COURT CLEARED\nESC — RETURN TO HUB'
            : phase === 'stage-cleared' ? 'STAGE CLEARED\nSPACE — NEXT STAGE'
            : phase === 'ready' ? 'SPACE — SERVE' : '');
        this.message.setVisible(phase !== 'playing');
    }

    update() {
        if (this.attempt.phase === 'leaving') return;
        const canMove = this.attempt.phase === 'ready' || this.attempt.phase === 'playing';
        const left = this.keys.A.isDown || this.keys.LEFT.isDown;
        const right = this.keys.D.isDown || this.keys.RIGHT.isDown;
        this.paddle.body.setVelocityX(canMove ? (Number(right) - Number(left)) * TUNING.paddleSpeed : 0);
        if (Input.Keyboard.JustDown(this.keys.SPACE)) {
            if (advanceStage(this.attempt)) {
                this.buildStage();
            } else if (serveBall(this.attempt)) {
                this.ball.setActive(true).setVisible(true);
                this.ball.body.enable = true;
                this.ball.body.reset(this.paddle.x, this.paddle.y - TUNING.paddleHeight / 2
                    - TUNING.ballRadius - TUNING.serveGap);
                this.ball.body.setVelocity(0, -STAGES[this.attempt.stage].ballSpeed);
                this.updateStatus();
            }
        }
        if (this.ball.body.top > this.scale.height && missBall(this.attempt)) {
            this.removeBall();
            this.updateStatus();
        }
    }
}
