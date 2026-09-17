import { GameObjects, Input, Physics, Scene } from 'phaser';
import {
    STAGES, createAttempt, serveBall, scorePoint, advanceStage, retryStage, leaveAttempt,
    paddleBounce, serveVelocity, aiVelocity, type Attempt, type VerticalDirection
} from '../school-pong-court/attempt';
import { markDungeonCleared, type Session } from '../session';

const TUNING = {
    paddleSpeed: 400,
    paddleWidth: 90,
    paddleHeight: 10,
    playerInset: 28,
    opponentInset: 28,
    ballRadius: 5,
    wallInset: 16,
    courtTop: 48,
    courtBottomInset: 38
};

type Paddle = GameObjects.Rectangle & { body: Physics.Arcade.Body };
type Ball = GameObjects.Arc & { body: Physics.Arcade.Body };

export class SchoolPongCourt extends Scene {
    private readonly session: Session;
    private attempt!: Attempt;
    private playerPaddle!: Paddle;
    private opponentPaddle!: Paddle;
    private ball!: Ball;
    private status!: GameObjects.Text;
    private message!: GameObjects.Text;
    private keys!: Record<'A' | 'D' | 'LEFT' | 'RIGHT' | 'SPACE' | 'R', Input.Keyboard.Key>;
    private courtBottom = 0;

    constructor(session: Session) {
        super('SchoolPongCourt');
        this.session = session;
    }

