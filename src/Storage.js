import { ACHIEVEMENTS, CONFIG } from "./Config.js";

export function loadHighscores(){
  try{
    const raw = localStorage.getItem(CONFIG.highscoreKey);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(n => Math.max(0, Math.floor(+n || 0))).slice(0, 3) : [];
  } catch {
    return [];
  }
}

export function addHighscore(score){
  const hs = loadHighscores();
  hs.push(Math.floor(score));
  hs.sort((a,b) => b - a);
  const top = hs.slice(0, 3);
  try{ localStorage.setItem(CONFIG.highscoreKey, JSON.stringify(top)); } catch {}
  return top;
}

export function clearHighscores(){
  try{ localStorage.removeItem(CONFIG.highscoreKey); } catch {}
}

const defaultStats = {
  runs:0,
  bestScore:0,
  eggs:0,
  pigKills:0,
  enemyKills:0,
  bossKills:0,
  blocksBroken:0,
  fireballs:0
};

export function loadStats(){
  try{
    const raw = localStorage.getItem(CONFIG.statsKey);
    return { ...defaultStats, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...defaultStats };
  }
}

export function saveStats(stats){
  try{ localStorage.setItem(CONFIG.statsKey, JSON.stringify({ ...defaultStats, ...stats })); } catch {}
}

export function addStat(name, amount=1){
  const stats = loadStats();
  stats[name] = (stats[name] || 0) + amount;
  saveStats(stats);
  return stats;
}

export function noteBestScore(score){
  const stats = loadStats();
  stats.bestScore = Math.max(stats.bestScore || 0, Math.floor(score));
  saveStats(stats);
  return stats;
}

export function loadUnlockedAchievements(){
  try{
    const raw = localStorage.getItem(CONFIG.achievementsKey);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function saveUnlockedAchievements(set){
  try{ localStorage.setItem(CONFIG.achievementsKey, JSON.stringify([...set])); } catch {}
}

export function checkAchievements(){
  const stats = loadStats();
  const unlocked = loadUnlockedAchievements();
  const newly = [];
  for (const a of ACHIEVEMENTS){
    if (unlocked.has(a.id)) continue;
    if ((stats[a.stat] || 0) >= a.target){
      unlocked.add(a.id);
      newly.push(a);
    }
  }
  if (newly.length) saveUnlockedAchievements(unlocked);
  return { stats, unlocked, newly };
}
