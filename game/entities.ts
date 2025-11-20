import { audioService } from '../services/audioService';

export const WORLD_SIZE = 3000;

export class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    decay: number;
    color: string;
    size: number;

    constructor(x: number, y: number, color: string, speed: number, size: number = 2) {
        this.x = x;
        this.y = y;
        this.color = color;
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * speed;
        this.vx = Math.cos(a) * s;
        this.vy = Math.sin(a) * s;
        this.life = 1.0;
        this.decay = 0.03 + Math.random() * 0.02;
        this.size = size;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size + this.life * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

export class Projectile {
    x: number;
    y: number;
    vx: number;
    vy: number;
    dmg: number;
    homing: boolean;
    life: number = 100;
    color: string = '#ff0';

    constructor(x: number, y: number, vx: number, vy: number, dmg: number, homing: boolean) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.dmg = dmg;
        this.homing = homing;
    }

    update(enemies: Enemy[]) {
        if (this.homing) {
            let target: Enemy | null = null;
            let minD = 500;
            for (const e of enemies) {
                const d = Math.hypot(e.x - this.x, e.y - this.y);
                if (d < minD) {
                    minD = d;
                    target = e;
                }
            }
            if (target) {
                const angle = Math.atan2(target.y - this.y, target.x - this.x);
                this.vx += Math.cos(angle) * 2;
                this.vy += Math.sin(angle) * 2;
                const s = Math.hypot(this.vx, this.vy);
                this.vx = (this.vx / s) * 15;
                this.vy = (this.vy / s) * 15;
                this.color = '#f0f';
            }
        }

        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.vy, this.vx));
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(-5, -2, 10, 4);
        ctx.restore();
    }
}

export class Enemy {
    x: number;
    y: number;
    type: number;
    hp: number;
    maxHp: number;
    speed: number;
    r: number;
    color: string;
    xp: number;
    angle: number = 0;

    constructor(x: number, y: number, type: number) {
        this.x = x;
        this.y = y;
        this.type = type;
        
        // Defaults
        this.hp = 20; 
        this.maxHp = 20;
        this.speed = 4; 
        this.r = 15; 
        this.color = '#f00'; 
        this.xp = 5;

        if (type === 0) { /* Basic */ }
        else if (type === 1) { this.hp = 10; this.speed = 7; this.r = 10; this.color = '#ffaa00'; this.xp = 8; }
        else if (type === 2) { this.hp = 80; this.speed = 2; this.r = 25; this.color = '#a0f'; this.xp = 20; }
        else if (type === 3) { this.hp = 1000; this.speed = 1.5; this.r = 60; this.color = '#fff'; this.xp = 500; } // Boss

        this.maxHp = this.hp;
    }

