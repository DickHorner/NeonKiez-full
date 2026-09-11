import { GameObjects, Input, Math as PhaserMath, Physics, Scene } from 'phaser';
import { createAttempt, loseLife, respawn, clearAttempt, type Attempt } from '../asteroids/attempt';

const TUNING = {
    lives: 3,
    respawnDelay: 900,
    respawnProtection: 1200,
    respawnClearance: 35,
    turnSpeed: 220,
    thrust: 210,
    maxSpeed: 240,
    shipRadius: 9,
    bulletRadius: 2,
    bulletSpeed: 360,
    bulletLifetime: 1400,
    fireInterval: 180,
    asteroidCount: 4,
    asteroidSizes: {
        large: { radius: 23, minSpeed: 25, maxSpeed: 48 },
        medium: { radius: 15, minSpeed: 45, maxSpeed: 65 },
        small: { radius: 9, minSpeed: 65, maxSpeed: 90 }
    },
    splitAngle: Math.PI / 7,
    asteroidMaxSpin: 25,
    asteroidHitRadiusRatio: 0.8,
    spawnRing: 0.38,
    wrapPadding: 24
};

type AsteroidSize = keyof typeof TUNING.asteroidSizes;
type Asteroid = GameObjects.Polygon & { body: Physics.Arcade.Body; size: AsteroidSize };

type Ship = GameObjects.Polygon & { body: Physics.Arcade.Body };
type Bullet = GameObjects.Arc & { body: Physics.Arcade.Body; expiresAt: number };

export class Asteroids extends Scene {
    private ship!: Ship;
    private bullets!: Physics.Arcade.Group;
    private asteroids!: Physics.Arcade.Group;
    private status!: GameObjects.Text;
    private keys!: Record<'A' | 'D' | 'W' | 'LEFT' | 'RIGHT' | 'UP' | 'SPACE', Input.Keyboard.Key>;
    private attempt!: Attempt;
    private nextShotAt = 0;

    constructor() {
        super('Asteroids');
    }

    create() {
        // Only a new dungeon visit or explicit retry creates a fresh attempt.
        this.attempt = createAttempt(TUNING.lives);
        this.nextShotAt = 0;
        this.physics.resume();
        this.physics.world.drawDebug = false;
        this.physics.world.debugGraphic?.clear();
        this.cameras.main.setBackgroundColor('#000000');

        if (!this.input.keyboard) {
            throw new Error('Keyboard input unavailable');
        }
        this.keys = this.input.keyboard.addKeys('A,D,W,LEFT,RIGHT,UP,SPACE') as typeof this.keys;
        this.input.keyboard.once('keydown-ESC', () => {
            this.attempt.phase = 'leaving';
            this.scene.start('Game');
        });

        const { width, height } = this.scale;
        this.physics.world.setBounds(0, 0, width, height);
        // Polygon points start at (0, 0), so its default origin and body share the visual center.
        this.ship = this.add.polygon(width / 2, height / 2,
            [10, 0, 20, 24, 10, 19, 0, 24], 0xffffff, 0
        ).setStrokeStyle(2, 0xffffff) as Ship;
        this.physics.add.existing(this.ship);
        this.ship.body.setCircle(TUNING.shipRadius,
            this.ship.width / 2 - TUNING.shipRadius,
            this.ship.height / 2 - TUNING.shipRadius);
        this.ship.body.setMaxSpeed(TUNING.maxSpeed);

        this.bullets = this.physics.add.group();
        this.asteroids = this.physics.add.group();
        this.spawnAsteroids();

        this.status = this.add.text(16, 14, '', {
            fontFamily: 'monospace', fontSize: 16, color: '#ffffff'
        }).setDepth(10);
        this.updateStatus();
        this.add.text(width / 2, height - 16,
            'A/D or ←/→ TURN · W/↑ THRUST · SPACE FIRE · ESC HUB', {
                fontFamily: 'monospace', fontSize: 12, color: '#aaaaaa'
            }).setOrigin(0.5).setDepth(10);

        this.physics.add.overlap(this.bullets, this.asteroids, (bulletObject, asteroidObject) => {
            const bullet = bulletObject as Bullet;
            const asteroid = asteroidObject as Asteroid;
            if (this.attempt.phase !== 'playing' || !bullet.active || !asteroid.active) {
                return;
            }
            bullet.destroy();
            this.splitAsteroid(asteroid);
            this.updateStatus();
            if (this.asteroids.countActive() === 0) {
                this.clearDungeon();
            }
        });
        this.physics.add.overlap(this.ship, this.asteroids, () => {
            if (!loseLife(this.attempt, this.time.now, TUNING.respawnDelay)) {
                return;
            }
            this.ship.body.stop();
            this.ship.body.enable = false;
            this.ship.setActive(false).setVisible(false);
            this.bullets.clear(true, true);
            this.updateStatus();
            if (this.attempt.phase === 'lost') {
                this.showResult('GAME OVER', 'R — RETRY   /   ESC — HUB');
                this.input.keyboard!.once('keydown-R', () => {
                    if (this.attempt.phase === 'lost') {
                        this.attempt.phase = 'leaving';
                        this.scene.restart();
                    }
                });
            }
        });
    }

