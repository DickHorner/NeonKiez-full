import { GameObjects, Input, Physics, Scene } from 'phaser';
import {
    STAGES, PROJECTILE_CAP, PROJECTILE_LIFETIME, formationMotion, createAttempt, hitEnemy,
    advanceWave, advanceStage, spawnAlarm, hitCore, hitPlayer, retryStage,
    type Attempt, type FormationDirection
} from '../rooftop-invaders/attempt';
import { markDungeonCleared, type Session } from '../session';

const TUNING = {
    playerSpeed: 220,
    playerShotSpeed: 300,
    enemyShotSpeed: 175,
    enemyShotInterval: 1100,
    enemyProjectileCap: 2,
    formationBaseSpeed: 42,
    formationStageSpeed: 7,
    formationWaveSpeed: 5,
    formationDrop: 18,
    formationInset: 28,
    shieldChunk: 8,
    shieldColumns: 7,
    shieldRows: 4,
    shieldY: 244
};

type Player = GameObjects.Triangle & { body: Physics.Arcade.Body };
type Enemy = GameObjects.Rectangle & { body: Physics.Arcade.Body; enemyId: number };
type Bullet = GameObjects.Arc & { body: Physics.Arcade.Body; expiresAt: number };
type ShieldChunk = GameObjects.Rectangle & { body: Physics.Arcade.StaticBody };

export class RooftopInvaders extends Scene {
    private readonly session: Session;
    private attempt!: Attempt;
    private player!: Player;
    private enemies!: Physics.Arcade.Group;
    private playerBullets!: Physics.Arcade.Group;
    private enemyBullets!: Physics.Arcade.Group;
    private shields!: Physics.Arcade.StaticGroup;
    private core!: GameObjects.Rectangle;
    private status!: GameObjects.Text;
    private message!: GameObjects.Text;
    private keys!: Record<'A' | 'D' | 'LEFT' | 'RIGHT' | 'SPACE' | 'ENTER' | 'R', Input.Keyboard.Key>;
    private formationDirection: FormationDirection = 1;
    private nextEnemyShotAt = 0;

    constructor(session: Session) {
        super('RooftopInvaders');
        this.session = session;
    }

    create() {
        this.attempt = createAttempt(this.time.now);
        this.physics.resume();
        this.physics.world.drawDebug = false;
        this.physics.world.debugGraphic?.clear();
        this.cameras.main.setBackgroundColor('#101522');
        if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
        this.keys = this.input.keyboard.addKeys('A,D,LEFT,RIGHT,SPACE,ENTER,R') as typeof this.keys;
        const leave = () => {
            this.attempt.phase = 'leaving';
            this.scene.start('Game');
        };
        this.input.keyboard.once('keydown-ESC', leave);
        this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', leave));

        const { width, height } = this.scale;
        this.physics.world.setBounds(16, 48, width - 32, height - 80);
        this.add.rectangle(width / 2, (height + 16) / 2, width - 32, height - 80)
            .setStrokeStyle(1, 0x52657b);

        this.player = this.add.triangle(width / 2, height - 60, 0, 20, 10, 0, 20, 20,
            0x72f5cf) as Player;
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);

        this.enemies = this.physics.add.group();
        this.playerBullets = this.physics.add.group();
        this.enemyBullets = this.physics.add.group();
        this.shields = this.physics.add.staticGroup();

        this.core = this.add.rectangle(width / 2, 86, 72, 36, 0xffc766)
            .setStrokeStyle(2, 0xffffff).setVisible(false);
        this.physics.add.existing(this.core, true);
        (this.core.body as Physics.Arcade.StaticBody).enable = false;

