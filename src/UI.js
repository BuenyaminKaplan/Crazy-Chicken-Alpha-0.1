import { CONFIG } from "./Config.js";
import { ABILITIES, UPGRADES } from "./Abilities.js";
import { checkAchievements, clearHighscores, loadHighscores, loadStats } from "./Storage.js";
import { nightAmount } from "./World.js";

export class UI {
  constructor(game){
    this.game = game;
    this.overlay = document.getElementById("overlay");
    this.menu = document.getElementById("menu");
    this.title = document.getElementById("menuTitle");
    this.text = document.getElementById("menuText");
    this.scoreBox = document.getElementById("scoreBox");
    this.opts = document.getElementById("menuOptions");
    this.shopCategory = "abilities";
    this.shopSelected = null;
  }

  showStart(){
    this.show("Crazy Chicken", "Ein Küken, Feuerbälle, Farm-Chaos und viel zu selbstbewusste Bauernhof-Gegner.", [
      ["Spiel starten", () => this.game.startRun()],
      ["Steuerung", () => this.showControls()],
      ["Highscores", () => this.showHighscores()],
      [`Schwierigkeit: ${CONFIG.difficulties[this.game.difficultyName].label}`, () => this.cycleDifficulty()],
      [`Sound: ${this.game.audio.enabled ? "An" : "Aus"}`, () => this.toggleSound()]
    ]);
    this.scoreBox.textContent = "Wähle eine Schwierigkeit und starte deinen Run.";
  }

  showPause(){
    const nearShop = this.game.nearMerchant();
    this.show(nearShop ? "Rastplatz" : "Pause", nearShop ? "Der reisende Chicken-Haendler raschelt mit seiner Tasche. Eier sind hier Waehrung." : CONFIG.controlsText, [
      ...(nearShop ? [["Chicken-Haendler", () => this.showShop()]] : []),
      ["Weiterspielen", () => this.game.resume()],
      ["Neu starten", () => this.game.startRun()],
      ["Steuerung", () => this.showControls()],
      ["Highscores", () => this.showHighscores()],
      [`Sound: ${this.game.audio.enabled ? "An" : "Aus"}`, () => this.toggleSound()],
      ["Zum Startscreen", () => this.game.showStart()]
    ]);
    this.scoreBox.textContent = this.scoreText();
  }

  showShop(){
    const p = this.game.player;
    const active = this.game.abilities.active();
    const lines = [
      "Frische Ware fuer mutige Kueken.",
      "Eier gegen Macht, so laeuft das Geschaeft.",
      "Ein kleiner Preis fuer grosses Gegacker."
    ];
    this.overlay.style.display = "flex";
    this.menu.className = "menu shopMenu";
    this.title.textContent = "Chicken-Haendler";
    this.text.textContent = `„${lines[Math.floor(Math.random()*lines.length)]}“`;
    this.opts.innerHTML = "";
    this.scoreBox.className = "scores shopPanel";
    this.scoreBox.innerHTML = "";
    this.renderShopPanel(active);
  }

