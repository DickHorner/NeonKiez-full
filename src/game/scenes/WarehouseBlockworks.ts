import { GameObjects, Input, Physics, Scene } from 'phaser';
import {
    STAGES, activateSwitch, advanceStage, bumpCrate, createAttempt, leaveAttempt,
    reachGoal, type Attempt
} from '../warehouse-blockworks/attempt';
import { markDungeonCleared, type Session } from '../session';

const TUNING = {
    playerSpeed: 165,
    playerSize: 18,
    arenaInset: 22,
    arenaTop: 54,
    arenaBottomInset: 38,
    switchRange: 42,
    crateSize: 30
};

type Player = GameObjects.Rectangle & { body: Physics.Arcade.Body };
type Gate = GameObjects.Rectangle & { body: Physics.Arcade.StaticBody };
type SwitchMarker = GameObjects.Rectangle & { switchId: string };
type MovingCrate = GameObjects.Rectangle & { body: Physics.Arcade.Body };

export class WarehouseBlockworks extends Scene {
    private readonly session: Session;
    private attempt!: Attempt;
    private player!: Player;
    private gates!: Physics.Arcade.StaticGroup;
    private goals!: Physics.Arcade.StaticGroup;
    private crates!: Physics.Arcade.Group;
    private switchMarkers: SwitchMarker[] = [];
    private status!: GameObjects.Text;
    private message!: GameObjects.Text;
    private keys!: Record<
        'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT' | 'E' | 'ENTER',
        Input.Keyboard.Key
    >;
    private arenaBottom = 0;

    constructor(session: Session) {
        super('WarehouseBlockworks');
        this.session = session;
    }

    create() {
        this.attempt = createAttempt();
        this.physics.world.drawDebug = false;
        this.physics.world.debugGraphic?.clear();
        this.cameras.main.setBackgroundColor('#15120e');

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
            0x252119
        ).setStrokeStyle(2, 0x766d5d);

