export const BIOME_LENGTH = 3800;
export const TRANSITION_LENGTH = 620;

export const BIOME_ORDER = [
  "farm",
  "forest",
  "desert",
  "snow",
  "beach",
  "tropics",
  "volcano",
  "graveyard",
  "swamp"
];

export const BIOMES = {
  farm: {
    label:"Farm",
    themes:["field","barn","tractor","field"],
    ground:"dirt",
    platform:"wood",
    enemies:["pig","angryChicken","rooster","cow"],
    weather:["clear","clear","wind","rain"],
    sky:["#79c8ff", "#d6f3ff", "#f6f1cc"],
    hills:["#8ab6a0", "#74bf75", "#328939"]
  },
  forest: {
    label:"Wald",
    themes:["forest","forest","field"],
    ground:"dirt",
    platform:"wood",
    enemies:["fox","crow","pig","rooster"],
    weather:["clear","fog","rain","wind"],
    sky:["#80c7ec", "#c8ebdc", "#dcefc4"],
    hills:["#5f9175", "#3f7b54", "#28683f"]
  },
  desert: {
    label:"Wueste",
    themes:["desert","desert","ruins"],
    ground:"sand",
    platform:"rock",
    enemies:["bull","angryChicken","pig"],
    weather:["clear","wind","wind"],
    sky:["#82c7f2", "#f1d6a4", "#f5d483"],
    hills:["#d9b96f", "#c9984d", "#ad7b36"]
  },
  snow: {
    label:"Schnee",
    themes:["snow","snow","forest"],
    ground:"snow",
    platform:"wood",
    enemies:["cow","crow","fox"],
    weather:["fog","wind","clear"],
    sky:["#9fd4f2", "#dceefa", "#eef7ff"],
    hills:["#b8d5e5", "#8eb4c6", "#60899b"]
  },
  beach: {
    label:"Strand",
    themes:["beach","beach","field"],
    ground:"sand",
    platform:"wood",
    enemies:["crow","pig","angryChicken"],
    weather:["clear","wind","clear"],
    sky:["#7fd4ff", "#d9f5ff", "#f8e9b5"],
    hills:["#83c9b0", "#68b890", "#3b9b72"]
  },
  tropics: {
    label:"Tropen",
    themes:["tropics","tropics","forest"],
    ground:"dirt",
    platform:"wood",
    enemies:["fox","crow","rooster","angryChicken"],
    weather:["rain","fog","clear"],
    sky:["#72cce5", "#c7f2d3", "#e5efb6"],
    hills:["#4d9b70", "#2e8a56", "#1d6947"]
  },
  volcano: {
    label:"Vulkanland",
    themes:["volcano","volcano","ruins"],
    ground:"basalt",
    platform:"rock",
    enemies:["bull","rooster","crow"],
    weather:["fog","wind","clear"],
    sky:["#6f8eaa", "#b18c79", "#684f55"],
    hills:["#59423d", "#4a3432", "#2e2527"]
  },
  graveyard: {
    label:"Friedhof",
    themes:["graveyard","graveyard","forest"],
    ground:"dirt",
    platform:"wood",
    enemies:["crow","fox","pig"],
    weather:["fog","wind","clear"],
    sky:["#556a96", "#34405d", "#26314a"],
    hills:["#3e5557", "#30484a", "#25373a"]
  },
  swamp: {
    label:"Sumpf",
    themes:["swamp","swamp","forest"],
    ground:"mud",
    platform:"wood",
    enemies:["pig","cow","fox","crow"],
    weather:["fog","rain","clear"],
    sky:["#79bfb7", "#b5d5bd", "#bec998"],
    hills:["#5d8063", "#476d51", "#2e5542"]
  }
};

export function getBiomeState(x){
  const pos = Math.max(0, x);
  const index = Math.floor(pos / BIOME_LENGTH);
  const local = pos % BIOME_LENGTH;
  const id = BIOME_ORDER[index % BIOME_ORDER.length];
  const prevId = BIOME_ORDER[(index - 1 + BIOME_ORDER.length) % BIOME_ORDER.length];
  const nextId = BIOME_ORDER[(index + 1) % BIOME_ORDER.length];
  if (index > 0 && local < TRANSITION_LENGTH){
    return { id, prevId, nextId, phase:"intro", transition:1 - local / TRANSITION_LENGTH };
  }
  if (local > BIOME_LENGTH - TRANSITION_LENGTH){
    return { id, prevId, nextId, phase:"outro", transition:(local - (BIOME_LENGTH - TRANSITION_LENGTH)) / TRANSITION_LENGTH };
  }
  return { id, prevId, nextId, phase:"active", transition:0 };
}

export function biomeThemeAt(x, step=0){
  const state = getBiomeState(x);
  if (state.phase !== "active") return "transition";
  const list = BIOMES[state.id]?.themes ?? BIOMES.farm.themes;
  return list[Math.abs(step) % list.length];
}
