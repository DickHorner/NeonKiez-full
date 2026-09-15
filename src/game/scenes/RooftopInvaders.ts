import { GameObjects, Input, Physics, Scene } from 'phaser';
import {
    STAGES, PROJECTILE_CAP, PROJECTILE_LIFETIME, createAttempt, hitEnemy, advanceWave,
    advanceStage, spawnAlarm, hitCore, hitPlayer, retryStage, type Attempt
} from '../rooftop-invaders/attempt';
import { markDungeonCleared, type Session } from '../session';

type Player = GameObjects.Triangle & { body: Physics.Arcade.Body };
type Enemy = GameObjects.Rectangle & { body: Physics.Arcade.Body; enemyId: number };
type Bullet = GameObjects.Arc & { body: Physics.Arcade.Body; expiresAt: number };

export class RooftopInvaders extends Scene {
    private readonly session: Session;
    private attempt!: Attempt;
    private player!: Player;
    private enemies!: Physics.Arcade.Group;
    private bullets!: Physics.Arcade.Group;
    private core!: GameObjects.Rectangle;
    private status!: GameObjects.Text;
    private message!: GameObjects.Text;
    private keys!: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT' | 'SPACE' | 'ENTER' | 'R', Input.Keyboard.Key>;
    private nextShotAt = 0;

    constructor(session: Session) {
        super('RooftopInvaders');
        this.session = session;
    }

    create() {
        this.attempt = createAttempt(this.time.now);
        this.nextShotAt = 0;
        this.physics.resume();
        this.physics.world.drawDebug = false;
        this.physics.world.debugGraphic?.clear();
        this.cameras.main.setBackgroundColor('#101522');
        if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
        this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE,ENTER,R') as typeof this.keys;
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
        this.bullets = this.physics.add.group();
        this.core = this.add.rectangle(width / 2, 86, 72, 36, 0xffc766)
            .setStrokeStyle(2, 0xffffff).setVisible(false);
        this.physics.add.existing(this.core, true);
        (this.core.body as Physics.Arcade.StaticBody).enable = false;
        this.status = this.add.text(16, 10, '', { fontFamily: 'monospace', fontSize: 13, color: '#ffffff' });
        this.message = this.add.text(width / 2, height * 0.65, '', {
            fontFamily: 'monospace', fontSize: 18, color: '#ffffff', align: 'center',
            backgroundColor: '#101522', padding: { x: 8, y: 5 }
        }).setOrigin(0.5).setDepth(10);
        this.add.text(width / 2, height - 14, 'WASD / ARROWS MOVE · SPACE FIRE · ENTER NEXT · ESC HUB', {
            fontFamily: 'monospace', fontSize: 12, color: '#b4c4d7'
        }).setOrigin(0.5);
        this.physics.add.overlap(this.bullets, this.enemies, (shot, target) => {
            const bullet = shot as Bullet;
            const enemy = target as Enemy;
            if (!bullet.active || !enemy.active || this.time.now >= bullet.expiresAt
                || !hitEnemy(this.attempt, enemy.enemyId, this.time.now)) return;
            bullet.destroy();
            enemy.destroy();
            this.updateStatus();
        });
        this.physics.add.overlap(this.core, this.bullets, (_core, shot) => {
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
            this.player.body.reset(width / 2, height - 60);
            this.updateStatus();
        });
        this.buildStage();
    }

    private buildStage() {
        this.physics.resume();
        this.bullets.clear(true, true);
        this.enemies.clear(true, true);
        this.player.body.reset(this.scale.width / 2, this.scale.height - 60);
        this.player.setAlpha(1);
        const isCore = this.attempt.stage === 3;
        this.core.setVisible(isCore).setFillStyle(0xffc766);
        (this.core.body as Physics.Arcade.StaticBody).enable = isCore;
        this.spawnWave();
    }

