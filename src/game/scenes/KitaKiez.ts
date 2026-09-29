import { GameObjects, Input, Physics, Scene } from 'phaser';
import {
    STAGES, advanceStage, childArrives, createAttempt, giveLollipop, leaveAttempt,
    makeChildCry, retryStage, tickAttempt, type Attempt
} from '../kita-kiez/attempt';
import { markDungeonCleared, type Session } from '../session';

const TUNING = {
    playerSpeed: 175,
    playerSize: 18,
    childSpeed: 82,
    childSize: 14,
    childReleaseIntervalMs: 900,
    arenaInset: 22,
    arenaTop: 54,
    arenaBottomInset: 38,
    interactionRange: 42,
    turnRadius: 13,
    rescueNudge: 26
};

type Direction = 'up' | 'right' | 'down' | 'left';

type Point = { x: number; y: number };
type TurnSpec = Point & { direction: Direction };
type SignSpec = Point & { directions: readonly Direction[]; initialIndex: number };
type HazardSpec = Point & { width: number; height: number };
type GoalSpec = Point & { width: number; height: number };

type StageLayout = {
    playerStart: Point;
    childStart: Point;
    childDirection: Direction;
    signs: readonly SignSpec[];
    turns: readonly TurnSpec[];
    hazards: readonly HazardSpec[];
    goal: GoalSpec;
};

const LAYOUTS: readonly StageLayout[] = [
    {
        playerStart: { x: 96, y: 266 },
        childStart: { x: 58, y: 190 },
        childDirection: 'right',
        signs: [{ x: 190, y: 190, directions: ['right', 'up'], initialIndex: 0 }],
        turns: [
            { x: 190, y: 90, direction: 'right' },
            { x: 470, y: 90, direction: 'down' },
            { x: 470, y: 190, direction: 'right' }
        ],
        hazards: [{ x: 330, y: 190, width: 70, height: 72 }],
        goal: { x: 584, y: 190, width: 36, height: 70 }
    },
    {
        playerStart: { x: 100, y: 212 },
        childStart: { x: 58, y: 110 },
        childDirection: 'right',
        signs: [
            { x: 180, y: 110, directions: ['right', 'down'], initialIndex: 0 },
            { x: 430, y: 260, directions: ['right', 'up'], initialIndex: 0 }
        ],
        turns: [
            { x: 180, y: 260, direction: 'right' },
            { x: 430, y: 110, direction: 'right' }
        ],
        hazards: [
            { x: 310, y: 110, width: 72, height: 64 },
            { x: 535, y: 260, width: 58, height: 54 }
        ],
        goal: { x: 584, y: 110, width: 36, height: 70 }
    },
    {
        playerStart: { x: 100, y: 260 },
        childStart: { x: 58, y: 185 },
        childDirection: 'right',
        signs: [
            { x: 170, y: 185, directions: ['right', 'up'], initialIndex: 0 },
            { x: 360, y: 82, directions: ['right', 'down'], initialIndex: 0 },
            { x: 360, y: 270, directions: ['down', 'right'], initialIndex: 0 }
        ],
        turns: [
            { x: 170, y: 82, direction: 'right' },
            { x: 500, y: 270, direction: 'up' },
            { x: 500, y: 185, direction: 'right' }
        ],
        hazards: [
            { x: 290, y: 185, width: 64, height: 58 },
            { x: 520, y: 82, width: 58, height: 48 },
            { x: 360, y: 306, width: 58, height: 28 }
        ],
        goal: { x: 584, y: 185, width: 36, height: 70 }
    },
    {
        playerStart: { x: 92, y: 192 },
        childStart: { x: 58, y: 260 },
        childDirection: 'right',
        signs: [
            { x: 160, y: 260, directions: ['right', 'up'], initialIndex: 0 },
            { x: 330, y: 90, directions: ['right', 'down'], initialIndex: 0 },
            { x: 330, y: 190, directions: ['down', 'right'], initialIndex: 0 }
        ],
        turns: [{ x: 160, y: 90, direction: 'right' }],
        hazards: [
            { x: 295, y: 260, width: 66, height: 54 },
            { x: 515, y: 90, width: 62, height: 46 },
            { x: 330, y: 300, width: 58, height: 32 }
        ],
        goal: { x: 584, y: 190, width: 36, height: 70 }
    }
];

const DIRECTION_VECTORS: Record<Direction, Point> = {
    up: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }
};

const DIRECTION_GLYPHS: Record<Direction, string> = {
    up: '↑',
    right: '→',
    down: '↓',
    left: '←'
};

