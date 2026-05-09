import { CONFIG } from "./Config.js";
import { aabb } from "./Collision.js";
import { OUTLINE, contactShadow, ellipse, fillStroke } from "./Art.js";

export class Enemy {
  constructor(type, x, difficulty){
    this.type = type;
    const specs = {
      pig: { w:42, h:30, hp:3, speed:95, chase:305, y:36 },
      cow: { w:56, h:40, hp:6, speed:66, chase:230, y:54 },
      crow: { w:38, h:28, hp:2, speed:115, chase:230, y:180 },
      angryChicken: { w:34, h:30, hp:2, speed:155, chase:390, y:38 },
      rooster: { w:46, h:42, hp:4, speed:110, chase:520, y:50 },
      bull: { w:64, h:44, hp:5, speed:175, chase:610, y:58 },
      fox: { w:48, h:30, hp:3, speed:135, chase:430, y:38 },
      giantRooster: { w:96, h:92, hp:32, speed:74, chase:250, y:100 }
    }[type];
    this.x = x; this.baseY = type === "crow" ? CONFIG.groundY - specs.y : CONFIG.groundY - specs.y;
    this.y = this.baseY;
    this.w = specs.w; this.h = specs.h;
    this.hp = specs.hp;
    this.speed = specs.speed * difficulty.speed;
    this.chaseSpeed = specs.chase * difficulty.speed;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.targetDir = this.dir;
    this.turnT = 0;
    this.jumpT = 0;
    this.jumpCooldown = 0.7 + Math.random()*0.8;
    this.slowT = 0;
    this.minX = x - 240; this.maxX = x + 240;
    this.alive = true;
    this.hitT = 0;
    this.knockVX = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.aggro = false;
    this.chargeT = 0;
    this.warnT = 0;
    this.boss = type === "giantRooster";
    this.maxHp = specs.hp;
  }

  damage(dmg, dir, knock){
    this.hp -= dmg;
    this.hitT = 0.14;
    this.knockVX += dir * knock;
    if (this.hp <= 0) this.alive = false;
    return !this.alive;
  }