    private spawnAsteroids() {
        const { width, height } = this.scale;
        const startAngle = PhaserMath.FloatBetween(0, Math.PI * 2);
        for (let i = 0; i < TUNING.asteroidCount; i++) {
            const angle = startAngle + i * Math.PI * 2 / TUNING.asteroidCount;
            // A procedural ring leaves the central ship spawn clear.
            const x = width / 2 + Math.cos(angle) * width * TUNING.spawnRing;
            const y = height / 2 + Math.sin(angle) * height * TUNING.spawnRing;
            this.spawnAsteroid(x, y, 'large', PhaserMath.FloatBetween(0, Math.PI * 2));
        }
    }

    private spawnAsteroid(x: number, y: number, size: AsteroidSize, heading: number) {
        const { radius, minSpeed, maxSpeed } = TUNING.asteroidSizes[size];
        const points: number[] = [];
        for (let vertex = 0; vertex < 9; vertex++) {
            const direction = vertex * Math.PI * 2 / 9;
            const length = radius * PhaserMath.FloatBetween(0.8, 1);
            points.push(radius + Math.cos(direction) * length,
                radius + Math.sin(direction) * length);
        }
        const asteroid = this.add.polygon(x, y, points, 0xffffff, 0)
            .setStrokeStyle(1.5, 0xffffff) as Asteroid;
        asteroid.size = size;
        this.asteroids.add(asteroid);
        const hitRadius = radius * TUNING.asteroidHitRadiusRatio;
        asteroid.body.setCircle(hitRadius, asteroid.width / 2 - hitRadius, asteroid.height / 2 - hitRadius);
        const speed = PhaserMath.FloatBetween(minSpeed, maxSpeed);
        asteroid.body.setVelocity(Math.cos(heading) * speed, Math.sin(heading) * speed);
        asteroid.body.setAngularVelocity(PhaserMath.Between(-TUNING.asteroidMaxSpin, TUNING.asteroidMaxSpin));
    }

    private splitAsteroid(asteroid: Asteroid) {
        const { x, y, size } = asteroid;
        const heading = Math.atan2(asteroid.body.velocity.y, asteroid.body.velocity.x);
        asteroid.destroy();
        if (size === 'small') {
            return;
        }
        const childSize = size === 'large' ? 'medium' : 'small';
        this.spawnAsteroid(x, y, childSize, heading - TUNING.splitAngle);
        this.spawnAsteroid(x, y, childSize, heading + TUNING.splitAngle);
    }