type Player = GameObjects.Rectangle & { body: Physics.Arcade.Body };
type RoutedChild = GameObjects.Rectangle & {
    body: Physics.Arcade.Body;
    childIndex: number;
    direction: Direction;
    releaseAt: number;
    released: boolean;
};

type RouteSign = {
    spec: SignSpec;
    directionIndex: number;
    label: GameObjects.Text;
};

export class KitaKiez extends Scene {
    private readonly session: Session;
    private attempt!: Attempt;
    private player!: Player;
    private children: RoutedChild[] = [];
    private signs: RouteSign[] = [];
    private stageObjects: GameObjects.GameObject[] = [];
    private pickupCars: GameObjects.Rectangle[] = [];
    private status!: GameObjects.Text;
    private message!: GameObjects.Text;
    private keys!: Record<
        'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT' | 'E' | 'ENTER' | 'R',
        Input.Keyboard.Key
    >;
    private arenaBottom = 0;

    constructor(session: Session) {
        super('KitaKiez');
        this.session = session;
    }

    create() {
        this.attempt = createAttempt();
        this.physics.world.drawDebug = false;
        this.physics.world.debugGraphic?.clear();
        this.cameras.main.setBackgroundColor('#151625');

        if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
        this.keys = this.input.keyboard.addKeys(
            'W,A,S,D,UP,LEFT,DOWN,RIGHT,E,ENTER,R'
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
            0x22253a
        ).setStrokeStyle(2, 0x72799b);

        this.player = this.add.rectangle(
            90, 190,
            TUNING.playerSize,
            TUNING.playerSize,
            0x72f5cf
        ).setDepth(10) as Player;
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);

