import { GameObjects, Input, Physics, Scene } from 'phaser';
import {
    BEAT_INTERVAL_MS, MISS_LIMIT, STAGES,
    advanceStage, beatCountdownMs, beatDistanceMs, createAttempt, leaveAttempt,
    reachGoal, retryStage, tapBeat, type Attempt
} from '../subway-timing/attempt';
import { markDungeonCleared, type Session } from '../session';

const TUNING = {
    playerSpeed: 170,
    playerSize: 18,
    arenaInset: 28,
    arenaTop: 92,
    arenaBottomInset: 42,
    gateWidth: 18,
    switchRadius: 13,
    switchRange: 36,
    finalMarkerRange: 30,
    beatFlashMs: 60
};

type Player = GameObjects.Rectangle & { body: Physics.Arcade.Body };
type Gate = GameObjects.Rectangle & { body: Physics.Arcade.StaticBody };
type SwitchMarker = GameObjects.Arc & { switchIndex: number };
type BeatMarker = GameObjects.Arc & { markerIndex: number };

export class SubwayTiming extends Scene {
    private readonly session: Session;
    private attempt!: Attempt;
    private player!: Player;
    private gates!: Physics.Arcade.StaticGroup;
    private goals!: Physics.Arcade.StaticGroup;
    private switches: SwitchMarker[] = [];
    private switchLabels: GameObjects.Text[] = [];
    private beatMarkers: BeatMarker[] = [];
    private beatCue!: GameObjects.Arc;
    private status!: GameObjects.Text;
    private message!: GameObjects.Text;
    private feedback!: GameObjects.Text;
    private keys!: Record<
        'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT' | 'SPACE' | 'ENTER' | 'R',
        Input.Keyboard.Key
    >;
    private arenaBottom = 0;

    constructor(session: Session) {
        super('SubwayTiming');
        this.session = session;
    }

    create() {
        this.attempt = createAttempt(this.time.now);
        this.physics.world.drawDebug = false;
        this.physics.world.debugGraphic?.clear();
        this.cameras.main.setBackgroundColor('#0b0d18');

        if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
        this.keys = this.input.keyboard.addKeys(
            'W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE,ENTER,R'
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
            0x11182a
        ).setStrokeStyle(2, 0x52657b);

        this.add.line(0, 0, 145, 68, 495, 68, 0x52657b).setOrigin(0);
        this.add.circle(width / 2, 68, 23, 0x000000, 0)
            .setStrokeStyle(2, 0xd7e1ff, 0.6);
        this.beatCue = this.add.circle(width / 2, 68, 11, 0x52657b, 0.9);

        this.player = this.add.rectangle(
            width / 2,
            (TUNING.arenaTop + this.arenaBottom) / 2,
            TUNING.playerSize,
            TUNING.playerSize,
            0x72f5cf
        ) as Player;
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);

        this.gates = this.physics.add.staticGroup();
        this.goals = this.physics.add.staticGroup();
        this.physics.add.collider(this.player, this.gates);
        this.physics.add.overlap(this.player, this.goals, () => {
            if (!reachGoal(this.attempt)) return;
            this.player.body.stop();
            this.updateStatus();
        });

