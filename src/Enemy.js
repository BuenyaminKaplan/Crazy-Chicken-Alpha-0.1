import { CONFIG } from "./Config.js";
import { aabb } from "./Collision.js";

export class Enemy {
  constructor(type, x, difficulty){
    this.type = type;
    const specs = {
      pig: { w:42, h:30, hp:3, speed:95, chase:305, y:36 },
      cow: { w:56, h:40, hp:6, speed:66, chase:230, y:54 },
      crow: { w:38, h:28, hp:2, speed:115, chase:230, y:180 },
      angryChicken: { w:34, h:30, hp:2, speed:155, chase:390, y:38 }
    }[type];
    this.x = x; this.baseY = type === "crow" ? CONFIG.groundY - specs.y : CONFIG.groundY - specs.y;
    this.y = this.baseY;
    this.w = specs.w; this.h = specs.h;
    this.hp = specs.hp;
    this.speed = specs.speed * difficulty.speed;
    this.chaseSpeed = specs.chase * difficulty.speed;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.minX = x - 240; this.maxX = x + 240;
    this.alive = true;
    this.hitT = 0;
    this.knockVX = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.aggro = false;
  }

  damage(dmg, dir, knock){
    this.hp -= dmg;
    this.hitT = 0.14;
    this.knockVX += dir * knock;
    if (this.hp <= 0) this.alive = false;
    return !this.alive;
  }

  update(dt, player, blocks){
    if (!this.alive) return;
    this.hitT = Math.max(0, this.hitT - dt);
    this.knockVX *= 0.88;
    this.x += this.knockVX * dt;

    const px = player.x + player.dims().w/2;
    const ex = this.x + this.w/2;
    const dist = Math.abs(px - ex);
    this.aggro = dist < 560 ? true : (dist > 760 ? false : this.aggro);

    if (this.type === "crow"){
      this.dir = px >= ex ? 1 : -1;
      this.x += (this.aggro ? this.chaseSpeed : this.speed) * this.dir * dt;
      this.y = this.baseY + Math.sin(performance.now()/300 + this.phase) * 34;
      return;
    }

    if (this.aggro){
      this.dir = px >= ex ? 1 : -1;
      this.x += this.chaseSpeed * this.dir * dt;
    } else {
      this.x += this.speed * this.dir * dt;
      if (this.x < this.minX) this.dir = 1;
      if (this.x > this.maxX) this.dir = -1;
    }

    for (const b of blocks){
      if (!aabb(this.x, this.y, this.w, this.h, b.x, b.y, b.w, b.h)) continue;
      if (this.dir > 0) this.x = b.x - this.w;
      else this.x = b.x + b.w;
      this.dir *= -1;
    }
  }

  draw(ctx, cam){
    if (!this.alive) return;
    const x = this.x - cam.x, y = this.y - cam.y;
    if (x < -260 || x > CONFIG.canvas.width + 260) return;
    ctx.save();
    ctx.globalAlpha = this.hitT > 0 ? 0.55 : 1;
    if (this.type === "pig") this.drawPig(ctx, x, y);
    else if (this.type === "cow") this.drawCow(ctx, x, y);
    else if (this.type === "crow") this.drawCrow(ctx, x, y);
    else this.drawAngryChicken(ctx, x, y);
    ctx.restore();
  }

  drawPig(ctx,x,y){
    ctx.fillStyle = "#ffb6c1";
    ctx.beginPath(); ctx.ellipse(x+this.w/2, y+this.h/2, this.w/2, this.h/2, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#ff8da0"; ctx.beginPath(); ctx.ellipse(x+this.w-10, y+15, 10, 7, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#1b1b1b"; ctx.beginPath(); ctx.arc(x+12, y+11, 2.3, 0, Math.PI*2); ctx.fill();
  }

  drawCow(ctx,x,y){
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(x+this.w/2, y+this.h/2, this.w/2, this.h/2, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#222";
    ctx.beginPath(); ctx.ellipse(x+15, y+14, 9, 7, .4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+38, y+24, 10, 8, -.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#f2a7a7"; ctx.beginPath(); ctx.ellipse(x+this.w-8, y+24, 12, 8, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(x+this.w-13, y+12, 2.2, 0, Math.PI*2); ctx.fill();
  }

  drawCrow(ctx,x,y){
    ctx.fillStyle = "#1f2430";
    ctx.beginPath(); ctx.ellipse(x+this.w/2, y+this.h/2, this.w/2, this.h/2, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#2f3948";
    ctx.beginPath(); ctx.ellipse(x+12, y+18, 16, 6, -0.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+27, y+13, 14, 6, 0.4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#f0b333"; ctx.beginPath(); ctx.moveTo(x+this.w-2,y+13); ctx.lineTo(x+this.w+9,y+17); ctx.lineTo(x+this.w-2,y+20); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillRect(x+this.w-11,y+8,3,3);
  }

  drawAngryChicken(ctx,x,y){
    ctx.fillStyle = "#f3f0d2";
    ctx.beginPath(); ctx.ellipse(x+this.w/2, y+this.h/2, this.w/2, this.h/2, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#d93024"; ctx.beginPath(); ctx.arc(x+12,y+3,5,0,Math.PI*2); ctx.arc(x+18,y+2,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#ff8a2a"; ctx.beginPath(); ctx.moveTo(x+this.w-4,y+14); ctx.lineTo(x+this.w+8,y+18); ctx.lineTo(x+this.w-4,y+21); ctx.fill();
    ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x+10,y+10); ctx.lineTo(x+17,y+13); ctx.stroke();
    ctx.lineWidth = 1;
  }
}
