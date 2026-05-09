import { CONFIG } from "./Config.js";
import { clamp, lerp } from "./Utils.js";

export class Player {
  constructor(){
    this.baseW = 34;
    this.baseH = 34;
    this.reset();
  }

  reset(){
    this.x = 120; this.y = 380;
    this.vx = 0; this.vy = 0;
    this.scale = 1;
    this.facing = 1;
    this.onGround = false;
    this.bob = 0;
    this.hp = CONFIG.maxHp;
    this.lives = CONFIG.lives;
    this.eggPower = 0;
    this.invuln = 0;
    this.hurtFlash = 0;
    this.hurtGrace = 0;
    this.loadGrace = 2;
    this.flameTimer = 0;
    this.featherTimer = 0;
    this.charging = false;
    this.chargeT = 0;
    this.fireCooldown = 0;
    this.stompCooldown = 0;
    this.stompPrimed = false;
    this.stompLock = 0;
    this.dying = false;
    this.deathT = 0;
    this.deathBeepT = 0;
    this.deathRespawn = false;
    this.popups = [];
  }

  dims(){ return { w:this.baseW * this.scale, h:this.baseH * this.scale }; }
  rect(){ const d = this.dims(); return { x:this.x, y:this.y, w:d.w, h:d.h }; }
  center(){ const d = this.dims(); return { x:this.x + d.w/2, y:this.y + d.h/2 }; }

  damageMult(){
    let m = 1 + 0.03 * this.eggPower;
    if (this.eggPower >= 10) m *= 1.10;
    if (this.eggPower >= 20) m *= 1.10;
    if (this.eggPower >= 30) m *= 1.10;
    return m;
  }

  addPopup(text, color="#fff"){
    const c = this.center();
    this.popups.push({ text, color, x:c.x, y:c.y - 34, t:0, life:1.0 });
  }

  addEgg(){
    this.eggPower = clamp(this.eggPower + 1, 0, CONFIG.eggMax);
    this.scale = 1 + clamp(this.eggPower / CONFIG.eggMax, 0, 1) * 0.7;
    this.hp = clamp(this.hp + 1, 0, CONFIG.maxHp);
    this.addPopup("+ Ei", "#fff6cf");
  }

  activatePower(kind){
    if (kind === "goldEgg"){
      this.invuln = Math.max(this.invuln, 5);
      this.addPopup("Gold-Ei aktiv!", "#ffe36a");
    } else if (kind === "chili"){
      this.flameTimer = 5;
      this.addPopup("Chili-Power!", "#ff7a2a");
    } else if (kind === "feather"){
      this.featherTimer = 6;
      this.addPopup("Feder-Sprung!", "#d7f7ff");
    } else {
      this.addEgg();
    }
  }

  takeDamage(amount, difficulty){
    if (this.invuln > 0 || this.hurtGrace > 0 || this.loadGrace > 0 || this.dying) return false;
    this.hp -= amount * difficulty.damage;
    this.hurtFlash = 0.85;
    this.hurtGrace = 0.65;
    return this.hp <= 0;
  }

  startDeath(respawnAfter){
    this.lives -= 1;
    this.dying = true;
    this.deathRespawn = respawnAfter;
    this.deathT = 2;
    this.deathBeepT = 0;
    this.hp = 0;
    this.vx = 0; this.vy = 0; this.facing = 1;
  }

  finishRespawn(startX){
    this.dying = false;
    this.deathRespawn = false;
    this.hp = CONFIG.maxHp;
    this.x = Math.max(startX + 60, this.x - 520);
    this.y = 380;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.hurtFlash = 0.9;
    this.hurtGrace = 0.75;
    this.loadGrace = 1.5;
    this.stompPrimed = false;
    this.stompLock = 0;
  }