        this.status = this.add.text(16, 10, '', {
            fontFamily: 'monospace', fontSize: 13, color: '#ffffff'
        });
        this.message = this.add.text(width / 2, height * 0.65, '', {
            fontFamily: 'monospace', fontSize: 18, color: '#ffffff', align: 'center',
            backgroundColor: '#101522', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setDepth(10);
        this.add.text(width / 2, height - 14,
            'A/D or LEFT/RIGHT MOVE · SPACE FIRE · ENTER NEXT · ESC HUB', {
                fontFamily: 'monospace', fontSize: 12, color: '#b4c4d7'
            }).setOrigin(0.5);

        this.physics.add.overlap(this.playerBullets, this.enemies, (shot, target) => {
            const bullet = shot as Bullet;
            const enemy = target as Enemy;
            if (!bullet.active || !enemy.active || this.time.now >= bullet.expiresAt
                || !hitEnemy(this.attempt, enemy.enemyId, this.time.now)) return;
            bullet.destroy();
            enemy.destroy();
            this.updateStatus();
        });
        this.physics.add.overlap(this.core, this.playerBullets, (_core, shot) => {
            const bullet = shot as Bullet;
            if (!bullet.active || this.time.now >= bullet.expiresAt || !hitCore(this.attempt)) return;
            bullet.destroy();
            this.core.setFillStyle(this.attempt.coreHP % 2 ? 0xffffff : 0xffc766);
            if (this.attempt.phase === 'cleared') {
                markDungeonCleared(this.session, 'RooftopInvaders');
                this.core.setFillStyle(0x72f5cf);
            }
            this.updateStatus();
        });
        this.physics.add.overlap(this.player, this.enemies, () => {
            if (!hitPlayer(this.attempt, this.time.now)) return;
            this.resetPlayer();
            this.updateStatus();
        });
        this.physics.add.overlap(this.player, this.enemyBullets, (_player, shot) => {
            const bullet = shot as Bullet;
            if (!bullet.active || !hitPlayer(this.attempt, this.time.now)) return;
            bullet.destroy();
            this.resetPlayer();
            this.updateStatus();
        });
        this.physics.add.overlap(this.playerBullets, this.shields, (shot, cover) => {
            const bullet = shot as Bullet;
            const chunk = cover as ShieldChunk;
            if (!bullet.active || !chunk.active) return;
            bullet.destroy();
            chunk.destroy();
        });
        this.physics.add.overlap(this.enemyBullets, this.shields, (shot, cover) => {
            const bullet = shot as Bullet;
            const chunk = cover as ShieldChunk;
            if (!bullet.active || !chunk.active) return;
            bullet.destroy();
            chunk.destroy();
        });

        this.buildStage();
    }

    private resetPlayer() {
        this.player.body.reset(this.scale.width / 2, this.scale.height - 60);
        this.player.body.setVelocity(0, 0);
    }

    private buildStage() {
        this.physics.resume();
        this.playerBullets.clear(true, true);
        this.enemyBullets.clear(true, true);
        this.enemies.clear(true, true);
        this.shields.clear(true, true);
        this.resetPlayer();
        this.player.setAlpha(1);
        this.formationDirection = 1;
        this.nextEnemyShotAt = this.time.now + TUNING.enemyShotInterval;

        const isCore = this.attempt.stage === 3;
        this.core.setVisible(isCore).setFillStyle(0xffc766);
        (this.core.body as Physics.Arcade.StaticBody).enable = isCore;
        if (!isCore) this.buildShields();
        this.spawnWave();
    }

    private buildShields() {
        const centers = [0.18, 0.39, 0.61, 0.82].map(value => value * this.scale.width);
        const chunk = TUNING.shieldChunk;
        for (const centerX of centers) {
            for (let row = 0; row < TUNING.shieldRows; row++) {
                for (let column = 0; column < TUNING.shieldColumns; column++) {
                    const roundedTopCorner = row === 0 && (column === 0 || column === TUNING.shieldColumns - 1);
                    const firingNotch = row === TUNING.shieldRows - 1 && column >= 2 && column <= 4;
                    if (roundedTopCorner || firingNotch) continue;
                    const x = centerX + (column - (TUNING.shieldColumns - 1) / 2) * chunk;
                    const y = TUNING.shieldY + row * chunk;
                    this.shields.add(this.add.rectangle(x, y, chunk - 1, chunk - 1, 0x72f5cf, 0.78));
                }
            }
        }
    }

    private spawnWave() {
        this.playerBullets.clear(true, true);
        this.enemyBullets.clear(true, true);
        this.formationDirection = 1;
        const ids = this.attempt.remainingEnemies;
        ids.forEach((id, index) => {
            const x = this.scale.width / 2 + (index - (ids.length - 1) / 2) * 46;
            this.spawnEnemy(id, x, 90, false);
        });
        this.updateStatus();
    }

    private spawnEnemy(id: number, x: number, y: number, alarm: boolean) {
        const enemy = this.add.rectangle(x, y, 22, 18, alarm ? 0xffc766 : 0xba9dff)
            .setStrokeStyle(1, 0xffffff) as Enemy;
        enemy.enemyId = id;
        this.enemies.add(enemy);
        enemy.body.setAllowGravity(false);
    }

    private updateFormation(delta: number) {
        if (this.attempt.stage === 3) return;
        const enemies = (this.enemies.getChildren() as Enemy[]).filter(enemy => enemy.active);
        if (enemies.length === 0) return;

        const halfWidth = 11;
        const left = Math.min(...enemies.map(enemy => enemy.x - halfWidth));
        const right = Math.max(...enemies.map(enemy => enemy.x + halfWidth));
        const speed = TUNING.formationBaseSpeed
            + this.attempt.stage * TUNING.formationStageSpeed
            + this.attempt.wave * TUNING.formationWaveSpeed;
        const motion = formationMotion(left, right, this.formationDirection,
            speed * delta / 1000, TUNING.formationInset,
            this.scale.width - TUNING.formationInset, TUNING.formationDrop);
        this.formationDirection = motion.direction;
        for (const enemy of enemies) {
            enemy.body.reset(enemy.x + motion.dx, enemy.y + motion.dy);
        }
    }

    private firePlayer(now: number) {
        if (this.playerBullets.countActive() >= PROJECTILE_CAP) return;
        const bullet = this.add.circle(this.player.x, this.player.y - 14, 3, 0x72f5cf) as Bullet;
        this.playerBullets.add(bullet);
        bullet.body.setCircle(3);
        bullet.body.setVelocity(0, -TUNING.playerShotSpeed);
        bullet.expiresAt = now + PROJECTILE_LIFETIME;
    }

    private fireEnemy(now: number) {
        if (this.attempt.stage === 3 || now < this.nextEnemyShotAt
            || this.enemyBullets.countActive() >= TUNING.enemyProjectileCap) return;
        const enemies = (this.enemies.getChildren() as Enemy[]).filter(enemy => enemy.active);
        if (enemies.length === 0) return;
        const shooter = enemies[Math.floor(now / TUNING.enemyShotInterval) % enemies.length];
        const bullet = this.add.circle(shooter.x, shooter.y + 13, 3, 0xffc766) as Bullet;
        this.enemyBullets.add(bullet);
        bullet.body.setCircle(3);
        bullet.body.setVelocity(0, TUNING.enemyShotSpeed);
        bullet.expiresAt = now + PROJECTILE_LIFETIME;
        this.nextEnemyShotAt = now + TUNING.enemyShotInterval;
    }

    private updateProjectiles(now: number) {
        for (const bullet of this.playerBullets.getChildren() as Bullet[]) {
            if (now >= bullet.expiresAt || bullet.y < 48) bullet.destroy();
        }
        for (const bullet of this.enemyBullets.getChildren() as Bullet[]) {
            if (now >= bullet.expiresAt || bullet.y > this.scale.height - 32) bullet.destroy();
        }
    }

    private updateStatus() {
        const { stage, wave, phase, hearts, coreHP, remainingEnemies } = this.attempt;
        this.status.setText(`ROOFTOP · ${stage}/3 ${STAGES[stage].name} · WAVE ${wave + 1}/${STAGES[stage].enemiesPerWave.length}\n`
            + `${hearts} HEARTS · ${stage === 3 ? `CORE ${coreHP}/30` : `${remainingEnemies.length} INVADERS`}`);
        this.message.setText(phase === 'cleared' ? 'ROOFTOP CLEARED!\nESC — HUB'
            : phase === 'lost' ? 'TAKE A BREATHER\nR — RETRY STAGE · ESC — HUB'
            : phase === 'stage-cleared' ? 'STAGE CLEARED\nENTER — NEXT STAGE'
            : phase === 'wave-wait' ? 'WAVE CLEARED' : '');
        this.message.setVisible(phase !== 'playing');
        if (phase !== 'playing') {
            this.playerBullets.clear(true, true);
            this.enemyBullets.clear(true, true);
        }
        if (phase === 'lost' || phase === 'cleared' || phase === 'stage-cleared') {
            this.physics.pause();
            this.player.body.stop();
        }
    }

    update(now: number, delta: number) {
        if (this.attempt.phase === 'leaving') return;
        if (Input.Keyboard.JustDown(this.keys.ENTER) && advanceStage(this.attempt, now)) this.buildStage();
        if (Input.Keyboard.JustDown(this.keys.R) && retryStage(this.attempt, now)) this.buildStage();
        if (advanceWave(this.attempt, now)) this.spawnWave();
        if (this.attempt.phase !== 'playing') {
            this.player.body.stop();
            return;
        }

        this.player.setAlpha(now < this.attempt.protectedUntil ? 0.35 : 1);
        const left = this.keys.A.isDown || this.keys.LEFT.isDown;
        const right = this.keys.D.isDown || this.keys.RIGHT.isDown;
        this.player.body.setVelocity((Number(right) - Number(left)) * TUNING.playerSpeed, 0);

        this.updateProjectiles(now);
        this.updateFormation(delta);
        this.fireEnemy(now);
        if (Input.Keyboard.JustDown(this.keys.SPACE)) this.firePlayer(now);

        const alarmId = spawnAlarm(this.attempt, now);
        if (alarmId !== null) {
            const active = (this.enemies.getChildren() as Enemy[]).filter(enemy => enemy.active);
            const top = active.length > 0 ? Math.min(...active.map(enemy => enemy.y)) : 90;
            this.spawnEnemy(alarmId, this.scale.width / 2, Math.max(62, top - 28), true);
            this.updateStatus();
        }
    }
}
