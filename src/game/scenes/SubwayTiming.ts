import { GameObjects, Input, Physics, Scene } from 'phaser';
import {
    BEAT_INTERVAL_MS, GOOD_WINDOW_MS, MISS_LIMIT, STAGES,
    activateSwitch, advanceStage, beatDistanceMs, createAttempt, leaveAttempt,
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
    switchRange: 38
};

type Player = GameObjects.Rectangle & { body: Physics.Arcade.Body };
type Gate = GameObjects.Rectangle & { body: Physics.Arcade.StaticBody };
type SwitchMarker = GameObjects.Arc & { switchIndex: number };

export class SubwayTiming extends Scene {
    private readonly session: Session;
    private attempt!: Attempt;
    private player!: Player;
    private gates!: Physics.Arcade.StaticGroup;
    private goals!: Physics.Arcade.StaticGroup;
    private switches: SwitchMarker[] = [];
    private switchLabels: GameObjects.Text[] = [];
    private beatMarkers: GameObjects.Arc[] = [];
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
            this.player.body.reset(80, centerY);
            const positions = [
                { x: 145, y: 140 },
                { x: 265, y: 140 },
                { x: 385, y: 140 },
                { x: 505, y: 140 },
                { x: 505, y: 255 },
                { x: 325, y: 255 }
            ];
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
            this.player.body.reset(this.scale.width / 2, centerY);
            for (let index = 0; index < STAGES[3].markerCount; index++) {
                const x = this.scale.width / 2 + (index - 1.5) * 58;
                this.beatMarkers.push(this.add.circle(x, 178, 13, 0x2f415f, 0.9)
                    .setStrokeStyle(2, 0xb7c8e8));
            }
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

    private nearbySwitch(): SwitchMarker | undefined {
        let nearest: SwitchMarker | undefined;
        let nearestDistance = Infinity;
        for (const marker of this.switches) {
            if (this.attempt.activatedSwitches.includes(marker.switchIndex)) continue;
            const distance = Math.hypot(this.player.x - marker.x, this.player.y - marker.y);
            if (distance <= TUNING.switchRange && distance < nearestDistance) {
                nearest = marker;
                nearestDistance = distance;
            }
        }
        return nearest;
    }

    private handleTap(now: number) {
        const result = tapBeat(this.attempt, now);
        if (result.kind === 'ignored') return;

        if (result.kind === 'good') {
            this.feedback.setText('GOOD');
            if (this.attempt.stage === 2) {
                const marker = this.nearbySwitch();
                if (marker && activateSwitch(this.attempt, marker.switchIndex, result.beatIndex)) {
                    this.refreshSwitches();
                }
            }
        } else {
            this.feedback.setText('MISS');
        }

        if (this.attempt.stage === 1) this.applyDoorState();
        if (this.attempt.phase === 'cleared') {
            markDungeonCleared(this.session, 'SubwayTiming');
        }
        this.updateStatus();
    }

    private updateStatus() {
        const stage = STAGES[this.attempt.stage];
        const extras = this.attempt.stage === 1
            ? ` · DOORS ${this.attempt.doorsOpen ? 'OPEN' : 'CLOSED'}`
            : this.attempt.stage === 2
                ? ` · SWITCHES ${this.attempt.activatedSwitches.length}/${stage.switchCount}`
                : '';
        this.status.setText(
            `SUBWAY TIMING · ${this.attempt.stage}/3 ${stage.name} · `
            + `STREAK ${this.attempt.streak}/${stage.streakTarget} · MISSES ${this.attempt.misses}/${MISS_LIMIT}`
            + extras
        );

        this.message.setText(this.attempt.phase === 'cleared' ? 'SUBWAY CLEARED!\nESC — HUB'
            : this.attempt.phase === 'lost' ? 'TIMING LOST\nR — RETRY STAGE · ESC — HUB'
            : this.attempt.phase === 'stage-cleared' ? 'STAGE CLEARED\nENTER — NEXT STAGE'
            : this.attempt.stage === 1 ? 'BUILD 5 STREAK · CROSS THE GATES'
            : this.attempt.stage === 2 ? 'HIT THE NUMBERED SWITCHES ON BEAT'
            : this.attempt.stage === 3 ? 'FINAL STREAK · 12 CLEAN BEATS'
            : 'SPACE ON THE BEAT · 3 IN A ROW');
        this.message.setVisible(this.attempt.phase !== 'playing' || this.attempt.streak === 0);

        if (this.attempt.phase !== 'playing') this.player.body.stop();
    }

    private updateBeatCue(now: number) {
        const distance = beatDistanceMs(this.attempt, now);
        const closeness = 1 - Math.min(distance / (BEAT_INTERVAL_MS / 2), 1);
        this.beatCue.setScale(0.7 + closeness * 0.75);
        this.beatCue.setFillStyle(distance <= GOOD_WINDOW_MS ? 0x72f5cf : 0x52657b, 0.9);

        if (this.attempt.stage === 3 && this.beatMarkers.length > 0) {
            const beatIndex = Math.max(0,
                Math.round((now - this.attempt.beatOriginAt) / BEAT_INTERVAL_MS));
            const activeIndex = beatIndex % this.beatMarkers.length;
            this.beatMarkers.forEach((marker, index) => {
                marker.setFillStyle(index === activeIndex ? 0xffc766 : 0x2f415f, 0.9);
            });
        }
    }

    update(now: number) {
        if (this.attempt.phase === 'leaving') return;
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