  shopEntries(){
    const p = this.game.player;
    const abilities = ABILITIES.map(a => {
      const lvl = this.game.abilities.levels[a.id] || 0;
      const unlocked = this.game.abilities.unlocked.has(a.id);
      const price = unlocked ? 4 + lvl * 5 : a.cost;
      const maxed = unlocked && lvl >= a.maxLevel;
      return {
        id:a.id,
        category:"abilities",
        icon:a.id,
        name:a.name,
        level:unlocked ? `Stufe ${lvl}/${a.maxLevel}` : "Neu",
        price:maxed ? null : price,
        canBuy:!maxed && p.eggPower >= price,
        owned:unlocked,
        desc:a.desc,
        comment:unlocked ? "Noch ein bisschen Schaerfe, und die Farm merkt es." : "Seltene Ware. Kitzelt im Schnabel.",
        action:() => unlocked ? this.game.abilities.upgradeAbility(a.id, p) : this.game.abilities.buyAbility(a.id, p),
        sound:unlocked ? "egg" : "goldEgg"
      };
    });
    const upgrades = UPGRADES.map(u => {
      const lvl = this.game.abilities.upgrades[u.id] || 0;
      const price = u.cost + lvl * 4;
      const maxed = lvl >= u.maxLevel;
      return {
        id:u.id,
        category:"upgrades",
        icon:"upgrade",
        name:u.name,
        level:`Stufe ${lvl}/${u.maxLevel}`,
        price:maxed ? null : price,
        canBuy:!maxed && p.eggPower >= price,
        desc:u.desc,
        comment:"Kleine Investition, grosses Gegacker.",
        action:() => this.game.abilities.buyUpgrade(u.id, p),
        sound:"egg"
      };
    });
    const healing = [
      { id:"heal", category:"healing", icon:"heal", name:"Warme Suppe", level:"Heilung", price:3, canBuy:p.eggPower >= 3, desc:"Heilt sofort 2 HP.", comment:"Schmeckt nach Lagerfeuer und Mut.", action:() => this.game.abilities.buyHeal(p), sound:"egg" },
      { id:"life", category:"healing", icon:"life", name:"Extra Leben", level:"Versicherung", price:14, canBuy:p.eggPower >= 14, desc:"Gibt dir einen weiteren Versuch.", comment:"Teuer, aber Huehner fallen dramatisch.", action:() => this.game.abilities.buyLife(p), sound:"goldEgg" }
    ];
    const specials = [
      { id:"active", category:"specials", icon:this.game.abilities.active().id, name:"Aktiv: " + this.game.abilities.active().name, level:"Ausgeruestet", price:null, canBuy:false, desc:"Druecke unten am Boden, um die Faehigkeit zu wechseln.", comment:"Die richtige Ware zur richtigen Zeit." },
      { id:"bed", category:"specials", icon:"heal", name:this.game.materials.bedBuilt ? "Bett steht bereit" : "Bett bauen", level:this.game.materials.bedBuilt ? "S zum Schlafen" : "Materialien", price:null, canBuy:false, desc:this.game.materials.bedBuilt ? "Druecke S am Haendler, um dich voll zu heilen." : this.game.materials.progressText(), comment:"Ein gutes Nest ist mehr wert als zehn mutige Gackerer." },
      { id:"skin", category:"specials", icon:"upgrade", name:"Skin: " + this.game.skins.name(), level:"K zum Wechseln", price:null, canBuy:false, desc:"Mathe-Schilder schalten neue Skins frei. Sie geben keine Vorteile.", comment:"Mode ist kein Schaden, aber manchmal Mut." }
    ];
    return [...abilities, ...upgrades, ...healing, ...specials];
  }

  renderShopPanel(active){
    const p = this.game.player;
    const categories = [
      ["abilities", "Faehigkeiten"],
      ["upgrades", "Upgrades"],
      ["healing", "Heilung"],
      ["specials", "Spezial"]
    ];
    const entries = this.shopEntries();
    const visible = entries.filter(e => e.category === this.shopCategory);
    if (!visible.some(e => e.id === this.shopSelected)) this.shopSelected = visible[0]?.id ?? null;
    const selected = visible.find(e => e.id === this.shopSelected) || visible[0];

    const wrap = document.createElement("div");
    wrap.className = "shopGrid";
    const top = document.createElement("div");
    top.className = "shopTop";
    top.innerHTML = `<span class="eggPill">Ei-Waehrung: ${p.eggPower}</span><span>Aktiv: ${active.name}</span><span>H / Enter / Escape schliesst</span>`;
    wrap.appendChild(top);

    const tabs = document.createElement("div");
    tabs.className = "shopTabs";
    for (const [id,label] of categories){
      const btn = document.createElement("button");
      btn.className = "shopTab" + (id === this.shopCategory ? " active" : "");
      btn.textContent = label;
      btn.onclick = () => { this.shopCategory = id; this.shopSelected = null; this.game.audio.beep(520, 0.025, "triangle", 0.025); this.showShop(); };
      tabs.appendChild(btn);
    }
    wrap.appendChild(tabs);

    const list = document.createElement("div");
    list.className = "shopList";
    for (const e of visible){
      const row = document.createElement("button");
      row.className = "shopItem" + (selected && e.id === selected.id ? " selected" : "") + (e.price !== null && !e.canBuy ? " locked" : "");
      row.innerHTML = `<span class="shopIcon icon-${e.icon}"></span><span><strong>${e.name}</strong><small>${e.level}</small></span><span class="price">${e.price === null ? "MAX" : e.price + " Ei"}</span>`;
      row.onclick = () => { this.shopSelected = e.id; this.game.audio.beep(460, 0.02, "sine", 0.020); this.showShop(); };
      list.appendChild(row);
    }

    const detail = document.createElement("div");
    detail.className = "shopDetail";
    if (selected){
      detail.innerHTML = `<div class="bigIcon icon-${selected.icon}"></div><h2>${selected.name}</h2><p class="level">${selected.level}</p><p>${selected.desc}</p><blockquote>${selected.comment}</blockquote><p class="cost">${selected.price === null ? "Bereits maximiert" : "Preis: " + selected.price + " Eier"}</p>`;
      if (selected.price !== null){
        const buy = document.createElement("button");
        buy.className = "btn primaryBuy";
        buy.textContent = selected.canBuy ? "Kaufen / verbessern" : "Nicht genug Eier";
        buy.onclick = () => this.buyOrComplain(() => selected.action?.(), selected.sound || "egg");
        detail.appendChild(buy);
      }
    }
    const grid = document.createElement("div");
    grid.className = "shopBody";
    grid.appendChild(list);
    grid.appendChild(detail);
    wrap.appendChild(grid);

    const close = document.createElement("button");
    close.className = "btn shopClose";
    close.textContent = "Zurueck ins Spiel";
    close.onclick = () => this.game.closeShop();
    wrap.appendChild(close);

    this.scoreBox.appendChild(wrap);
  }

