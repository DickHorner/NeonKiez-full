import { GameObjects, Input, Physics, Scene } from 'phaser';
import {
    GHOST_STUN_MS, STAGES, TOKEN_TARGET,
    advanceStage, bumpGhost, collectToken, createAttempt, interactSwitch, leaveAttempt,
    reachGoal, type Attempt
} from '../laundromat-labyrinth/attempt';
import { markDungeonCleared, type Session } from '../session';

const TUNING = {
    playerSpeed: 165,
    playerSize: 18,
    arenaInset: 22,
    arenaTop: 54,
    arenaBottomInset: 38,
    switchRange: 42,
    ghostSpeed: 86,
    tokenRadius: 9
};

type Player = GameObjects.Rectangle & { body: Physics.Arcade.Body };
type Gate = GameObjects.Rectangle & { body: Physics.Arcade.StaticBody };
type Token = GameObjects.Arc & { tokenId: string };
type GhostBot = GameObjects.Rectangle & { body: Physics.Arcade.Body };

export class LaundromatLabyrinth extends Scene {
    private readonly session: Session;
    private attempt!: Attempt;
    private player!: Player;
    private walls!: Physics.Arcade.StaticGroup;
    private gates!: Physics.Arcade.StaticGroup;
    private goals!: Physics.Arcade.StaticGroup;
    private tokens!: Physics.Arcade.Group;
    private switchMarkers: GameObjects.Rectangle[] = [];
    private ghostBot?: GhostBot;
    private darkness!: GameObjects.Rectangle;
    private status!: GameObjects.Text;
    private message!: GameObjects.Text;
    private keys!: Record<
        'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT' | 'E' | 'ENTER',
        Input.Keyboard.Key
    >;
    private arenaBottom = 0;

    constructor(session: Session) {
        super('LaundromatLabyrinth');
        this.session = session;
    }

    create() {
        this.attempt = createAttempt();
        this.physics.world.drawDebug = false;
        this.physics.world.debugGraphic?.clear();
        this.cameras.main.setBackgroundColor('#0e151c');

        if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
        this.keys = this.input.keyboard.addKeys(
            'W,A,S,D,UP,LEFT,DOWN,RIGHT,E,ENTER'
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
            0x17232d
        ).setStrokeStyle(2, 0x587080);

        this.player = this.add.rectangle(
            60,
            (TUNING.arenaTop + this.arenaBottom) / 2,
            TUNING.playerSize,
            TUNING.playerSize,
            0x72f5cf
        ).setDepth(10) as Player;
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);

        this.walls = this.physics.add.staticGroup();
        this.gates = this.physics.add.staticGroup();
        this.goals = this.physics.add.staticGroup();
        this.tokens = this.physics.add.group();

        this.physics.add.collider(this.player, this.walls);
        this.physics.add.collider(this.player, this.gates);
        this.physics.add.overlap(this.player, this.goals, () => this.handleGoal());
        this.physics.add.overlap(this.player, this.tokens, (_player, object) => {
            const token = object as Token;
            if (!token.active || !collectToken(this.attempt, token.tokenId)) return;
            token.destroy();
            this.updateStatus();
        });

        this.darkness = this.add.rectangle(
            width / 2,
            height / 2,
            width,
            height,
            0x000000,
            0.82
        ).setDepth(8).setVisible(false);