        this.player = this.add.rectangle(
            58,
            (TUNING.arenaTop + this.arenaBottom) / 2,
            TUNING.playerSize,
            TUNING.playerSize,
            0x72f5cf
        ).setDepth(10) as Player;
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);

        this.gates = this.physics.add.staticGroup();
        this.goals = this.physics.add.staticGroup();
        this.crates = this.physics.add.group();

        this.physics.add.collider(this.player, this.gates);
        this.physics.add.overlap(this.player, this.goals, () => this.handleGoal());
        this.physics.add.overlap(this.player, this.crates, (_player, object) => {
            const crate = object as MovingCrate;
            if (!crate.active) return;
            this.handleCrateBump(crate);
        });

        this.status = this.add.text(16, 10, '', {
            fontFamily: 'monospace', fontSize: 13, color: '#ffffff',
            backgroundColor: '#15120e', padding: { x: 5, y: 3 }
        }).setDepth(20);
        this.message = this.add.text(width / 2, height * 0.67, '', {
            fontFamily: 'monospace', fontSize: 17, color: '#ffffff', align: 'center',
            backgroundColor: '#15120e', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setDepth(20);
        this.add.text(
            width / 2,
            height - 13,
            'WASD / ARROWS MOVE · E SWITCH · ENTER NEXT · ESC HUB',
            {
                fontFamily: 'monospace', fontSize: 11, color: '#c1b7a5',
                backgroundColor: '#15120e', padding: { x: 4, y: 2 }
            }
        ).setOrigin(0.5).setDepth(20);

        this.buildStage();
    }

    private addConveyor(x: number, y: number, width: number) {
        this.add.rectangle(x, y, width, 54, 0x373229).setStrokeStyle(2, 0x817766);
        for (let offset = -width / 2 + 16; offset < width / 2; offset += 28) {
            this.add.rectangle(x + offset, y, 10, 46, 0x5c5447, 0.8);
        }
    }

    private addGate(x: number, y: number, width: number, height: number) {
        this.gates.add(this.add.rectangle(x, y, width, height, 0xe4a74f, 0.88)
            .setStrokeStyle(2, 0xffffff) as Gate);
    }

    private addGoal(x: number, y: number) {
        this.goals.add(this.add.rectangle(x, y, 30, 46, 0x72f5cf, 0.18)
            .setStrokeStyle(2, 0x72f5cf));
    }

    private addSwitch(switchId: string, x: number, y: number) {
        const marker = this.add.rectangle(x, y, 26, 20, 0x669cff)
            .setStrokeStyle(2, 0xffffff)
            .setDepth(10) as SwitchMarker;
        marker.switchId = switchId;
        this.switchMarkers.push(marker);
    }

    private addStaticCrate(x: number, y: number) {
        this.add.rectangle(x, y, TUNING.crateSize, TUNING.crateSize, 0x926d43)
            .setStrokeStyle(2, 0xd6b17c);
    }

    private addMovingCrate(x: number, y: number, vx: number, vy: number) {
        const crate = this.add.rectangle(
            x, y, TUNING.crateSize, TUNING.crateSize, 0xb77a44
        ).setStrokeStyle(2, 0xf4c987) as MovingCrate;
        this.crates.add(crate);
        crate.body
            .setAllowGravity(false)
            .setCollideWorldBounds(true)
            .setBounce(1, 1)
            .setVelocity(vx, vy);
    }

    private buildStage() {
        this.physics.resume();
        this.gates.clear(true, true);
        this.goals.clear(true, true);
        this.crates.clear(true, true);
        for (const marker of this.switchMarkers) marker.destroy();
        this.switchMarkers = [];

        const centerY = (TUNING.arenaTop + this.arenaBottom) / 2;
        this.player.body.setVelocity(0, 0);
        this.player.setAlpha(1);

        if (this.attempt.stage === 0) {
            this.player.body.reset(58, centerY);
            this.addConveyor(240, centerY, 260);
            this.addStaticCrate(230, centerY);
            this.addSwitch('intro-switch', 145, centerY - 72);
            this.addGate(390, centerY, 28, this.arenaBottom - TUNING.arenaTop);
            this.addGoal(578, centerY);
        } else if (this.attempt.stage === 1) {
            this.player.body.reset(58, centerY);
            this.addStaticCrate(230, centerY - 56);
            this.addStaticCrate(230, centerY + 56);
            this.addStaticCrate(310, centerY - 56);
            this.addStaticCrate(310, centerY + 56);
            this.addSwitch('row-a', 145, centerY - 72);
            this.addSwitch('row-b', 145, centerY + 72);
            this.addGate(390, centerY, 28, this.arenaBottom - TUNING.arenaTop);
            this.addGoal(578, centerY);
        } else if (this.attempt.stage === 2) {
            this.player.body.reset(58, centerY);
            this.addMovingCrate(190, 110, 78, 48);
            this.addMovingCrate(345, 185, -66, 58);
            this.addMovingCrate(475, 255, 54, -82);
            this.addGoal(584, centerY);
        } else {
            this.player.body.reset(58, centerY);
            this.addStaticCrate(225, centerY - 52);
            this.addStaticCrate(225, centerY);
            this.addStaticCrate(225, centerY + 52);
            this.addSwitch('final-switch', 305, centerY);
            this.addGate(405, centerY, 30, this.arenaBottom - TUNING.arenaTop);
            this.addGoal(578, centerY);
        }

        this.applyGateState();
        this.refreshSwitches();
        this.updateStatus();
    }

    private applyGateState() {
        for (const gate of this.gates.getChildren() as Gate[]) {
            gate.setVisible(!this.attempt.gatesOpen);
            gate.body.enable = !this.attempt.gatesOpen;
        }
    }

    private refreshSwitches() {
        for (const marker of this.switchMarkers) {
            const active = this.attempt.activatedSwitchIds.includes(marker.switchId);
            marker.setFillStyle(active ? 0x72f5cf : 0x669cff);
        }
    }

    private nearestSwitch(): SwitchMarker | undefined {
        let nearest: SwitchMarker | undefined;
        let nearestDistance = Infinity;
        for (const marker of this.switchMarkers) {
            if (this.attempt.activatedSwitchIds.includes(marker.switchId)) continue;
            const distance = Math.hypot(this.player.x - marker.x, this.player.y - marker.y);
            if (distance <= TUNING.switchRange && distance < nearestDistance) {
                nearest = marker;
                nearestDistance = distance;
            }
        }
        return nearest;
    }

    private useSwitch() {
        const marker = this.nearestSwitch();
        if (!marker || !activateSwitch(this.attempt, marker.switchId)) return;
        this.refreshSwitches();
        this.applyGateState();
        this.updateStatus();
    }

    private handleCrateBump(crate: MovingCrate) {
        const now = this.time.now;
        if (!bumpCrate(this.attempt, now)) return;

        const dx = this.player.x - crate.x;
        const dy = this.player.y - crate.y;
        const length = Math.hypot(dx, dy) || 1;
        this.player.body.setVelocity(dx / length * 225, dy / length * 225);
        this.player.setAlpha(0.55);
    }

    private handleGoal() {
        if (!reachGoal(this.attempt)) {
            this.updateStatus();
            return;
        }

        this.player.body.stop();
        if (this.attempt.phase === 'cleared') {
            markDungeonCleared(this.session, 'WarehouseBlockworks');
        }
        this.updateStatus();
    }

    private updateStatus() {
        const stage = STAGES[this.attempt.stage];
        const progress = stage.switchesRequired > 0
            ? ` · SWITCHES ${this.attempt.activatedSwitchIds.length}/${stage.switchesRequired}`
            : ' · MOVING CRATES';

        this.status.setText(
            `WAREHOUSE BLOCKWORKS · ${this.attempt.stage}/3 ${stage.name}${progress}`
        );

        const nearSwitch = this.nearestSwitch();
        this.message.setText(this.attempt.phase === 'cleared'
            ? 'WAREHOUSE CLEARED!\nESC — HUB'
            : this.attempt.phase === 'stage-cleared'
                ? 'STAGE CLEARED\nENTER — NEXT STAGE'
                : nearSwitch
                    ? 'E — ACTIVATE SWITCH'
                    : this.attempt.stage === 1 && !this.attempt.gatesOpen
                        ? 'ACTIVATE BOTH SWITCHES'
                        : this.attempt.stage === 2
                            ? 'REACH THE EXIT · CRATES ONLY BUMP'
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
        if (this.attempt.stage !== 2) this.updateStatus();
    }
}