  updateTimers(dt){
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.hurtGrace = Math.max(0, this.hurtGrace - dt);
    this.loadGrace = Math.max(0, this.loadGrace - dt);
    this.flameTimer = Math.max(0, this.flameTimer - dt);
    this.featherTimer = Math.max(0, this.featherTimer - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.stompCooldown = Math.max(0, this.stompCooldown - dt);
    this.stompLock = Math.max(0, this.stompLock - dt);
    for (let i=this.popups.length-1;i>=0;i--){
      const p = this.popups[i];
      p.t += dt; p.y -= 28 * dt;
      if (p.t >= p.life) this.popups.splice(i, 1);
    }
  }

  update(input, dt, difficulty){
    if (this.dying) return;
    this.updateTimers(dt);

    const accel = 7840 * difficulty.speed;
    const maxVx = 4160 * difficulty.speed;
    const jump = this.featherTimer > 0 ? 1450 : 1200;

    if (input.pressed("down") && !this.onGround) this.startStomp();

    if (this.stompLock <= 0){
      if (input.keys.left) { this.vx -= accel * dt; this.facing = -1; }
      if (input.keys.right){ this.vx += accel * dt; this.facing = 1; }
    } else {
      this.vx = 0;
    }

    if (input.keys.up && this.onGround && this.stompLock <= 0){
      this.vy = -jump;
      this.onGround = false;
    }

    if (input.keys.fire){
      this.charging = true;
      this.chargeT = clamp(this.chargeT + dt, 0, CONFIG.chargeMax);
    }

    this.vy += CONFIG.gravity * dt;
    this.vx *= this.onGround ? 0.83 : 0.95;
    this.vx = clamp(this.vx, -maxVx, maxVx);
    this.vy = clamp(this.vy, -1850, 2200);
    const moving = Math.abs(this.vx) > 90 || !this.onGround;
    this.bob += (moving ? 18 : 6) * dt;
  }

  startStomp(){
    if (this.stompCooldown > 0 || this.stompLock > 0 || this.stompPrimed) return false;
    this.stompPrimed = true;
    this.vx *= 0.35;
    this.vy = 2100;
    this.stompLock = 0.10;
    return true;
  }

  landStomp(){
    this.vx = 0; this.vy = 0;
    this.stompLock = 0.24;
    this.stompCooldown = 1.35;
    this.stompPrimed = false;
  }

  makeFireball(){
    if (this.fireCooldown > 0) return null;
    const t = clamp(this.chargeT / CONFIG.chargeMax, 0, 1);
    const full = t >= 0.999;
    const d = this.dims();
    const speed = full ? 3200 : lerp(2200, 2800, t);
    const r = full ? 20 : lerp(7, 16, t);
    const base = full ? 2.2 : lerp(0.7, 1.2, t);
    this.fireCooldown = full ? 0.22 : 0.055;
    this.charging = false;
    this.chargeT = 0;
    return {
      x:this.x + d.w/2 + this.facing * (d.w * 0.62),
      y:this.y + d.h*0.42,
      vx:this.facing * speed,
      vy:0,
      r,
      life:1.1,
      dmg:Math.max(1, Math.floor(base * this.damageMult())),
      charged:full
    };
  }

  draw(ctx, cam, time){
    const {w,h} = this.dims();
    const x = this.x - cam.x, y = this.y - cam.y;
    const bob = this.onGround ? Math.sin(this.bob)*1.2 : 0;

    if (this.dying){
      this.drawDeath(ctx, x, y, w, h, bob);
      return;
    }

    if (this.invuln > 0){
      ctx.fillStyle = "rgba(255,224,78,.22)";
      ctx.beginPath(); ctx.arc(x+w/2, y+h/2 + bob, Math.max(w,h)*0.78, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "rgba(255,245,155,.75)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x+w/2, y+h/2 + bob, Math.max(w,h)*0.68, 0, Math.PI*2); ctx.stroke();
      ctx.lineWidth = 1;
    }
    if (this.hurtFlash > 0){
      const a = 0.18 + 0.50 * (0.5 + 0.5*Math.sin(this.hurtFlash*52));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(x+w/2, y+h/2 + bob, Math.max(w,h)*0.76, 0, Math.PI*2); ctx.fill();
    }

    ctx.fillStyle = "#ffd34a";
    ctx.beginPath(); ctx.ellipse(x+w/2, y+h/2 + bob, 16*this.scale, 14*this.scale, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+w/2 + 6*this.facing*this.scale, y+12*this.scale + bob, 13*this.scale, 12*this.scale, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "rgba(255,190,40,.95)";
    ctx.beginPath(); ctx.ellipse(x+w/2 - 4*this.facing*this.scale, y+22*this.scale + bob, 9*this.scale, 6*this.scale, 0.2*this.facing, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#ff8a2a";
    ctx.beginPath();
    ctx.moveTo(x+w/2 + 18*this.facing*this.scale, y+14*this.scale + bob);
    ctx.lineTo(x+w/2 + 30*this.facing*this.scale, y+18*this.scale + bob);
    ctx.lineTo(x+w/2 + 18*this.facing*this.scale, y+22*this.scale + bob);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#1b1b1b";
    ctx.beginPath(); ctx.arc(x+w/2 + 10*this.facing*this.scale, y+10*this.scale + bob, 2.2*this.scale, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#ff8a2a"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x+w/2 - 6*this.scale, y+h-2 + bob); ctx.lineTo(x+w/2 - 10*this.scale, y+h+6 + bob);
    ctx.moveTo(x+w/2 + 6*this.scale, y+h-2 + bob); ctx.lineTo(x+w/2 + 10*this.scale, y+h+6 + bob);
    ctx.stroke(); ctx.lineWidth = 1;

    if (this.charging){
      const t = clamp(this.chargeT / CONFIG.chargeMax, 0, 1);
      const bx = x+w/2 + 30*this.facing*this.scale;
      const by = y+18*this.scale + bob;
      ctx.fillStyle = `rgba(255,120,40,${0.10 + t*0.20})`;
      ctx.beginPath(); ctx.arc(bx, by, lerp(12,44,t), 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = t > 0.98 ? "#ff4a1a" : "#ff7a2a";
      ctx.beginPath(); ctx.arc(bx, by, lerp(6,22,t), 0, Math.PI*2); ctx.fill();
    }

    if (this.flameTimer > 0){
      const bx = x+w/2 + 25*this.facing*this.scale;
      const by = y+18*this.scale + bob;
      const len = 116 + Math.sin(time*34)*18;
      ctx.fillStyle = "rgba(255,72,14,.46)";
      ctx.beginPath();
      ctx.moveTo(bx, by-14); ctx.lineTo(bx + this.facing*len, by-44);
      ctx.lineTo(bx + this.facing*(len+54), by); ctx.lineTo(bx + this.facing*len, by+44);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,232,86,.68)";
      ctx.beginPath();
      ctx.moveTo(bx, by-7); ctx.lineTo(bx + this.facing*(len*0.82), by-22);
      ctx.lineTo(bx + this.facing*(len+26), by); ctx.lineTo(bx + this.facing*(len*0.82), by+22);
      ctx.closePath(); ctx.fill();
    }
  }

  drawDeath(ctx, x, y, w, h, bob){
    const elapsed = clamp(2 - this.deathT, 0, 2);
    const jump = Math.sin(clamp(elapsed / 1.15, 0, 1) * Math.PI) * 76;
    const wobble = Math.sin(elapsed * 22) * 2.2;
    const cry = Math.sin(elapsed * 24) * 2.2;
    const dx = x + w/2, dy = y - jump + bob + wobble;
    ctx.fillStyle = "#ffd34a";
    ctx.beginPath(); ctx.ellipse(dx, dy+h/2, 18*this.scale, 15*this.scale, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(dx, dy+12*this.scale, 15*this.scale, 13*this.scale, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#f2b529"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(dx-19*this.scale, dy+20*this.scale); ctx.lineTo(dx-30*this.scale, dy+7*this.scale-cry);
    ctx.moveTo(dx+19*this.scale, dy+20*this.scale); ctx.lineTo(dx+30*this.scale, dy+7*this.scale+cry);
    ctx.stroke();
    ctx.fillStyle = "#ff8a2a";
    ctx.beginPath(); ctx.moveTo(dx-6*this.scale, dy+19*this.scale); ctx.lineTo(dx, dy+25*this.scale); ctx.lineTo(dx+6*this.scale, dy+19*this.scale); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f7f5ff";
    ctx.beginPath(); ctx.ellipse(dx-6*this.scale, dy+10*this.scale, 5*this.scale, 6*this.scale, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(dx+6*this.scale, dy+10*this.scale, 5*this.scale, 6*this.scale, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#202020";
    ctx.beginPath(); ctx.arc(dx-6*this.scale, dy+11*this.scale, 2.5*this.scale, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(dx+6*this.scale, dy+11*this.scale, 2.5*this.scale, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#5db7ff"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(dx-7*this.scale, dy+16*this.scale); ctx.lineTo(dx-10*this.scale, dy+29*this.scale+cry);
    ctx.moveTo(dx+7*this.scale, dy+16*this.scale); ctx.lineTo(dx+10*this.scale, dy+29*this.scale-cry);
    ctx.stroke(); ctx.lineWidth = 1;
  }
}