  buyOrComplain(fn, soundKind){
    if (fn()){
      this.game.audio.pickup(soundKind);
      this.game.spawnAbilityBurst(this.game.player.center().x, this.game.player.center().y, "shield", 0.7);
    } else {
      this.game.player.addPopup("Nicht genug Eier", "#ff8b7a");
      this.game.audio.beep(130, 0.08, "square", 0.08);
    }
    this.showShop();
  }

  showGameOver(){
    this.show("Game Over", "Run beendet. Neustart mit Button oder Enter.", [
      ["Neu starten", () => this.game.startRun()],
      ["Highscores", () => this.showHighscores()],
      ["Zum Startscreen", () => this.game.showStart()]
    ]);
    this.scoreBox.textContent = this.scoreText();
  }

  showControls(){
    this.show("Steuerung", CONFIG.controlsText + "\n\nTouch: Nutze die eingeblendeten Buttons auf kleinen Bildschirmen.", [
      ["Zurück", () => ["running","hidden","paused","shop"].includes(this.game.state) ? this.showPause() : this.showStart()]
    ]);
    this.scoreBox.textContent = "Tipp: Stampfer funktioniert nur in der Luft mit ↓.";
  }

  showHighscores(){
    this.show("Highscores", "Top 3 Distance-Scores", [
      ["Zurück", () => ["running","hidden","paused","shop"].includes(this.game.state) ? this.showPause() : this.showStart()],
      ["Highscores löschen", () => { clearHighscores(); this.showHighscores(); }]
    ]);
    const hs = loadHighscores();
    const stats = loadStats();
    const ach = checkAchievements();
    const unlocked = [...ach.unlocked].length;
    this.scoreBox.textContent =
      `1. ${hs[0] ?? 0}\n2. ${hs[1] ?? 0}\n3. ${hs[2] ?? 0}` +
      `\n\nStatistik:\nRuns: ${stats.runs}\nBesiegte Gegner: ${stats.enemyKills}\nEier gesamt: ${stats.eggs}\nZerstörte Objekte: ${stats.blocksBroken}` +
      `\n\nAchievements: ${unlocked}/5`;
  }

  cycleDifficulty(){
    const order = ["easy","normal","hard"];
    const i = order.indexOf(this.game.difficultyName);
    this.game.difficultyName = order[(i + 1) % order.length];
    this.showStart();
  }

  toggleSound(){
    this.game.audio.setEnabled(!this.game.audio.enabled);
    if (this.game.state === "running" || this.game.state === "hidden" || this.game.state === "paused" || this.game.state === "shop") this.showPause();
    else this.showStart();
  }

  show(title, text, buttons){
    this.overlay.style.display = "flex";
    this.menu.className = "menu";
    this.scoreBox.className = "scores";
    this.title.textContent = title;
    this.text.textContent = text;
    this.opts.innerHTML = "";
    for (const [label, handler] of buttons){
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = label;
      btn.onclick = () => { this.game.audio.resume(); handler(); };
      this.opts.appendChild(btn);
    }
  }

