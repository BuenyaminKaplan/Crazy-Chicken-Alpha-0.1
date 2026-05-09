import { CONFIG } from "./Config.js";
import { aabb } from "./Collision.js";
import { chance, mixHex, pick, rand, smoothstep } from "./Utils.js";
import { Enemy } from "./Enemy.js";
import { OUTLINE, contactShadow, drawFlower, drawGrassClump, drawPlankSign, drawSoftLight, drawWoodGrain, ellipse, fillStroke, roundedRect } from "./Art.js";

export class World {
  constructor(){
    this.blocks = [];
    this.decor = [];
    this.collectibles = [];
    this.enemies = [];
    this.particles = [];
    this.cracks = [];
    this.fireballs = [];
    this.zones = [];
    this.weather = "clear";
    this.nextBossX = 4200;
    this.nextGenX = 0;
  }

  reset(difficulty){
    this.blocks.length = 0;
    this.decor.length = 0;
    this.collectibles.length = 0;
    this.enemies.length = 0;
    this.particles.length = 0;
    this.cracks.length = 0;
    this.fireballs.length = 0;
    this.zones.length = 0;
    this.weather = "clear";
    this.nextBossX = 4200;
    this.nextGenX = 0;
    for (let i=0;i<24;i++) this.addBlock(72 + i*CONFIG.tile, CONFIG.groundY-2*CONFIG.tile, CONFIG.tile, CONFIG.tile*2, "dirt", 2);
    this.generateTo(4400, difficulty, true);
  }

