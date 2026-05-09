import { CONFIG } from "./Config.js";
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
    this.show("Pause", CONFIG.controlsText, [
      ["Weiterspielen", () => this.game.resume()],
      ["Neu starten", () => this.game.startRun()],
      ["Steuerung", () => this.showControls()],
      ["Highscores", () => this.showHighscores()],
      [`Sound: ${this.game.audio.enabled ? "An" : "Aus"}`, () => this.toggleSound()],
      ["Zum Startscreen", () => this.game.showStart()]
    ]);
    this.scoreBox.textContent = this.scoreText();
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
      ["Zurück", () => this.game.state === "running" || this.game.state === "paused" ? this.showPause() : this.showStart()]
    ]);
    this.scoreBox.textContent = "Tipp: Stampfer funktioniert nur in der Luft mit ↓.";
  }

  showHighscores(){
    this.show("Highscores", "Top 3 Distance-Scores", [
      ["Zurück", () => this.game.state === "running" || this.game.state === "paused" ? this.showPause() : this.showStart()],
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
    if (this.game.state === "running" || this.game.state === "paused") this.showPause();
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
    const hpRatio = Math.max(0, Math.min(1, p.hp / CONFIG.maxHp));
    let hpColor = "#30c25f";
    if (hpRatio <= 0.25) hpColor = "#e3322b";
    else if (hpRatio <= 0.45) hpColor = "#f07822";
    else if (hpRatio <= 0.70) hpColor = "#e9ca35";
    const textColor = n > 0.48 ? "rgba(245,250,255,.94)" : "rgba(10,18,18,.76)";
    const panelColor = n > 0.48 ? "rgba(8,13,28,.56)" : "rgba(255,255,255,.44)";

    ctx.save();
    ctx.fillStyle = panelColor; ctx.fillRect(10, 8, 330, 58);
    ctx.strokeStyle = n > 0.48 ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.13)"; ctx.strokeRect(10, 8, 330, 58);
    ctx.fillStyle = "rgba(0,0,0,.26)"; ctx.fillRect(18, 33, 136, 14);
    ctx.fillStyle = hpColor; ctx.fillRect(18, 33, 136 * hpRatio, 14);
    ctx.strokeStyle = "rgba(255,255,255,.40)"; ctx.strokeRect(18, 33, 136, 14);
    ctx.fillStyle = textColor;
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Score ${Math.floor(this.game.score)}  •  Leben ${p.lives}  •  Eier ${p.eggPower}`, 18, 23);
    ctx.fillText(`HP ${Math.ceil(p.hp)}/${CONFIG.maxHp}`, 162, 45);
    const buffs = [];
    if (p.invuln > 0) buffs.push(`Gold-Ei ${p.invuln.toFixed(1)}s`);
    if (p.flameTimer > 0) buffs.push(`Chili ${p.flameTimer.toFixed(1)}s`);
    if (p.featherTimer > 0) buffs.push(`Feder ${p.featherTimer.toFixed(1)}s`);
    ctx.globalAlpha = 0.88;
    ctx.fillText(buffs.length ? buffs.join("  •  ") : "Enter Pause  •  ↓ Stampfer im Sprung", 18, 61);
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