    update(player: Player, otherEnemies: Enemy[]) {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.angle = angle;
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;

        // Simple separation boid logic
        for (const other of otherEnemies) {
            if (other === this) continue;
            const d = Math.hypot(this.x - other.x, this.y - other.y);
            if (d < this.r + other.r) {
                const a = Math.atan2(this.y - other.y, this.x - other.x);
                this.x += Math.cos(a);
                this.y += Math.sin(a);
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.shadowBlur = 10; 
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;

        if (this.type === 3) { // Boss
            ctx.beginPath();
            const spikes = 8;
            for (let i = 0; i < spikes * 2; i++) {
                const r = i % 2 === 0 ? this.r : this.r / 2;
                const a = (Math.PI / spikes) * i;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.fill();
            
            // Boss HP Bar
            ctx.fillStyle = 'black';
            ctx.fillRect(-40, -80, 80, 10);
            ctx.fillStyle = 'red';
            ctx.fillRect(-40, -80, 80 * (this.hp / this.maxHp), 10);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, this.r, 0, Math.PI * 2);
            ctx.fill();
            // Eyes
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(5, -5, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(5, 5, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

export class XpGem {
    x: number;
    y: number;
    val: number;
    r: number;
    marked: boolean = false;

    constructor(x: number, y: number, val: number) {
        this.x = x;
        this.y = y;
        this.val = val;
        this.r = 3 + Math.min(val, 5);
    }

    update(player: Player) {
        const d = Math.hypot(player.x - this.x, player.y - this.y);
        if (d < 150) {
            const a = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(a) * 10;
            this.y += Math.sin(a) * 10;
        }
        if (d < player.r + this.r) {
            player.gainXp(this.val);
            audioService.playTone(800 + (Math.random() * 200), 'sine', 0.05, 0.05);
            this.marked = true;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ff0';
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.r);
        ctx.lineTo(this.x + this.r, this.y);
        ctx.lineTo(this.x, this.y + this.r);
        ctx.lineTo(this.x - this.r, this.y);
        ctx.fill();
    }
}

export class Player {
    x: number = WORLD_SIZE / 2;
    y: number = WORLD_SIZE / 2;
    r: number = 20;
    angle: number = 0;
    vel = { x: 0, y: 0 };
    
    // Stats
    maxHp: number = 100;
    hp: number = 100;
    speed: number = 8;
    friction: number = 0.92;
    xp: number = 0;
    maxXp: number = 50;
    level: number = 1;
    
    // Combat
    damage: number = 10;
    fireRate: number = 10;
    multishot: number = 1;
    spread: number = 0.1;
    bulletSpeed: number = 15;
    regen: number = 0.05;
    homing: boolean = false;

    // Cooldowns
    dashCd: number = 0;
    maxDashCd: number = 60;
    isDashing: boolean = false;

    shieldHp: number = 0;
    shieldCd: number = 0;
    maxShieldCd: number = 600;

    nukeCd: number = 0;
    maxNukeCd: number = 1200;

    shootTimer: number = 0;
    levelUpCallback: () => void;
    addProjectile: (p: Projectile) => void;
    addParticle: (p: Particle) => void;

    constructor(onLevelUp: () => void, addProj: (p: Projectile) => void, addPart: (p: Particle) => void) {
        this.levelUpCallback = onLevelUp;
        this.addProjectile = addProj;
        this.addParticle = addPart;
    }

    update(keys: { w: boolean, a: boolean, s: boolean, d: boolean }, mouse: { wx: number, wy: number, down: boolean }) {
        // Regen
        if (this.hp < this.maxHp) this.hp += this.regen;
        if (this.hp > this.maxHp) this.hp = this.maxHp;

        // Move
        if (keys.w) this.vel.y -= 1;
        if (keys.s) this.vel.y += 1;
        if (keys.a) this.vel.x -= 1;
        if (keys.d) this.vel.x += 1;

        if (this.isDashing) {
            this.vel.x *= 1.1; 
            this.vel.y *= 1.1;
        } else {
            const mag = Math.hypot(this.vel.x, this.vel.y);
            if (mag > this.speed) {
                this.vel.x = (this.vel.x / mag) * this.speed;
                this.vel.y = (this.vel.y / mag) * this.speed;
            }
            this.vel.x *= this.friction;
            this.vel.y *= this.friction;
        }

        this.x += this.vel.x;
        this.y += this.vel.y;

        // Boundaries
        this.x = Math.max(this.r, Math.min(WORLD_SIZE - this.r, this.x));
        this.y = Math.max(this.r, Math.min(WORLD_SIZE - this.r, this.y));

        // Aim
        this.angle = Math.atan2(mouse.wy - this.y, mouse.wx - this.x);

        // Timers
        if (this.dashCd > 0) this.dashCd--;
        if (this.shieldCd > 0) this.shieldCd--;
        if (this.nukeCd > 0) this.nukeCd--;
        if (this.shootTimer > 0) this.shootTimer--;

        // Shoot
        if (mouse.down && this.shootTimer <= 0) {
            this.shoot();
            this.shootTimer = this.fireRate;
        }

        // Shield Decay
        if (this.shieldHp > 0) {
            this.shieldHp -= 0.1;
            if (this.shieldHp < 0) this.shieldHp = 0;
        }
    }

    dash() {
        if (this.dashCd <= 0) {
            this.isDashing = true;
            this.dashCd = this.maxDashCd;
            audioService.playTone(300, 'sine', 0.3);
            
            const dashAngle = (this.vel.x === 0 && this.vel.y === 0) ? this.angle : Math.atan2(this.vel.y, this.vel.x);
            this.vel.x = Math.cos(dashAngle) * 30;
            this.vel.y = Math.sin(dashAngle) * 30;
            
            setTimeout(() => this.isDashing = false, 250);
            
            for (let i = 0; i < 10; i++) {
                this.addParticle(new Particle(this.x, this.y, 'cyan', 2));
            }
            return true; // signal camera shake
        }
        return false;
    }

    activateShield() {
        if (this.shieldCd <= 0) {
            this.shieldHp = 50;
            this.shieldCd = this.maxShieldCd;
            audioService.playTone(600, 'triangle', 0.5);
            this.addParticle(new Particle(this.x, this.y, 'blue', 5, 5));
        }
    }

    activateNuke() {
        if (this.nukeCd <= 0) {
            this.nukeCd = this.maxNukeCd;
            audioService.playTone(100, 'sawtooth', 1.0, 0.5);
            this.addParticle(new Particle(this.x, this.y, 'white', 10, 10));
            return true; // signal nuke effect
        }
        return false;
    }

    shoot() {
        audioService.playTone(400 + Math.random() * 100, 'square', 0.1, 0.05);
        let startAngle = this.angle - (this.multishot - 1) * this.spread / 2;
        
        for (let i = 0; i < this.multishot; i++) {
            let a = startAngle + i * this.spread;
            let vx = Math.cos(a) * this.bulletSpeed;
            let vy = Math.sin(a) * this.bulletSpeed;
            this.addProjectile(new Projectile(this.x, this.y, vx, vy, this.damage, this.homing));
        }
        
        this.x -= Math.cos(this.angle) * 2;
        this.y -= Math.sin(this.angle) * 2;
    }

    gainXp(amount: number) {
        this.xp += amount;
        if (this.xp >= this.maxXp) {
            this.xp -= this.maxXp;
            this.maxXp = Math.floor(this.maxXp * 1.2);
            this.level++;
            this.hp = this.maxHp;
            this.levelUpCallback();
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Shield
        if (this.shieldHp > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 200, 255, ${0.3 + this.shieldHp / 50})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Ship
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.isDashing ? '#fff' : '#00d2ff';
        ctx.fillStyle = this.isDashing ? '#fff' : '#00d2ff';
        
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-15, 15);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-15, -15);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}