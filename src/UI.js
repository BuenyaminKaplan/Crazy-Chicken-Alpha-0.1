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
    const rows = [];
    rows.push(`Eier-Waehrung: ${p.eggPower}`);
    rows.push(`Aktive Faehigkeit: ${active.name}`);
    rows.push("Enter/Escape schliesst den Shop.");
    rows.push("Freischalten und Upgraden macht die Grundfaehigkeiten bewusst wertvoller.");
    const buttons = [["Zurueck ins Spiel", () => this.game.closeShop()]];

    for (const a of ABILITIES){
      const lvl = this.game.abilities.levels[a.id] || 0;
      if (!this.game.abilities.unlocked.has(a.id)){
        rows.push(`${a.name} - ${a.cost} Eier: ${a.desc}`);
        buttons.push([`${p.eggPower >= a.cost ? "Kaufen" : "Zu teuer"}: ${a.name} (${a.cost})`, () => this.buyOrComplain(() => this.game.abilities.buyAbility(a.id, p), "goldEgg")]);
      } else {
        const cost = 4 + lvl * 5;
        rows.push(`${a.name} Stufe ${lvl}/${a.maxLevel}: ${a.desc}`);
        if (lvl < a.maxLevel) buttons.push([`${p.eggPower >= cost ? "Upgrade" : "Zu teuer"}: ${a.name} (${cost})`, () => this.buyOrComplain(() => this.game.abilities.upgradeAbility(a.id, p), "egg")]);
      }
    }

    for (const u of UPGRADES){
      const lvl = this.game.abilities.upgrades[u.id] || 0;
      const cost = u.cost + lvl * 4;
      rows.push(`${u.name} ${lvl}/${u.maxLevel} - ${u.desc}`);
      if (lvl < u.maxLevel) buttons.push([`${p.eggPower >= cost ? "Kaufen" : "Zu teuer"}: ${u.name} (${cost})`, () => this.buyOrComplain(() => this.game.abilities.buyUpgrade(u.id, p), "egg")]);
    }
    buttons.push([`${p.eggPower >= 3 ? "Heilung kaufen" : "Zu teuer: Heilung"} (3)`, () => this.buyOrComplain(() => this.game.abilities.buyHeal(p), "egg")]);
    buttons.push([`${p.eggPower >= 14 ? "Leben kaufen" : "Zu teuer: Leben"} (14)`, () => this.buyOrComplain(() => this.game.abilities.buyLife(p), "goldEgg")]);
    buttons.push(["Pause-Menue", () => this.showPause()]);
    this.show("Chicken-Haendler", `„${lines[Math.floor(Math.random()*lines.length)]}“`, buttons);
    this.scoreBox.textContent = rows.join("\n");
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
    const panelColor = n > 0.48 ? "rgba(8,13,28,.56)" : "rgba(255,255,255,.44)";

    ctx.save();
    ctx.fillStyle = panelColor; ctx.fillRect(10, 8, 438, 72);
    ctx.strokeStyle = n > 0.48 ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.13)"; ctx.strokeRect(10, 8, 438, 72);
    ctx.fillStyle = "rgba(0,0,0,.26)"; ctx.fillRect(18, 33, 136, 14);
    ctx.fillStyle = hpColor; ctx.fillRect(18, 33, 136 * hpRatio, 14);
    ctx.strokeStyle = "rgba(255,255,255,.40)"; ctx.strokeRect(18, 33, 136, 14);
    ctx.fillStyle = textColor;
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Score ${Math.floor(this.game.score)}  •  Leben ${p.lives}  •  Eier ${p.eggPower}`, 18, 23);
    ctx.fillText(`HP ${Math.ceil(p.hp)}/${maxHp}`, 162, 45);
    const active = this.game.abilities.active();
    const cd = this.game.abilities.cooldowns[active.id] || 0;
    ctx.fillStyle = n > 0.48 ? "rgba(255,244,190,.95)" : "rgba(70,42,16,.82)";
    ctx.fillText(`Faehigkeit: ${active.name} ${cd > 0 ? `(${cd.toFixed(1)}s)` : ""}`, 238, 45);
    const buffs = [];
    if (p.invuln > 0) buffs.push(`Gold-Ei ${p.invuln.toFixed(1)}s`);
    if (p.flameTimer > 0) buffs.push(`Chili ${p.flameTimer.toFixed(1)}s`);
    if (p.featherTimer > 0) buffs.push(`Feder ${p.featherTimer.toFixed(1)}s`);
    ctx.globalAlpha = 0.88;
    const hint = this.game.nearMerchant() ? "Enter: Chicken-Haendler" : (this.game.nearestHideZone() ? "↑ halten: in Scheune verstecken" : "↓ am Boden: Fähigkeit wechseln  •  ↓ im Sprung: Stampfer");
    ctx.fillText(buffs.length ? buffs.join("  •  ") : hint, 18, 65);
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
