export function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t){ return a + (b - a) * t; }
export function smoothstep(a, b, v){
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
export function rand(a, b){ return a + Math.random() * (b - a); }
export function chance(p){ return Math.random() < p; }
export function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
export function mixHex(a, b, t){
  const ar = parseInt(a.slice(1,3),16), ag = parseInt(a.slice(3,5),16), ab = parseInt(a.slice(5,7),16);
  const br = parseInt(b.slice(1,3),16), bg = parseInt(b.slice(3,5),16), bb = parseInt(b.slice(5,7),16);
  const rr = Math.round(lerp(ar,br,t)).toString(16).padStart(2,"0");
  const rg = Math.round(lerp(ag,bg,t)).toString(16).padStart(2,"0");
  const rb = Math.round(lerp(ab,bb,t)).toString(16).padStart(2,"0");
  return `#${rr}${rg}${rb}`;
}