    create() {
        this.attempt = createAttempt();
        this.physics.resume();
        this.physics.world.drawDebug = false;
        this.physics.world.debugGraphic?.clear();
        this.cameras.main.setBackgroundColor('#07110f');

        if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
        this.keys = this.input.keyboard.addKeys('A,D,LEFT,RIGHT,SPACE,R') as typeof this.keys;
        const leave = () => {
            leaveAttempt(this.attempt);
            this.scene.start('Game');
        };
        this.input.keyboard.once('keydown-ESC', leave);
        this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', leave));

        const { width, height } = this.scale;
        this.courtBottom = height - TUNING.courtBottomInset;
        this.physics.world.setBounds(
            TUNING.wallInset,
            TUNING.courtTop,
            width - TUNING.wallInset * 2,
            this.courtBottom - TUNING.courtTop,
            true,
            true,
            false,
            false
        );

        const court = this.add.graphics().lineStyle(2, 0xdcefe9, 0.8);
        court.strokeRect(
            TUNING.wallInset,
            TUNING.courtTop,
            width - TUNING.wallInset * 2,
            this.courtBottom - TUNING.courtTop
        );
        court.lineBetween(TUNING.wallInset, (TUNING.courtTop + this.courtBottom) / 2,
            width - TUNING.wallInset, (TUNING.courtTop + this.courtBottom) / 2);

        this.playerPaddle = this.add.rectangle(
            width / 2,
            this.courtBottom - TUNING.playerInset,
            TUNING.paddleWidth,
            TUNING.paddleHeight,
            0x72f5cf
        ) as Paddle;
        this.physics.add.existing(this.playerPaddle);
        this.playerPaddle.body.setImmovable(true).setCollideWorldBounds(true);

        this.opponentPaddle = this.add.rectangle(
            width / 2,
            TUNING.courtTop + TUNING.opponentInset,
            TUNING.paddleWidth,
            TUNING.paddleHeight,
            0xffc766
        ) as Paddle;
        this.physics.add.existing(this.opponentPaddle);
        this.opponentPaddle.body.setImmovable(true).setCollideWorldBounds(true);

        this.ball = this.add.circle(width / 2, (TUNING.courtTop + this.courtBottom) / 2,
            TUNING.ballRadius, 0xffffff) as Ball;
        this.physics.add.existing(this.ball);
        this.ball.body.setCircle(TUNING.ballRadius);
        this.ball.body.setBounce(1).setCollideWorldBounds(true);

        this.physics.add.collider(this.ball, this.playerPaddle, () => {
            this.bounceFromPaddle(this.playerPaddle, -1);
        }, () => this.attempt.phase === 'playing'
            && this.ball.body.velocity.y > 0
            && this.ball.body.center.y < this.playerPaddle.body.center.y);

        this.physics.add.collider(this.ball, this.opponentPaddle, () => {
            this.bounceFromPaddle(this.opponentPaddle, 1);
        }, () => this.attempt.phase === 'playing'
            && this.ball.body.velocity.y < 0
            && this.ball.body.center.y > this.opponentPaddle.body.center.y);

        this.status = this.add.text(16, 12, '', {
            fontFamily: 'monospace', fontSize: 13, color: '#ffffff',
            backgroundColor: '#07110f', padding: { x: 5, y: 3 }
        }).setDepth(10);
        this.message = this.add.text(width / 2, height * 0.56, '', {
            fontFamily: 'monospace', fontSize: 18, color: '#ffffff', align: 'center',
            backgroundColor: '#07110f', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setDepth(10);
        this.add.text(width / 2, height - 12,
            'A/D or LEFT/RIGHT MOVE · SPACE SERVE / NEXT · R RETRY · ESC HUB', {
                fontFamily: 'monospace', fontSize: 11, color: '#b7c9c4',
                backgroundColor: '#07110f', padding: { x: 4, y: 2 }
            }).setOrigin(0.5).setDepth(10);

        this.buildStage();
    }

    private bounceFromPaddle(paddle: Paddle, verticalDirection: VerticalDirection) {
        const velocity = paddleBounce(
            this.ball.body.center.x - paddle.body.center.x,
            TUNING.paddleWidth / 2,
            STAGES[this.attempt.stage].ballSpeed,
            verticalDirection
        );
        this.ball.body.setVelocity(velocity.x, velocity.y);
    }

    private buildStage() {
        this.physics.resume();
        this.playerPaddle.body.reset(this.scale.width / 2, this.courtBottom - TUNING.playerInset);
        this.opponentPaddle.body.reset(this.scale.width / 2, TUNING.courtTop + TUNING.opponentInset);
        this.playerPaddle.body.setVelocity(0, 0);
        this.opponentPaddle.body.setVelocity(0, 0);
        this.resetBall();
        this.updateStatus();
    }

    private resetBall() {
        const centerY = (TUNING.courtTop + this.courtBottom) / 2;
        this.ball.body.stop();
        this.ball.body.reset(this.scale.width / 2, centerY);
        this.ball.body.enable = false;
        this.ball.setActive(false).setVisible(false);
    }

    private launchBall() {
        const stage = STAGES[this.attempt.stage];
        const horizontalDirection = ((this.attempt.playerScore + this.attempt.opponentScore
            + this.attempt.stage) % 2 === 0 ? 1 : -1) as VerticalDirection;
        const velocity = serveVelocity(stage.ballSpeed, this.attempt.serveDirection, horizontalDirection);
        const centerY = (TUNING.courtTop + this.courtBottom) / 2;
        this.ball.setActive(true).setVisible(true);
        this.ball.body.enable = true;
        this.ball.body.reset(this.scale.width / 2, centerY);
        this.ball.body.setVelocity(velocity.x, velocity.y);
    }

    private handlePoint(side: 'player' | 'opponent') {
        if (!scorePoint(this.attempt, side)) return;
        this.resetBall();
        if (this.attempt.phase === 'cleared') {
            markDungeonCleared(this.session, 'SchoolPongCourt');
        }
        this.updateStatus();
    }

    private updateStatus() {
        const stage = STAGES[this.attempt.stage];
        this.status.setText(
            `SCHOOL PONG · ${this.attempt.stage}/3 ${stage.name} · `
            + `YOU ${this.attempt.playerScore}:${this.attempt.opponentScore} AI · FIRST TO ${stage.targetScore}`
        );
        this.message.setText(this.attempt.phase === 'cleared' ? 'COURT CLEARED\nESC — RETURN TO HUB'
            : this.attempt.phase === 'lost' ? 'MATCH LOST\nR — RETRY STAGE'
            : this.attempt.phase === 'stage-cleared' ? 'MATCH WON\nSPACE — NEXT STAGE'
            : this.attempt.phase === 'ready' ? 'SPACE — SERVE' : '');
        this.message.setVisible(this.message.text.length > 0);
    }

    update() {
        if (this.attempt.phase === 'leaving') return;

        if (Input.Keyboard.JustDown(this.keys.R) && retryStage(this.attempt)) {
            this.buildStage();
            return;
        }
        if (Input.Keyboard.JustDown(this.keys.SPACE)) {
            if (advanceStage(this.attempt)) {
                this.buildStage();
                return;
            }
            if (serveBall(this.attempt)) {
                this.launchBall();
                this.updateStatus();
            }
        }

        const canMove = this.attempt.phase === 'ready' || this.attempt.phase === 'playing';
        const left = this.keys.A.isDown || this.keys.LEFT.isDown;
        const right = this.keys.D.isDown || this.keys.RIGHT.isDown;
        this.playerPaddle.body.setVelocityX(
            canMove ? (Number(right) - Number(left)) * TUNING.paddleSpeed : 0
        );

        if (canMove) {
            const stage = STAGES[this.attempt.stage];
            this.opponentPaddle.body.setVelocityX(aiVelocity(
                this.opponentPaddle.x,
                this.ball.x,
                this.scale.width / 2,
                this.attempt.phase === 'playing' ? this.ball.body.velocity.y : 0,
                stage.aiSpeed,
                stage.aiDeadZone
            ));
        } else {
            this.opponentPaddle.body.setVelocityX(0);
        }

        if (this.attempt.phase !== 'playing') return;
        if (this.ball.body.bottom < TUNING.courtTop) {
            this.handlePoint('player');
        } else if (this.ball.body.top > this.courtBottom) {
            this.handlePoint('opponent');
        }
    }
}
