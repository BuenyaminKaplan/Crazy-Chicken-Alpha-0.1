import { CONFIG } from "./Config.js";
import { aabb } from "./Collision.js";
import { chance, mixHex, pick, rand, smoothstep } from "./Utils.js";
import { Enemy } from "./Enemy.js";

export class World {
  constructor(){
    this.blocks = [];
    this.decor = [];
    this.collectibles = [];
    this.enemies = [];
    this.particles = [];
    this.cracks = [];
    this.fireballs = [];
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

    this.spawnCollectibleTrail(baseX, len, theme);
    if (theme !== "start") this.spawnEnemies(baseX, len, theme, difficulty);
  }

  spawnCollectibleTrail(baseX, len, theme){
    if (Math.random() < 0.66) return;
    const count = Math.random() < 0.78 ? 1 : 2;
    for (let i=0;i<count;i++){
      const ex = baseX + 320 + Math.random()*(len-520);
      const ey = theme === "barn" ? CONFIG.groundY-170 : (Math.random() < 0.55 ? CONFIG.groundY-90 : CONFIG.groundY-190);
      const roll = Math.random();
      const kind = roll < 0.10 ? "goldEgg" : (roll < 0.20 ? "chili" : (roll < 0.25 ? "feather" : "egg"));
      this.spawnCollectible(ex, ey, kind);
    }
  }

  spawnEnemies(baseX, len, theme, difficulty){
    const count = Math.floor((2 + Math.random()*4) * difficulty.enemyRate);
    const typesByTheme = {
      field: ["pig","angryChicken","pig"],
      barn: ["cow","pig","crow"],
      mud: ["pig","cow"],
      tractor: ["angryChicken","pig","cow"],
      night: ["crow","pig","angryChicken"]
    };
    for (let i=0;i<count;i++){
      const x = baseX + 430 + Math.random()*(len-620);
      if (x < 900) continue;
      this.enemies.push(new Enemy(pick(typesByTheme[theme] || ["pig"]), x, difficulty));
    }
  }

  spawnField(x){
    this.addGrid(x, CONFIG.groundY-2*CONFIG.tile, 9, 2, "fence", 2);
    for (let i=0;i<9;i+=2) this.addGrid(x+i*CONFIG.tile, CONFIG.groundY-4*CONFIG.tile, 1, 2, "fence", 2);
    this.decor.push({ kind:"grass", x:x-120, y:CONFIG.groundY, w:420 });
  }
  spawnBarn(x){
    this.decor.push({ kind:"barn", x:x+460, y:CONFIG.groundY-150, w:150, h:150 });
    this.addGrid(x, CONFIG.groundY-3*CONFIG.tile, 4, 3, "well", 3);
    this.carve(x+CONFIG.tile, CONFIG.groundY-2*CONFIG.tile, 2*CONFIG.tile, CONFIG.tile, "well");
  }
  spawnMud(x){
    this.addGrid(x, CONFIG.groundY-CONFIG.tile, 9, 1, "mud", 1);
    this.addGrid(x+260, CONFIG.groundY-2*CONFIG.tile, 5, 2, "hay", 2);
  }
  spawnTractor(x){
    this.addGrid(x, CONFIG.groundY-2*CONFIG.tile, 7, 2, "tractor", 4);
    this.addGrid(x+3*CONFIG.tile, CONFIG.groundY-4*CONFIG.tile, 3, 2, "tractor", 4);
    this.carve(x+4*CONFIG.tile, CONFIG.groundY-4*CONFIG.tile, CONFIG.tile, CONFIG.tile, "tractor");
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
  }