        this.status = this.add.text(16, 10, '', {
            fontFamily: 'monospace', fontSize: 13, color: '#ffffff',
            backgroundColor: '#151625', padding: { x: 5, y: 3 }
        }).setDepth(20);
        this.message = this.add.text(width / 2, height * 0.67, '', {
            fontFamily: 'monospace', fontSize: 17, color: '#ffffff', align: 'center',
            backgroundColor: '#151625', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setDepth(20);
        this.add.text(
            width / 2,
            height - 13,
            'WASD / ARROWS MOVE · E INTERACT · ENTER NEXT · R RETRY · ESC HUB',
            {
                fontFamily: 'monospace', fontSize: 11, color: '#b7bbd2',
                backgroundColor: '#151625', padding: { x: 4, y: 2 }
            }
        ).setOrigin(0.5).setDepth(20);

        this.buildStage();
    }

    private track<T extends GameObjects.GameObject>(object: T): T {
        this.stageObjects.push(object);
        return object;
    }

    private currentLayout(): StageLayout {
        const layout = LAYOUTS[this.attempt.stage];
        if (!layout) throw new Error(`Kita-Kiez layout missing for stage ${this.attempt.stage}`);
        return layout;
    }

    private addSign(spec: SignSpec) {
        this.track(this.add.rectangle(
            spec.x, spec.y, 28, 28, 0xffcf5a, 0.9
        ).setStrokeStyle(2, 0xffffff).setDepth(5));
        const label = this.track(this.add.text(spec.x, spec.y, '', {
            fontFamily: 'monospace', fontSize: 20, color: '#202030'
        }).setOrigin(0.5).setDepth(6));
        const sign = { spec, directionIndex: spec.initialIndex, label };
        this.signs.push(sign);
        this.renderSign(sign);
    }

    private renderSign(sign: RouteSign) {
        sign.label.setText(DIRECTION_GLYPHS[sign.spec.directions[sign.directionIndex]]);
    }

    private addFixedTurn(turn: TurnSpec) {
        this.track(this.add.text(turn.x, turn.y, DIRECTION_GLYPHS[turn.direction], {
            fontFamily: 'monospace', fontSize: 15, color: '#7f88aa',
            backgroundColor: '#22253a', padding: { x: 2, y: 1 }
        }).setOrigin(0.5).setDepth(4));
    }

    private addHazard(hazard: HazardSpec) {
        this.track(this.add.rectangle(
            hazard.x, hazard.y, hazard.width, hazard.height, 0x4c87c7, 0.5
        ).setStrokeStyle(2, 0x83c7ff, 0.9).setDepth(2));
    }

    private addGoal(goal: GoalSpec) {
        this.track(this.add.rectangle(
            goal.x, goal.y, goal.width, goal.height, 0x72f5cf, 0.16
        ).setStrokeStyle(2, 0x72f5cf).setDepth(2));
        this.track(this.add.text(goal.x, goal.y - goal.height / 2 - 9, 'PICKUP', {
            fontFamily: 'monospace', fontSize: 10, color: '#72f5cf'
        }).setOrigin(0.5).setDepth(4));
    }

    private addPickupCars(goal: GoalSpec) {
        this.pickupCars = [0, 1, 2].map(index => this.track(this.add.rectangle(
            goal.x + 12,
            74 + index * 105,
            32,
            18,
            index === 1 ? 0xff6d8f : 0xffc766,
            0.9
        ).setStrokeStyle(1, 0xffffff).setDepth(3).setVisible(false)));
    }

    private spawnChildren(layout: StageLayout) {
        this.children = this.attempt.childStates.map((_state, childIndex) => {
            const child = this.add.rectangle(
                layout.childStart.x,
                layout.childStart.y,
                TUNING.childSize,
                TUNING.childSize,
                0xffd66b
            ).setStrokeStyle(1, 0xffffff).setDepth(7) as RoutedChild;
            this.physics.add.existing(child);
            child.body.setAllowGravity(false);
            child.childIndex = childIndex;
            child.direction = layout.childDirection;
            child.releaseAt = this.time.now + 1100 + childIndex * TUNING.childReleaseIntervalMs;
            child.released = false;
            child.body.stop();
            return child;
        });
    }

    private buildStage() {
        this.physics.resume();
        for (const child of this.children) child.destroy();
        this.children = [];
        for (const object of this.stageObjects) object.destroy();
        this.stageObjects = [];
        this.signs = [];
        this.pickupCars = [];

        const layout = this.currentLayout();
        this.player.body.reset(layout.playerStart.x, layout.playerStart.y);
        this.player.body.setVelocity(0, 0);

        layout.hazards.forEach(hazard => this.addHazard(hazard));
        layout.turns.forEach(turn => this.addFixedTurn(turn));
        layout.signs.forEach(sign => this.addSign(sign));
        this.addGoal(layout.goal);
        this.addPickupCars(layout.goal);
        this.spawnChildren(layout);
        this.updatePickupCars();
        this.updateStatus();
    }

    private setChildDirection(child: RoutedChild, direction: Direction) {
        child.direction = direction;
        const vector = DIRECTION_VECTORS[direction];
        child.body.setVelocity(vector.x * TUNING.childSpeed, vector.y * TUNING.childSpeed);
    }

    private reverseDirection(direction: Direction): Direction {
        if (direction === 'up') return 'down';
        if (direction === 'down') return 'up';
        if (direction === 'left') return 'right';
        return 'left';
    }

    private nearPoint(child: RoutedChild, point: Point): boolean {
        return Math.hypot(child.x - point.x, child.y - point.y) <= TUNING.turnRadius;
    }

    private insideRect(x: number, y: number, rect: GoalSpec | HazardSpec): boolean {
        return Math.abs(x - rect.x) <= rect.width / 2
            && Math.abs(y - rect.y) <= rect.height / 2;
    }

    private routeChild(child: RoutedChild, layout: StageLayout) {
        if (this.attempt.phase !== 'playing'
            || this.attempt.childStates[child.childIndex] !== 'walking') return;
        if (!child.released) {
            if (this.time.now < child.releaseAt) return;
            child.released = true;
            this.setChildDirection(child, layout.childDirection);
        }

        for (const sign of this.signs) {
            if (this.nearPoint(child, sign.spec)) {
                this.setChildDirection(child, sign.spec.directions[sign.directionIndex]);
                break;
            }
        }
        for (const turn of layout.turns) {
            if (this.nearPoint(child, turn)) {
                this.setChildDirection(child, turn.direction);
                break;
            }
        }

        const hitHazard = layout.hazards.some(hazard => this.insideRect(child.x, child.y, hazard));
        const outOfRoute = child.x < TUNING.arenaInset + 4
            || child.x > this.scale.width - TUNING.arenaInset - 4
            || child.y < TUNING.arenaTop + 4
            || child.y > this.arenaBottom - 4;
        if ((hitHazard || outOfRoute) && makeChildCry(this.attempt, child.childIndex)) {
            child.body.stop();
            child.setFillStyle(0xff6d8f);
            this.updateStatus();
            return;
        }

        if (!this.insideRect(child.x, child.y, layout.goal)) return;
        if (!childArrives(this.attempt, child.childIndex)) return;
        child.body.stop();
        child.body.enable = false;
        child.setActive(false).setVisible(false);
        if (this.attempt.phase === 'cleared') {
            markDungeonCleared(this.session, 'KitaKiez');
        }
        this.updateStatus();
    }

    private nearestCryingChild(): RoutedChild | undefined {
        let nearest: RoutedChild | undefined;
        let nearestDistance = Infinity;
        for (const child of this.children) {
            if (this.attempt.childStates[child.childIndex] !== 'crying') continue;
            const distance = Math.hypot(this.player.x - child.x, this.player.y - child.y);
            if (distance <= TUNING.interactionRange && distance < nearestDistance) {
                nearest = child;
                nearestDistance = distance;
            }
        }
        return nearest;
    }

    private nearestSign(): RouteSign | undefined {
        let nearest: RouteSign | undefined;
        let nearestDistance = Infinity;
        for (const sign of this.signs) {
            const distance = Math.hypot(this.player.x - sign.spec.x, this.player.y - sign.spec.y);
            if (distance <= TUNING.interactionRange && distance < nearestDistance) {
                nearest = sign;
                nearestDistance = distance;
            }
        }
        return nearest;
    }

    private showHeart(child: RoutedChild) {
        const heart = this.add.text(child.x, child.y - 18, '♥', {
            fontFamily: 'monospace', fontSize: 16, color: '#ff7aa8'
        }).setOrigin(0.5).setDepth(15);
        this.tweens.add({
            targets: heart,
            y: heart.y - 16,
            alpha: 0,
            duration: 550,
            onComplete: () => heart.destroy()
        });
    }

    private rescueChild(child: RoutedChild) {
        if (!giveLollipop(this.attempt, child.childIndex)) return;
        const direction = this.reverseDirection(child.direction);
        const vector = DIRECTION_VECTORS[direction];
        child.body.reset(
            child.x + vector.x * TUNING.rescueNudge,
            child.y + vector.y * TUNING.rescueNudge
        );
        child.setFillStyle(0xffd66b);
        this.setChildDirection(child, direction);
        this.showHeart(child);
    }

    private rotateSign(sign: RouteSign) {
        sign.directionIndex = (sign.directionIndex + 1) % sign.spec.directions.length;
        this.renderSign(sign);
    }

    private interact() {
        const cryingChild = this.nearestCryingChild();
        if (cryingChild) {
            this.rescueChild(cryingChild);
            this.updateStatus();
            return;
        }
        const sign = this.nearestSign();
        if (!sign) return;
        this.rotateSign(sign);
        this.updateStatus();
    }

    private updatePickupCars() {
        const stage = STAGES[this.attempt.stage];
        const elapsedRatio = 1 - this.attempt.remainingMs / stage.timeLimitMs;
        this.pickupCars.forEach((car, index) => {
            car.setVisible(elapsedRatio >= (index + 1) * 0.25);
        });
    }

    private updateStatus() {
        const stage = STAGES[this.attempt.stage];
        const arrived = this.attempt.childStates.filter(state => state === 'arrived').length;
        const crying = this.attempt.childStates.filter(state => state === 'crying').length;
        const seconds = Math.ceil(this.attempt.remainingMs / 1000);
        this.status.setText(
            `KITA-KIEZ · ${this.attempt.stage}/3 ${stage.name} · PICKUP ${seconds}s`
            + ` · KIDS ${arrived}/${stage.childCount} · CRYING ${crying}`
        );

        const cryingChild = this.nearestCryingChild();
        const sign = this.nearestSign();
        this.message.setText(this.attempt.phase === 'cleared'
            ? 'ALL KIDS PICKED UP!\nESC — HUB'
            : this.attempt.phase === 'stage-cleared'
                ? 'OUTING COMPLETE\nENTER — NEXT STAGE'
                : this.attempt.phase === 'timed-out'
                    ? 'PARENTS ARE HERE\nR — RETRY STAGE'
                    : cryingChild
                        ? 'E — LOLLIPOP'
                        : sign
                            ? 'E — TURN SIGN'
                            : this.attempt.stage === 0
                                ? 'TURN THE SIGN · GUIDE EVERYONE TO PICKUP'
                                : 'GUIDE THE GROUP · RESCUE CRYING KIDS');
        this.message.setVisible(this.message.text.length > 0);

        if (this.attempt.phase !== 'playing') this.physics.pause();
    }

    private updatePlayer() {
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

        this.updatePlayer();
        if (Input.Keyboard.JustDown(this.keys.E)) this.interact();

        const layout = this.currentLayout();
        for (const child of this.children) this.routeChild(child, layout);
        if (this.attempt.phase !== 'playing') return;

        tickAttempt(this.attempt, delta);
        this.updatePickupCars();
        this.updateStatus();
    }
}
