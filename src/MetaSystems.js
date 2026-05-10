import { clamp } from "./Utils.js";

export const BED_COST = { wood:4, wool:2, feathers:3, stone:2, cloth:2 };

export const SKINS = [
  { id:"classic", name:"Klassik-Kueken" },
  { id:"raincoat", name:"Gelber Regenmantel" },
  { id:"dragon", name:"Drachen-Kueken" },
  { id:"capybara", name:"Capybara-Kueken" },
  { id:"monsterKing", name:"Blauer Monster-Kronen-Skin" },
  { id:"astronaut", name:"Astronauten-Kueken" },
  { id:"knight", name:"Ritter-Kueken" },
  { id:"pirate", name:"Piraten-Kueken" },
  { id:"ninja", name:"Ninja-Kueken" },
  { id:"winter", name:"Weihnachts-Kueken" },
  { id:"lava", name:"Lava-Kueken" },
  { id:"ice", name:"Eis-Kueken" },
  { id:"ghost", name:"Geister-Kueken" }
];

export class MaterialSystem {
  constructor(){ this.reset(); }
  reset(){
    this.items = { wood:0, wool:0, feathers:0, stone:0, cloth:0 };
    this.bedBuilt = false;
    this.sleepT = 0;
    this.notice = "";
  }
  add(kind, amount=1){
    if (this.bedBuilt) return false;
    if (!(kind in this.items)) return false;
    this.items[kind] += amount;
    return true;
  }
  canBuildBed(){
    return Object.entries(BED_COST).every(([k,v]) => this.items[k] >= v);
  }
  buildBed(){
    if (!this.canBuildBed()) return false;
    for (const k of Object.keys(this.items)) this.items[k] = 0;
    this.bedBuilt = true;
    return true;
  }
  resetBiomeMaterials(){
    if (this.bedBuilt) return;
    for (const k of Object.keys(this.items)) this.items[k] = 0;
  }
  progressText(){
    return Object.entries(BED_COST).map(([k,v]) => `${labelMaterial(k)} ${this.items[k]}/${v}`).join("  ");
  }
}

export class SkinSystem {
  constructor(){
    this.unlocked = new Set(["classic"]);
    this.equipped = "classic";
  }
  unlockNext(){
    const next = SKINS.find(s => !this.unlocked.has(s.id));
    if (!next) return null;
    this.unlocked.add(next.id);
    return next;
  }
  cycle(){
    const list = SKINS.filter(s => this.unlocked.has(s.id));
    const i = list.findIndex(s => s.id === this.equipped);
    this.equipped = list[(i + 1) % list.length]?.id || "classic";
    return SKINS.find(s => s.id === this.equipped);
  }
  name(){
    return SKINS.find(s => s.id === this.equipped)?.name || "Klassik-Kueken";
  }
}

export class MathSystem {
  constructor(){ this.current = null; }
  makeTask(){
    const type = Math.floor(Math.random()*3);
    let a, b, answer, text;
    if (type === 0){ a = 3 + Math.floor(Math.random()*7); b = 2 + Math.floor(Math.random()*6); answer = a*b; text = `${a} x ${b} = ?`; }
    else if (type === 1){ a = 8 + Math.floor(Math.random()*18); b = 3 + Math.floor(Math.random()*12); answer = a+b; text = `${a} + ${b} = ?`; }
    else { a = 16 + Math.floor(Math.random()*20); b = 3 + Math.floor(Math.random()*12); answer = a-b; text = `${a} - ${b} = ?`; }
    this.current = { text, answer };
    return this.current;
  }
  check(value){ return this.current && Number(value) === this.current.answer; }
}

export class SurvivalSystem {
  constructor(){ this.reset(); }
  reset(){
    this.biome = "field";
    this.thirst = 100;
    this.cold = 0;
    this.parasites = 0;
    this.lavaGrace = 0;
    this.tick = 0;
  }
  update(dt, game){
    this.tick += dt;
    const safe = game.nearMerchant();
    if (safe){
      this.thirst = Math.min(100, this.thirst + dt*12);
      this.cold = Math.max(0, this.cold - dt*18);
      this.parasites = Math.max(0, this.parasites - dt*10);
      return;
    }
    if (this.biome === "desert") this.thirst = Math.max(0, this.thirst - dt*2.3);
    if (this.biome === "snow") this.cold = Math.min(100, this.cold + dt*2.1);
    if (this.biome === "jungle" || this.biome === "swamp") this.parasites = Math.min(100, this.parasites + dt*1.0);
    if (this.tick >= 5){
      this.tick = 0;
      if (this.thirst <= 0 || this.cold >= 100 || this.parasites >= 100) game.applyDamage(1, this.biome);
    }
  }
  setBiomeByX(x){
    const biomes = ["field","jungle","beach","desert","snow","darkForest","volcano","swamp"];
    this.biome = biomes[Math.floor(Math.max(0, x) / 2400) % biomes.length];
  }
  visibleStatus(){
    if (this.biome === "desert") return `Durst ${Math.ceil(this.thirst)}%`;
    if (this.biome === "snow") return `Kaelte ${Math.ceil(this.cold)}%`;
    if (this.biome === "jungle" || this.biome === "swamp") return `Parasiten ${Math.ceil(this.parasites)}%`;
    return "";
  }
}

export function labelMaterial(k){
  return { wood:"Holz", wool:"Wolle", feathers:"Federn", stone:"Stein", cloth:"Stoff" }[k] || k;
}

export function materialFromBlock(kind){
  if (["wood","fence","treeTrunk","crate","break"].includes(kind)) return "wood";
  if (kind === "hay") return "wool";
  if (kind === "treeLeaf") return "feathers";
  if (kind === "rock" || kind === "well") return "stone";
  if (kind === "barn" || kind === "cloth") return "cloth";
  return null;
}

export function clampStatus(v){ return clamp(v, 0, 100); }
