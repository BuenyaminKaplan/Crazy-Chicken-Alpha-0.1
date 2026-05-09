import { CONFIG } from "./Config.js";
import { clamp, lerp } from "./Utils.js";

export const ABILITIES = [
  {
    id:"fireball",
    name:"Feuerball",
    icon:"F",
    desc:"Klassischer Feuerball. Upgrades geben mehr Schaden und weniger Cooldown.",
    cost:0,
    maxLevel:4
  },
  {
    id:"ice",
    name:"Eisstrahl",
    icon:"I",
    desc:"Langsamer Frostschuss, der Gegner stark zuruckstoest.",
    cost:5,
    maxLevel:3
  },
  {
    id:"lightning",
    name:"Blitzball",
    icon:"B",
    desc:"Schneller Blitz mit kleinem Ketteneffekt.",
    cost:8,
    maxLevel:3
  },
  {
    id:"eggBomb",
    name:"Ei-Bombe",
    icon:"E",
    desc:"Kurzer Bogenwurf mit grosser Explosion.",
    cost:10,
    maxLevel:3
  },
  {
    id:"shield",
    name:"Schildblase",
    icon:"S",
    desc:"Kurzer Schutzschild gegen Kontakt-Schaden.",
    cost:12,
    maxLevel:2
  }
];

export const UPGRADES = [
  { id:"damage", name:"Scharfer Schnabel", desc:"+15% Fahigkeits-Schaden", cost:6, maxLevel:5 },
  { id:"cooldown", name:"Schnelle Fluegel", desc:"Fahigkeiten laden schneller", cost:7, maxLevel:4 },
  { id:"magnet", name:"Ei-Magnet", desc:"Groessere Pickup-Reichweite", cost:5, maxLevel:5 },
  { id:"heart", name:"Extra Herz", desc:"+1 maximales HP", cost:9, maxLevel:3 },
  { id:"stomp", name:"Farm-Beben", desc:"Stampfer-Radius und Schaden steigen", cost:8, maxLevel:3 }
];

export class AbilitySystem {
  constructor(){
    this.unlocked = new Set(["fireball"]);
    this.levels = Object.fromEntries(ABILITIES.map(a => [a.id, a.id === "fireball" ? 1 : 0]));
    this.upgrades = Object.fromEntries(UPGRADES.map(u => [u.id, 0]));
    this.activeIndex = 0;
    this.cooldowns = {};
    this.notice = "";
    this.noticeT = 0;
  }

  resetForRun(){
    this.activeIndex = 0;
    this.cooldowns = {};
    this.notice = "";
    this.noticeT = 0;
  }

  update(dt){
    this.noticeT = Math.max(0, this.noticeT - dt);
    for (const k of Object.keys(this.cooldowns)) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
  }

  unlockedList(){
    return ABILITIES.filter(a => this.unlocked.has(a.id));
  }

  active(){
    const list = this.unlockedList();
    return list[this.activeIndex % list.length] || ABILITIES[0];
  }

  activeLevel(){
    return Math.max(1, this.levels[this.active().id] || 1);
  }

  switchNext(player){
    const list = this.unlockedList();
    if (list.length <= 1) return false;
    this.activeIndex = (this.activeIndex + 1) % list.length;
    this.notice = `${this.active().name} aktiv`;
    this.noticeT = 1.1;
    player.addPopup(this.notice, "#d7f7ff");
    return true;
  }

  damageMult(){
    return 1 + (this.upgrades.damage || 0) * 0.15;
  }

  cooldownMult(){
    return 1 - Math.min(0.38, (this.upgrades.cooldown || 0) * 0.095);
  }

  pickupBonus(){
    return (this.upgrades.magnet || 0) * 9;
  }

  maxHpBonus(){
    return this.upgrades.heart || 0;
  }

  stompBonus(){
    return this.upgrades.stomp || 0;
  }

  canBuyAbility(id, eggs){
    const a = ABILITIES.find(x => x.id === id);
    return a && !this.unlocked.has(id) && eggs >= a.cost;
  }

  buyAbility(id, player){
    const a = ABILITIES.find(x => x.id === id);
    if (!a || this.unlocked.has(id) || player.eggPower < a.cost) return false;
    player.eggPower -= a.cost;
    this.unlocked.add(id);
    this.levels[id] = 1;
    this.notice = `${a.name} freigeschaltet`;
    this.noticeT = 1.4;
    player.addPopup(this.notice, "#ffdf6a");
    return true;
  }