  damageBlocks(rx, ry, rw, rh, dmg, game){
    for (let i=this.blocks.length-1;i>=0;i--){
      const b = this.blocks[i];
      if (!aabb(b.x,b.y,b.w,b.h,rx,ry,rw,rh)) continue;
      b.hp -= dmg;
      if (b.hp <= 0){
        game.spawnExplosion(b.x+b.w/2, b.y+b.h/2, 0.55);
        game.audio.material(b.kind);
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
      this.blocks.splice(i,1);
    }
  }

  update(dt, game){
    for (const e of this.enemies) e.update(dt, game.player, this.blocks);
    this.updateFireballs(dt, game);
    this.updateParticles(dt);
    for (let i=this.cracks.length-1;i>=0;i--){
      this.cracks[i].t += dt;
      if (this.cracks[i].t >= this.cracks[i].life) this.cracks.splice(i,1);
    }
  }

  updateFireballs(dt, game){
    for (let i=this.fireballs.length-1;i>=0;i--){
      const f = this.fireballs[i];
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
        else e.damage(f.dmg, f.vx >= 0 ? 1 : -1, 1800);
        game.explodeFireball(f);
        this.fireballs.splice(i,1);
        removed = true;
        break;
      }
      if (!removed && (f.life <= 0 || f.x < game.cam.x-1200 || f.x > game.cam.x+CONFIG.canvas.width+2400)) this.fireballs.splice(i,1);
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
    this.drawDecor(ctx, cam);
    ctx.fillStyle = mixHex("#5aa85b", "#3f7447", n);
    ctx.fillRect(-200, CONFIG.groundY-cam.y, CONFIG.canvas.width+400, CONFIG.canvas.height-CONFIG.groundY+200);
    ctx.fillStyle = mixHex("#3f833e", "#315332", n);
    ctx.fillRect(-200, CONFIG.groundY-cam.y, CONFIG.canvas.width+400, 10);

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
  }

  drawDecor(ctx, cam){
    for (const d of this.decor){
      const x = d.x - cam.x*0.92;
      if (x < -260 || x > CONFIG.canvas.width+260) continue;
      if (d.kind === "grass"){
        ctx.strokeStyle = "rgba(34,112,48,.55)";
        for (let i=0;i<d.w;i+=14){ ctx.beginPath(); ctx.moveTo(x+i, d.y-cam.y); ctx.lineTo(x+i+4, d.y-cam.y-12-(i%22)); ctx.stroke(); }
      } else if (d.kind === "barn"){
        const y = d.y - cam.y;
        ctx.fillStyle = "#9d2f2f"; ctx.fillRect(x,y,d.w,d.h);
        ctx.fillStyle = "#6f2222"; ctx.beginPath(); ctx.moveTo(x-12,y); ctx.lineTo(x+d.w/2,y-58); ctx.lineTo(x+d.w+12,y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 4; ctx.strokeRect(x+42,y+74,64,76); ctx.lineWidth = 1;
      }
    }
  }

  drawBlock(ctx,b,cam){
    const x = b.x - cam.x, y = b.y - cam.y;
    if (x < -200 || x > CONFIG.canvas.width+200) return;
    const colors = { dirt:"#b88a5d", mud:"#74513b", wood:"#8c6a4a", rock:"#8c94a2", treeTrunk:"#7a563a", treeLeaf:"#4ab86a", tractor:"#c73e2d", hay:"#d9b84b", fence:"#9b7148", well:"#b9c2d4" };
    ctx.fillStyle = colors[b.kind] || "#888";
    if (b.kind === "rock"){
      ctx.beginPath(); ctx.moveTo(x+3,y+20); ctx.lineTo(x+7,y+6); ctx.lineTo(x+18,y+3); ctx.lineTo(x+23,y+14); ctx.lineTo(x+19,y+24); ctx.lineTo(x+6,y+24); ctx.closePath(); ctx.fill();
    } else if (b.kind === "treeLeaf"){
      ctx.beginPath(); ctx.arc(x+12,y+12,13,0,Math.PI*2); ctx.fill();
    } else {
      ctx.fillRect(x, y, b.w, b.h);
      if (["wood","fence","treeTrunk"].includes(b.kind)){
        ctx.strokeStyle = "rgba(70,38,18,.35)"; ctx.beginPath(); ctx.moveTo(x+5,y+2); ctx.lineTo(x+7,y+b.h-2); ctx.moveTo(x+16,y+3); ctx.lineTo(x+14,y+b.h-4); ctx.stroke();
      }
    }
    if (b.hp <= 1){ ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.moveTo(x+4,y+6); ctx.lineTo(x+b.w-6,y+b.h-8); ctx.stroke(); }
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
    else if (p.kind === "ring"){ ctx.strokeStyle = `rgba(255,255,255,${a*0.80})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x,y,p.r,0,Math.PI*2); ctx.stroke(); ctx.lineWidth = 1; }
    else if (p.kind === "shockwave"){ ctx.strokeStyle = `rgba(255,244,190,${a*0.75})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x,y,p.r*2.4,p.r*0.34,0,0,Math.PI*2); ctx.stroke(); ctx.lineWidth = 1; }
  }
}

export function nightAmount(worldTime){
  const n = Math.cos((worldTime % CONFIG.dayLength) / CONFIG.dayLength * Math.PI * 2) * -0.5 + 0.5;
  return smoothstep(0, 1, n);
}
