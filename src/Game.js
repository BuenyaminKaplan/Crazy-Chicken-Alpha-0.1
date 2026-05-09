import { CONFIG } from "./Config.js";
import { aabb } from "./Collision.js";
import { addHighscore, addStat, checkAchievements, noteBestScore } from "./Storage.js";
import { mixHex } from "./Utils.js";
import { drawGrassClump, drawSoftLight } from "./Art.js";
import { AudioBus } from "./Audio.js";
import { AbilitySystem } from "./Abilities.js";
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
    this.abilities = new AbilitySystem();
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
    this.cameraZoom = 1;
    this.hideGrace = 0;
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
    this.abilities.resetForRun();
    this.world.reset(this.difficulty);
    this.cam.x = 0; this.cam.y = 0;
    this.score = 0; this.startX = this.player.x; this.maxX = this.player.x;
    this.worldTime = 18;
    this.pendingTop3 = null;
    this.achievements = [];
    this.musicT = 1.2;
    this.hideGrace = 0;
    addStat("runs", 1);
  }

  pause(){
    if (this.state !== "running" && this.state !== "hidden") return;
    this.state = "paused";
    this.ui.showPause();
  }

  resume(){
    if (this.state !== "paused" && this.state !== "shop") return;
    this.state = "running";
    this.ui.hide();
  }

  closeShop(){
    if (this.state !== "shop") return;
    this.state = "running";
    this.ui.hide();
    this.player.hurtGrace = 0.65;
    this.audio.beep(360, 0.04, "triangle", 0.035);
  }

  togglePause(){
    if (this.player.dying) return;
    if (this.state === "running" || this.state === "hidden") this.pause();
    else if (this.state === "paused") this.resume();
    else if (this.state === "gameover") this.startRun();
  }

  step(t){
    const dt = Math.min(0.02, (t - this.lastT) / 1000);
    this.lastT = t;
    const enter = this.input.pressed("enter");
    const escape = this.input.pressed("escape");
    const shopKey = this.input.pressed("shop");
    if (this.state === "shop" && (shopKey || enter || escape)) this.closeShop();
    else if (shopKey && this.state === "running" && this.nearMerchant()) this.openShop();
    else if (enter) this.togglePause();
    else if (escape && this.state === "running") this.pause();
    else if (escape && this.state === "paused") this.resume();

    if (this.state === "running" || this.state === "hidden") this.update(dt);
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
    this.abilities.update(dt);
    this.updateHideState(dt);
    if (this.state === "hidden"){
      this.updateWhileHidden(dt);
      return;
    }
    if (this.input.pressed("down") && this.player.onGround && !this.nearMerchant()){
      if (this.abilities.switchNext(this.player)) this.audio.beep(660, 0.045, "triangle", 0.045);
    }
    this.player.update(this.input, simDt, this.difficulty);
    if (this.player.justJumped){
      this.audio.jump(this.player.featherTimer > 0 ? 1.2 : 1);
      this.player.justJumped = false;
    }
    if (this.input.released("fire")){
      const active = this.abilities.active();
      if (active.id !== "fireball" && this.abilities.cast(this, { chargeT:this.player.chargeT / CONFIG.chargeMax })){
        this.player.charging = false;
        this.player.chargeT = 0;
        this.trackProgress("fireballs", 1);
      } else {
      const f = this.player.makeFireball();
      if (f){
        f.dmg *= this.abilities.damageMult();
        f.r += (this.abilities.levels.fireball || 1) * 0.9;
        this.player.fireCooldown *= this.abilities.cooldownMult();
        this.world.fireballs.push(f);
        this.trackProgress("fireballs", 1);
        this.spawnExplosion(f.x, f.y, f.charged ? 0.7 : 0.3);
        if (f.charged) { this.audio.boom(110, 0.12, 0.12); this.addShake(0.55, 0.08); }
        else this.audio.beep(520, 0.03, "triangle", 0.07);
      }
      }
    }

    this.resolvePlayerCollisions(simDt);
    this.hideGrace = Math.max(0, this.hideGrace - dt);
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
    this.audio.ambient(this.world.weather, night);
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

  openShop(){
    this.state = "shop";
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.hurtGrace = 999;
    this.ui.showShop();
  }

  nearMerchant(){
    const c = this.player.center();
    return Boolean(this.nearestMerchant());
  }

  nearestMerchant(){
    const c = this.player.center();
    let best = null, bestD = Infinity;
    for (const z of this.world.zones){
      if (z.kind !== "merchant") continue;
      const dx = c.x - (z.cx ?? z.x+z.w/2);
      const dy = c.y - (z.cy ?? z.y+z.h/2);
      const d = Math.hypot(dx, dy);
      if (d < (z.radius ?? CONFIG.merchantInteractionRadius) && d < bestD){ best = z; bestD = d; }
    }
    return best;
  }

  nearestHideZone(){
    const c = this.player.center();
    let best = null, bestD = Infinity;
    for (const z of this.world.zones){
      if (z.kind !== "hide") continue;
      const cx = z.x + z.w/2, cy = z.y + z.h*0.72;
      const d = Math.hypot(c.x - cx, c.y - cy);
      if (d < CONFIG.hideInteractionRadius && d < bestD){ best = z; bestD = d; }
    }
    return best;
  }

  updateHideState(dt){
    const p = this.player;
    const zone = this.nearestHideZone();
    const wantsHide = zone && this.input.keys.up && p.onGround && !p.dying;
    if (wantsHide){
      if (this.state !== "hidden"){
        this.state = "hidden";
        p.hidden = true;
        p.invuln = Math.max(p.invuln, 0.2);
        p.addPopup("Versteckt", "#d7f7ff");
        this.audio.beep(420, 0.05, "triangle", 0.035);
      }
      p.x += ((zone.x + zone.w/2) - (p.x + p.dims().w/2)) * Math.min(1, dt * 8);
      p.vx = 0; p.vy = 0; p.hurtGrace = Math.max(p.hurtGrace, 0.35);
      return;
    }
    if (this.state === "hidden"){
      this.state = "running";
      p.hidden = false;
      p.hurtGrace = Math.max(p.hurtGrace, 0.9);
      this.hideGrace = 0.9;
      p.addPopup("Wieder draussen", "#fff6cf");
    }
  }

  updateWhileHidden(dt){
    const p = this.player;
    p.updateTimers(dt);
    p.vx = 0; p.vy = 0;
    for (const e of this.world.enemies){
      e.aggro = false;
      e.warnT = Math.max(0, e.warnT - dt * 3);
      e.chargeT = Math.max(0, e.chargeT - dt * 2);
    }
    this.updateCamera(dt);
    this.world.generateTo(this.cam.x + CONFIG.canvas.width + 2400, this.difficulty);
    this.world.cleanup(this.cam.x);
    this.world.update(dt, this);
    this.updateMusic(dt);
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
    p.hp = Math.min(p.hp, CONFIG.maxHp + this.abilities.maxHpBonus());
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
    const stompLevel = this.abilities.stompBonus();
    this.world.spawnGroundCracks(c.x, CONFIG.canvas.width*(0.31 + stompLevel*0.025));
    const radius = CONFIG.canvas.width * (0.31 + stompLevel*0.025);
    const rx = c.x - radius;
    for (const e of this.world.enemies){
      if (e.alive && aabb(e.x,e.y,e.w,e.h,rx,0,radius*2,CONFIG.canvas.height)){
        e.alive = false;
        this.noteKill(e);
        this.spawnExplosion(e.x+e.w/2, e.y+e.h/2, 1.05);
        this.audio.enemy(e.type);
      }
    }
    this.world.damageBlocks(rx, 0, radius*2, CONFIG.canvas.height, 8 + stompLevel*2, this);
    this.audio.boom(62, 0.18, 0.16);
    this.audio.noise(0.22, 0.12, 460);
    this.addShake(1.9, 0.20);
  }

  collectItems(){
    const p = this.player, c = p.center();
    for (const item of this.world.collectibles){
      if (item.got) continue;
      const dx = c.x - item.x, dy = c.y - item.y;
      const pickupR = item.r + 38 + this.abilities.pickupBonus();
      const magnetR = pickupR + 78;
      const d2 = dx*dx + dy*dy;
      if (d2 < magnetR * magnetR){
        const pull = Math.min(1, 0.10 + this.abilities.pickupBonus()*0.01);
        item.x += dx * pull;
        item.y += dy * pull;
      }
      const ndx = c.x - item.x, ndy = c.y - item.y;
      if (ndx*ndx + ndy*ndy >= pickupR ** 2) continue;
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
    if (p.hidden || this.hideGrace > 0) return;
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
    if (this.player.hidden || this.state === "shop") return false;
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
    const rad = f.bomb ? 132 + (this.abilities.levels.eggBomb || 1) * 18 : 90;
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

  spawnAbilityBurst(x,y,kind,scale=1){
    const count = Math.floor(12 * scale);
    for (let i=0;i<count;i++){
      const a = Math.random()*Math.PI*2;
      const sp = 90 + Math.random()*360*scale;
      this.world.particles.push({
        kind:kind === "ice" ? "ice" : "spark",
        x,y,
        vx:Math.cos(a)*sp,
        vy:Math.sin(a)*sp,
        r:2+Math.random()*5,
        t:0,
        life:0.18+Math.random()*0.18
      });
    }
    if (kind === "shield") this.world.particles.push({ kind:"ring", x,y, r:24*scale, t:0, life:0.18 });
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
    const bossNear = this.world.enemies.some(e => e.alive && e.boss && Math.abs(e.x - this.player.x) < 760);
    const targetZoom = bossNear ? 1.055 : (this.slowMo > 0 ? 1.04 : 1);
    this.cameraZoom += (targetZoom - this.cameraZoom) * Math.min(1, dt * 3.5);
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
    this.drawCloudLayer(n);
    if (n > 0.2){
      this.ctx.fillStyle = `rgba(255,255,220,${(n-0.2)*0.65})`;
      for (let i=0;i<38;i++) this.ctx.fillRect((i*137 + Math.floor(this.cam.x*0.03)) % CONFIG.canvas.width, 28 + ((i*61)%160), i%5===0 ? 2 : 1, i%5===0 ? 2 : 1);
    }
    const sun = this.skyPoint(t, 440, 398);
    if (n < 0.6){
      drawSoftLight(this.ctx, sun.x, sun.y, 190, "255,218,132", 0.20 * (1-n));
      this.ctx.strokeStyle = `rgba(255,235,170,${0.08*(1-n)})`;
      this.ctx.lineWidth = 16;
      for (let i=-2;i<=2;i++){ this.ctx.beginPath(); this.ctx.moveTo(sun.x, sun.y); this.ctx.lineTo(sun.x + i*190, CONFIG.canvas.height); this.ctx.stroke(); }
      this.ctx.lineWidth = 1;
    }
    this.ctx.fillStyle = "rgba(255,232,132,.96)"; this.ctx.beginPath(); this.ctx.arc(sun.x,sun.y,42,0,Math.PI*2); this.ctx.fill();
    const moon = this.skyPoint((t+0.5)%1, 440, 398);
    this.ctx.fillStyle = "rgba(240,244,255,.92)"; this.ctx.beginPath(); this.ctx.arc(moon.x,moon.y,34,0,Math.PI*2); this.ctx.fill();
    this.ctx.fillStyle = skyTop; this.ctx.beginPath(); this.ctx.arc(moon.x+12,moon.y-6,30,0,Math.PI*2); this.ctx.fill();
    this.drawParallaxHills(n);
    this.drawForegroundMist(n);
  }

  drawCloudLayer(n){
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.30 - n*0.16;
    ctx.fillStyle = "#ffffff";
    for (let i=0;i<6;i++){
      const x = ((i*210 - this.cam.x*0.06 + this.worldTime*5) % (CONFIG.canvas.width+260)) - 130;
      const y = 62 + (i%3)*38;
      ctx.beginPath();
      ctx.ellipse(x, y, 42, 15, 0, 0, Math.PI*2);
      ctx.ellipse(x+34, y+3, 52, 18, 0, 0, Math.PI*2);
      ctx.ellipse(x+76, y, 36, 13, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawParallaxHills(n){
    const ctx = this.ctx;
    const far = -((this.cam.x*0.10) % 900);
    ctx.fillStyle = mixHex("#8ab6a0", "#2d4053", n);
    for (let off=far-900; off<CONFIG.canvas.width+900; off+=900){
      ctx.beginPath(); ctx.moveTo(off,385);
      ctx.quadraticCurveTo(off+220,250,off+460,350);
      ctx.quadraticCurveTo(off+680,420,off+900,325);
      ctx.lineTo(off+900,CONFIG.canvas.height); ctx.lineTo(off,CONFIG.canvas.height); ctx.fill();
    }
    const mid = -((this.cam.x*0.20) % 760);
    ctx.fillStyle = mixHex("#74bf75", "#355a57", n);
    for (let off=mid-760; off<CONFIG.canvas.width+760; off+=760){
      ctx.beginPath(); ctx.moveTo(off,405);
      ctx.quadraticCurveTo(off+210,320,off+405,392);
      ctx.quadraticCurveTo(off+590,464,off+760,378);
      ctx.lineTo(off+760,CONFIG.canvas.height); ctx.lineTo(off,CONFIG.canvas.height); ctx.fill();
    }
    const near = -((this.cam.x*0.34) % 96);
    for (let x=near-40; x<CONFIG.canvas.width+60; x+=32) drawGrassClump(ctx, x, CONFIG.groundY-42, this.worldTime*2 + x, 1.2, mixHex("#328939", "#1f4739", n));
  }

  drawForegroundMist(n){
    const ctx = this.ctx;
    const fog = this.world.weather === "fog" ? 0.16 : 0.045;
    ctx.fillStyle = `rgba(235,244,230,${fog + n*0.035})`;
    for (let i=0;i<3;i++){
      const x = ((this.worldTime*18 + i*310 - this.cam.x*0.08) % (CONFIG.canvas.width+420)) - 210;
      ctx.beginPath();
      ctx.ellipse(x+130, 320+i*55, 220, 22, 0, 0, Math.PI*2);
      ctx.fill();
    }
  }

  skyPoint(t, radius, yBase){
    const a = Math.PI * (1.08 + t);
    return { x:CONFIG.canvas.width*0.5 + Math.cos(a)*radius, y:yBase + Math.sin(a)*radius };
  }

  drawInteractionHints(ctx){
    if (this.state !== "running" && this.state !== "hidden") return;
    const merchant = this.nearestMerchant();
    if (merchant){
      const pulse = 1 + Math.sin(this.worldTime * 7) * 0.06;
      const x = (merchant.promptX ?? merchant.cx ?? merchant.x + merchant.w/2) - this.cam.x;
      const y = (merchant.promptY ?? merchant.y - 34) - this.cam.y + Math.sin(this.worldTime*5)*3;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = "rgba(20,15,8,.58)";
      ctx.strokeStyle = "rgba(255,226,138,.82)";
      ctx.lineWidth = 2;
      roundHint(ctx, -58, -18, 116, 36);
      ctx.fillStyle = "#fff1b8";
      ctx.font = "bold 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.fillText("H: Handeln", 4, 5);
      ctx.fillStyle = "#ffd84e";
      ctx.beginPath(); ctx.ellipse(-40, 1, 7, 9, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    const hide = this.nearestHideZone();
    if (hide){
      const x = (hide.promptX ?? hide.x + hide.w/2) - this.cam.x;
      const y = (hide.promptY ?? hide.y - 22) - this.cam.y + Math.sin(this.worldTime*5)*2;
      ctx.save();
      ctx.fillStyle = this.state === "hidden" ? "rgba(32,58,82,.72)" : "rgba(20,15,8,.58)";
      ctx.strokeStyle = "rgba(210,240,255,.78)";
      ctx.lineWidth = 2;
      roundHint(ctx, x-76, y-18, 152, 36);
      ctx.fillStyle = "#e9fbff";
      ctx.font = "bold 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.fillText(this.state === "hidden" ? "↑ halten: versteckt" : "↑ halten: Verstecken", x, y+5);
      ctx.restore();
    }
  }

  render(){
    this.drawBackground();
    let sx=0, sy=0;
    if (this.shakeT > 0){ sx = (Math.random()*2-1)*this.shakePow*5; sy = (Math.random()*2-1)*this.shakePow*5; }
    this.ctx.save();
    this.ctx.translate(sx, sy);
    const zoom = this.cameraZoom;
    if (Math.abs(zoom - 1) > 0.001){
      this.ctx.translate(CONFIG.canvas.width/2, CONFIG.canvas.height/2);
      this.ctx.scale(zoom, zoom);
      this.ctx.translate(-CONFIG.canvas.width/2, -CONFIG.canvas.height/2);
    }
    this.world.draw(this.ctx, this.cam, this.worldTime);
    this.player.draw(this.ctx, this.cam, this.worldTime);
    this.drawInteractionHints(this.ctx);
    this.ctx.restore();
    const n = nightAmount(this.worldTime);
    if (n > 0.08){ this.ctx.fillStyle = `rgba(7,12,32,${n*0.34})`; this.ctx.fillRect(0,0,CONFIG.canvas.width,CONFIG.canvas.height); }
    if (this.state === "running" || this.state === "hidden" || this.state === "paused" || this.state === "shop" || this.state === "gameover") this.ui.drawHUD(this.ctx);
  }
}

function roundHint(ctx, x, y, w, h){
  const r = 8;
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.fill();
  ctx.stroke();
}