  addBlock(x,y,w,h,kind,hp=2){ this.blocks.push({ x,y,w,h,kind,hp }); }
  addGrid(x,y,cols,rows,kind,hp=2){
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) this.addBlock(x+c*CONFIG.tile, y+r*CONFIG.tile, CONFIG.tile, CONFIG.tile, kind, hp);
  }
  carve(x,y,w,h,kind=null){
    for (let i=this.blocks.length-1;i>=0;i--){
      const b = this.blocks[i];
      if (kind && b.kind !== kind) continue;
      if (aabb(b.x,b.y,b.w,b.h,x,y,w,h)) this.blocks.splice(i,1);
    }
  }
  blocked(x,y,w,h){
    return this.blocks.some(b => aabb(x,y,w,h,b.x,b.y,b.w,b.h));
  }

  safeZoneAt(x, y){
    return this.zones.find(z => z.kind === "safe" && x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) || null;
  }

  safeCollectible(x, y){
    const ys = [y, CONFIG.groundY-90, CONFIG.groundY-145, CONFIG.groundY-210, CONFIG.groundY-265];
    const xs = [0, -48, 48, -96, 96];
    for (const ox of xs) for (const yy of ys){
      const tx = x + ox;
      if (!this.blocked(tx-20, yy-24, 40, 48)) return { x:tx, y:yy };
    }
    return { x, y:CONFIG.groundY-90 };
  }

  spawnCollectible(x,y,kind="egg"){
    const p = this.safeCollectible(x,y);
    const r = kind === "goldEgg" ? 17 : 15;
    this.collectibles.push({ ...p, kind, r, got:false, bob:Math.random()*Math.PI*2 });
  }

  segmentTheme(index){
    return ["field","barn","mud","tractor","night"][index % 5];
  }

  generateTo(xMax, difficulty, first=false){
    let segIndex = Math.floor(this.nextGenX / 1700);
    while (this.nextGenX < xMax){
      const len = 1450 + Math.floor(Math.random()*850);
      const baseX = this.nextGenX;
      const theme = first && baseX < 1300 ? "start" : this.segmentTheme(segIndex++);
      this.makeSegment(baseX, len, theme, difficulty);
      if (baseX > this.nextBossX){
        this.spawnBoss(baseX + 980, difficulty);
        this.nextBossX += 5200 + Math.random()*2600;
      }
      this.nextGenX += len;
    }
  }

  makeSegment(baseX, len, theme, difficulty){
    if (theme !== "start" && chance(0.65)){
      const steps = 5 + Math.floor(Math.random()*6);
      for (let i=0;i<steps;i++) this.addGrid(baseX+150+i*CONFIG.tile, CONFIG.groundY-2*CONFIG.tile-i*14, 2, 2, theme === "mud" ? "mud" : "dirt", 2);
    }

    if (theme !== "start" && chance(0.76)){
      const y = CONFIG.groundY - (5 + Math.floor(Math.random()*3))*CONFIG.tile;
      const tiles = 9 + Math.floor(Math.random()*11);
      this.addGrid(baseX+520, y, tiles, 1, "wood", 2);
      for (let i=0;i<tiles;i+=7) this.addGrid(baseX+520+i*CONFIG.tile, y+CONFIG.tile, 1, 2, "wood", 2);
    }

    if (theme === "barn") this.spawnBarn(baseX+800);
    else if (theme === "tractor") this.spawnTractor(baseX+760);
    else if (theme === "mud") this.spawnMud(baseX+720);
    else if (theme === "field") this.spawnField(baseX+760);
    else if (theme === "night") this.spawnTreeRock(baseX+780);

    if (theme !== "start" && baseX > 1800 && chance(0.24)) this.spawnMarket(baseX + Math.min(len - 360, 860));

    this.spawnCollectibleTrail(baseX, len, theme);
    if (theme !== "start") this.spawnEnemies(baseX, len, theme, difficulty);
    if (theme !== "start" && chance(0.22)) this.spawnChallenge(baseX + 620, theme);
    if (chance(0.12)) this.weather = pick(["rain","fog","wind","clear"]);
  }

  spawnCollectibleTrail(baseX, len, theme){
    if (Math.random() < 0.24) return;
    const count = 3 + Math.floor(Math.random()*4);
    const start = baseX + 260 + Math.random()*220;
    const arc = Math.random() < 0.42;
    for (let i=0;i<count;i++){
      const ex = start + i * (70 + Math.random()*28);
      if (ex > baseX + len - 220) break;
      const wave = arc ? Math.sin(i/(Math.max(1,count-1))*Math.PI) * 74 : (i%2)*34;
      const ey = theme === "barn" ? CONFIG.groundY-165-wave : (Math.random() < 0.62 ? CONFIG.groundY-92-wave : CONFIG.groundY-184-wave*0.35);
      const roll = Math.random();
      const kind = roll < 0.07 ? "goldEgg" : (roll < 0.14 ? "chili" : (roll < 0.18 ? "feather" : "egg"));
      this.spawnCollectible(ex, ey, kind);
    }
  }

  spawnEnemies(baseX, len, theme, difficulty){
    const count = Math.floor((2 + Math.random()*4) * difficulty.enemyRate);
    const typesByTheme = {
      field: ["pig","angryChicken","pig","rooster"],
      barn: ["cow","pig","crow","fox"],
      mud: ["pig","cow","bull"],
      tractor: ["angryChicken","pig","cow","bull"],
      night: ["crow","pig","angryChicken","fox"]
    };
    for (let i=0;i<count;i++){
      const x = baseX + 430 + Math.random()*(len-620);
      if (x < 900) continue;
      if (this.zones.some(z => z.kind === "safe" && x > z.x - 120 && x < z.x + z.w + 120)) continue;
      this.enemies.push(new Enemy(pick(typesByTheme[theme] || ["pig"]), x, difficulty));
    }
  }

  spawnBoss(x, difficulty){
    this.decor.push({ kind:"warning", x:x-120, y:CONFIG.groundY-180, w:240 });
    this.enemies.push(new Enemy("giantRooster", x, difficulty));
  }

  spawnChallenge(x, theme){
    if (theme === "mud"){
      this.zones.push({ kind:"slow", x:x, y:CONFIG.groundY-70, w:240, h:90, strength:0.55 });
      this.addGrid(x, CONFIG.groundY-CONFIG.tile, 10, 1, "mud", 1);
    } else if (theme === "tractor"){
      this.addGrid(x, CONFIG.groundY-2*CONFIG.tile, 2, 2, "crate", 1);
      this.addGrid(x+220, CONFIG.groundY-5*CONFIG.tile, 5, 1, "break", 1);
    } else if (theme === "field"){
      this.addBlock(x, CONFIG.groundY-2*CONFIG.tile, CONFIG.tile*3, CONFIG.tile, "trampoline", 2);
      this.addGrid(x+260, CONFIG.groundY-6*CONFIG.tile, 6, 1, "moving", 2);
    } else {
      this.zones.push({ kind:"wind", x:x, y:CONFIG.groundY-250, w:260, h:250, strength:380 });
      this.addGrid(x+300, CONFIG.groundY-6*CONFIG.tile, 4, 1, "break", 1);
    }
  }

  spawnField(x){
    this.addGrid(x, CONFIG.groundY-2*CONFIG.tile, 9, 2, "fence", 2);
    for (let i=0;i<9;i+=2) this.addGrid(x+i*CONFIG.tile, CONFIG.groundY-4*CONFIG.tile, 1, 2, "fence", 2);
    this.decor.push({ kind:"grass", x:x-120, y:CONFIG.groundY, w:420 });
    this.decor.push({ kind:"flowers", x:x-80, y:CONFIG.groundY, w:360 });
    if (chance(0.55)) this.decor.push({ kind:"sign", x:x+350, y:CONFIG.groundY-58, label:"EIER" });
    if (chance(0.38)) this.decor.push({ kind:"scarecrow", x:x+550, y:CONFIG.groundY-112 });
  }
  spawnBarn(x){
    const barnX = x + 460;
    this.decor.push({ kind:"barn", x:barnX, y:CONFIG.groundY-150, w:150, h:150 });
    this.zones.push({ kind:"hide", x:barnX+34, y:CONFIG.groundY-104, w:82, h:116, promptX:barnX+75, promptY:CONFIG.groundY-142 });
    this.decor.push({ kind:"coop", x:x+250, y:CONFIG.groundY-86 });
    this.decor.push({ kind:"laundry", x:x+120, y:CONFIG.groundY-118, w:190 });
    this.addGrid(x, CONFIG.groundY-3*CONFIG.tile, 4, 3, "well", 3);
    this.carve(x+CONFIG.tile, CONFIG.groundY-2*CONFIG.tile, 2*CONFIG.tile, CONFIG.tile, "well");
  }
  spawnMud(x){
    this.addGrid(x, CONFIG.groundY-CONFIG.tile, 9, 1, "mud", 1);
    this.addGrid(x+260, CONFIG.groundY-2*CONFIG.tile, 5, 2, "hay", 2);
    this.decor.push({ kind:"stones", x:x-70, y:CONFIG.groundY, w:540 });
  }
  spawnTractor(x){
    this.addGrid(x, CONFIG.groundY-2*CONFIG.tile, 7, 2, "tractor", 4);
    this.addGrid(x+3*CONFIG.tile, CONFIG.groundY-4*CONFIG.tile, 3, 2, "tractor", 4);
    this.carve(x+4*CONFIG.tile, CONFIG.groundY-4*CONFIG.tile, CONFIG.tile, CONFIG.tile, "tractor");
    this.decor.push({ kind:"windmill", x:x+390, y:CONFIG.groundY-235 });
  }
  spawnTreeRock(x){
    if (chance(0.5)){
      this.addGrid(x+CONFIG.tile, CONFIG.groundY-5*CONFIG.tile, 2, 5, "treeTrunk", 3);
      this.addGrid(x-CONFIG.tile, CONFIG.groundY-8*CONFIG.tile, 6, 3, "treeLeaf", 2);
      this.addGrid(x, CONFIG.groundY-9*CONFIG.tile, 4, 1, "treeLeaf", 2);
    } else {
      this.addGrid(x, CONFIG.groundY-3*CONFIG.tile, 5, 3, "rock", 5);
      this.carve(x, CONFIG.groundY-3*CONFIG.tile, CONFIG.tile, CONFIG.tile, "rock");
      this.carve(x+4*CONFIG.tile, CONFIG.groundY-3*CONFIG.tile, CONFIG.tile, CONFIG.tile, "rock");
    }
    this.decor.push({ kind:"fireflies", x:x-90, y:CONFIG.groundY-180, w:390 });
    this.decor.push({ kind:"graveyard", x:x+260, y:CONFIG.groundY-82, w:260 });
    this.decor.push({ kind:"ghost", x:x+520, y:CONFIG.groundY-178, w:60, h:82 });
    this.decor.push({ kind:"deadTree", x:x-190, y:CONFIG.groundY-170, w:120, h:170 });
  }

  spawnMarket(x){
    this.zones.push({ kind:"safe", x:x-140, y:CONFIG.groundY-140, w:380, h:160, strength:0 });
    this.zones.push({ kind:"merchant", x:x+18, y:CONFIG.groundY-130, w:150, h:140, cx:x+98, cy:CONFIG.groundY-70, radius:CONFIG.merchantInteractionRadius, promptX:x+98, promptY:CONFIG.groundY-132 });
    this.decor.push({ kind:"campfire", x:x-68, y:CONFIG.groundY-30 });
    this.decor.push({ kind:"merchant", x:x+60, y:CONFIG.groundY-92, w:76, h:92 });
    this.decor.push({ kind:"sign", x:x-118, y:CONFIG.groundY-58, label:"SHOP" });
  }

  cleanup(camX){
    const killX = camX - 2400;
    for (let i=this.blocks.length-1;i>=0;i--) if (this.blocks[i].x + this.blocks[i].w < killX) this.blocks.splice(i,1);
    for (let i=this.enemies.length-1;i>=0;i--){
      const e = this.enemies[i];
      if (e.x + e.w < killX || (!e.alive && e.x + e.w < camX - 900)) this.enemies.splice(i,1);
    }
    for (let i=this.collectibles.length-1;i>=0;i--){
      const e = this.collectibles[i];
      if (e.x < killX || (e.got && e.x < camX - 900)) this.collectibles.splice(i,1);
    }
    for (let i=this.decor.length-1;i>=0;i--) if (this.decor[i].x + (this.decor[i].w || 0) < killX) this.decor.splice(i,1);
    for (let i=this.zones.length-1;i>=0;i--) if (this.zones[i].x + (this.zones[i].w || 0) < killX) this.zones.splice(i,1);
  }

  damageBlocks(rx, ry, rw, rh, dmg, game){
    for (let i=this.blocks.length-1;i>=0;i--){
      const b = this.blocks[i];
      if (!aabb(b.x,b.y,b.w,b.h,rx,ry,rw,rh)) continue;
      b.hp -= dmg;
      if (b.hp <= 0){
        game.spawnExplosion(b.x+b.w/2, b.y+b.h/2, 0.55);
        game.audio.material(b.kind);
        if (game.trackProgress) game.trackProgress("blocksBroken", 1);
        this.blocks.splice(i,1);
      }
    }
  }

  explodeBlocks(rx, ry, rw, rh, game){
    for (let i=this.blocks.length-1;i>=0;i--){
      const b = this.blocks[i];
      if (!aabb(b.x,b.y,b.w,b.h,rx,ry,rw,rh)) continue;
      game.spawnExplosion(b.x+b.w/2, b.y+b.h/2, 0.75);
      game.audio.material(b.kind);
      if (game.trackProgress) game.trackProgress("blocksBroken", 1);
      this.blocks.splice(i,1);
    }
  }

  update(dt, game){
    this.updateSpecialBlocks(dt);
    for (const e of this.enemies) e.update(dt, game.player, this.blocks, game.player.hidden);
    this.updateFireballs(dt, game);
    this.updateParticles(dt);
    for (let i=this.cracks.length-1;i>=0;i--){
      this.cracks[i].t += dt;
      if (this.cracks[i].t >= this.cracks[i].life) this.cracks.splice(i,1);
    }
  }

  updateSpecialBlocks(dt){
    for (const b of this.blocks){
      if (b.kind !== "moving") continue;
      if (!b.baseX){ b.baseX = b.x; b.phase = Math.random()*Math.PI*2; }
      b.x = b.baseX + Math.sin(performance.now()/900 + b.phase) * 90;
    }
  }

  updateFireballs(dt, game){
    for (let i=this.fireballs.length-1;i>=0;i--){
      const f = this.fireballs[i];
      if (f.bomb) f.vy += 1050 * dt;
      f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt;
      let removed = false;
      for (const b of this.blocks){
        if (aabb(f.x-f.r,f.y-f.r,f.r*2,f.r*2,b.x,b.y,b.w,b.h)){
          game.explodeFireball(f); this.fireballs.splice(i,1); removed = true; break;
        }
      }
      if (removed) continue;
      if (f.y + f.r >= CONFIG.groundY){
        game.explodeFireball(f, CONFIG.groundY-2); this.fireballs.splice(i,1); continue;
      }
      for (const e of this.enemies){
        if (!e.alive) continue;
        if (!aabb(f.x-f.r,f.y-f.r,f.r*2,f.r*2,e.x,e.y,e.w,e.h)) continue;
        if (f.charged) e.alive = false;
        else {
          const knock = (f.ability === "ice" ? 420 : 360) * (game.abilities?.knockbackMult?.() ?? 0.25);
          e.damage(f.dmg, f.vx >= 0 ? 1 : -1, knock);
          if (f.ability === "ice") e.slowT = Math.max(e.slowT || 0, 1.1 + (f.slow || 0));
          if (f.ability === "lightning") this.chainLightning(e, f, game);
        }
        game.explodeFireball(f);
        this.fireballs.splice(i,1);
        removed = true;
        break;
      }
      if (!removed && (f.life <= 0 || f.x < game.cam.x-1200 || f.x > game.cam.x+CONFIG.canvas.width+2400)) this.fireballs.splice(i,1);
    }
  }

  chainLightning(first, f, game){
    let jumps = f.chain || 0;
    let source = first;
    while (jumps-- > 0){
      const target = this.enemies.find(e => e.alive && e !== source && Math.abs(e.x - source.x) < 190 && Math.abs(e.y - source.y) < 120);
      if (!target) break;
      target.damage(f.dmg * 0.55, target.x > source.x ? 1 : -1, 520);
      this.particles.push({ kind:"lightning", x:source.x+source.w/2, y:source.y+source.h/2, x2:target.x+target.w/2, y2:target.y+target.h/2, t:0, life:0.12 });
      if (!target.alive) game.noteKill(target);
      source = target;
    }
  }

  updateParticles(dt){
    for (let i=this.particles.length-1;i>=0;i--){
      const p = this.particles[i];
      p.t += dt;
      if (p.kind === "spark"){ p.vy += 1300*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.98; }
      else if (p.kind === "smoke"){ p.vy += 340*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.92; p.r *= 1.016; }
      else if (p.kind === "dust"){ p.vy += 820*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.88; p.r *= 1.012; }
      else if (p.kind === "flame"){ p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.86; p.vy *= 0.92; p.r *= 0.94; }
      else if (p.kind === "ring"){ p.r *= 1.17; }
      else if (p.kind === "shockwave"){ p.r += 2100*dt; }
      if (p.t >= p.life) this.particles.splice(i,1);
    }
  }

  spawnGroundCracks(cx, radius){
    for (let i=0;i<16;i++){
      const dir = i % 2 === 0 ? 1 : -1;
      this.cracks.push({ x:cx + dir*Math.random()*radius, y:CONFIG.groundY+1, len:45+Math.random()*125, angle:(Math.random()*0.55+0.08)*dir, t:0, life:1.1+Math.random()*0.35 });
    }
  }

  draw(ctx, cam, worldTime){
    const n = nightAmount(worldTime);
    this.drawDecor(ctx, cam, worldTime, "back");
    const grassGrad = ctx.createLinearGradient(0, CONFIG.groundY-cam.y, 0, CONFIG.canvas.height);
    grassGrad.addColorStop(0, mixHex("#65b65e", "#3f7447", n));
    grassGrad.addColorStop(1, mixHex("#3e7e41", "#253b2e", n));
    ctx.fillStyle = grassGrad;
    ctx.fillRect(-200, CONFIG.groundY-cam.y, CONFIG.canvas.width+400, CONFIG.canvas.height-CONFIG.groundY+200);
    ctx.fillStyle = mixHex("#3f833e", "#315332", n);
    ctx.fillRect(-200, CONFIG.groundY-cam.y, CONFIG.canvas.width+400, 10);
    this.drawDecor(ctx, cam, worldTime, "front");

    for (const c of this.cracks){
      const x = c.x - cam.x, y = c.y - cam.y, a = 1 - c.t/c.life;
      ctx.strokeStyle = `rgba(42,28,22,${a*0.72})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(c.angle)*c.len, y+Math.sin(c.angle)*c.len); ctx.stroke(); ctx.lineWidth = 1;
    }
    for (const b of this.blocks) this.drawBlock(ctx, b, cam);
    for (const c of this.collectibles) this.drawCollectible(ctx, c, cam, worldTime);
    for (const e of this.enemies) e.draw(ctx, cam);
    for (const f of this.fireballs) this.drawFireball(ctx, f, cam);
    for (const p of this.particles) this.drawParticle(ctx, p, cam);
    this.drawZones(ctx, cam);
    this.drawWeather(ctx);
    if (n > 0.48) this.drawNightAtmosphere(ctx, cam, worldTime, n);
  }

  drawDecor(ctx, cam, worldTime=0, layer="front"){
    for (const d of this.decor){
      const worldLocked = ["barn","merchant","campfire","coop","sign","scarecrow","windmill","laundry"].includes(d.kind);
      const x = d.x - cam.x * (worldLocked ? 1 : 0.92);
      if (x < -260 || x > CONFIG.canvas.width+260) continue;
      if (layer === "back" && !["barn","windmill","laundry","fireflies","ghost","deadTree"].includes(d.kind)) continue;
      if (layer === "front" && ["barn","windmill","laundry","fireflies","ghost","deadTree"].includes(d.kind)) continue;
      if (d.kind === "grass"){
        for (let i=0;i<d.w;i+=20) drawGrassClump(ctx, x+i, d.y-cam.y, worldTime*3+i, 0.9 + (i%3)*0.08, "rgba(35,115,51,.68)");
      } else if (d.kind === "flowers"){
        for (let i=18;i<d.w;i+=42) drawFlower(ctx, x+i, d.y-cam.y-2, i%3 ? "#ffd766" : "#f989a5", worldTime*2+i);
      } else if (d.kind === "stones"){
        const y = d.y - cam.y;
        for (let i=0;i<d.w;i+=76) ellipse(ctx, x+i+16, y-8-(i%2)*3, 12+(i%3)*3, 7, -0.1, "#9da4a4", "rgba(64,58,52,.55)", 1.5);
      } else if (d.kind === "sign"){
        drawPlankSign(ctx, x, d.y-cam.y, d.label);
      } else if (d.kind === "scarecrow"){
        const y = d.y-cam.y;
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, y+16); ctx.lineTo(x, y+94); ctx.moveTo(x-38, y+38); ctx.lineTo(x+38, y+38); ctx.stroke();
        ellipse(ctx, x, y+18, 16, 15, 0, "#d9a354", OUTLINE, 2);
        roundedRect(ctx, x-24, y+40, 48, 34, 8, "#6fb0d5", OUTLINE, 2);
        ctx.fillStyle = "#d9b84b"; ctx.beginPath(); ctx.moveTo(x-18,y+6); ctx.lineTo(x,y-18); ctx.lineTo(x+22,y+6); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (d.kind === "barn"){
        const y = d.y - cam.y;
        contactShadow(ctx, x+d.w/2, y+d.h+6, d.w*0.58, 0.16);
        roundedRect(ctx, x, y, d.w, d.h, 10, "#a93a35", OUTLINE, 3);
        drawWoodGrain(ctx, x+6, y+12, d.w-12, d.h-16, 0.18);
        ctx.fillStyle = "#742522"; ctx.beginPath(); ctx.moveTo(x-16,y+4); ctx.lineTo(x+d.w/2,y-62); ctx.lineTo(x+d.w+16,y+4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; ctx.stroke(); ctx.lineWidth = 1;
        roundedRect(ctx, x+40,y+72,70,78,6, "#6d3327", "#f1d8b4", 3.5);
        ctx.fillStyle = "rgba(0,0,0,.26)";
        ctx.beginPath(); ctx.ellipse(x+75,y+112,28,42,0,0,Math.PI*2); ctx.fill();
        roundedRect(ctx, x+53,y+78,44,72,8, "#4a2a20", OUTLINE, 2.4);
        ctx.fillStyle = "rgba(255,202,92,.24)";
        ctx.fillRect(x+60,y+86,30,20);
        drawSoftLight(ctx, x+d.w-22, y+54, 96, "255,190,96", 0.12);
      } else if (d.kind === "coop"){
        const y = d.y-cam.y;
        roundedRect(ctx, x-44, y+22, 88, 58, 9, "#c87a3e", OUTLINE, 2.6);
        ctx.fillStyle = "#8f3a2d"; ctx.beginPath(); ctx.moveTo(x-54,y+26); ctx.lineTo(x,y-12); ctx.lineTo(x+54,y+26); ctx.closePath(); ctx.fill(); ctx.strokeStyle=OUTLINE; ctx.lineWidth=2.4; ctx.stroke(); ctx.lineWidth=1;
        roundedRect(ctx, x-12, y+45, 24, 35, 5, "#5b3023", OUTLINE, 2);
      } else if (d.kind === "laundry"){
        const y = d.y-cam.y;
        ctx.strokeStyle = "rgba(71,50,31,.65)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+d.w, y-10); ctx.stroke(); ctx.lineWidth = 1;
        const colors = ["#fff2d6", "#83c8f2", "#ff9aa4"];
        for (let i=0;i<3;i++) roundedRect(ctx, x+30+i*44, y-1-i*2+Math.sin(worldTime*3+i)*2, 28, 34, 4, colors[i], OUTLINE, 1.5);
      } else if (d.kind === "windmill"){
        const y = d.y-cam.y;
        roundedRect(ctx, x-22, y+84, 44, 150, 8, "#d8c49a", OUTLINE, 2.4);
        const r = 50, a = worldTime*1.4;
        ctx.save(); ctx.translate(x, y+84); ctx.rotate(a);
        ctx.strokeStyle = "#f2ead4"; ctx.lineWidth = 7;
        for (let i=0;i<4;i++){ ctx.rotate(Math.PI/2); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(r,0); ctx.stroke(); }
        ctx.restore(); ellipse(ctx, x, y+84, 8, 8, 0, "#b76b39", OUTLINE, 2);
      } else if (d.kind === "fireflies"){
        const y = d.y-cam.y;
        for (let i=0;i<8;i++){
          const px = x + (i*47 + Math.sin(worldTime+i)*18) % d.w;
          const py = y + Math.sin(worldTime*1.7+i*2)*34;
          drawSoftLight(ctx, px, py, 18, "255,234,120", 0.16 + Math.sin(worldTime*4+i)*0.04);
        }
      } else if (d.kind === "graveyard"){
        const y = d.y-cam.y;
        for (let i=0;i<4;i++){
          const gx = x + i*58;
          roundedRect(ctx, gx, y + (i%2)*8, 34, 58, 12, "#66707d", "rgba(32,34,42,.75)", 2);
          ctx.strokeStyle = "rgba(210,220,230,.34)";
          ctx.beginPath(); ctx.moveTo(gx+17,y+15+(i%2)*8); ctx.lineTo(gx+17,y+34+(i%2)*8); ctx.moveTo(gx+9,y+23+(i%2)*8); ctx.lineTo(gx+25,y+23+(i%2)*8); ctx.stroke();
        }
      } else if (d.kind === "ghost"){
        const y = d.y-cam.y + Math.sin(worldTime*2.1+d.x)*8;
        drawSoftLight(ctx, x+30, y+36, 74, "185,225,255", 0.12);
        ctx.fillStyle = "rgba(218,238,255,.34)";
        ctx.beginPath();
        ctx.moveTo(x+10,y+64); ctx.quadraticCurveTo(x+7,y+15,x+32,y+8); ctx.quadraticCurveTo(x+58,y+15,x+53,y+64);
        ctx.quadraticCurveTo(x+45,y+55,x+38,y+66); ctx.quadraticCurveTo(x+30,y+54,x+22,y+66); ctx.quadraticCurveTo(x+17,y+56,x+10,y+64);
        ctx.fill();
        ctx.fillStyle = "rgba(20,30,52,.38)"; ctx.beginPath(); ctx.arc(x+25,y+31,3,0,Math.PI*2); ctx.arc(x+40,y+31,3,0,Math.PI*2); ctx.fill();
      } else if (d.kind === "deadTree"){
        const y = d.y-cam.y;
        ctx.strokeStyle = "rgba(63,43,35,.82)"; ctx.lineWidth = 9; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x+56,y+165); ctx.lineTo(x+48,y+74); ctx.lineTo(x+28,y+38); ctx.moveTo(x+50,y+92); ctx.lineTo(x+82,y+47); ctx.moveTo(x+49,y+120); ctx.lineTo(x+18,y+92); ctx.stroke(); ctx.lineWidth = 1;
      } else if (d.kind === "campfire"){
        const y = d.y-cam.y;
        contactShadow(ctx, x, y+30, 34, 0.18);
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x-24,y+23); ctx.lineTo(x+22,y+34); ctx.moveTo(x+24,y+23); ctx.lineTo(x-22,y+34); ctx.stroke(); ctx.lineWidth = 1;
        const flame = 1 + Math.sin(worldTime*12)*0.08;
        drawSoftLight(ctx, x, y+3, 70, "255,148,48", 0.20);
        ctx.fillStyle = "#ff6a22"; ctx.beginPath(); ctx.moveTo(x,y+20); ctx.quadraticCurveTo(x-17,y+1,x-2,y-23*flame); ctx.quadraticCurveTo(x+18,y+2,x,y+20); ctx.fill();
        ctx.fillStyle = "#ffe26c"; ctx.beginPath(); ctx.moveTo(x+1,y+18); ctx.quadraticCurveTo(x-8,y+5,x+2,y-11*flame); ctx.quadraticCurveTo(x+10,y+4,x+1,y+18); ctx.fill();
      } else if (d.kind === "merchant"){
        const y = d.y-cam.y;
        contactShadow(ctx, x+d.w/2, y+d.h+4, 38, 0.22);
        ctx.fillStyle = "#2b2432";
        ctx.beginPath();
        ctx.moveTo(x+15,y+18); ctx.quadraticCurveTo(x+38,y-10,x+61,y+18);
        ctx.lineTo(x+72,y+86); ctx.quadraticCurveTo(x+38,y+99,x+5,y+86); ctx.closePath();
        fillStroke(ctx, "#2b2432", OUTLINE, 3);
        ctx.fillStyle = "#6f4a32"; ctx.beginPath(); ctx.ellipse(x+58,y+52,18,28,-0.25,0,Math.PI*2); fillStroke(ctx, "#6f4a32", OUTLINE, 2);
        ctx.fillStyle = "#f1cf87"; ctx.beginPath(); ctx.ellipse(x+38,y+25,18,14,0,0,Math.PI*2); fillStroke(ctx, "#f1cf87", OUTLINE, 2);
        ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(x+31,y+23,2,0,Math.PI*2); ctx.arc(x+45,y+23,2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "#8b1f2d"; ctx.beginPath(); ctx.arc(x+30,y+9,7,0,Math.PI*2); ctx.arc(x+38,y+5,8,0,Math.PI*2); ctx.arc(x+47,y+9,7,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "#fff0b8"; ctx.font = "bold 10px system-ui"; ctx.fillText("Kauf?", x+19, y-8);
      } else if (d.kind === "warning"){
        const y = d.y - cam.y;
        ctx.fillStyle = "rgba(255,70,40,.20)";
        ctx.fillRect(x, y, d.w, 44);
        ctx.fillStyle = "#ffdf6a";
        ctx.font = "bold 13px system-ui";
        ctx.fillText("MINI-BOSS", x+70, y+27);
      }
    }
  }

  drawBlock(ctx,b,cam){
    const x = b.x - cam.x, y = b.y - cam.y;
    if (x < -200 || x > CONFIG.canvas.width+200) return;
    const colors = { dirt:"#b88a5d", mud:"#74513b", wood:"#8c6a4a", rock:"#8c94a2", treeTrunk:"#7a563a", treeLeaf:"#4ab86a", tractor:"#c73e2d", hay:"#d9b84b", fence:"#9b7148", well:"#b9c2d4", trampoline:"#52c7d8", break:"#d7ad64", moving:"#6fa9de", crate:"#b45335" };
    const fill = colors[b.kind] || "#888";
    if (!["treeLeaf","rock"].includes(b.kind)) contactShadow(ctx, x+b.w/2, y+b.h+3, b.w*0.42, 0.08);
    ctx.fillStyle = fill;
    if (b.kind === "rock"){
      ctx.beginPath(); ctx.moveTo(x+3,y+21); ctx.lineTo(x+8,y+6); ctx.lineTo(x+20,y+2); ctx.lineTo(x+29,y+13); ctx.lineTo(x+22,y+30); ctx.lineTo(x+7,y+31); ctx.closePath(); fillStroke(ctx, fill, "rgba(50,48,46,.58)", 2);
      ctx.fillStyle = "rgba(255,255,255,.20)"; ctx.beginPath(); ctx.ellipse(x+15,y+11,7,3,-0.35,0,Math.PI*2); ctx.fill();
    } else if (b.kind === "treeLeaf"){
      ellipse(ctx, x+b.w/2, y+b.h/2, b.w*0.55, b.h*0.48, 0, fill, "rgba(39,89,43,.62)", 2);
    } else if (b.kind === "trampoline"){
      roundedRect(ctx, x, y+8, b.w, b.h-8, 6, fill, OUTLINE, 2);
      ctx.strokeStyle = "#e9ffff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x+3,y+8); ctx.lineTo(x+b.w-3,y+8); ctx.stroke(); ctx.lineWidth = 1;
    } else if (b.kind === "crate"){
      roundedRect(ctx, x, y, b.w, b.h, 4, fill, OUTLINE, 2);
      ctx.strokeStyle = "rgba(60,25,10,.45)"; ctx.beginPath(); ctx.moveTo(x+3,y+3); ctx.lineTo(x+b.w-3,y+b.h-3); ctx.moveTo(x+b.w-3,y+3); ctx.lineTo(x+3,y+b.h-3); ctx.stroke();
    } else if (b.kind === "tractor"){
      roundedRect(ctx, x, y, b.w, b.h, 5, fill, OUTLINE, 2);
      ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(x+4,y+4,b.w-8,5);
    } else if (b.kind === "hay"){
      roundedRect(ctx, x, y, b.w, b.h, 6, fill, "#7d5d24", 2);
      ctx.strokeStyle = "rgba(112,83,24,.38)"; for (let i=5;i<b.w;i+=8){ ctx.beginPath(); ctx.moveTo(x+i,y+4); ctx.lineTo(x+i-2,y+b.h-5); ctx.stroke(); }
    } else {
      roundedRect(ctx, x, y, b.w, b.h, b.kind === "dirt" || b.kind === "mud" ? 3 : 5, fill, "rgba(63,42,25,.62)", 1.6);
      if (["wood","fence","treeTrunk"].includes(b.kind)){
        ctx.strokeStyle = "rgba(70,38,18,.35)"; ctx.beginPath(); ctx.moveTo(x+5,y+2); ctx.lineTo(x+7,y+b.h-2); ctx.moveTo(x+16,y+3); ctx.lineTo(x+14,y+b.h-4); ctx.stroke();
      }
    }
    if (b.hp <= 1){ ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.moveTo(x+4,y+6); ctx.lineTo(x+b.w-6,y+b.h-8); ctx.stroke(); }
  }

  drawZones(ctx, cam){
    for (const z of this.zones){
      const x = z.x - cam.x, y = z.y - cam.y;
      if (x > CONFIG.canvas.width || x + z.w < 0) continue;
      if (z.kind === "wind"){
        ctx.strokeStyle = "rgba(220,245,255,.28)";
        for (let i=0;i<z.w;i+=34){ ctx.beginPath(); ctx.moveTo(x+i,y+20+(i%70)); ctx.quadraticCurveTo(x+i+22,y+8+(i%70),x+i+52,y+20+(i%70)); ctx.stroke(); }
      } else if (z.kind === "slow"){
        ctx.fillStyle = "rgba(94,65,42,.20)";
        ctx.fillRect(x,y,z.w,z.h);
      } else if (z.kind === "safe"){
        const g = ctx.createLinearGradient(x, y, x, y+z.h);
        g.addColorStop(0, "rgba(255,231,148,.05)");
        g.addColorStop(1, "rgba(255,231,148,.16)");
        ctx.fillStyle = g;
        ctx.fillRect(x,y,z.w,z.h);
        ctx.strokeStyle = "rgba(255,231,148,.22)";
        ctx.setLineDash([8,8]);
        ctx.strokeRect(x,y,z.w,z.h);
        ctx.setLineDash([]);
      } else if (z.kind === "hide"){
        ctx.fillStyle = "rgba(62,38,25,.08)";
        ctx.fillRect(x,y,z.w,z.h);
      }
    }
  }

  drawWeather(ctx){
    if (this.weather === "clear") return;
    if (this.weather === "rain"){
      ctx.strokeStyle = "rgba(160,205,255,.38)";
      for (let i=0;i<70;i++){ const x=(i*53+performance.now()/18)%CONFIG.canvas.width; const y=(i*97+performance.now()/9)%CONFIG.canvas.height; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-8,y+18); ctx.stroke(); }
    } else if (this.weather === "fog"){
      ctx.fillStyle = "rgba(220,230,220,.10)";
      for (let i=0;i<5;i++) ctx.fillRect(0, 110+i*55, CONFIG.canvas.width, 24);
    } else if (this.weather === "wind"){
      ctx.strokeStyle = "rgba(255,255,255,.20)";
      for (let i=0;i<12;i++){ const x=(performance.now()/20+i*80)%CONFIG.canvas.width-120; const y=70+i*35; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+120,y+8); ctx.stroke(); }
    }
  }

  drawNightAtmosphere(ctx, cam, worldTime, n){
    ctx.save();
    ctx.fillStyle = `rgba(190,210,230,${0.035*n})`;
    for (let i=0;i<4;i++){
      const x = ((worldTime*22 + i*260 - cam.x*0.14) % (CONFIG.canvas.width+360)) - 180;
      const y = 250 + i*38 + Math.sin(worldTime+i)*10;
      ctx.beginPath(); ctx.ellipse(x+130, y, 190, 18, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle = `rgba(205,225,255,${0.10*n})`;
    ctx.lineWidth = 2;
    for (let i=0;i<9;i++){
      const x = (i*131 + Math.sin(worldTime*.6+i)*18 - cam.x*.04) % CONFIG.canvas.width;
      const y = 130 + (i*47)%210;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.quadraticCurveTo(x+12,y-18,x+27,y); ctx.stroke();
    }
    ctx.restore();
  }

  drawCollectible(ctx,c,cam,time){
    if (c.got) return;
    const x = c.x - cam.x, y = c.y - cam.y + Math.sin(time*3+c.bob)*2;
    if (x < -200 || x > CONFIG.canvas.width+200) return;
    if (c.kind === "chili"){
      ctx.fillStyle = "rgba(255,60,20,.20)"; ctx.beginPath(); ctx.arc(x,y,c.r*1.7,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = "#d92818"; ctx.beginPath(); ctx.ellipse(x,y+2,c.r*0.58,c.r*1.15,-0.45,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = "#49a64a"; ctx.beginPath(); ctx.ellipse(x-5,y-c.r,5,9,-0.8,0,Math.PI*2); ctx.fill();
    } else if (c.kind === "feather"){
      ctx.fillStyle = "#d7f7ff"; ctx.beginPath(); ctx.ellipse(x,y,c.r*0.55,c.r*1.2,0.55,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#77bde0"; ctx.beginPath(); ctx.moveTo(x-8,y+10); ctx.lineTo(x+8,y-12); ctx.stroke();
    } else {
      if (c.kind === "goldEgg"){ ctx.fillStyle = "rgba(255,218,70,.28)"; ctx.beginPath(); ctx.arc(x,y,c.r*1.65,0,Math.PI*2); ctx.fill(); ctx.fillStyle = "#ffd84e"; }
      else ctx.fillStyle = "#fff7e7";
      ctx.beginPath(); ctx.ellipse(x,y,c.r*0.9,c.r*1.15,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = c.kind === "goldEgg" ? "rgba(255,255,210,.78)" : "rgba(210,170,120,.7)";
      for (let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(x+Math.sin((i+1)*2.2)*7, y+Math.cos((i+1)*1.7)*7, 2.4, 0, Math.PI*2); ctx.fill(); }
    }
  }

  drawFireball(ctx,f,cam){
    const x = f.x - cam.x, y = f.y - cam.y;
    if (f.ability === "ice"){
      ctx.fillStyle = "rgba(120,220,255,.28)";
      ctx.beginPath(); ctx.arc(x,y,f.r*2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = "#b7f5ff"; ctx.beginPath(); ctx.moveTo(x,y-f.r); ctx.lineTo(x+f.r,y); ctx.lineTo(x,y+f.r); ctx.lineTo(x-f.r,y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#4ba9d4"; ctx.stroke();
      return;
    }
    if (f.ability === "lightning"){
      ctx.strokeStyle = "rgba(255,250,125,.82)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x-f.r*1.5,y); ctx.lineTo(x-2,y-f.r); ctx.lineTo(x+3,y+f.r*.2); ctx.lineTo(x+f.r*1.6,y-f.r*.1); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(255,246,90,.35)"; ctx.beginPath(); ctx.arc(x,y,f.r*1.7,0,Math.PI*2); ctx.fill();
      return;
    }
    if (f.ability === "eggBomb"){
      ctx.fillStyle = "rgba(255,240,190,.30)"; ctx.beginPath(); ctx.arc(x,y,f.r*1.6,0,Math.PI*2); ctx.fill();
      ellipse(ctx, x, y, f.r*.88, f.r*1.12, 0.2, "#fff2d2", "#8f5b1d", 2);
      ctx.fillStyle = "#ff6a22"; ctx.beginPath(); ctx.arc(x+f.r*.25,y-f.r*.55,3.2,0,Math.PI*2); ctx.fill();
      return;
    }
    ctx.fillStyle = f.charged ? "rgba(255,120,40,.40)" : "rgba(255,140,40,.28)";
    ctx.beginPath(); ctx.arc(x,y,f.r*2.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = f.charged ? "#ff4a1a" : "#ff7a2a";
    ctx.beginPath(); ctx.arc(x,y,f.r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#fff1b8"; ctx.beginPath(); ctx.arc(x-2,y-2,f.r*0.45,0,Math.PI*2); ctx.fill();
  }

  drawParticle(ctx,p,cam){
    const x = p.x - cam.x, y = p.y - cam.y, a = 1 - p.t/p.life;
    if (p.kind === "spark"){ ctx.fillStyle = `rgba(255,220,120,${a})`; ctx.beginPath(); ctx.arc(x,y,p.r,0,Math.PI*2); ctx.fill(); }
    else if (p.kind === "smoke"){ ctx.fillStyle = `rgba(80,80,90,${a*0.50})`; ctx.beginPath(); ctx.arc(x,y,p.r*1.2,0,Math.PI*2); ctx.fill(); }
    else if (p.kind === "dust"){ ctx.fillStyle = `rgba(150,105,66,${a*0.55})`; ctx.beginPath(); ctx.ellipse(x,y,p.r*1.5,p.r,0,0,Math.PI*2); ctx.fill(); }
    else if (p.kind === "flame"){ ctx.fillStyle = `rgba(255,82,18,${a*0.70})`; ctx.beginPath(); ctx.arc(x,y,p.r,0,Math.PI*2); ctx.fill(); ctx.fillStyle = `rgba(255,230,90,${a*0.56})`; ctx.beginPath(); ctx.arc(x,y,p.r*0.48,0,Math.PI*2); ctx.fill(); }
    else if (p.kind === "ice"){ ctx.fillStyle = `rgba(145,230,255,${a*0.70})`; ctx.beginPath(); ctx.rect(x-p.r*.5,y-p.r*.5,p.r,p.r); ctx.fill(); }
    else if (p.kind === "lightning"){ ctx.strokeStyle = `rgba(255,250,120,${a})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(p.x2-cam.x,p.y2-cam.y); ctx.stroke(); ctx.lineWidth = 1; }
    else if (p.kind === "ring"){ ctx.strokeStyle = `rgba(255,255,255,${a*0.80})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x,y,p.r,0,Math.PI*2); ctx.stroke(); ctx.lineWidth = 1; }
    else if (p.kind === "shockwave"){ ctx.strokeStyle = `rgba(255,244,190,${a*0.75})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x,y,p.r*2.4,p.r*0.34,0,0,Math.PI*2); ctx.stroke(); ctx.lineWidth = 1; }
  }
}

export function nightAmount(worldTime){
  const n = Math.cos((worldTime % CONFIG.dayLength) / CONFIG.dayLength * Math.PI * 2) * -0.5 + 0.5;
  return smoothstep(0, 1, n);
}
