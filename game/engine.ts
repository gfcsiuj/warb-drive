
import { Player, Enemy, Projectile, Particle, XpGem, WORLD_SIZE } from './entities';
import { audioService } from '../services/audioService';
import { HUDState } from '../types';

export class GameEngine {
    player: Player;
    enemies: Enemy[] = [];
    projectiles: Projectile[] = [];
    particles: Particle[] = [];
    xpGems: XpGem[] = [];
    stars: any[] = [];
    
    score: number = 0;
    frame: number = 0;
    
    camera = { x: 0, y: 0, shake: 0 };
    world = { w: WORLD_SIZE, h: WORLD_SIZE };

    keys = { w: false, a: false, s: false, d: false };
    mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false };
    
    onLevelUp: () => void;
    onGameOver: (finalScore: number) => void;

    constructor(onLevelUp: () => void, onGameOver: (s: number) => void) {
        this.onLevelUp = onLevelUp;
        this.onGameOver = onGameOver;
        this.player = new Player(
            onLevelUp,
            (p) => this.projectiles.push(p),
            (p) => this.particles.push(p)
        );
        this.initStars();
    }

    initStars() {
        this.stars = [];
        for (let i = 0; i < 500; i++) {
            this.stars.push({
                x: Math.random() * this.world.w,
                y: Math.random() * this.world.h,
                size: Math.random() * 2,
                parallax: 0.2 + Math.random() * 0.8
            });
        }
    }

    spawnEnemy() {
        const edge = Math.floor(Math.random() * 4);
        let x = 0, y = 0;
        const buffer = 100;

        if (edge === 0) { x = Math.random() * this.world.w; y = -buffer; }
        if (edge === 1) { x = this.world.w + buffer; y = Math.random() * this.world.h; }
        if (edge === 2) { x = Math.random() * this.world.w; y = this.world.h + buffer; }
        if (edge === 3) { x = -buffer; y = Math.random() * this.world.h; }

        const roll = Math.random();
        let type = 0;
        if (roll > 0.8) type = 1; // Fast
        if (roll > 0.95) type = 2; // Tank
        
        // Boss Logic
        if (this.player.level % 5 === 0 && this.player.level > 1 && !this.enemies.some(e => e.type === 3) && Math.random() < 0.05) {
            type = 3;
        }

        this.enemies.push(new Enemy(x, y, type));
    }

    update(canvasWidth: number, canvasHeight: number): HUDState {
        this.frame++;

        // Spawning
        const spawnRate = Math.max(20, 60 - this.player.level * 2);
        if (this.frame % spawnRate === 0 && this.enemies.length < 100) {
            this.spawnEnemy();
        }

        // Camera logic
        let targetCamX = this.player.x - canvasWidth / 2;
        let targetCamY = this.player.y - canvasHeight / 2;

        let shakeX = (Math.random() - 0.5) * this.camera.shake;
        let shakeY = (Math.random() - 0.5) * this.camera.shake;
        this.camera.shake *= 0.9;

        this.camera.x += (targetCamX - this.camera.x) * 0.1;
        this.camera.y += (targetCamY - this.camera.y) * 0.1;

        this.mouse.wx = this.mouse.x + this.camera.x;
        this.mouse.wy = this.mouse.y + this.camera.y;

        // Player Update & Boost Logic
        this.player.update(this.keys, this.mouse);
        
        // Score Drain for Boost
        if (this.player.isBoosting && this.frame % 5 === 0) {
            if (this.score > 0) this.score--;
            else this.player.setBoost(false); // Disable boost if no score
        }
        
        // Clean up entities
        this.projectiles = this.projectiles.filter(p => p.life > 0);
        this.projectiles.forEach(p => p.update(this.enemies));
        
        this.particles = this.particles.filter(p => p.life > 0);
        this.particles.forEach(p => p.update());

        this.xpGems = this.xpGems.filter(g => !g.marked);
        this.xpGems.forEach(g => g.update(this.player));

        this.enemies.forEach((e, i) => {
            e.update(this.player, this.enemies);
            
            const d = Math.hypot(this.player.x - e.x, this.player.y - e.y);
            if (d < this.player.r + e.r) {
                if (this.player.isDashing) {
                    e.hp -= 50; 
                    this.addDamageText(e.x, e.y, "50", "#fff");
                } else if (this.player.shieldHp > 0) {
                    this.player.shieldHp -= 1;
                    const angle = Math.atan2(e.y - this.player.y, e.x - this.player.x);
                    e.x += Math.cos(angle) * 20;
                    e.y += Math.sin(angle) * 20;
                } else {
                    this.player.hp -= 0.5;
                    this.camera.shake = 5;
                }
            }

            this.projectiles.forEach(p => {
                if (p.life <= 0) return;
                const pd = Math.hypot(p.x - e.x, p.y - e.y);
                if (pd < e.r + 5) {
                    e.hp -= p.dmg;
                    p.life = 0;
                    this.addDamageText(e.x, e.y, Math.floor(p.dmg).toString());
                    for (let k = 0; k < 3; k++) this.particles.push(new Particle(p.x, p.y, e.color, 3));
                }
            });

            if (e.hp <= 0) {
                this.score += e.xp * 10;
                this.xpGems.push(new XpGem(e.x, e.y, e.xp));
                for (let k = 0; k < 15; k++) this.particles.push(new Particle(e.x, e.y, e.color, 6));
                audioService.playTone(200, 'sawtooth', 0.2);
                this.camera.shake += 2;
                this.enemies.splice(i, 1);
            }
        });

        if (this.player.hp <= 0) {
            this.onGameOver(this.score);
        }

        return {
            hp: this.player.hp,
            maxHp: this.player.maxHp,
            shieldHp: this.player.shieldHp,
            score: this.score,
            level: this.player.level,
            xp: this.player.xp,
            maxXp: this.player.maxXp,
            dashCd: this.player.dashCd,
            maxDashCd: this.player.maxDashCd,
            shieldCd: this.player.shieldCd,
            maxShieldCd: this.player.maxShieldCd,
            nukeCd: this.player.nukeCd,
            maxNukeCd: this.player.maxNukeCd
        };
    }

    draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        const sx = (Math.random() - 0.5) * this.camera.shake;
        const sy = (Math.random() - 0.5) * this.camera.shake;
        ctx.translate(-this.camera.x + sx, -this.camera.y + sy);

        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, this.world.w, this.world.h);

        this.stars.forEach(s => {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random()})`;
            let px = (s.x - this.camera.x * s.parallax);
            let py = (s.y - this.camera.y * s.parallax);
            px = ((px % this.world.w) + this.world.w) % this.world.w;
            py = ((py % this.world.h) + this.world.h) % this.world.h;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
        });

        this.xpGems.forEach(g => g.draw(ctx));
        this.player.draw(ctx);
        this.projectiles.forEach(p => p.draw(ctx));
        this.enemies.forEach(e => e.draw(ctx));
        this.particles.forEach(p => p.draw(ctx));
        this.drawTexts(ctx);

        ctx.restore();
    }

    texts: { x: number, y: number, text: string, color: string, life: number, vy: number }[] = [];
    addDamageText(x: number, y: number, text: string, color: string = '#fff') {
        this.texts.push({ x, y, text, color, life: 30, vy: -2 });
    }
    drawTexts(ctx: CanvasRenderingContext2D) {
        this.texts = this.texts.filter(t => t.life > 0);
        this.texts.forEach(t => {
            t.y += t.vy;
            t.life--;
            ctx.fillStyle = t.color;
            ctx.font = "bold 20px Cairo, sans-serif";
            ctx.globalAlpha = t.life / 30;
            ctx.fillText(t.text, t.x, t.y);
            ctx.globalAlpha = 1;
        });
    }

    drawMinimap(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#001';
        ctx.fillRect(0, 0, 150, 150);
        
        const scaleX = 150 / this.world.w;
        const scaleY = 150 / this.world.h;

        ctx.fillStyle = 'red';
        this.enemies.forEach(e => {
            ctx.fillRect(e.x * scaleX - 1, e.y * scaleY - 1, 2, 2);
        });

        ctx.fillStyle = 'yellow';
        this.xpGems.forEach(g => {
            ctx.fillRect(g.x * scaleX, g.y * scaleY, 1, 1);
        });

        ctx.fillStyle = '#00d2ff';
        ctx.beginPath();
        ctx.arc(this.player.x * scaleX, this.player.y * scaleY, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    triggerNuke() {
        if (this.player.activateNuke()) {
             this.camera.shake = 30;
             this.enemies.forEach(e => {
                const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
                if (d < 1000) {
                    e.hp -= 200;
                    this.addDamageText(e.x, e.y, "200", "#ff0000");
                }
             });
        }
    }
    triggerDash() {
        if (this.player.dash()) {
            this.camera.shake = 10;
        }
    }
    triggerShield() {
        this.player.activateShield();
    }
}
