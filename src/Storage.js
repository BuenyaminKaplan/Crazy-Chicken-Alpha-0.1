import { CONFIG } from "./Config.js";

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