    private fire(time: number) {
        if (time < this.nextShotAt) {
            return;
        }
        this.nextShotAt = time + TUNING.fireInterval;
        const heading = this.ship.rotation - Math.PI / 2;
        const dx = Math.cos(heading);
        const dy = Math.sin(heading);
        const offset = TUNING.shipRadius + TUNING.bulletRadius;
        const bullet = this.add.circle(this.ship.x + dx * offset,
            this.ship.y + dy * offset, TUNING.bulletRadius, 0xffffff) as Bullet;
        this.bullets.add(bullet);
        bullet.body.setCircle(TUNING.bulletRadius);
        bullet.body.setVelocity(this.ship.body.velocity.x + dx * TUNING.bulletSpeed,
            this.ship.body.velocity.y + dy * TUNING.bulletSpeed);
        bullet.expiresAt = time + TUNING.bulletLifetime;
    }

    private updateStatus() {
        const waiting = this.attempt.phase === 'respawning' ? '  /  RESPAWNING' : '';
        this.status.setText(`${this.asteroids.countActive()} ROCKS  /  ${this.attempt.lives} LIVES${waiting}`);
    }

    private clearDungeon() {
        if (!clearAttempt(this.attempt)) {
            return;
        }
        this.updateStatus();
        this.showResult('CLEARED', 'ESC — RETURN TO HUB');
    }

    private showResult(title: string, hint: string) {
        this.physics.pause();
        this.bullets.clear(true, true);
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, 120, 0x000000)
            .setDepth(20);
        this.add.text(width / 2, height / 2 - 14, title, {
            fontFamily: 'monospace', fontSize: 42, color: '#ffffff'
        }).setOrigin(0.5).setDepth(21);
        this.add.text(width / 2, height / 2 + 30, hint, {
            fontFamily: 'monospace', fontSize: 16, color: '#ffffff'
        }).setOrigin(0.5).setDepth(21);
    }

    update(time: number) {
        if (this.attempt.phase !== 'playing' && this.attempt.phase !== 'respawning') {
            return;
        }
        if (this.asteroids.countActive() === 0) {
            this.clearDungeon();
            return;
        }
        this.physics.world.wrap(this.asteroids, TUNING.wrapPadding);
        if (this.attempt.phase === 'respawning') {
            const x = this.scale.width / 2;
            const y = this.scale.height / 2;
            const safe = this.asteroids.getChildren().every(object => {
                const asteroid = object as Asteroid;
                const distance = TUNING.shipRadius + asteroid.body.radius + TUNING.respawnClearance;
                return PhaserMath.Distance.Squared(x, y, asteroid.body.center.x, asteroid.body.center.y) > distance * distance;
            });
            if (respawn(this.attempt, time, safe, TUNING.respawnProtection)) {
                this.ship.setRotation(0).setActive(true).setVisible(true);
                this.ship.body.enable = true;
                this.ship.body.reset(x, y);
                this.nextShotAt = time;
                this.updateStatus();
            }
            return;
        }
        this.ship.setAlpha(time < this.attempt.protectedUntil ? 0.45 : 1);
        const left = this.keys.A.isDown || this.keys.LEFT.isDown;
        const right = this.keys.D.isDown || this.keys.RIGHT.isDown;
        this.ship.body.setAngularVelocity((Number(right) - Number(left)) * TUNING.turnSpeed);
        if (this.keys.W.isDown || this.keys.UP.isDown) {
            const heading = this.ship.rotation - Math.PI / 2;
            this.ship.body.setAcceleration(Math.cos(heading) * TUNING.thrust,
                Math.sin(heading) * TUNING.thrust);
            this.ship.setFillStyle(0xffffff, 0.25);
        } else {
            this.ship.body.setAcceleration(0);
            this.ship.setFillStyle(0xffffff, 0);
        }
        if (this.keys.SPACE.isDown) {
            this.fire(time);
        }
        const bullets = this.bullets.getChildren() as Bullet[];
        for (let i = bullets.length - 1; i >= 0; i--) {
            if (time >= bullets[i].expiresAt) {
                bullets[i].destroy();
            }
        }
        this.physics.world.wrap(this.ship, TUNING.wrapPadding);
        this.physics.world.wrap(this.bullets, TUNING.wrapPadding);
    }
}