  update(dt, player, blocks, playerHidden=false){
    if (!this.alive) return;
    this.hitT = Math.max(0, this.hitT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.turnT = Math.max(0, this.turnT - dt);
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    if (this.type !== "crow"){
      if (this.jumpT > 0){
        this.jumpT = Math.max(0, this.jumpT - dt);
        const p = 1 - this.jumpT / 0.42;
        this.y = this.baseY - Math.sin(p * Math.PI) * (this.type === "rooster" ? 54 : 38);
      } else {
        this.y = this.baseY;
      }
    }
    this.knockVX *= 0.88;
    this.x += this.knockVX * dt;

    const px = player.x + player.dims().w/2;
    const ex = this.x + this.w/2;
    const dist = Math.abs(px - ex);
    if (playerHidden){
      this.aggro = false;
      this.warnT = Math.max(0, this.warnT - dt * 4);
      this.chargeT = Math.max(0, this.chargeT - dt * 3);
    } else {
      this.aggro = dist < 560 ? true : (dist > 760 ? false : this.aggro);
    }
    const speedMul = this.slowT > 0 ? 0.48 : 1;

    if (this.type === "crow"){
      this.chooseDirection(px >= ex ? 1 : -1, dist < 38 ? 0.42 : 0.20);
      const landing = !this.aggro && Math.sin(performance.now()/1200 + this.phase) > 0.72;
      this.x += (this.aggro ? this.chaseSpeed : this.speed) * this.dir * dt * speedMul;
      this.y = (landing ? CONFIG.groundY - 70 : this.baseY) + Math.sin(performance.now()/300 + this.phase) * (landing ? 6 : 34);
      return;
    }

    if (this.type === "rooster" || this.type === "bull" || this.type === "giantRooster"){
      this.chargeT -= dt;
      this.warnT = Math.max(0, this.warnT - dt);
      if (this.aggro && this.chargeT <= 0){
        this.warnT = 0.45;
        this.chargeT = this.type === "giantRooster" ? 2.2 : 1.4;
      }
      if (this.warnT > 0){
        this.chooseDirection(px >= ex ? 1 : -1, 0.12);
      } else if (this.chargeT > (this.type === "giantRooster" ? 1.45 : 0.78)){
        this.x += this.chaseSpeed * 1.45 * this.dir * dt * speedMul;
      } else if (this.aggro) {
        this.chooseDirection(px >= ex ? 1 : -1, dist < 34 ? 0.35 : 0.18);
        this.x += this.speed * 0.45 * this.dir * dt * speedMul;
        if ((this.type === "rooster" || this.type === "giantRooster") && dist < 260 && this.jumpCooldown <= 0){
          this.jumpT = 0.42;
          this.jumpCooldown = this.type === "giantRooster" ? 1.9 : 1.25;
        }
      } else {
        this.x += this.speed * 0.55 * this.dir * dt * speedMul;
      }
    } else if (this.type === "fox"){
      const targetEgg = player.eggPower > 0;
      this.chooseDirection(px >= ex ? 1 : -1, dist < 42 ? 0.38 : 0.16);
      this.x += (this.aggro || targetEgg ? this.chaseSpeed : this.speed) * this.dir * dt * speedMul;
    } else {
      if (this.aggro){
        this.chooseDirection(px >= ex ? 1 : -1, dist < 40 ? 0.38 : 0.18);
        const ram = this.type === "pig" && dist < 330 ? 1.22 : 1;
        this.x += this.chaseSpeed * this.dir * dt * speedMul * ram;
      } else {
        this.x += this.speed * this.dir * dt * speedMul;
        if (this.x < this.minX) this.chooseDirection(1, 0.12);
        if (this.x > this.maxX) this.chooseDirection(-1, 0.12);
      }
    }

    for (const b of blocks){
      if (!aabb(this.x, this.y, this.w, this.h, b.x, b.y, b.w, b.h)) continue;
      if (this.jumpCooldown <= 0 && this.type !== "giantRooster"){
        this.jumpT = 0.42;
        this.jumpCooldown = 1.15 + Math.random()*0.45;
        continue;
      }
      if (this.dir > 0) this.x = b.x - this.w;
      else this.x = b.x + b.w;
      this.chooseDirection(-this.dir, 0.08);
    }
  }

  chooseDirection(dir, delay=0.18){
    if (dir === this.dir) return;
    this.targetDir = dir;
    if (this.turnT > 0) return;
    this.dir = dir;
    this.turnT = delay + Math.random()*0.08;
  }

  draw(ctx, cam){
    if (!this.alive) return;
    const x = this.x - cam.x, y = this.y - cam.y;
    if (x < -260 || x > CONFIG.canvas.width + 260) return;
    ctx.save();
    ctx.globalAlpha = this.hitT > 0 ? 0.55 : 1;
    if (this.type !== "crow") contactShadow(ctx, x + this.w/2, y + this.h + 5, this.w * 0.42, this.boss ? 0.22 : 0.17);
    if (this.type === "pig") this.drawPig(ctx, x, y);
    else if (this.type === "cow") this.drawCow(ctx, x, y);
    else if (this.type === "crow") this.drawCrow(ctx, x, y);
    else if (this.type === "rooster") this.drawRooster(ctx, x, y);
    else if (this.type === "bull") this.drawBull(ctx, x, y);
    else if (this.type === "fox") this.drawFox(ctx, x, y);
    else if (this.type === "giantRooster") this.drawGiantRooster(ctx, x, y);
    else this.drawAngryChicken(ctx, x, y);
    if (this.warnT > 0){
      ctx.strokeStyle = "rgba(255,60,30,.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 16, y - 8);
      ctx.lineTo(x + this.w + 16, y - 8);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.restore();
  }

  drawPig(ctx,x,y){
    const walk = Math.sin(performance.now()/130 + this.phase) * 2;
    ellipse(ctx, x+this.w/2, y+17+walk*.3, 22, 14, 0.04*this.dir, "#ffadc0", OUTLINE, 2.8);
    ellipse(ctx, x+this.w-8, y+16, 12, 9, 0, "#ff9aae", OUTLINE, 2.4);
    ctx.fillStyle = "#ffadc0";
    ctx.beginPath(); ctx.moveTo(x+9,y+8); ctx.lineTo(x+14,y-2); ctx.lineTo(x+19,y+9); ctx.closePath(); fillStroke(ctx, "#ffadc0", OUTLINE, 2);
    ctx.beginPath(); ctx.moveTo(x+27,y+8); ctx.lineTo(x+33,y-1); ctx.lineTo(x+36,y+11); ctx.closePath(); fillStroke(ctx, "#ffadc0", OUTLINE, 2);
    ctx.strokeStyle = "#7b4a46"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x+12,y+27); ctx.lineTo(x+10,y+34+walk); ctx.moveTo(x+29,y+27); ctx.lineTo(x+31,y+34-walk); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = "#8a3c4b"; ctx.beginPath(); ctx.arc(x+this.w-11, y+16, 1.7, 0, Math.PI*2); ctx.arc(x+this.w-5, y+16, 1.7, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#171717"; ctx.beginPath(); ctx.arc(x+this.w-18, y+10, 2.2, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#b15a72"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x+4,y+16,5,Math.PI*1.1,Math.PI*2.45); ctx.stroke(); ctx.lineWidth = 1;
  }

  drawCow(ctx,x,y){
    const slide = Math.sin(performance.now()/260 + this.phase) * 1.2;
    ellipse(ctx, x+25, y+22, 28, 17, -0.04, "#fff6e9", OUTLINE, 2.8);
    ctx.fillStyle = "#252525"; ctx.beginPath(); ctx.ellipse(x+17,y+16,9,6,.4,0,Math.PI*2); ctx.ellipse(x+35,y+27,10,7,-.2,0,Math.PI*2); ctx.fill();
    ellipse(ctx, x+this.w-9, y+20+slide, 15, 13, 0, "#fff6e9", OUTLINE, 2.6);
    ellipse(ctx, x+this.w-6, y+27, 11, 7, 0, "#efa8a8", OUTLINE, 1.8);
    ctx.strokeStyle = "#f2e2bc"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x+this.w-17,y+8); ctx.lineTo(x+this.w-25,y-4); ctx.moveTo(x+this.w-2,y+9); ctx.lineTo(x+this.w+10,y-1); ctx.stroke(); ctx.lineWidth = 1;
    ctx.strokeStyle = "#3b2a21"; ctx.lineWidth = 4;
    for (let i=0;i<4;i++){ const lx=x+8+i*11; ctx.beginPath(); ctx.moveTo(lx,y+34); ctx.lineTo(lx+(i%2?2:-1),y+45); ctx.stroke(); }
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(x+this.w-13,y+15,2.2,0,Math.PI*2); ctx.fill();
  }

  drawCrow(ctx,x,y){
    const flap = Math.sin(performance.now()/95 + this.phase);
    ctx.fillStyle = "rgba(0,0,0,.10)"; ctx.beginPath(); ctx.ellipse(x+this.w/2,CONFIG.groundY+5,18,4,0,0,Math.PI*2); ctx.fill();
    ellipse(ctx, x+20, y+16, 17, 12, 0, "#232a37", OUTLINE, 2.2);
    ctx.beginPath(); ctx.ellipse(x+12, y+16, 23, 6, -0.55-flap*.35, 0, Math.PI*2); fillStroke(ctx, "#303b4c", OUTLINE, 2);
    ctx.beginPath(); ctx.ellipse(x+28, y+16, 23, 6, 0.55+flap*.35, 0, Math.PI*2); fillStroke(ctx, "#303b4c", OUTLINE, 2);
    ctx.fillStyle = "#f2b42d"; ctx.beginPath(); ctx.moveTo(x+this.w-3,y+13); ctx.lineTo(x+this.w+11,y+17); ctx.lineTo(x+this.w-3,y+21); ctx.closePath(); fillStroke(ctx, "#f2b42d", OUTLINE, 1.5);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x+this.w-12,y+10,3,0,Math.PI*2); ctx.fill(); ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(x+this.w-11,y+10,1.4,0,Math.PI*2); ctx.fill();
  }

