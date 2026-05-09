import { CONFIG } from "./Config.js";
import { aabb } from "./Collision.js";
import { addHighscore, addStat, checkAchievements, noteBestScore } from "./Storage.js";
import { mixHex } from "./Utils.js";
import { AudioBus } from "./Audio.js";
import { Input } from "./Input.js";
import { Player } from "./Player.js";
import { UI } from "./UI.js";
import { World, nightAmount } from "./World.js";

export class Game {
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.audio = new AudioBus();
    this.input = new Input(this.audio);
    this.player = new Player();
    this.world = new World();
    this.ui = new UI(this);
    this.cam = { x:0, y:0 };
    this.score = 0;
    this.startX = 0;
    this.maxX = 0;
    this.worldTime = 18;
    this.lastT = performance.now();
    this.state = "start";
    this.difficultyName = "normal";
    this.pendingTop3 = null;
    this.achievements = [];
    this.slowMo = 0;
    this.musicT = 1.5;
    this.shakeT = 0;
    this.shakePow = 0;
  }

  get difficulty(){ return CONFIG.difficulties[this.difficultyName]; }

  boot(){
    this.ui.showStart();
    requestAnimationFrame(t => this.step(t));
  }

  showStart(){
    this.state = "start";
    this.ui.showStart();
  }

  startRun(){
    this.audio.resume();
    this.state = "running";
    this.ui.hide();
    this.player.reset();
    this.world.reset(this.difficulty);
    this.cam.x = 0; this.cam.y = 0;
    this.score = 0; this.startX = this.player.x; this.maxX = this.player.x;
    this.worldTime = 18;
    this.pendingTop3 = null;
    this.achievements = [];
    this.musicT = 1.2;
    addStat("runs", 1);
  }

  pause(){
    if (this.state !== "running") return;
    this.state = "paused";
    this.ui.showPause();
  }

  resume(){
    if (this.state !== "paused") return;
    this.state = "running";
    this.ui.hide();
  }

  togglePause(){
    if (this.player.dying) return;
    if (this.state === "running") this.pause();
    else if (this.state === "paused") this.resume();
    else if (this.state === "gameover") this.startRun();
  }

  step(t){
    const dt = Math.min(0.02, (t - this.lastT) / 1000);
    this.lastT = t;
    if (this.input.pressed("enter")) this.togglePause();

    if (this.state === "running") this.update(dt);
    this.render();
    this.input.snapshot();
    requestAnimationFrame(tt => this.step(tt));
  }

  update(dt){
    if (this.player.dying){
      this.updateDeath(dt);
      return;
    }

    this.worldTime += dt;
    const simDt = this.slowMo > 0 ? dt * 0.45 : dt;
    this.slowMo = Math.max(0, this.slowMo - dt);
    this.player.update(this.input, simDt, this.difficulty);
    if (this.player.justJumped){
      this.audio.jump(this.player.featherTimer > 0 ? 1.2 : 1);
      this.player.justJumped = false;
    }
    if (this.input.released("fire")){
      const f = this.player.makeFireball();
      if (f){
        this.world.fireballs.push(f);
        this.trackProgress("fireballs", 1);
        this.spawnExplosion(f.x, f.y, f.charged ? 0.7 : 0.3);
        if (f.charged) { this.audio.boom(110, 0.12, 0.12); this.addShake(0.55, 0.08); }
        else this.audio.beep(520, 0.03, "triangle", 0.07);
      }
    }

    this.resolvePlayerCollisions(simDt);
    this.applyZones(simDt);
    this.updateCamera(dt);
    this.world.generateTo(this.cam.x + CONFIG.canvas.width + 2400, this.difficulty);
    this.world.cleanup(this.cam.x);
    this.collectItems();
    this.updateEnemyContacts();
    this.updateFlamethrower(simDt);
    this.updateInvulnContact();
    this.world.update(simDt, this);
    this.updateMusic(dt);
    this.updateScore();
    if (this.shakeT > 0){
      this.shakeT -= dt;
      this.shakePow *= 0.90;
      if (this.shakeT <= 0){ this.shakeT = 0; this.shakePow = 0; }
    }
  }

  updateMusic(dt){
    if (!this.audio.enabled) return;
    this.musicT -= dt;
    if (this.musicT > 0) return;
    const night = nightAmount(this.worldTime);
    this.musicT = night > 0.55 ? 2.8 : 2.2;
    const base = night > 0.55 ? 220 : 330;
    const weatherShift = this.world.weather === "rain" ? -30 : (this.world.weather === "wind" ? 45 : 0);
    this.audio.beep(base + weatherShift, 0.08, "triangle", 0.018);
    setTimeout(() => this.audio.beep(base * 1.5 + weatherShift, 0.06, "sine", 0.014), 130);
  }

  updateDeath(dt){
    const p = this.player;
    p.deathT -= dt;
    p.deathBeepT -= dt;
    if (p.deathBeepT <= 0){
      p.deathBeepT = 0.26;
      this.audio.beep(720 + Math.random()*170, 0.06, "triangle", 0.052);
    }
    p.hurtFlash = Math.max(p.hurtFlash, 0.18);
    if (p.deathT <= 0){
      if (p.deathRespawn) p.finishRespawn(this.startX);
      else this.finishGameOver();
    }
  }

  finishGameOver(){
    this.player.dying = false;
    this.state = "gameover";
    this.ui.showGameOver();
  }

  resolvePlayerCollisions(dt){
    const p = this.player;
    const d = p.dims();
    p.onGround = false;
    p.x += p.vx * dt;
    if (p.invuln > 0) this.world.explodeBlocks(p.x-8, p.y-8, d.w+16, d.h+16, this);
    for (const b of this.world.blocks){
      if (!aabb(p.x,p.y,d.w,d.h,b.x,b.y,b.w,b.h)) continue;
      if (p.vx > 0) p.x = b.x - d.w;
      else if (p.vx < 0) p.x = b.x + b.w;
      p.vx = 0;
    }

    p.y += p.vy * dt;
    if (p.invuln > 0) this.world.explodeBlocks(p.x-8, p.y-8, d.w+16, d.h+16, this);
    for (const b of this.world.blocks){
      if (!aabb(p.x,p.y,d.w,d.h,b.x,b.y,b.w,b.h)) continue;
      if (p.vy > 0){
        p.y = b.y - d.h;
        if (b.kind === "trampoline"){
          p.vy = -(p.featherTimer > 0 ? 1700 : 1450);
          this.spawnLandingDust(p.x + d.w/2, b.y);
          this.audio.beep(620, 0.06, "triangle", 0.08);
        } else {
          p.vy = 0;
        }
        p.onGround = true;
        if (b.kind === "break") this.world.damageBlocks(b.x,b.y,b.w,b.h,99,this);
        if (b.kind === "crate") this.explodeCrate(b);
        if (p.stompPrimed) this.landStomp();
      } else if (p.vy < 0){
        p.y = b.y + b.h;
        p.vy = 0;
      }
    }

    if (p.y + d.h >= CONFIG.groundY){
      p.y = CONFIG.groundY - d.h;
      p.vy = 0;
      p.onGround = true;
      this.spawnLandingDust(p.x + d.w/2, CONFIG.groundY);
      if (p.stompPrimed) this.landStomp();
    }
    if (p.y > 1200) this.applyDamage(1);
    p.x = Math.max(this.startX, p.x);
  }

  applyZones(dt){
    const p = this.player;
    const r = p.rect();
    for (const z of this.world.zones){
      if (!aabb(r.x,r.y,r.w,r.h,z.x,z.y,z.w,z.h)) continue;
      if (z.kind === "slow") p.vx *= Math.pow(z.strength, dt * 8);
      else if (z.kind === "wind") p.vx += z.strength * dt;
    }
    if (this.world.weather === "wind") p.vx += 35 * dt;
  }

  spawnLandingDust(x, y){
    if (Math.random() > 0.25) return;
    for (let i=0;i<6;i++){
      const dir = Math.random()<0.5 ? -1 : 1;
      this.world.particles.push({ kind:"dust", x:x+dir*Math.random()*8, y:y-4, vx:dir*(90+Math.random()*190), vy:-60-Math.random()*100, r:3+Math.random()*4, t:0, life:0.18+Math.random()*0.12 });
    }
  }

  explodeCrate(block){
    this.spawnExplosion(block.x+block.w/2, block.y+block.h/2, 1.25);
    this.world.damageBlocks(block.x-90, block.y-90, 180, 180, 8, this);
    for (const e of this.world.enemies){
      if (e.alive && aabb(e.x,e.y,e.w,e.h,block.x-110,block.y-110,220,220)){
        e.damage(5, e.x < block.x ? -1 : 1, 1200);
        if (!e.alive) this.noteKill(e);
      }
    }
    this.audio.boom(64, 0.18, 0.16);
    this.addShake(1.0, 0.12);
  }

  landStomp(){
    const p = this.player;
    p.landStomp();
    const c = p.center();
    this.world.particles.push({ kind:"shockwave", x:c.x, y:CONFIG.groundY-8, r:18, t:0, life:0.34 });
    for (let i=0;i<26;i++){
      const dir = Math.random()<0.5 ? -1 : 1;
      this.world.particles.push({ kind:"dust", x:c.x+dir*Math.random()*70, y:CONFIG.groundY-4, vx:dir*(260+Math.random()*760), vy:-120-Math.random()*220, r:4+Math.random()*7, t:0, life:0.28+Math.random()*0.24 });
    }
    this.world.spawnGroundCracks(c.x, CONFIG.canvas.width*0.31);
    const radius = CONFIG.canvas.width * 0.31;
    const rx = c.x - radius;
    for (const e of this.world.enemies){
      if (e.alive && aabb(e.x,e.y,e.w,e.h,rx,0,radius*2,CONFIG.canvas.height)){
        e.alive = false;
        this.noteKill(e);
        this.spawnExplosion(e.x+e.w/2, e.y+e.h/2, 1.05);
        this.audio.enemy(e.type);
      }
    }
    this.world.damageBlocks(rx, 0, radius*2, CONFIG.canvas.height, 8, this);
    this.audio.boom(62, 0.18, 0.16);
    this.audio.noise(0.22, 0.12, 460);
    this.addShake(1.9, 0.20);
  }

  collectItems(){
    const p = this.player, c = p.center();
    for (const item of this.world.collectibles){
      if (item.got) continue;
      const dx = c.x - item.x, dy = c.y - item.y;
      if (dx*dx + dy*dy >= (item.r + 24) ** 2) continue;
      item.got = true;
      this.spawnExplosion(item.x, item.y, item.kind === "goldEgg" ? 1.15 : 0.85);
      p.activatePower(item.kind);
      if (item.kind === "egg") this.trackProgress("eggs", 1);
      this.audio.pickup(item.kind);
      this.addShake(0.35, 0.07);
    }
  }

  updateEnemyContacts(){
    const p = this.player;
    const pr = p.rect();
    for (const e of this.world.enemies){
      if (!e.alive) continue;
      const hx = e.x - 8, hy = e.y - 7, hw = e.w + 16, hh = e.h + 12;
      if (!aabb(pr.x,pr.y,pr.w,pr.h,hx,hy,hw,hh)) continue;
      const playerBottom = p.y + pr.h;
      const playerCenterX = p.x + pr.w/2;
      const nearTop = playerBottom <= e.y + e.h*0.78;
      const horizontallyClose = playerCenterX > e.x - 18 && playerCenterX < e.x + e.w + 18;
      if (p.invuln > 0){
        e.alive = false;
        this.noteKill(e);
        this.spawnExplosion(e.x+e.w/2, e.y+e.h/2, 1.2);
        this.audio.boom(95, 0.10, 0.10);
        this.audio.enemy(e.type);
      } else if (p.vy > 160 && nearTop && horizontallyClose){
        e.alive = false;
        this.noteKill(e);
        p.vy = -980;
        this.spawnExplosion(e.x+e.w/2, e.y+e.h/2, 1.15);
        this.audio.boom(95, 0.10, 0.11);
        this.audio.enemy(e.type);
      } else {
        if (e.type === "fox" && p.eggPower > 0){
          p.eggPower = Math.max(0, p.eggPower - 1);
          p.scale = 1 + Math.min(1, p.eggPower / CONFIG.eggMax) * 0.7;
          p.addPopup("Fuchs klaut ein Ei!", "#ffb26a");
        }
        if (this.applyDamage(1)){
          p.vx = -p.facing * 420;
          p.vy = -240;
        }
      }
    }
  }

  applyDamage(amount){
    const died = this.player.takeDamage(amount, this.difficulty);
    if (!died){
      this.spawnExplosion(this.player.center().x, this.player.center().y, 0.8);
      this.addShake(0.8, 0.10);
      this.audio.beep(180, 0.06, "square", 0.10);
      return true;
    }
    this.audio.boom(85, 0.20, 0.16);
    this.addShake(1.2, 0.12);
    const respawn = this.player.lives - 1 > 0;
    this.player.startDeath(respawn);
    if (!respawn) {
      this.pendingTop3 = addHighscore(this.score);
      noteBestScore(this.score);
      this.refreshAchievements();
    }
    return false;
  }

  updateFlamethrower(dt){
    const p = this.player;
    if (p.flameTimer <= 0) return;
    const d = p.dims();
    const fx = p.x + d.w/2 + p.facing*26;
    const fy = p.y + d.h*0.46;
    const coneX = p.facing > 0 ? fx : fx - 280;
    const coneY = fy - 58;
    const coneW = 280, coneH = 116;
    this.world.particles.push({ kind:"flame", x:fx+p.facing*(24+Math.random()*145), y:fy+(Math.random()*2-1)*38, vx:p.facing*(620+Math.random()*620), vy:(Math.random()*2-1)*150, r:11+Math.random()*17, t:0, life:0.16+Math.random()*0.16 });
    for (const e of this.world.enemies){
      if (!e.alive || !aabb(e.x,e.y,e.w,e.h,coneX,coneY,coneW,coneH)) continue;
      const dead = e.damage(15.5 * p.damageMult() * dt, p.facing, 125);
      e.x += p.facing * 170 * dt;
      if (dead){ this.noteKill(e); this.spawnExplosion(e.x+e.w/2, e.y+e.h/2, 1.05); this.audio.boom(90, 0.10, 0.10); this.audio.enemy(e.type); }
    }
    this.world.damageBlocks(coneX, coneY, coneW, coneH, 5.5 * dt, this);
  }

  updateInvulnContact(){
    const p = this.player;
    if (p.invuln <= 0) return;
    const d = p.dims();
    this.world.explodeBlocks(p.x-7, p.y-7, d.w+14, d.h+14, this);
  }

  explodeFireball(f, yOverride=null){
    const fy = yOverride ?? f.y;
    this.spawnExplosion(f.x, fy, f.charged ? 1.35 : 1.0);
    if (f.charged){
      const rx = this.cam.x, ry = this.cam.y, rw = CONFIG.canvas.width, rh = CONFIG.canvas.height;
      for (const e of this.world.enemies){
        if (e.alive && aabb(e.x,e.y,e.w,e.h,rx,ry,rw,rh)){ e.alive = false; this.noteKill(e); this.spawnExplosion(e.x+e.w/2,e.y+e.h/2,1.05); }
      }
      this.world.damageBlocks(rx, ry, rw, rh, 9, this);
      this.audio.boom(95, 0.16, 0.14);
      this.addShake(0.7, 0.10);
      return;
    }
    const rad = 90;
    this.world.damageBlocks(f.x-rad, fy-rad, rad*2, rad*2, 2, this);
    for (const e of this.world.enemies){
      if (!e.alive || !aabb(e.x,e.y,e.w,e.h,f.x-rad,fy-rad,rad*2,rad*2)) continue;
      e.damage(f.dmg, f.vx >= 0 ? 1 : -1, 1600);
      if (!e.alive) this.noteKill(e);
      this.spawnExplosion(e.x+e.w/2, e.y+e.h/2, 0.8);
      this.addShake(0.25, 0.06);
    }
    this.audio.boom(70, 0.11, 0.10);
  }

  spawnExplosion(x,y,strength=1){
    const n = Math.floor(22 * strength);
    for (let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2, sp = (240+Math.random()*700)*strength;
      this.world.particles.push({ kind:Math.random()<0.65 ? "spark" : "smoke", x,y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-180, r:2+Math.random()*4.2, t:0, life:0.20+Math.random()*0.28 });
    }
    this.world.particles.push({ kind:"ring", x,y, r:10*strength, t:0, life:0.11 });
  }

  noteKill(enemy){
    this.trackProgress("enemyKills", 1);
    if (enemy.type === "pig") this.trackProgress("pigKills", 1);
    if (enemy.boss){
      this.trackProgress("bossKills", 1);
      this.slowMo = 0.55;
      this.addShake(2.1, 0.22);
      this.player.addPopup("Boss besiegt!", "#ffdf6a");
      this.audio.boss();
    }
  }

  trackProgress(stat, amount){
    addStat(stat, amount);
    this.refreshAchievements();
  }

  refreshAchievements(){
    const result = checkAchievements();
    for (const a of result.newly){
      this.player.addPopup(`Achievement: ${a.label}`, "#ffdf6a");
      this.audio.beep(940, 0.08, "triangle", 0.07);
    }
    this.achievements = [...result.unlocked];
  }

  updateCamera(dt){
    const target = Math.max(0, this.player.x - CONFIG.canvas.width*0.35);
    this.cam.x += (target - this.cam.x) * Math.min(1, dt * 7);
    this.cam.y = 0;
  }

  updateScore(){
    this.maxX = Math.max(this.maxX, this.player.x);
    this.score = Math.max(0, this.maxX - this.startX) * 0.10;
  }

  addShake(power, time=0.10){
    this.shakePow = Math.max(this.shakePow, power * 0.35);
    this.shakeT = Math.max(this.shakeT, time * 0.60);
  }

  drawBackground(){
    const n = nightAmount(this.worldTime);
    const t = (this.worldTime % CONFIG.dayLength) / CONFIG.dayLength;
    const dusk = Math.sin(t*Math.PI*2);
    const duskAmt = (1 - Math.abs(dusk)) * (1 - Math.abs(n - 0.5)*2);
    const skyTop = mixHex(mixHex("#79c8ff", "#121936", n), "#f08f66", duskAmt*0.42);
    const skyMid = mixHex(mixHex("#d6f3ff", "#26355f", n), "#f5b073", duskAmt*0.34);
    const skyLow = mixHex(mixHex("#f5f0cc", "#5c6d73", n), "#ffcf83", duskAmt*0.45);
    const g = this.ctx.createLinearGradient(0,0,0,CONFIG.canvas.height);
    g.addColorStop(0, skyTop); g.addColorStop(0.62, skyMid); g.addColorStop(1, skyLow);
    this.ctx.fillStyle = g; this.ctx.fillRect(0,0,CONFIG.canvas.width,CONFIG.canvas.height);
    if (n > 0.2){
      this.ctx.fillStyle = `rgba(255,255,220,${(n-0.2)*0.65})`;
      for (let i=0;i<38;i++) this.ctx.fillRect((i*137 + Math.floor(this.cam.x*0.03)) % CONFIG.canvas.width, 28 + ((i*61)%160), i%5===0 ? 2 : 1, i%5===0 ? 2 : 1);
    }
    const sun = this.skyPoint(t, 440, 398);
    this.ctx.fillStyle = "rgba(255,232,132,.96)"; this.ctx.beginPath(); this.ctx.arc(sun.x,sun.y,42,0,Math.PI*2); this.ctx.fill();
    const moon = this.skyPoint((t+0.5)%1, 440, 398);
    this.ctx.fillStyle = "rgba(240,244,255,.92)"; this.ctx.beginPath(); this.ctx.arc(moon.x,moon.y,34,0,Math.PI*2); this.ctx.fill();
    this.ctx.fillStyle = skyTop; this.ctx.beginPath(); this.ctx.arc(moon.x+12,moon.y-6,30,0,Math.PI*2); this.ctx.fill();
    this.ctx.fillStyle = mixHex("#74bf75", "#355a57", n);
    this.ctx.beginPath(); this.ctx.moveTo(0,360); this.ctx.quadraticCurveTo(230,278,485,344); this.ctx.quadraticCurveTo(710,402,980,330); this.ctx.lineTo(CONFIG.canvas.width,390); this.ctx.lineTo(CONFIG.canvas.width,CONFIG.canvas.height); this.ctx.lineTo(0,CONFIG.canvas.height); this.ctx.fill();
    this.ctx.fillStyle = mixHex("#58aa60", "#2e504c", n);
    this.ctx.beginPath(); this.ctx.moveTo(0,405); this.ctx.quadraticCurveTo(260,330,520,402); this.ctx.quadraticCurveTo(760,470,980,382); this.ctx.lineTo(CONFIG.canvas.width,CONFIG.canvas.height); this.ctx.lineTo(0,CONFIG.canvas.height); this.ctx.fill();
  }

  skyPoint(t, radius, yBase){
    const a = Math.PI * (1.08 + t);
    return { x:CONFIG.canvas.width*0.5 + Math.cos(a)*radius, y:yBase + Math.sin(a)*radius };
  }

  render(){
    this.drawBackground();
    let sx=0, sy=0;
    if (this.shakeT > 0){ sx = (Math.random()*2-1)*this.shakePow*5; sy = (Math.random()*2-1)*this.shakePow*5; }
    this.ctx.save();
    this.ctx.translate(sx, sy);
    this.world.draw(this.ctx, this.cam, this.worldTime);
    this.player.draw(this.ctx, this.cam, this.worldTime);
    this.ctx.restore();
    const n = nightAmount(this.worldTime);
    if (n > 0.08){ this.ctx.fillStyle = `rgba(7,12,32,${n*0.34})`; this.ctx.fillRect(0,0,CONFIG.canvas.width,CONFIG.canvas.height); }
    if (this.state === "running" || this.state === "paused" || this.state === "gameover") this.ui.drawHUD(this.ctx);
  }
}