  upgradeAbility(id, player){
    const a = ABILITIES.find(x => x.id === id);
    const lvl = this.levels[id] || 0;
    const cost = 4 + lvl * 5;
    if (!a || !this.unlocked.has(id) || lvl >= a.maxLevel || player.eggPower < cost) return false;
    player.eggPower -= cost;
    this.levels[id] = lvl + 1;
    player.addPopup(`${a.name} Stufe ${lvl + 1}`, "#ffdf6a");
    return true;
  }

  buyUpgrade(id, player){
    const u = UPGRADES.find(x => x.id === id);
    const lvl = this.upgrades[id] || 0;
    const cost = u ? u.cost + lvl * 4 : 0;
    if (!u || lvl >= u.maxLevel || player.eggPower < cost) return false;
    player.eggPower -= cost;
    this.upgrades[id] = lvl + 1;
    if (id === "heart") player.hp = clamp(player.hp + 1, 0, CONFIG.maxHp + this.maxHpBonus());
    player.addPopup(`${u.name} ${lvl + 1}`, "#ffdf6a");
    return true;
  }

  buyHeal(player){
    const maxHp = CONFIG.maxHp + this.maxHpBonus();
    if (player.eggPower < 3 || player.hp >= maxHp) return false;
    player.eggPower -= 3;
    player.hp = clamp(player.hp + 2, 0, maxHp);
    player.addPopup("Heilung gekauft", "#a9ffb0");
    return true;
  }

  buyLife(player){
    if (player.eggPower < 14) return false;
    player.eggPower -= 14;
    player.lives += 1;
    player.addPopup("+ Leben", "#ffd7ec");
    return true;
  }

  cast(game, chargedFireball){
    const ability = this.active();
    const id = ability.id;
    if ((this.cooldowns[id] || 0) > 0) return false;
    if (id === "fireball") return false;

    const p = game.player;
    const d = p.dims();
    const lvl = Math.max(1, this.levels[id] || 1);
    const dmg = (0.9 + lvl * 0.45) * this.damageMult() * p.damageMult();
    const x = p.x + d.w/2 + p.facing * (d.w * 0.66);
    const y = p.y + d.h * 0.46;
    const cd = this.cooldownMult();

    if (id === "shield"){
      p.invuln = Math.max(p.invuln, 1.2 + lvl * 0.55);
      game.spawnAbilityBurst(x, y, "shield", 1 + lvl * 0.25);
      game.audio.beep(780, 0.08, "sine", 0.08);
      this.cooldowns[id] = (7.0 - lvl * 0.9) * cd;
      return true;
    }

    const common = { x, y, vy:0, life:1.05, dmg, charged:false, ability:id };
    if (id === "ice"){
      game.world.fireballs.push({ ...common, vx:p.facing * (1500 + lvl * 120), r:13 + lvl * 2, slow:0.45 });
      game.spawnAbilityBurst(x, y, "ice", 0.7);
      game.audio.beep(920, 0.05, "sine", 0.06);
      this.cooldowns[id] = (0.42 - lvl * 0.035) * cd;
    } else if (id === "lightning"){
      game.world.fireballs.push({ ...common, vx:p.facing * (2600 + lvl * 180), r:10 + lvl, chain:1 + lvl });
      game.spawnAbilityBurst(x, y, "lightning", 0.75);
      game.audio.beep(1180, 0.035, "square", 0.055);
      this.cooldowns[id] = (0.34 - lvl * 0.03) * cd;
    } else if (id === "eggBomb"){
      game.world.fireballs.push({ ...common, vx:p.facing * 980, vy:-540, r:15 + lvl * 3, life:1.55, bomb:true, dmg:dmg * 1.5 });
      game.spawnAbilityBurst(x, y, "eggBomb", 0.8);
      game.audio.beep(360, 0.06, "triangle", 0.07);
      this.cooldowns[id] = (1.45 - lvl * 0.12) * cd;
    }
    if (chargedFireball) this.cooldowns[id] *= lerp(0.84, 0.62, clamp(chargedFireball.chargeT || 0, 0, 1));
    return true;
  }
}
