import { GameObjects, Input, Physics, Scene } from 'phaser';
import {
    STAGES, createAttempt, serveBall, scorePoint, advanceStage, retryStage, leaveAttempt,
    paddleBounce, serveVelocity, aiVelocity,
    type Attempt, type CourtAxis, type Direction, type PointSide
} from '../school-pong-court/attempt';
import { markDungeonCleared, type Session } from '../session';

const TUNING = {
    paddleSpeed: 400,
    paddleLength: 90,
    paddleThickness: 10,
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
    private court!: GameObjects.Graphics;
    private status!: GameObjects.Text;
    private message!: GameObjects.Text;
    private keys!: Record<
        'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT' | 'SPACE' | 'R',
        Input.Keyboard.Key
    >;
    private courtBottom = 0;
    private courtRight = 0;

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
        this.keys = this.input.keyboard.addKeys(
            'W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE,R'
        ) as typeof this.keys;
        const leave = () => {
            leaveAttempt(this.attempt);
            this.scene.start('Game');
        };
        this.input.keyboard.once('keydown-ESC', leave);
        this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', leave));

        const { width, height } = this.scale;
        this.courtBottom = height - TUNING.courtBottomInset;
        this.courtRight = width - TUNING.wallInset;
        this.court = this.add.graphics();

        this.playerPaddle = this.add.rectangle(
            0, 0, TUNING.paddleLength, TUNING.paddleThickness, 0x72f5cf
        ) as Paddle;
        this.physics.add.existing(this.playerPaddle);
        this.playerPaddle.body.setImmovable(true).setCollideWorldBounds(true);

        this.opponentPaddle = this.add.rectangle(
            0, 0, TUNING.paddleLength, TUNING.paddleThickness, 0xffc766
        ) as Paddle;
        this.physics.add.existing(this.opponentPaddle);
        this.opponentPaddle.body.setImmovable(true).setCollideWorldBounds(true);

        this.ball = this.add.circle(
            width / 2,
            (TUNING.courtTop + this.courtBottom) / 2,
            TUNING.ballRadius,
            0xffffff
        ) as Ball;
        this.physics.add.existing(this.ball);
        this.ball.body.setCircle(TUNING.ballRadius);
        this.ball.body.setBounce(1).setCollideWorldBounds(true);

        this.physics.add.collider(this.ball, this.playerPaddle, () => {
            this.bounceFromPaddle(this.playerPaddle, 'opponent');
        }, () => this.canHitPlayerPaddle());

        this.physics.add.collider(this.ball, this.opponentPaddle, () => {
            this.bounceFromPaddle(this.opponentPaddle, 'player');
        }, () => this.canHitOpponentPaddle());

        this.status = this.add.text(16, 12, '', {
            fontFamily: 'monospace', fontSize: 13, color: '#ffffff',
            backgroundColor: '#07110f', padding: { x: 5, y: 3 }
        }).setDepth(10);
        this.message = this.add.text(width / 2, height * 0.56, '', {
            fontFamily: 'monospace', fontSize: 18, color: '#ffffff', align: 'center',
            backgroundColor: '#07110f', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setDepth(10);
        this.add.text(width / 2, height - 12,
            'WASD / ARROWS MOVE · SPACE SERVE / NEXT · R RETRY · ESC HUB', {
                fontFamily: 'monospace', fontSize: 11, color: '#b7c9c4',
                backgroundColor: '#07110f', padding: { x: 4, y: 2 }
            }).setOrigin(0.5).setDepth(10);

        this.buildStage();
    }

    private primaryDirection(axis: CourtAxis, toward: PointSide): Direction {
        if (axis === 'horizontal') return toward === 'opponent' ? 1 : -1;
        return toward === 'opponent' ? -1 : 1;
    }

    private bounceFromPaddle(paddle: Paddle, toward: PointSide) {
        const stage = STAGES[this.attempt.stage];
        const offset = stage.axis === 'horizontal'
            ? this.ball.body.center.y - paddle.body.center.y
            : this.ball.body.center.x - paddle.body.center.x;
        const velocity = paddleBounce(
            offset,
            TUNING.paddleLength / 2,
            stage.ballSpeed,
            stage.axis,
            this.primaryDirection(stage.axis, toward)
        );
        this.ball.body.setVelocity(velocity.x, velocity.y);
    }

    private canHitPlayerPaddle(): boolean {
        if (this.attempt.phase !== 'playing') return false;
        const axis = STAGES[this.attempt.stage].axis;
        return axis === 'horizontal'
            ? this.ball.body.velocity.x < 0 && this.ball.body.center.x > this.playerPaddle.body.center.x
            : this.ball.body.velocity.y > 0 && this.ball.body.center.y < this.playerPaddle.body.center.y;
    }

    private canHitOpponentPaddle(): boolean {
        if (this.attempt.phase !== 'playing') return false;
        const axis = STAGES[this.attempt.stage].axis;
        return axis === 'horizontal'
            ? this.ball.body.velocity.x > 0 && this.ball.body.center.x < this.opponentPaddle.body.center.x
            : this.ball.body.velocity.y < 0 && this.ball.body.center.y > this.opponentPaddle.body.center.y;
    }

    private configureCourt(axis: CourtAxis) {
        const width = this.scale.width;
        const centerX = width / 2;
        const centerY = (TUNING.courtTop + this.courtBottom) / 2;
        const courtWidth = this.courtRight - TUNING.wallInset;
        const courtHeight = this.courtBottom - TUNING.courtTop;

        this.physics.world.setBounds(
            TUNING.wallInset,
            TUNING.courtTop,
            courtWidth,
            courtHeight,
            axis === 'vertical',
            axis === 'vertical',
            axis === 'horizontal',
            axis === 'horizontal'
        );

        this.court.clear().lineStyle(2, 0xdcefe9, 0.8);
        this.court.strokeRect(TUNING.wallInset, TUNING.courtTop, courtWidth, courtHeight);
        if (axis === 'horizontal') {
            this.court.lineBetween(centerX, TUNING.courtTop, centerX, this.courtBottom);
        } else {
            this.court.lineBetween(TUNING.wallInset, centerY, this.courtRight, centerY);
        }

        this.playerPaddle.setScale(1);
        this.opponentPaddle.setScale(1);
        if (axis === 'horizontal') {
            this.playerPaddle.setSize(TUNING.paddleThickness, TUNING.paddleLength);
            this.opponentPaddle.setSize(TUNING.paddleThickness, TUNING.paddleLength);
            this.playerPaddle.body.setSize(TUNING.paddleThickness, TUNING.paddleLength);
            this.opponentPaddle.body.setSize(TUNING.paddleThickness, TUNING.paddleLength);
            this.playerPaddle.body.reset(TUNING.wallInset + TUNING.playerInset, centerY);
            this.opponentPaddle.body.reset(this.courtRight - TUNING.opponentInset, centerY);
        } else {
            this.playerPaddle.setSize(TUNING.paddleLength, TUNING.paddleThickness);
            this.opponentPaddle.setSize(TUNING.paddleLength, TUNING.paddleThickness);
            this.playerPaddle.body.setSize(TUNING.paddleLength, TUNING.paddleThickness);
            this.opponentPaddle.body.setSize(TUNING.paddleLength, TUNING.paddleThickness);
            this.playerPaddle.body.reset(centerX, this.courtBottom - TUNING.playerInset);
            this.opponentPaddle.body.reset(centerX, TUNING.courtTop + TUNING.opponentInset);
        }
        this.playerPaddle.body.setVelocity(0, 0);
        this.opponentPaddle.body.setVelocity(0, 0);
    }

    private buildStage() {
        this.physics.resume();
        this.configureCourt(STAGES[this.attempt.stage].axis);
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
        const secondaryDirection = ((this.attempt.playerScore + this.attempt.opponentScore
            + this.attempt.stage) % 2 === 0 ? 1 : -1) as Direction;
        const velocity = serveVelocity(
            stage.ballSpeed,
            stage.axis,
            this.primaryDirection(stage.axis, this.attempt.serveToward),
            secondaryDirection
        );
        const centerY = (TUNING.courtTop + this.courtBottom) / 2;
        this.ball.setActive(true).setVisible(true);
        this.ball.body.enable = true;
        this.ball.body.reset(this.scale.width / 2, centerY);
        this.ball.body.setVelocity(velocity.x, velocity.y);
    }

    private handlePoint(side: PointSide) {
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

    private updatePlayerPaddle(canMove: boolean, axis: CourtAxis) {
        this.playerPaddle.body.setVelocity(0, 0);
        if (!canMove) return;
        if (axis === 'horizontal') {
            const up = this.keys.W.isDown || this.keys.UP.isDown;
            const down = this.keys.S.isDown || this.keys.DOWN.isDown;
            this.playerPaddle.body.setVelocityY((Number(down) - Number(up)) * TUNING.paddleSpeed);
        } else {
            const left = this.keys.A.isDown || this.keys.LEFT.isDown;
            const right = this.keys.D.isDown || this.keys.RIGHT.isDown;
            this.playerPaddle.body.setVelocityX((Number(right) - Number(left)) * TUNING.paddleSpeed);
        }
    }

    private updateOpponentPaddle(canMove: boolean, axis: CourtAxis) {
        this.opponentPaddle.body.setVelocity(0, 0);
        if (!canMove) return;
        const stage = STAGES[this.attempt.stage];
        if (axis === 'horizontal') {
            this.opponentPaddle.body.setVelocityY(aiVelocity(
                this.opponentPaddle.y,
                this.ball.y,
                (TUNING.courtTop + this.courtBottom) / 2,
                this.attempt.phase === 'playing' && this.ball.body.velocity.x > 0,
                stage.aiSpeed,
                stage.aiDeadZone
            ));
        } else {
            this.opponentPaddle.body.setVelocityX(aiVelocity(
                this.opponentPaddle.x,
                this.ball.x,
                this.scale.width / 2,
                this.attempt.phase === 'playing' && this.ball.body.velocity.y < 0,
                stage.aiSpeed,
                stage.aiDeadZone
            ));
        }
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

        const stage = STAGES[this.attempt.stage];
        const canMove = this.attempt.phase === 'ready' || this.attempt.phase === 'playing';
        this.updatePlayerPaddle(canMove, stage.axis);
        this.updateOpponentPaddle(canMove, stage.axis);

        if (this.attempt.phase !== 'playing') return;
        if (stage.axis === 'horizontal') {
            if (this.ball.body.left > this.courtRight) {
                this.handlePoint('player');
            } else if (this.ball.body.right < TUNING.wallInset) {
                this.handlePoint('opponent');
            }
        } else if (this.ball.body.bottom < TUNING.courtTop) {
            this.handlePoint('player');
        } else if (this.ball.body.top > this.courtBottom) {
            this.handlePoint('opponent');
        }
    }
}