  drawAngryChicken(ctx,x,y){
    ellipse(ctx, x+this.w/2, y+this.h/2, this.w/2, this.h/2, 0, "#f3f0d2", OUTLINE, 2.5);
    ellipse(ctx, x+13, y+18, 9, 6, -.3, "#e6d8b4", "rgba(72,50,31,.6)", 1.4);
    ctx.fillStyle = "#d93024"; ctx.beginPath(); ctx.arc(x+12,y+3,5,0,Math.PI*2); ctx.arc(x+18,y+2,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#ff8a2a"; ctx.beginPath(); ctx.moveTo(x+this.w-4,y+14); ctx.lineTo(x+this.w+8,y+18); ctx.lineTo(x+this.w-4,y+21); ctx.closePath(); fillStroke(ctx, "#ff8a2a", OUTLINE, 1.4);
    ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x+10,y+10); ctx.lineTo(x+17,y+13); ctx.stroke();
    ctx.lineWidth = 1;
  }

  drawRooster(ctx,x,y){
    const pump = this.warnT > 0 ? Math.sin(performance.now()/45)*2 : Math.sin(performance.now()/140+this.phase);
    ellipse(ctx, x+22, y+24+pump*.25, 22, 17, -0.05*this.dir, "#fff6d5", OUTLINE, 2.8);
    ellipse(ctx, x+this.w-11, y+20+pump*.2, 13, 13, 0, "#fff6d5", OUTLINE, 2.4);
    ctx.fillStyle = "#327a58";
    for (let i=0;i<3;i++){ ctx.beginPath(); ctx.ellipse(x+5-i*4,y+17+i*4,12,5,-0.9,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle = "#cc2620"; ctx.beginPath(); ctx.arc(x+14,y+4,6,0,Math.PI*2); ctx.arc(x+23,y+2,7,0,Math.PI*2); ctx.arc(x+32,y+5,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#ff8a2a"; ctx.beginPath(); ctx.moveTo(x+this.w-4,y+17); ctx.lineTo(x+this.w+12,y+22); ctx.lineTo(x+this.w-4,y+27); ctx.closePath(); fillStroke(ctx, "#ff8a2a", OUTLINE, 1.6);
    ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x+13,y+15); ctx.lineTo(x+23,y+18); ctx.stroke(); ctx.lineWidth = 1;
    ctx.strokeStyle = "#c77722"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x+18,y+37); ctx.lineTo(x+15,y+46); ctx.moveTo(x+30,y+37); ctx.lineTo(x+32,y+46); ctx.stroke(); ctx.lineWidth = 1;
  }

  drawBull(ctx,x,y){
    const charge = this.warnT > 0 ? Math.sin(performance.now()/40)*1.8 : 0;
    ellipse(ctx, x+28, y+24+charge*.2, 31, 17, 0, "#7b4a32", OUTLINE, 3);
    ellipse(ctx, x+this.w-14,y+20,19,15,0,"#a06b48",OUTLINE,2.6);
    ctx.fillStyle = "#5b3222"; ctx.beginPath(); ctx.ellipse(x+20,y+17,11,6,.2,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#f0e0be"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x+this.w-22,y+7); ctx.lineTo(x+this.w-38,y-6); ctx.moveTo(x+this.w-8,y+7); ctx.lineTo(x+this.w+8,y-6); ctx.stroke();
    ctx.strokeStyle = "#3b241a"; ctx.lineWidth = 5;
    for (let i=0;i<4;i++){ const lx=x+12+i*13; ctx.beginPath(); ctx.moveTo(lx,y+35); ctx.lineTo(lx+(i%2?3:-2),y+47); ctx.stroke(); }
    ctx.fillStyle = "#111"; ctx.fillRect(x+this.w-17,y+15,3,3); ctx.fillRect(x+this.w-7,y+15,3,3); ctx.lineWidth = 1;
  }

  drawFox(ctx,x,y){
    const sneak = Math.sin(performance.now()/180 + this.phase) * 2;
    ellipse(ctx, x+22, y+17+sneak*.2, 22, 11, -0.06*this.dir, "#d86c2f", OUTLINE, 2.5);
    ctx.beginPath(); ctx.ellipse(x+5, y+14, 18, 8, .25, 0, Math.PI*2); fillStroke(ctx, "#d86c2f", OUTLINE, 2);
    ctx.fillStyle = "#fff1d5"; ctx.beginPath(); ctx.ellipse(x-7,y+12,8,5,.25,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x+34,y+8); ctx.lineTo(x+42,y-4); ctx.lineTo(x+45,y+12); ctx.closePath(); fillStroke(ctx, "#d86c2f", OUTLINE, 2);
    ellipse(ctx, x+this.w-11,y+18,13,8,0,"#fff1d5","rgba(110,55,29,.5)",1.4);
    ctx.strokeStyle = "#5c2b18"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x+14,y+25); ctx.lineTo(x+9,y+33+sneak); ctx.moveTo(x+31,y+24); ctx.lineTo(x+35,y+32-sneak); ctx.stroke(); ctx.lineWidth=1;
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(x+this.w-14,y+11,2,0,Math.PI*2); ctx.fill();
  }

  drawGiantRooster(ctx,x,y){
    const pump = this.warnT > 0 ? Math.sin(performance.now()/42)*3 : Math.sin(performance.now()/180+this.phase)*1.2;
    ellipse(ctx, x+this.w/2-8, y+this.h/2+6+pump*.25, this.w/2, this.h/2-7, -0.02*this.dir, "#ffe17a", OUTLINE, 4);
    ellipse(ctx, x+this.w-22, y+38+pump*.2, 30, 28, 0, "#fff0a0", OUTLINE, 3.5);
    ctx.fillStyle = "#2d8a62";
    for (let i=0;i<4;i++){ ctx.beginPath(); ctx.ellipse(x+12-i*7,y+37+i*9,24,8,-0.85,0,Math.PI*2); ctx.fill(); }
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#d9251c";
    ctx.beginPath(); ctx.arc(x+28,y+8,14,0,Math.PI*2); ctx.arc(x+48,y+1,16,0,Math.PI*2); ctx.arc(x+69,y+9,14,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#ff8a2a";
    ctx.beginPath(); ctx.moveTo(x+this.w-12,y+38); ctx.lineTo(x+this.w+24,y+48); ctx.lineTo(x+this.w-12,y+58); ctx.closePath(); fillStroke(ctx, "#ff8a2a", OUTLINE, 2.2);
    ctx.strokeStyle = "#111"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x+30,y+34); ctx.lineTo(x+48,y+40); ctx.stroke();
    ctx.strokeStyle = "#c77722"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x+35,y+82); ctx.lineTo(x+29,y+102); ctx.moveTo(x+61,y+82); ctx.lineTo(x+68,y+102); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(0,0,0,.38)";
    ctx.fillRect(x+16,y-14,this.w-32,6);
    ctx.fillStyle = "#ff4c36";
    ctx.fillRect(x+16,y-14,(this.w-32)*Math.max(0,this.hp/this.maxHp),6);
  }
}