    private spawnWave() {
        this.bullets.clear(true, true);
        const ids = this.attempt.remainingEnemies;
        ids.forEach((id, index) => {
            const x = this.scale.width / 2 + (index - (ids.length - 1) / 2) * 54;
            // Local placeholder layouts: row, shallow V, then staggered rows.
            const y = 90 + (this.attempt.wave === 1 ? Math.abs(index - (ids.length - 1) / 2) * 20
                : this.attempt.wave >= 2 ? (index % 2) * 42 : 0);
            this.spawnEnemy(id, x, y, false);
        });
        this.updateStatus();
    }

    private spawnEnemy(id: number, x: number, y: number, alarm: boolean) {
        const enemy = this.add.rectangle(x, y, 22, 18, alarm ? 0xffc766 : 0xba9dff)
            .setStrokeStyle(1, 0xffffff) as Enemy;
        enemy.enemyId = id;
        this.enemies.add(enemy);
        enemy.body.setCollideWorldBounds(true).setBounce(1);
        if (this.attempt.stage !== 0) {
            enemy.body.setVelocity((id % 2 ? 1 : -1) * (25 + this.attempt.wave * 8), alarm ? 35 : 12);
        }
    }

    private fire(now: number) {
        if (now < this.nextShotAt || this.bullets.countActive() >= PROJECTILE_CAP) return;
        this.nextShotAt = now + 120;
        const bullet = this.add.circle(this.player.x, this.player.y - 14, 3, 0x72f5cf) as Bullet;
        this.bullets.add(bullet);
        bullet.body.setCircle(3);
        bullet.body.setVelocity(0, -300);
        bullet.expiresAt = now + PROJECTILE_LIFETIME;
    }

    private updateStatus() {
        const { stage, wave, phase, hearts, coreHP, remainingEnemies } = this.attempt;
        this.status.setText(`ROOFTOP · ${stage}/3 ${STAGES[stage].name} · WAVE ${wave + 1}/${STAGES[stage].enemiesPerWave.length}\n`
            + `${hearts} HEARTS · ${stage === 3 ? `CORE ${coreHP}/30` : `${remainingEnemies.length} BOTS`}`);
        this.message.setText(phase === 'cleared' ? 'ROOFTOP CLEARED!\nESC — HUB'
            : phase === 'lost' ? 'TAKE A BREATHER\nR — RETRY STAGE · ESC — HUB'
            : phase === 'stage-cleared' ? 'STAGE CLEARED\nENTER — NEXT STAGE'
            : phase === 'wave-wait' ? 'WAVE CLEARED' : '');
        this.message.setVisible(phase !== 'playing');
        if (phase !== 'playing') this.bullets.clear(true, true);
        if (phase === 'lost' || phase === 'cleared' || phase === 'stage-cleared') {
            this.physics.pause();
            this.player.body.stop();
        }
    }

    update(now: number) {
        if (this.attempt.phase === 'leaving') return;
        if (Input.Keyboard.JustDown(this.keys.ENTER) && advanceStage(this.attempt, now)) this.buildStage();
        if (Input.Keyboard.JustDown(this.keys.R) && retryStage(this.attempt, now)) this.buildStage();
        if (advanceWave(this.attempt, now)) this.spawnWave();
        if (this.attempt.phase !== 'playing') {
            this.player.body.stop();
            return;
        }
        this.player.setAlpha(now < this.attempt.protectedUntil ? 0.35 : 1);
        const x = Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown);
        const y = Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown);
        this.player.body.setVelocity(x, y);
        if (x || y) this.player.body.velocity.normalize().scale(220);
        const bullets = this.bullets.getChildren() as Bullet[];
        for (let i = bullets.length - 1; i >= 0; i--) {
            if (now >= bullets[i].expiresAt || bullets[i].y < 48) bullets[i].destroy();
        }
        if (this.keys.SPACE.isDown) this.fire(now);
        const alarmId = spawnAlarm(this.attempt, now);
        if (alarmId !== null) {
            this.spawnEnemy(alarmId, 50 + (alarmId * 73) % (this.scale.width - 100), 64, true);
            this.updateStatus();
        }
    }
}