  hide(){ this.overlay.style.display = "none"; }

  scoreText(){
    const hs = loadHighscores();
    return `Score: ${Math.floor(this.game.score)}\nTop 3:\n1. ${hs[0] ?? 0}\n2. ${hs[1] ?? 0}\n3. ${hs[2] ?? 0}`;
  }

  drawHUD(ctx){
    const p = this.game.player;
    const n = nightAmount(this.game.worldTime);
    const maxHp = CONFIG.maxHp + this.game.abilities.maxHpBonus();
    const hpRatio = Math.max(0, Math.min(1, p.hp / maxHp));
    let hpColor = "#30c25f";
    if (hpRatio <= 0.25) hpColor = "#e3322b";
    else if (hpRatio <= 0.45) hpColor = "#f07822";
    else if (hpRatio <= 0.70) hpColor = "#e9ca35";
    const textColor = n > 0.48 ? "rgba(245,250,255,.94)" : "rgba(10,18,18,.76)";
    const panelColor = n > 0.48 ? "rgba(8,13,28,.46)" : "rgba(255,255,255,.34)";

    ctx.save();
    ctx.fillStyle = panelColor;
    roundHud(ctx, 12, 10, 386, 42, 10);
    ctx.strokeStyle = n > 0.48 ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.10)";
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,.24)";
    roundHud(ctx, 23, 32, 112, 10, 5);
    ctx.fillStyle = hpColor;
    roundHud(ctx, 23, 32, 112 * hpRatio, 10, 5);
    ctx.fillStyle = textColor;
    ctx.font = "bold 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Score ${Math.floor(this.game.score)}`, 22, 25);
    ctx.fillText(`x${p.lives}`, 128, 25);
    ctx.fillStyle = "#fff2bf";
    ctx.beginPath(); ctx.ellipse(168, 21, 7, 9, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = textColor;
    ctx.fillText(`${p.eggPower}`, 180, 25);
    ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`${Math.ceil(p.hp)}/${maxHp}`, 142, 41);
    const active = this.game.abilities.active();
    const cd = this.game.abilities.cooldowns[active.id] || 0;
    ctx.fillStyle = n > 0.48 ? "rgba(255,244,190,.95)" : "rgba(70,42,16,.82)";
    ctx.font = "bold 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`${active.name}${cd > 0 ? ` ${cd.toFixed(1)}s` : ""}`, 230, 25);
    const buffs = [];
    if (p.invuln > 0) buffs.push(`Gold-Ei ${p.invuln.toFixed(1)}s`);
    if (p.flameTimer > 0) buffs.push(`Chili ${p.flameTimer.toFixed(1)}s`);
    if (p.featherTimer > 0) buffs.push(`Feder ${p.featherTimer.toFixed(1)}s`);
    if (buffs.length){
      ctx.globalAlpha = 0.88;
      ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(buffs.join("  •  "), 230, 42);
    }
    const status = this.game.survival.visibleStatus();
    if (status){
      ctx.fillStyle = n > 0.48 ? "rgba(210,235,255,.92)" : "rgba(42,58,48,.82)";
      ctx.font = "bold 11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(`${this.game.currentBiomeLabel()} · ${status}`, 22, 62);
    }
    ctx.restore();

    this.drawPopups(ctx);
  }

  drawPopups(ctx){
    const p = this.game.player;
    ctx.save();
    ctx.font = "bold 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    for (const pop of p.popups){
      const a = 1 - pop.t / pop.life;
      ctx.fillStyle = `rgba(0,0,0,${a*0.42})`;
      ctx.fillText(pop.text, pop.x - this.game.cam.x + 1, pop.y - this.game.cam.y + 1);
      ctx.fillStyle = pop.color;
      ctx.globalAlpha = a;
      ctx.fillText(pop.text, pop.x - this.game.cam.x, pop.y - this.game.cam.y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left";
    ctx.restore();
  }
}

function roundHud(ctx, x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.lineTo(x+w-rr,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+rr);
  ctx.lineTo(x+w,y+h-rr);
  ctx.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);
  ctx.lineTo(x+rr,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-rr);
  ctx.lineTo(x,y+rr);
  ctx.quadraticCurveTo(x,y,x+rr,y);
  ctx.fill();
}