        this.status = this.add.text(16, 10, '', {
            fontFamily: 'monospace', fontSize: 13, color: '#ffffff',
            backgroundColor: '#0e151c', padding: { x: 5, y: 3 }
        }).setDepth(20);
        this.message = this.add.text(width / 2, height * 0.67, '', {
            fontFamily: 'monospace', fontSize: 17, color: '#ffffff', align: 'center',
            backgroundColor: '#0e151c', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setDepth(20);
        this.add.text(
            width / 2,
            height - 13,
            'WASD / ARROWS MOVE · E SWITCH · ENTER NEXT · ESC HUB',
            {
                fontFamily: 'monospace', fontSize: 11, color: '#aebbc4',
                backgroundColor: '#0e151c', padding: { x: 4, y: 2 }
            }
        ).setOrigin(0.5).setDepth(20);

        this.buildStage();
    }

    private addWall(x: number, y: number, width: number, height: number) {
        this.walls.add(this.add.rectangle(x, y, width, height, 0x425463)
            .setStrokeStyle(1, 0x708795));
    }

    private addGate(x: number, y: number, width: number, height: number) {
        this.gates.add(this.add.rectangle(x, y, width, height, 0xf0b45d, 0.86)
            .setStrokeStyle(2, 0xffffff) as Gate);
    }

    private addGoal(x: number, y: number) {
        this.goals.add(this.add.rectangle(x, y, 30, 46, 0x72f5cf, 0.18)
            .setStrokeStyle(2, 0x72f5cf));
    }

    private addSwitch(x: number, y: number) {
        const marker = this.add.rectangle(x, y, 24, 18, 0x67a9ff)
            .setStrokeStyle(2, 0xffffff)
            .setDepth(10);
        this.switchMarkers.push(marker);
    }

    private addToken(id: string, x: number, y: number) {
        const token = this.add.circle(x, y, TUNING.tokenRadius, 0xffdf72)
            .setStrokeStyle(2, 0xffffff) as Token;
        token.tokenId = id;
        this.tokens.add(token);
    }

    private buildStage() {
        this.physics.resume();
        this.walls.clear(true, true);
        this.gates.clear(true, true);
        this.goals.clear(true, true);
        this.tokens.clear(true, true);
        this.ghostBot?.destroy();
        this.ghostBot = undefined;
        for (const marker of this.switchMarkers) marker.destroy();
        this.switchMarkers = [];

        const centerY = (TUNING.arenaTop + this.arenaBottom) / 2;
        this.player.body.setVelocity(0, 0);
        this.player.setAlpha(1);

        if (this.attempt.stage === 0) {
            this.player.body.reset(58, centerY);
            this.addSwitch(155, centerY - 58);
            this.addGate(330, centerY, 26, this.arenaBottom - TUNING.arenaTop);
            this.addGoal(578, centerY);
        } else if (this.attempt.stage === 1) {
            this.player.body.reset(58, this.arenaBottom - 28);
            this.addWall(160, 152, 18, 196);
            this.addWall(300, 221, 18, 202);
            this.addWall(440, 152, 18, 196);
            this.addWall(520, 221, 18, 202);
            this.addSwitch(96, this.arenaBottom - 34);
            this.addSwitch(385, 82);
            this.addGoal(586, 80);
        } else if (this.attempt.stage === 2) {
            this.player.body.reset(62, centerY);
            [
                ['token-1', 145, 105],
                ['token-2', 265, 255],
                ['token-3', 350, 120],
                ['token-4', 455, 255],
                ['token-5', 535, 110]
            ].forEach(([id, x, y]) => this.addToken(id as string, x as number, y as number));
            this.addGoal(584, 276);
            this.spawnGhostBot();
        } else {
            this.player.body.reset(58, centerY);
            this.addSwitch(145, centerY - 72);
            this.addGate(350, centerY, 34, this.arenaBottom - TUNING.arenaTop);
            this.addGoal(578, centerY);
        }

        this.applyGateState();
        this.applyLightState();
        this.updateStatus();
    }

    private spawnGhostBot() {
        const ghost = this.add.rectangle(300, 188, 24, 20, 0xd889ff, 0.9)
            .setStrokeStyle(2, 0xffffff) as GhostBot;
        this.physics.add.existing(ghost);
        ghost.body.setCollideWorldBounds(true).setBounce(1, 1).setVelocityX(TUNING.ghostSpeed);
        this.physics.add.overlap(this.player, ghost, () => this.handleGhostBump());
        this.ghostBot = ghost;
    }

    private handleGhostBump() {
        const now = this.time.now;
        if (!this.ghostBot || !bumpGhost(this.attempt, now)) return;

        const dx = this.player.x - this.ghostBot.x;
        const dy = this.player.y - this.ghostBot.y;
        const length = Math.hypot(dx, dy) || 1;
        this.player.body.setVelocity(dx / length * 220, dy / length * 220);
        this.player.setAlpha(0.55);
    }

    private applyGateState() {
        for (const gate of this.gates.getChildren() as Gate[]) {
            gate.setVisible(!this.attempt.gatesOpen);
            gate.body.enable = !this.attempt.gatesOpen;
        }
    }

    private applyLightState() {
        this.darkness.setVisible(this.attempt.stage === 1 && !this.attempt.lightsOn);
    }

    private nearestSwitch(): GameObjects.Rectangle | undefined {
        let nearest: GameObjects.Rectangle | undefined;
        let nearestDistance = Infinity;
        for (const marker of this.switchMarkers) {
            const distance = Math.hypot(this.player.x - marker.x, this.player.y - marker.y);
            if (distance <= TUNING.switchRange && distance < nearestDistance) {
                nearest = marker;
                nearestDistance = distance;
            }
        }
        return nearest;
    }

    private useSwitch() {
        if (!this.nearestSwitch() || !interactSwitch(this.attempt)) return;
        this.applyGateState();
        this.applyLightState();
        this.updateStatus();
    }

    private handleGoal() {
        if (!reachGoal(this.attempt)) {
            this.updateStatus();
            return;
        }

        this.player.body.stop();
        if (this.attempt.phase === 'cleared') {
            markDungeonCleared(this.session, 'LaundromatLabyrinth');
        }
        this.updateStatus();
    }

    private updateStatus() {
        const stage = STAGES[this.attempt.stage];
        const progress = this.attempt.stage === 2
            ? ` · TOKENS ${this.attempt.collectedTokenIds.length}/${TOKEN_TARGET}`
            : this.attempt.stage === 1
                ? ` · LIGHTS ${this.attempt.lightsOn ? 'ON' : 'OFF'}`
                : ` · GATE ${this.attempt.gatesOpen ? 'OPEN' : 'CLOSED'}`;

        this.status.setText(
            `LAUNDROMAT LABYRINTH · ${this.attempt.stage}/3 ${stage.name}${progress}`
        );

        const nearSwitch = this.nearestSwitch();
        this.message.setText(this.attempt.phase === 'cleared'
            ? 'LAUNDROMAT CLEARED!\nESC — HUB'
            : this.attempt.phase === 'stage-cleared'
                ? 'STAGE CLEARED\nENTER — NEXT STAGE'
                : this.attempt.stage === 0 && nearSwitch
                    ? 'E — TOGGLE GATE'
                    : this.attempt.stage === 1 && nearSwitch
                        ? 'E — LIGHT SWITCH'
                        : this.attempt.stage === 2 && this.attempt.collectedTokenIds.length < TOKEN_TARGET
                            ? `COLLECT ${TOKEN_TARGET - this.attempt.collectedTokenIds.length} MORE TOKEN${TOKEN_TARGET - this.attempt.collectedTokenIds.length === 1 ? '' : 'S'}`
                            : this.attempt.stage === 3 && nearSwitch
                                ? 'E — OPEN FINAL GATE'
                                : '');
        this.message.setVisible(this.message.text.length > 0);

        if (this.attempt.phase !== 'playing') this.physics.pause();
    }

    update() {
        if (this.attempt.phase === 'leaving') return;

        if (Input.Keyboard.JustDown(this.keys.ENTER) && advanceStage(this.attempt)) {
            this.buildStage();
            return;
        }
        if (this.attempt.phase !== 'playing') return;

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

        if (Input.Keyboard.JustDown(this.keys.E)) this.useSwitch();
        if (this.attempt.stage === 0 || this.attempt.stage === 1 || this.attempt.stage === 3) {
            this.updateStatus();
        }
    }
}