        this.status = this.add.text(16, 10, '', {
            fontFamily: 'monospace', fontSize: 13, color: '#ffffff',
            backgroundColor: '#0b0d18', padding: { x: 5, y: 3 }
        }).setDepth(20);
        this.message = this.add.text(width / 2, height * 0.63, '', {
            fontFamily: 'monospace', fontSize: 17, color: '#ffffff', align: 'center',
            backgroundColor: '#0b0d18', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setDepth(20);
        this.feedback = this.add.text(width / 2, 102, '', {
            fontFamily: 'monospace', fontSize: 15, color: '#ffffff',
            backgroundColor: '#0b0d18', padding: { x: 5, y: 2 }
        }).setOrigin(0.5).setDepth(20);
        this.add.text(
            width / 2,
            height - 13,
            'WASD / ARROWS MOVE · SPACE TAP · ENTER NEXT · R RETRY · ESC HUB',
            {
                fontFamily: 'monospace', fontSize: 11, color: '#aebbd5',
                backgroundColor: '#0b0d18', padding: { x: 4, y: 2 }
            }
        ).setOrigin(0.5).setDepth(20);

        this.buildStage();
    }

    private buildStage() {
        this.gates.clear(true, true);
        this.goals.clear(true, true);
        for (const marker of this.switches) marker.destroy();
        for (const label of this.switchLabels) label.destroy();
        for (const marker of this.beatMarkers) marker.destroy();
        this.switches = [];
        this.switchLabels = [];
        this.beatMarkers = [];
        this.feedback.setText('');

        const centerY = (TUNING.arenaTop + this.arenaBottom) / 2;
        this.player.body.setVelocity(0, 0);

        if (this.attempt.stage === 1) {
            this.player.body.reset(62, centerY);
            for (const x of [220, 320, 420]) {
                const gate = this.add.rectangle(
                    x,
                    centerY,
                    TUNING.gateWidth,
                    this.arenaBottom - TUNING.arenaTop - 28,
                    0xffc766,
                    0.72
                ).setStrokeStyle(1, 0xffffff) as Gate;
                this.gates.add(gate);
            }
            this.goals.add(this.add.rectangle(
                572,
                centerY,
                34,
                70,
                0x72f5cf,
                0.16
            ).setStrokeStyle(2, 0x72f5cf));
            this.applyDoorState();
        } else if (this.attempt.stage === 2) {
            const positions = [
                { x: 180, y: 145 },
                { x: 240, y: 145 },
                { x: 300, y: 145 },
                { x: 360, y: 145 },
                { x: 420, y: 145 },
                { x: 420, y: 215 },
                { x: 340, y: 215 },
                { x: 260, y: 215 }
            ];
            this.player.body.reset(145, 145);
            positions.forEach((position, switchIndex) => {
                const marker = this.add.circle(
                    position.x,
                    position.y,
                    TUNING.switchRadius,
                    0x2f415f,
                    0.9
                ).setStrokeStyle(2, 0xb7c8e8) as SwitchMarker;
                marker.switchIndex = switchIndex;
                this.switches.push(marker);
                this.switchLabels.push(this.add.text(position.x, position.y, String(switchIndex + 1), {
                    fontFamily: 'monospace', fontSize: 11, color: '#ffffff'
                }).setOrigin(0.5).setDepth(5));
            });
            this.refreshSwitches();
        } else if (this.attempt.stage === 3) {
            const positions = [
                { x: 288, y: 160 },
                { x: 352, y: 160 },
                { x: 352, y: 224 },
                { x: 288, y: 224 }
            ];
            this.player.body.reset(288, 160);
            positions.forEach((position, markerIndex) => {
                const marker = this.add.circle(
                    position.x,
                    position.y,
                    15,
                    0x2f415f,
                    0.9
                ).setStrokeStyle(2, 0xb7c8e8) as BeatMarker;
                marker.markerIndex = markerIndex;
                this.beatMarkers.push(marker);
            });
            this.refreshBeatMarkers();
        } else {
            this.player.body.reset(this.scale.width / 2, centerY);
        }

        this.updateStatus();
    }

    private applyDoorState() {
        const open = this.attempt.doorsOpen;
        for (const child of this.gates.getChildren() as Gate[]) {
            child.setVisible(!open);
            child.body.enable = !open;
        }
    }

    private refreshSwitches() {
        for (const marker of this.switches) {
            const active = this.attempt.activatedSwitches.includes(marker.switchIndex);
            const next = marker.switchIndex === this.attempt.activatedSwitches.length;
            marker.setFillStyle(active ? 0x72f5cf : next ? 0xffc766 : 0x2f415f, 0.9);
        }
    }

    private refreshBeatMarkers() {
        if (this.beatMarkers.length === 0) return;
        const expected = this.attempt.streak % this.beatMarkers.length;
        this.beatMarkers.forEach((marker, index) => {
            marker.setFillStyle(index === expected ? 0xffc766 : 0x2f415f, 0.9);
        });
    }

    private nearbySwitch(): SwitchMarker | undefined {
        const expected = this.attempt.activatedSwitches.length;
        const marker = this.switches[expected];
        if (!marker) return undefined;
        return Math.hypot(this.player.x - marker.x, this.player.y - marker.y) <= TUNING.switchRange
            ? marker : undefined;
    }

    private nearbyBeatMarker(): BeatMarker | undefined {
        if (this.beatMarkers.length === 0) return undefined;
        const marker = this.beatMarkers[this.attempt.streak % this.beatMarkers.length];
        return Math.hypot(this.player.x - marker.x, this.player.y - marker.y) <= TUNING.finalMarkerRange
            ? marker : undefined;
    }

    private handleTap(now: number) {
        const targetIndex = this.attempt.stage === 2
            ? this.nearbySwitch()?.switchIndex ?? null
            : this.attempt.stage === 3
                ? this.nearbyBeatMarker()?.markerIndex ?? null
                : null;
        const result = tapBeat(this.attempt, now, targetIndex);
        if (result.kind === 'ignored') return;

        this.feedback.setText(result.kind === 'good' ? 'GOOD' : 'MISS');
        if (this.attempt.stage === 1) this.applyDoorState();
        if (this.attempt.stage === 2) this.refreshSwitches();
        if (this.attempt.stage === 3) this.refreshBeatMarkers();

        if (this.attempt.phase === 'cleared') {
            markDungeonCleared(this.session, 'SubwayTiming');
        }
        this.updateStatus();
    }

    private updateStatus() {
        const stage = STAGES[this.attempt.stage];
        const progress = this.attempt.stage === 2
            ? `CHAIN ${this.attempt.activatedSwitches.length}/${stage.switchCount}`
            : `STREAK ${this.attempt.streak}/${stage.streakTarget}`;
        const extras = this.attempt.stage === 1
            ? ` · DOORS ${this.attempt.doorsOpen ? 'OPEN' : 'CLOSED'}`
            : this.attempt.stage === 3
                ? ` · FIELD ${(this.attempt.streak % stage.markerCount) + 1}/${stage.markerCount}`
                : '';
        this.status.setText(
            `SUBWAY TIMING · ${this.attempt.stage}/3 ${stage.name} · ${progress} · `
            + `MISSES ${this.attempt.misses}/${MISS_LIMIT}${extras}`
        );

        this.message.setText(this.attempt.phase === 'cleared' ? 'SUBWAY CLEARED!\nESC — HUB'
            : this.attempt.phase === 'lost' ? 'TIMING LOST\nR — RETRY STAGE · ESC — HUB'
            : this.attempt.phase === 'stage-cleared' ? 'STAGE CLEARED\nENTER — NEXT STAGE'
            : this.attempt.stage === 1 ? '5 CLEAN BEATS OPEN THE GATES'
            : this.attempt.stage === 2 ? 'STAND ON 1 → 8 · HIT EACH ONE ON BEAT'
            : this.attempt.stage === 3 ? 'STAND ON THE LIT FIELD · SPACE ON BEAT'
            : 'SPACE ON THE BEAT · 3 IN A ROW');
        this.message.setVisible(this.attempt.phase !== 'playing' || this.attempt.streak === 0);

        if (this.attempt.phase !== 'playing') this.player.body.stop();
    }

    private updateBeatCue(now: number) {
        const countdown = beatCountdownMs(this.attempt, now);
        const progress = 1 - Math.min(countdown / BEAT_INTERVAL_MS, 1);
        this.beatCue.setScale(2 - progress * 1.35);
        this.beatCue.setFillStyle(
            beatDistanceMs(this.attempt, now) <= TUNING.beatFlashMs ? 0x72f5cf : 0x52657b,
            0.9
        );
    }

    update() {
        if (this.attempt.phase === 'leaving') return;
        const now = this.time.now;
        this.updateBeatCue(now);

        if (Input.Keyboard.JustDown(this.keys.R) && retryStage(this.attempt, now)) {
            this.buildStage();
            return;
        }
        if (Input.Keyboard.JustDown(this.keys.ENTER) && advanceStage(this.attempt, now)) {
            this.buildStage();
            return;
        }
        if (this.attempt.phase !== 'playing') return;

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

        if (Input.Keyboard.JustDown(this.keys.SPACE)) this.handleTap(now);
    }
}
