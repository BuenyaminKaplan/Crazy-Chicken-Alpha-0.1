// game.js
(() => { // IIFE: läuft sofort los, damit nix global “rumliegt”

  // --- Canvas setup ---
  const canvas = document.getElementById("c"); // holt das canvas element aus HTML
  const ctx = canvas.getContext("2d"); // holt 2D zeichen context, damit man malen kann

  // --- UI elements ---
  const overlay = document.getElementById("overlay"); // overlay layer (pause/gameover)
  const menuTitle = document.getElementById("menuTitle"); // titel zeile im overlay
  const menuText  = document.getElementById("menuText"); // erklär text im overlay
  const scoreBox  = document.getElementById("scoreBox"); // score box text
  const btnResume = document.getElementById("btnResume"); // resume button
  const btnRestart = document.getElementById("btnRestart"); // restart button
  const btnResetScores = document.getElementById("btnResetScores"); // highscores reset
  const btnQuit   = document.getElementById("btnQuit"); // quit button (macht nur hint)

  // ---------------- Input ----------------
  const keys = { left:false, right:false, up:false, down:false, fire:false, enter:false }; // taste states speichern
  let didUserGesture = false; // merken ob user mal was gedrückt hat (audio policy)

  addEventListener("keydown", (e) => { // wenn taste runter gedrückt wird
    if (e.key === "ArrowLeft") keys.left = true; // links aktiv
    if (e.key === "ArrowRight") keys.right = true; // rechts aktiv
    if (e.key === "ArrowUp") keys.up = true; // jump taste aktiv
    if (e.key === "ArrowDown") keys.down = true; // stampfer taste aktiv
    if (e.key === " ") keys.fire = true; // space fürs schießen/aufladen
    if (e.key === "Enter") keys.enter = true; // enter = pause

    if (!didUserGesture){ // browser will audio erst nach user aktion
      didUserGesture = true; // jetzt war user aktion da
      audioTryResume(); // versucht audio context zu starten (klappt nich immer)
    }

    // verhindert scrollen/komische browser actions bei diesen tasten
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," ","Enter"].includes(e.key)) e.preventDefault();
  }, { passive:false }); // passive false damit preventDefault erlaubt ist

  addEventListener("keyup", (e) => { // wenn taste losgelassen wird
    if (e.key === "ArrowLeft") keys.left = false; // links aus
    if (e.key === "ArrowRight") keys.right = false; // rechts aus
    if (e.key === "ArrowUp") keys.up = false; // up aus
    if (e.key === "ArrowDown") keys.down = false; // down aus
    if (e.key === " ") keys.fire = false; // fire aus
    if (e.key === "Enter") keys.enter = false; // enter aus
  });

  // ---------------- Audio (WebAudio, no files) ----------------
  let actx = null; // audio context (browser sound engine)
  let master = null; // master gain (lautstärke regler)
  let lastMaterialSfx = 0; // verhindert sound-chaos bei großen explosionen

  function audioTryResume(){ // macht audio “an” wenns geht
    try{
      if (!actx){ // wenn noch kein audio context existiert
        actx = new (window.AudioContext || window.webkitAudioContext)(); // create audio context
        master = actx.createGain(); // gain node machen
        master.gain.value = 0.16; // master lautstärke (klein)
        master.connect(actx.destination); // output an lautsprecher
      }
      if (actx.state === "suspended") actx.resume(); // wenn pausiert dann resume
    } catch {} // fehler ignoriern (manchmal blockt browser)
  }

  function beep(freq=440, dur=0.06, type="sine", gain=0.11){ // kleines piep geräusch
    if (!actx || actx.state !== "running") return; // wenn audio nicht läuft, dann nix
    const o = actx.createOscillator(); // oscillator macht ton
    const g = actx.createGain(); // gain für lautstärke
    o.type = type; // wellen form (sine/square/triangle)
    o.frequency.value = freq; // frequenz in hz
    g.gain.value = gain; // lautstärke grob
    o.connect(g); g.connect(master); // verkabeln (audio graph)
    const t = actx.currentTime; // aktuelle audio zeit
    g.gain.setValueAtTime(0.0001, t); // start leise (fast 0)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01); // schnell hoch fahren
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur); // dann ausblenden
    o.start(t); // start oscillator
    o.stop(t + dur + 0.01); // stop oscillator (kleiner puffer)
  }

  function boom(base=90, dur=0.16, gain=0.16){ // boom/explosion sound (bisschen random)
    if (!actx || actx.state !== "running") return; // wenn kein audio, dann return
    const o = actx.createOscillator(); // tone oscillator
    const g = actx.createGain(); // lautstärke node
    o.type = "sawtooth"; // sägezahn klingt “brrrr”
    const t = actx.currentTime; // audio zeit
    o.frequency.setValueAtTime(base*2.5, t); // start freq höher
    o.frequency.exponentialRampToValueAtTime(base, t + dur); // runter sweep
    g.gain.setValueAtTime(0.0001, t); // start leise
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02); // attack
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur); // decay
    o.connect(g); g.connect(master); // connect chain
    o.start(t); o.stop(t + dur + 0.02); // start/stop

    // noise burst (krach) über buffer
    const bufferSize = Math.floor(actx.sampleRate * dur); // samples anzahl
    const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate); // 1 kanal buffer
    const data = buffer.getChannelData(0); // daten array
    for (let i=0;i<bufferSize;i++){ // füllt das array
      const k = 1 - i/bufferSize; // fade out faktor
      data[i] = (Math.random()*2-1) * (k*k) * 0.75; // random noise mit falloff (ungefähr)
    }
    const n = actx.createBufferSource(); // buffer source node
    const ng = actx.createGain(); // gain für noise
    n.buffer = buffer; // set buffer
    ng.gain.setValueAtTime(0.0001, t); // start leise
    ng.gain.exponentialRampToValueAtTime(gain*0.55, t + 0.01); // hoch
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur); // runter
    n.connect(ng); ng.connect(master); // connect
    n.start(t); // start noise
    n.stop(t + dur + 0.02); // stop
  }

  function noiseBurst(dur=0.12, gain=0.08, filterFreq=900){ // kurze geräuschwolke für farm/impact sounds
    if (!actx || actx.state !== "running") return;
    const t = actx.currentTime;
    const bufferSize = Math.floor(actx.sampleRate * dur);
    const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<bufferSize;i++){
      const k = 1 - i/bufferSize;
      data[i] = (Math.random()*2-1) * k;
    }
    const src = actx.createBufferSource();
    const filter = actx.createBiquadFilter();
    const g = actx.createGain();
    src.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  function cluck(){ // einsammel-sound mit kleinem huhn-charakter
    beep(620, 0.035, "triangle", 0.08);
    setTimeout(() => beep(760, 0.035, "triangle", 0.06), 45);
  }

  function enemyVoice(type){ // schweine/kühe klingen unterschiedlich beim treffer
    if (type === "cow"){
      beep(145, 0.10, "sawtooth", 0.065);
      setTimeout(() => beep(118, 0.12, "sawtooth", 0.055), 70);
    } else {
      beep(260, 0.045, "square", 0.055);
      setTimeout(() => beep(210, 0.055, "square", 0.05), 42);
    }
  }

  function blockBreakSound(kind){ // material feedback
    if (actx && actx.currentTime - lastMaterialSfx < 0.035) return;
    if (actx) lastMaterialSfx = actx.currentTime;
    if (kind === "hay") { noiseBurst(0.11, 0.07, 1500); beep(220, 0.035, "triangle", 0.035); return; }
    if (kind === "rock") { noiseBurst(0.14, 0.085, 520); boom(55, 0.08, 0.055); return; }
    if (kind === "tractor") { noiseBurst(0.16, 0.08, 780); beep(95, 0.06, "sawtooth", 0.045); return; }
    if (kind === "treeTrunk" || kind === "wood" || kind === "fence") { noiseBurst(0.10, 0.065, 950); beep(180, 0.035, "square", 0.035); return; }
    noiseBurst(0.10, 0.055, 1200);
  }

  // ---------------- Helpers ----------------
  const W = canvas.width, H = canvas.height; // canvas breite/höhe
  const TILE = 24; // tile größe für blöcke
  const gravity = 2350; // schwerkraft wert (px/s², so ähnlich)

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); } // begrenzt wert zwischen a und b
  function lerp(a,b,t){ return a + (b-a)*t; } // linear interpolation (mischt werte)
  function aabb(ax,ay,aw,ah, bx,by,bw,bh){ // collision box check (rechteck zu rechteck)
    return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by; // true wenn überlappt
  }

  // ---------------- Minimal screen shake ----------------
  let shakeT = 0; // shake timer
  let shakePow = 0; // shake power stärke
  function addShake(power, time=0.10){ // fügt kamera wackeln hinzu
    power *= 0.35; // macht es weicher (unpräzise, aber ok)
    time  *= 0.60; // kürzer
    shakePow = Math.max(shakePow, power); // nimmt den höheren wert
    shakeT = Math.max(shakeT, time); // nimmt längere zeit
  }

  // ---------------- Highscores (Top 3, persistent) ----------------
  const HS_KEY = "chick_endless_top3_v1"; // key im localStorage

  function loadHighscores(){ // lädt highscores aus browser speicher
    try{
      const raw = localStorage.getItem(HS_KEY); // raw string holen
      const arr = raw ? JSON.parse(raw) : []; // JSON parse oder leeres array
      if (Array.isArray(arr)) return arr.map(n => Math.max(0, Math.floor(+n||0))).slice(0,3); // normalisieren
    } catch {} // parse error ignorieren
    return []; // fallback leer
  }

  function saveHighscores(arr){ // speichert array zurück
    try{ localStorage.setItem(HS_KEY, JSON.stringify(arr.slice(0,3))); } catch {} // top3 schreiben
  }

  function maybeAddHighscore(score){ // packt neuen score rein falls gut genug
    const hs = loadHighscores(); // alte laden
    hs.push(Math.floor(score)); // neuen score hinzufügen
    hs.sort((a,b)=>b-a); // groß nach klein sortieren
    const top3 = hs.slice(0,3); // nur 3
    saveHighscores(top3); // speichern
    return top3; // zurück geben
  }

  function resetHighscores(){ // löscht highscores
    try{ localStorage.removeItem(HS_KEY); } catch {} // remove key
  }

  function highscoresText(currentScore=0){ // baut text block für overlay
    const hs = loadHighscores(); // holen
    const lines = [ // list of lines
      `Score: ${Math.floor(currentScore)}`, // aktueller score
      `Top 3 Highscores:`, // titel
      `1) ${hs[0] ?? 0}`, // platz 1 oder 0
      `2) ${hs[1] ?? 0}`, // platz 2
      `3) ${hs[2] ?? 0}`, // platz 3
    ];
    return lines.join("\n"); // join mit newline
  }

  // ---------------- Game State ----------------
  let paused = false; // pause flag
  let gameOver = false; // gameover flag

  let lives = 3; // leben anzahl
  let hp = 10; // health points
  const MAX_HP = 10; // max hp

  // Score via distance
  let startX = 0; // start position x
  let maxX = 0; // weiteste x position
  let score = 0; // score value

  // eggs + buffs
  let eggPower = 0; // wie viele eier gesammelt
  const EGG_MAX = 30; // max eier fürs scaling (endless halt)

  function damageMult(){ // multiplikator für damage (bisschen scaling)
    let m = 1 + 0.03 * eggPower; // pro ei 3% mehr
    m *= (eggPower >= 10) ? 1.10 : 1.0; // bonus ab 10
    m *= (eggPower >= 20) ? 1.10 : 1.0; // bonus ab 20
    m *= (eggPower >= 30) ? 1.10 : 1.0; // bonus ab 30
    return m; // return mult
  }

  // Fire / charge
  let charging = false; // ob gerade space gehalten wird
  let chargeT = 0; // charge zeit in sekunden
  const CHARGE_MAX = 1.15; // max charge, jetzt schneller voll
  let fireCooldown = 0; // cooldown zwischen schüssen
  let stompCooldown = 0; // cooldown für stampfer
  let stompLock = 0; // kurze standzeit nach stampfer

  const TAP_BASE_DAMAGE = 0.7; // basis dmg bei tap
  const MID_BASE_DAMAGE = 1.2; // basis dmg bei mid charge
  const CHARGED_BASE_DAMAGE = 2.2; // voll charge dmg

  const fireballs = []; // array mit projektilen
  const particles = []; // array mit partikeln
  const groundCracks = []; // risse nach stampfer
  let invuln = 0; // invulnerable timer (unverwundbar)

  // world/camera
  const cam = { x:0, y:0 }; // kamera position
  const groundY = 470; // boden y (linie)

  // world objects (endless generation)
  const blocks = []; // zerstörbare blöcke
  const enemies = []; // gegner array
  const eggs = []; // eier array
  const decor = []; // nicht-kollidierende details für mehr tiefe

  let nextGenX = 0; // bis wohin world generiert wurde
  let nextId = 1; // id counter für enemies
  let worldTime = 0; // zeit für tag-nacht zyklus
  const DAY_LENGTH = 96; // sekunden für einen kompletten sonne/mond zyklus
  let ambientT = 2.5; // kleine farm-atmosphäre in abständen

  // ---------------- Player ----------------
  const player = { // spieler object
    x: 120, y: 380, // start position (ungefähr)
    baseW: 34, baseH: 34, // basis größe
    scale: 1, // scale faktor
    vx: 0, vy: 0, // velocity x/y
    onGround: false, // ob am boden
    facing: 1, // blickrichtung 1 oder -1
    bob: 0, // wackel animation time

    accel: 3600, // beschleunigung, natürlicher kontrollierbar
    maxVx: 920, // max speed
    jump: 1080, // jump impulse
  };

  const BASE_ACCEL = player.accel; // backup accel
  const BASE_MAXVX = player.maxVx; // backup maxVx

  function playerDims(){ // gibt echte größe zurück mit scale
    return { w: player.baseW*player.scale, h: player.baseH*player.scale }; // object w/h
  }

  function updateScaleFromEggs(){ // macht spieler größer je mehr eier
    const t = clamp(eggPower / EGG_MAX, 0, 1); // normalisiert 0..1
    player.scale = 1.0 + t * 0.70; // bis 1.7x groß (so grob)
  }

  // ---------------- FX ----------------
  function spawnExplosion(x,y,strength=1){ // macht partikel explosion
    const n = Math.floor(22 * strength); // wie viele partikel
    for (let i=0;i<n;i++){ // loop partikel
      const a = Math.random() * Math.PI * 2; // random winkel
      const sp = (240 + Math.random()*700) * strength; // speed
      particles.push({ // partikel object
        kind: (Math.random()<0.65) ? "spark" : "smoke", // spark oder smoke
        x, y, // start pos
        vx: Math.cos(a)*sp, // x speed
        vy: Math.sin(a)*sp - 180, // y speed (bisschen nach oben)
        r: 2 + Math.random()*4.2, // radius
        t: 0, // time
        life: 0.20 + Math.random()*0.28 // lebenszeit
      });
    }
    particles.push({ kind:"ring", x, y, r: 10*strength, t:0, life: 0.11 }); // ring effekt
  }

  function spawnGroundCracks(cx, radius=520){ // sichtbare risse entlang des bodens
    for (let i=0;i<16;i++){
      const dir = i % 2 === 0 ? 1 : -1;
      const len = 45 + Math.random()*125;
      const dist = Math.random()*radius;
      groundCracks.push({
        x: cx + dir*dist,
        y: groundY + 1,
        len,
        angle: (Math.random()*0.55 + 0.08) * dir,
        t: 0,
        life: 1.05 + Math.random()*0.35
      });
    }
  }

  function spawnShockwave(cx){ // stampfer optik
    particles.push({ kind:"shockwave", x:cx, y:groundY-8, r:18, t:0, life:0.34 });
    for (let i=0;i<26;i++){
      const dir = Math.random()<0.5 ? -1 : 1;
      particles.push({
        kind:"dust",
        x: cx + dir*Math.random()*70,
        y: groundY - 4,
        vx: dir*(260 + Math.random()*760),
        vy: -120 - Math.random()*220,
        r: 4 + Math.random()*7,
        t: 0,
        life: 0.28 + Math.random()*0.24
      });
    }
  }

  // ---------------- World Generation ----------------
  function addBlockGrid(x, y, cols, rows, kind, hpEach){ // fügt grid an blocks ein
    for (let r=0;r<rows;r++){ // jede row
      for (let c=0;c<cols;c++){ // jede col
        blocks.push({ // block object
          x: x + c*TILE, // pos x
          y: y + r*TILE, // pos y
          w: TILE, h: TILE, // größe
          kind, // art (dirt/wood/etc)
          hp: hpEach, // hitpoints
          solid:true // ist fest (collidable)
        });
      }
    }
  }

  function carveRect(x, y, w, h, kindMatch=null){ // schneidet blocks weg in einem rechteck
    for (let i=blocks.length-1;i>=0;i--){ // rückwärts löschen ist leichter
      const b = blocks[i]; // block referenz
      if (kindMatch && b.kind !== kindMatch) continue; // wenn kindMatch, nur die
      if (aabb(b.x,b.y,b.w,b.h, x,y,w,h)) blocks.splice(i,1); // wenn überlappt -> raus
    }
  }

  function spawnPropCluster(x0){ // baut deko/props auf
    const terrainHP = 2; // hp für boden blocks (so halb)
    const propHP = 3; // hp für props

    const pick = Math.random(); // random decide
    if (pick < 0.24){
      addBlockGrid(x0+TILE, groundY-5*TILE, 2, 5, "treeTrunk", propHP); // baum stamm
      addBlockGrid(x0-1*TILE, groundY-8*TILE, 6, 3, "treeLeaf", 2); // baumkrone
      addBlockGrid(x0, groundY-9*TILE, 4, 1, "treeLeaf", 2); // oben runder
      carveRect(x0+2*TILE, groundY-8*TILE, TILE, TILE, "treeLeaf"); // cartoon-lücke
    } else if (pick < 0.42){
      addBlockGrid(x0, groundY-3*TILE, 5, 3, "rock", propHP+2); // größerer felsen
      carveRect(x0, groundY-3*TILE, TILE, TILE, "rock");
      carveRect(x0+4*TILE, groundY-3*TILE, TILE, TILE, "rock");
    } else if (pick < 0.60){
      addBlockGrid(x0, groundY-2*TILE, 7, 2, "tractor", propHP+1); // traktor chassis
      addBlockGrid(x0+3*TILE, groundY-4*TILE, 3, 2, "tractor", propHP+1); // kabine
      carveRect(x0+4*TILE, groundY-4*TILE, TILE, TILE, "tractor"); // fenster
    } else if (pick < 0.78){
      addBlockGrid(x0, groundY-2*TILE, 6, 2, "hay", 2); // zerstörbarer heuhaufen
      addBlockGrid(x0+TILE, groundY-3*TILE, 4, 1, "hay", 2);
      addBlockGrid(x0+2*TILE, groundY-4*TILE, 2, 1, "hay", 2);
    } else if (pick < 0.90){
      addBlockGrid(x0, groundY-3*TILE, 4, 3, "well", propHP); // brunnen
      carveRect(x0+TILE, groundY-2*TILE, 2*TILE, TILE, "well"); // innen frei
      addBlockGrid(x0-TILE, groundY-5*TILE, 6, 1, "wood", propHP); // dach rand
    } else {
      addBlockGrid(x0, groundY-2*TILE, 9, 2, "fence", 2); // zaunbarriere
      for (let i=0;i<9;i+=2) addBlockGrid(x0+i*TILE, groundY-4*TILE, 1, 2, "fence", 2);
    }

    if (Math.random() < 0.65){ // manchmal plattform extra
      const y = groundY - (5 + Math.floor(Math.random()*3)) * TILE; // plattform y
      const tiles = 10 + Math.floor(Math.random()*10); // länge
      addBlockGrid(x0 + 420, y, tiles, 1, "wood", terrainHP); // wood plattform
      for (let i=0;i<tiles;i+=8) addBlockGrid(x0 + 420 + i*TILE, y+TILE, 1, 2, "wood", terrainHP); // stützen
    }

    if (Math.random() < 0.55) decor.push({ kind:"grass", x:x0-80, y:groundY, w:260 + Math.random()*180 });
    if (Math.random() < 0.35) decor.push({ kind:"barn", x:x0+520, y:groundY-150, w:150, h:150 });
  }

  function spawnEnemy(x){ // erstellt gegner bei x
    const type = (Math.random() < 0.34) ? "cow" : "pig"; // 34% cow sonst pig
    const w = (type==="pig") ? 42 : 54; // breite
    const h = (type==="pig") ? 30 : 38; // höhe

    const baseHp = (type==="pig") ? 3 : 4; // base hp
    const hp15 = Math.ceil(baseHp * 1.5); // 1.5x hp

    enemies.push({ // enemy object push
      id: nextId++, // unique id
      type, // pig or cow
      x, // start x
      y: groundY - (type==="pig" ? 36 : 52), // start y bisschen über ground
      w, h, // size
      dir: (Math.random()<0.5 ? -1 : 1), // richtung
      vx: (type==="pig") ? 95 : 78, // speed, etwas langsamer
      alive: true, // lebt
      minX: x - 240, // patroll min
      maxX: x + 240, // patroll max
      hitT: 0, // hit flash timer
      hp: hp15, // hp
      knockVX: 0, // knockback x
      aggro: false, // chase on/off
      aggroRadius: 560, // abstand fürs aggro
      chaseSpeed: (type==="pig") ? 305 : 265, // chase speed, weniger hektisch
    });
  }

  function isBlockedRect(x, y, w, h){ // prüft ob ein rechteck in soliden blöcken steckt
    for (const b of blocks){
      if (aabb(x,y,w,h, b.x,b.y,b.w,b.h)) return true;
    }
    return false;
  }

  function safeEggPosition(x, preferredY){ // findet freie eier-position statt in objekten
    const yChoices = [
      preferredY,
      groundY - 86,
      groundY - 140,
      groundY - 196,
      groundY - 252
    ];
    const xOffsets = [0, -42, 42, -84, 84, -126, 126];
    for (const ox of xOffsets){
      for (const y of yChoices){
        const tx = x + ox;
        if (!isBlockedRect(tx-16, y-20, 32, 40)) return { x:tx, y };
      }
    }
    return { x, y: groundY - 92 };
  }

  function spawnEgg(x, y){ // macht ein egg
    const p = safeEggPosition(x, y);
    eggs.push({ x:p.x, y:p.y, r: 12, got:false, bob:Math.random()*Math.PI*2 }); // r = radius
  }

  function generateTo(xMax){ // generiert world bis xMax
    while (nextGenX < xMax){ // solange noch nicht weit genug
      const segmentLen = 1400 + Math.floor(Math.random()*900); // länge segment
      const baseX = nextGenX; // basis x

      if (Math.random() < 0.75){ // oft ramps
        const steps = 7 + Math.floor(Math.random()*7); // steps count
        for (let i=0;i<steps;i++){ // each step
          const bx = baseX + 120 + i*TILE; // step x
          const by = groundY - 2*TILE - i*(TILE*0.65); // step y (rampe)
          addBlockGrid(bx, by, 2, 2, "dirt", 2); // dirt steps
        }
      }

      if (Math.random() < 0.85){ // plattform häufig
        const y = groundY - (5 + Math.floor(Math.random()*3))*TILE; // plattform y
        const tiles = 12 + Math.floor(Math.random()*14); // plattform tiles
        addBlockGrid(baseX + 520, y, tiles, 1, "wood", 2); // wood plattform
        for (let i=0;i<tiles;i+=8) addBlockGrid(baseX + 520 + i*TILE, y+TILE, 1, 2, "wood", 2); // stützen
      }

      if (Math.random() < 0.70) spawnPropCluster(baseX + 820); // props oft

      const eggCount = 2 + Math.floor(Math.random()*3); // 2..4 eggs
      for (let i=0;i<eggCount;i++){ // spawn eggs
        const ex = baseX + 260 + Math.random()*(segmentLen-420); // egg x random
        const ey = (Math.random() < 0.55) ? (groundY - 88) : (groundY - (6 + Math.floor(Math.random()*4))*TILE); // egg y random
        spawnEgg(ex, ey); // add egg
      }

      const eCount = 4 + Math.floor(Math.random()*6); // 4..9 enemies
      for (let i=0;i<eCount;i++){ // spawn enemies
        const ex = baseX + 220 + Math.random()*(segmentLen-420); // enemy x random
        spawnEnemy(ex); // add
      }

      nextGenX += segmentLen; // move generator forward
    }
  }

  function cleanupBehind(xMin){ // räumt hinter dem spieler auf für perfomance
    const killX = xMin - 2200; // alles links davon weg

    for (let i=blocks.length-1;i>=0;i--){ // blocks cleanup
      if (blocks[i].x + blocks[i].w < killX) blocks.splice(i,1); // löschen wenn weit weg
    }
    for (let i=enemies.length-1;i>=0;i--){ // enemies cleanup
      const e = enemies[i]; // enemy
      if (e.x + e.w < killX || (!e.alive && e.x + e.w < xMin - 800)) enemies.splice(i,1); // weg
    }
    for (let i=eggs.length-1;i>=0;i--){ // eggs cleanup
      const e = eggs[i]; // egg
      if (e.x < killX || (e.got && e.x < xMin - 800)) eggs.splice(i,1); // weg
    }
    for (let i=decor.length-1;i>=0;i--){ // decor cleanup
      if (decor[i].x + (decor[i].w || 0) < killX) decor.splice(i,1);
    }
  }

  // ---------------- Damage / health ----------------
  function takeDamage(amount=1){ // spieler nimmt schaden
    if (invuln > 0 || paused || gameOver) return; // wenn invuln oder pause -> nix
    hp -= amount; // hp runter
    invuln = 0.85; // kurz unverwundbar
    spawnExplosion(player.x + playerDims().w/2, player.y + playerDims().h/2, 0.8); // fx
    addShake(0.8, 0.10); // shake
    beep(180, 0.06, "square", 0.10); // sound

    if (hp <= 0){ // wenn hp leer
      lives -= 1; // leben runter
      boom(85, 0.20, 0.16); // boom sound
      addShake(1.2, 0.12); // extra shake

      if (lives <= 0){ // wenn keine leben mehr
        endRun(); // game over
      } else { // sonst respawn light
        hp = MAX_HP; // hp reset
        player.x = Math.max(startX + 60, player.x - 520); // bisschen zurück
        player.y = 380; // y reset
        player.vx = 0; // stop
        player.vy = 0; // stop
        invuln = 0.9; // invuln wieder
      }
    }
  }

  // ---------------- Collisions ----------------
  function resolvePlayerCollisions(dt){ // kollisions auflösen
    const {w,h} = playerDims(); // größe holen
    player.onGround = false; // default: nicht am boden

    // Horizontal move
    player.x += player.vx * dt; // x bewegen
    for (const p of blocks){ // check gegen blocks
      if (aabb(player.x, player.y, w, h, p.x, p.y, p.w, p.h)){ // overlap
        if (player.vx > 0) player.x = p.x - w; // rechts block -> zurück
        else if (player.vx < 0) player.x = p.x + p.w; // links block -> vor
        player.vx = 0; // x speed stoppen
      }
    }

    // Vertical move
    player.y += player.vy * dt; // y bewegen
    for (const p of blocks){ // check blocks
      if (aabb(player.x, player.y, w, h, p.x, p.y, p.w, p.h)){ // overlap
        if (player.vy > 0){ // fällt nach unten
          player.y = p.y - h; // auf block drauf stellen
          player.vy = 0; // y speed null
          player.onGround = true; // jetzt am boden
        } else if (player.vy < 0){ // springt nach oben
          player.y = p.y + p.h; // unter block setzen
          player.vy = 0; // stop y
        }
      }
    }

    // ground plane collide
    if (player.y + h >= groundY){ // wenn unter ground
      player.y = groundY - h; // auf boden setzen
      player.vy = 0; // stop
      player.onGround = true; // grounded
    }

    if (player.y > 1200){ // wenn zu tief gefallen (aus der welt)
      takeDamage(1); // damage
      player.y = 200; // teleport hoch
      player.vy = 0; // stop
      player.vx *= 0.5; // speed halbieren (ungefähr)
    }

    player.x = Math.max(startX, player.x); // nicht zu weit links (endless feel)
  }

  // ---------------- Eggs ----------------
  function healFromEgg(){ hp = clamp(hp + 1, 0, MAX_HP); } // heilt 1 hp

  function collectEggs(){ // sammelt eier wenn nah genug
    const {w,h} = playerDims(); // size
    const cx = player.x + w/2, cy = player.y + h/2; // center vom player

    for (const e of eggs){ // jedes ei
      if (e.got) continue; // wenn schon eingesammelt -> skip
      const dx = cx - e.x, dy = cy - e.y; // dist vector
      if (dx*dx + dy*dy < (e.r + 18)*(e.r + 18)){ // radius check (kreis-ish)
        e.got = true; // mark collected
        spawnExplosion(e.x, e.y, 0.85); // fx
        addShake(0.35, 0.07); // little shake
        cluck(); // bling sound

        eggPower = clamp(eggPower + 1, 0, EGG_MAX); // eggPower plus 1
        updateScaleFromEggs(); // update scale
        healFromEgg(); // heal
      }
    }
  }

  // ---------------- Enemies ----------------
  function damageEnemy(e, dmg, dir, knock){ // enemy bekommt schaden
    e.hp -= dmg; // hp runter
    e.hitT = 0.14; // hit flash timer
    e.knockVX += dir * knock; // knockback in richtung
    if (e.hp <= 0){ // wenn tot
      e.alive = false; // dead
      boom(95, 0.12, 0.12); // sound
      enemyVoice(e.type);
    } else {
      beep(300, 0.035, "square", 0.07); // hit sound
      enemyVoice(e.type);
    }
  }

  function updateEnemies(dt){ // bewegt gegner + collisions
    const {w:pw,h:ph} = playerDims(); // player size

    for (const e of enemies){ // each enemy
      if (!e.alive) continue; // skip dead

      e.hitT = Math.max(0, e.hitT - dt); // tick hit timer

      e.knockVX *= 0.88; // knockback damp
      e.x += e.knockVX * dt; // apply knock move

      const px = player.x + pw/2; // player center x
      const ex = e.x + e.w/2; // enemy center x
      const dist = Math.abs(px - ex); // distance

      if (dist < e.aggroRadius) e.aggro = true; // aggro on
      else if (dist > e.aggroRadius * 1.35) e.aggro = false; // aggro off

      if (e.aggro){ // wenn chasing
        e.dir = (px >= ex) ? 1 : -1; // richtung zum player
        e.x += e.chaseSpeed * e.dir * dt; // move chase
      } else { // patrol
        e.x += e.vx * e.dir * dt; // move
        if (e.x < e.minX) e.dir = 1; // umdrehen links
        if (e.x > e.maxX) e.dir = -1; // umdrehen rechts
      }

      // collide with blocks basic
      for (const p of blocks){ // each block
        if (aabb(e.x, e.y, e.w, e.h, p.x, p.y, p.w, p.h)){ // overlap
          if (e.dir > 0) e.x = p.x - e.w; // push left
          else e.x = p.x + p.w; // push right
          e.dir *= -1; // flip direction
        }
      }

      // player collision
      if (aabb(player.x, player.y, pw, ph, e.x, e.y, e.w, e.h)){ // overlap with player
        const playerBottom = player.y + ph; // bottom y
        if (player.vy > 240 && (playerBottom - e.y) < 18){ // stomp cond (nicht super physikalisch)
          e.alive = false; // kill enemy
          spawnExplosion(e.x+e.w/2, e.y+e.h/2, 1.15); // fx
          boom(95, 0.10, 0.11); // sound
          enemyVoice(e.type);
          player.vy = -980; // bounce up
          addShake(0.45, 0.08); // shake
        } else { // sonst player hit
          takeDamage(1); // damage
          player.vx = -player.facing * 1650; // push back
          player.vy = -700; // pop up
        }
      }
    }
  }

  // ---------------- Destruction / fireballs ----------------
  function damageBlocksInRect(rx, ry, rw, rh, dmg){ // schädigt blocks im rechteck
    for (let i=blocks.length-1;i>=0;i--){ // loop backwards
      const b = blocks[i]; // block
      if (!aabb(b.x,b.y,b.w,b.h, rx,ry,rw,rh)) continue; // wenn kein overlap -> skip
      b.hp -= dmg; // hp runter
      if (b.hp <= 0){ // wenn kaputt
        spawnExplosion(b.x+b.w/2, b.y+b.h/2, 0.55); // fx
        blockBreakSound(b.kind);
        blocks.splice(i,1); // löschen
      }
    }
  }

  function stompDestroyVisible(){ // stampfer: alles sichtbare bekommt massiven schaden
    const vx = cam.x, vy = cam.y, vw = W, vh = H;

    for (const e of enemies){
      if (!e.alive) continue;
      if (aabb(e.x,e.y,e.w,e.h, vx,vy,vw,vh)){
        e.alive = false;
        spawnExplosion(e.x+e.w/2, e.y+e.h/2, 1.05);
        enemyVoice(e.type);
      }
    }

    damageBlocksInRect(vx, vy, vw, vh, 8);
  }

  function doStomp(){ // neue fähigkeit auf pfeil runter
    if (!player.onGround || stompCooldown > 0 || stompLock > 0) return;
    const {w,h} = playerDims();
    const cx = player.x + w/2;
    player.vx = 0;
    player.vy = 0;
    stompLock = 0.24;
    stompCooldown = 1.35;
    spawnShockwave(cx);
    spawnGroundCracks(cx, W*0.62);
    stompDestroyVisible();
    boom(62, 0.18, 0.16);
    noiseBurst(0.22, 0.12, 460);
    addShake(1.9, 0.20);
  }

  function destroyVisibleNow(){ // charged attack: zerstört alles im viewport
    const vx = cam.x, vy = cam.y, vw = W, vh = H; // viewport rect

    for (const e of enemies){ // enemies kill
      if (!e.alive) continue; // skip dead
      if (aabb(e.x,e.y,e.w,e.h, vx,vy,vw,vh)){ // if on screen
        e.alive = false; // kill
        spawnExplosion(e.x+e.w/2, e.y+e.h/2, 1.05); // fx
      }
    }

    for (let pass=0; pass<3; pass++){ // mehrere passes damit sicher kaputt
      damageBlocksInRect(vx, vy, vw, vh, 3); // dmg blocks
    }

    boom(95, 0.16, 0.14); // big boom
    addShake(0.7, 0.10); // shake
  }

  function shootFireball(chargeSeconds){ // schießt fireball
    if (fireCooldown > 0) return; // cooldown check

    const t = clamp(chargeSeconds / CHARGE_MAX, 0, 1); // normalize
    const full = (t >= 0.999); // full charge bool

    const {w,h} = playerDims(); // player size
    const ox = player.x + w/2 + player.facing * (w*0.62); // origin x
    const oy = player.y + h*0.42; // origin y

    const mult = damageMult(); // damage multiplier

    let speed = lerp(2200, 2800, t); // speed by charge
    let r = lerp(7, 16, t); // radius by charge
    let base = lerp(TAP_BASE_DAMAGE, MID_BASE_DAMAGE, t); // base damage

    if (full){ // full charge tuning
      speed = 3200; // faster
      r = 20; // bigger
      base = CHARGED_BASE_DAMAGE; // more dmg
      fireCooldown = 0.22; // longer cooldown
    } else {
      fireCooldown = 0.055; // short cooldown
    }

    const dmg = Math.max(1, Math.floor(base * mult)); // final damage (mind 1)

    fireballs.push({ // fireball object
      x: ox, y: oy, // start pos
      vx: player.facing * speed, // x speed
      vy: 0, // y speed
      r, // radius
      life: 1.10, // lifetime sec
      dmg, // damage
      charged: full // charged flag
    });

    spawnExplosion(ox, oy, full ? 0.70 : 0.30); // fx on shot
    if (full) { boom(110, 0.12, 0.12); addShake(0.55, 0.08); } // big shot sfx
    else beep(520, 0.03, "triangle", 0.07); // small shot sfx
  }

  function explodeFireballAt(fx, fy, f){ // explosion when hit
    spawnExplosion(fx, fy, f.charged ? 1.35 : 1.0); // bigger if charged

    if (f.charged){ // charged = screen clear
      destroyVisibleNow(); // kill visible stuff
    } else {
      const rad = 90; // explosion radius (box based)
      damageBlocksInRect(fx-rad, fy-rad, rad*2, rad*2, 2); // dmg blocks

      for (const e of enemies){ // dmg enemies in area
        if (!e.alive) continue; // skip dead
        if (aabb(e.x,e.y,e.w,e.h, fx-rad, fy-rad, rad*2, rad*2)){ // overlap
          const dir = f.vx >= 0 ? 1 : -1; // knock dir
          damageEnemy(e, f.dmg, dir, 1600); // apply dmg
          spawnExplosion(e.x+e.w/2, e.y+e.h/2, 0.8); // extra fx
          addShake(0.25, 0.06); // tiny shake
        }
      }

      addShake(0.25, 0.07); // shake
      boom(70, 0.11, 0.10); // boom
    }
  }

  function updateFireballs(dt){ // bewegt fireballs und checkt hits
    for (let i=fireballs.length-1;i>=0;i--){ // backwards for safe remove
      const f = fireballs[i]; // fireball
      f.x += f.vx*dt; // move x
      f.y += f.vy*dt; // move y
      f.life -= dt; // life down

      // collide with blocks
      for (const p of blocks){ // each block
        if (aabb(f.x-f.r, f.y-f.r, f.r*2, f.r*2, p.x, p.y, p.w, p.h)){ // hit
          explodeFireballAt(f.x, f.y, f); // explode
          fireballs.splice(i,1); // remove fireball
          break; // stop checking blocks
        }
      }
      if (i >= fireballs.length) continue; // wenn schon entfernt, skip rest

      // collide with ground plane
      if (f.y + f.r >= groundY){ // hit ground
        explodeFireballAt(f.x, groundY - 2, f); // explode at ground
        fireballs.splice(i,1); // remove
        continue; // next
      }

      // hit enemies
      for (const e of enemies){ // each enemy
        if (!e.alive) continue; // skip dead
        if (aabb(f.x-f.r, f.y-f.r, f.r*2, f.r*2, e.x, e.y, e.w, e.h)){ // hit
          const dir = f.vx >= 0 ? 1 : -1; // dir
          if (f.charged) e.alive = false; // charged kills instantly
          else damageEnemy(e, f.dmg, dir, 1800); // else normal dmg
          explodeFireballAt(f.x, f.y, f); // explode
          fireballs.splice(i,1); // remove
          break; // stop
        }
      }

      // remove if expired or far away (perf)
      if (f.life <= 0 || f.x < cam.x - 1200 || f.x > cam.x + W + 2400) fireballs.splice(i,1); // cleanup
    }
  }

  // ---------------- Pause/UI ----------------
  function showMenu(title, text, isGO=false){ // zeigt overlay an
    overlay.style.display = "flex"; // overlay sichtbar
    menuTitle.textContent = title; // titel setzen
    menuText.textContent = text; // text setzen
    btnResume.textContent = isGO ? "Weiter (Neustart)" : "Weiterspielen (Enter)"; // button text
    scoreBox.textContent = highscoresText(score); // score box update
  }

  function hideMenu(){ overlay.style.display = "none"; } // overlay aus

  function togglePause(){ // toggelt pause an/aus
    if (gameOver){ restartRun(); return; } // bei gameover = restart (ist bissl shortcut)
    paused = !paused; // flip
    if (paused){ // wenn jetzt paused
      showMenu(
        "PAUSE",
        "←/→ laufen • ↑ springen • ↓ Stampfer • Space tippen = Fireball • Space halten = Screen-Clear • Enter = Pause",
        false
      ); // menu zeigen
    } else hideMenu(); // sonst menu weg
  }

  // button events
  btnResume.onclick = () => { // resume click
    if (gameOver) restartRun(); // wenn gameover -> restart
    else { paused=false; hideMenu(); } // sonst pause aus
  };

  btnRestart.onclick = () => { restartRun(); }; // restart click
  btnResetScores.onclick = () => { resetHighscores(); scoreBox.textContent = highscoresText(score); }; // reset scores click
  btnQuit.onclick = () => { menuText.textContent = "Zum Beenden: Tab schließen oder Browser-Fenster schließen."; }; // quit hint

  // ---------------- Run Control ----------------
  function resetWorld(){ // world arrays reseten
    blocks.length = 0; // blocks leer
    enemies.length = 0; // enemies leer
    eggs.length = 0; // eggs leer
    decor.length = 0; // deko leer
    fireballs.length = 0; // fireballs leer
    particles.length = 0; // particles leer
    groundCracks.length = 0; // risse leer

    nextGenX = 0; // generator reset
    nextId = 1; // id reset

    // start area: kleine plattform
    for (let i=0;i<22;i++){ // 22 tiles
      addBlockGrid(80 + i*TILE, groundY-2*TILE, 1, 2, "dirt", 2); // 2 hoch dirt
    }
    generateTo(4200); // initial generation nach vorne
  }

  function restartRun(){ // startet spiel neu
    paused = false; // pause aus
    gameOver = false; // gameOver aus
    hideMenu(); // overlay weg

    lives = 3; // leben reset
    hp = MAX_HP; // hp voll
    eggPower = 0; // eier reset
    updateScaleFromEggs(); // scale reset

    player.x = 120; // player x reset
    player.y = 380; // player y reset
    player.vx = 0; // speed reset
    player.vy = 0; // speed reset
    player.onGround = false; // grounded false
    player.facing = 1; // facing right

    player.accel = BASE_ACCEL; // accel reset
    player.maxVx = BASE_MAXVX; // max speed reset

    invuln = 0; // invuln reset
    charging = false; // charging off
    chargeT = 0; // charge time reset
    fireCooldown = 0; // cooldown reset
    stompCooldown = 0; // stampfer cooldown reset
    stompLock = 0; // stampfer standzeit reset

    startX = player.x; // startX setzen
    maxX = player.x; // maxX setzen
    score = 0; // score reset

    cam.x = 0; cam.y = 0; // cam reset
    worldTime = 18; // morgens starten, nicht mitten in der nacht
    ambientT = 2.5;

    resetWorld(); // world neu
  }

  function endRun(){ // game over
    gameOver = true; // set gameover
    paused = true; // pause an
    const top3 = maybeAddHighscore(score); // score speichern
    showMenu("GAME OVER", `Run beendet.\nNeustart: Enter oder Button.`, true); // overlay
    scoreBox.textContent = // überschreibt box direkt (damit top3 fresh ist)
      `Score: ${Math.floor(score)}\nTop 3 Highscores:\n1) ${top3[0] ?? 0}\n2) ${top3[1] ?? 0}\n3) ${top3[2] ?? 0}`;
  }

  // ---------------- Rendering ----------------
  function cycleT(){ return (worldTime % DAY_LENGTH) / DAY_LENGTH; } // 0..1
  function nightAmount(){ return clamp(Math.cos(cycleT()*Math.PI*2)*-0.5 + 0.5, 0, 1); } // nachtanteil

  function skyPoint(t, radius=410, yBase=360){ // position auf einem großen himmelsbogen
    const a = Math.PI * (1.08 + t);
    return {
      x: W*0.5 + Math.cos(a) * radius,
      y: yBase + Math.sin(a) * radius
    };
  }

  function drawBackground(){ // zeichnet hintergrund (sky, sun, hills)
    const n = nightAmount();
    const g = ctx.createLinearGradient(0,0,0,H); // gradient
    g.addColorStop(0, n > 0.55 ? "#121936" : "#79c8ff"); // oben himmel
    g.addColorStop(0.62, n > 0.55 ? "#26355f" : "#d6f3ff"); // mitte
    g.addColorStop(1, n > 0.55 ? "#5c6d73" : "#f5f0cc"); // horizont
    ctx.fillStyle = g; // fill color set
    ctx.fillRect(0,0,W,H); // rectangle full screen

    if (n > 0.20){ // sterne nur wenn es dunkel genug ist
      ctx.fillStyle = `rgba(255,255,220,${(n-0.2)*0.65})`;
      for (let i=0;i<38;i++){
        const sx = (i*137 + Math.floor(cam.x*0.03)) % W;
        const sy = 28 + ((i*61) % 160);
        ctx.fillRect(sx, sy, i%5===0 ? 2 : 1, i%5===0 ? 2 : 1);
      }
    }

    const sun = skyPoint(cycleT(), 440, 398);
    ctx.fillStyle = "rgba(255,232,132,.96)";
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 42, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "rgba(255,210,80,.18)";
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 70, 0, Math.PI*2); ctx.fill();

    const moon = skyPoint((cycleT()+0.5)%1, 440, 398);
    ctx.fillStyle = "rgba(240,244,255,.92)";
    ctx.beginPath(); ctx.arc(moon.x, moon.y, 34, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = n > 0.55 ? "#121936" : "#79c8ff";
    ctx.beginPath(); ctx.arc(moon.x+12, moon.y-6, 30, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = n > 0.55 ? "#355a57" : "#74bf75"; // ferne hügel
    ctx.beginPath();
    ctx.moveTo(0, 360);
    ctx.quadraticCurveTo(230, 278, 485, 344);
    ctx.quadraticCurveTo(710, 402, 980, 330);
    ctx.lineTo(W, 390); ctx.lineTo(W, H); ctx.lineTo(0, H);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = n > 0.55 ? "#2e504c" : "#58aa60"; // zweite hügelreihe
    ctx.beginPath();
    ctx.moveTo(0, 405);
    ctx.quadraticCurveTo(260, 330, 520, 402);
    ctx.quadraticCurveTo(760, 470, 980, 382);
    ctx.lineTo(W, H); ctx.lineTo(0, H);
    ctx.closePath(); ctx.fill();
  }

  function blockColor(kind){ // gibt farbe für block-art
    switch(kind){ // switch on string
      case "dirt": return "#b88a5d"; // dirt
      case "wood": return "#8c6a4a"; // wood
      case "rock": return "#8c94a2"; // rock
      case "treeTrunk": return "#7a563a"; // trunk
      case "treeLeaf": return "#4ab86a"; // leaf
      case "tractor": return "#c73e2d"; // tractor
      case "hay": return "#d9b84b"; // hay
      case "fence": return "#9b7148"; // fence
      case "well": return "#b9c2d4"; // well
      default: return "#888"; // fallback
    }
  }

  function drawBlock(b, x, y){ // tile wird je nach material gezeichnet
    ctx.fillStyle = blockColor(b.kind);
    if (b.kind === "rock"){
      ctx.beginPath();
      ctx.moveTo(x+3,y+20); ctx.lineTo(x+7,y+6); ctx.lineTo(x+18,y+3); ctx.lineTo(x+23,y+14); ctx.lineTo(x+19,y+24); ctx.lineTo(x+6,y+24);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.beginPath(); ctx.moveTo(x+8,y+8); ctx.lineTo(x+16,y+5); ctx.stroke();
    } else if (b.kind === "treeLeaf"){
      ctx.beginPath(); ctx.arc(x+12,y+12,13,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.10)"; ctx.beginPath(); ctx.arc(x+7,y+8,5,0,Math.PI*2); ctx.fill();
    } else if (b.kind === "treeTrunk" || b.kind === "wood" || b.kind === "fence"){
      ctx.fillRect(x, y, b.w, b.h);
      ctx.strokeStyle = "rgba(70,38,18,.35)";
      ctx.beginPath(); ctx.moveTo(x+5,y+2); ctx.lineTo(x+7,y+b.h-2); ctx.moveTo(x+16,y+3); ctx.lineTo(x+14,y+b.h-4); ctx.stroke();
    } else if (b.kind === "hay"){
      ctx.fillRect(x+1, y+2, b.w-2, b.h-3);
      ctx.strokeStyle = "rgba(120,78,20,.35)";
      ctx.beginPath(); ctx.moveTo(x+3,y+8); ctx.lineTo(x+21,y+5); ctx.moveTo(x+2,y+17); ctx.lineTo(x+22,y+20); ctx.stroke();
    } else if (b.kind === "tractor"){
      ctx.fillRect(x, y+3, b.w, b.h-4);
      ctx.fillStyle = "rgba(255,230,120,.55)";
      ctx.fillRect(x+5, y+6, 9, 7);
    } else if (b.kind === "well"){
      ctx.fillRect(x, y, b.w, b.h);
      ctx.strokeStyle = "rgba(70,80,100,.35)";
      ctx.strokeRect(x+2, y+3, b.w-4, b.h-6);
    } else {
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = "rgba(255,255,255,.08)";
      ctx.fillRect(x+2, y+2, b.w-4, 4);
    }
  }

  function drawDecor(){ // hintergrunddetails wie gras und scheunen
    for (const d of decor){
      const x = d.x - cam.x*0.92;
      if (x < -260 || x > W+260) continue;
      if (d.kind === "grass"){
        ctx.strokeStyle = "rgba(34,112,48,.55)";
        for (let i=0;i<d.w;i+=14){
          const gx = x+i;
          ctx.beginPath(); ctx.moveTo(gx, d.y-cam.y); ctx.lineTo(gx+4, d.y-cam.y-12-(i%22)); ctx.stroke();
        }
      } else if (d.kind === "barn"){
        const y = d.y - cam.y;
        ctx.fillStyle = "#9d2f2f"; ctx.fillRect(x, y, d.w, d.h);
        ctx.fillStyle = "#6f2222";
        ctx.beginPath(); ctx.moveTo(x-12,y); ctx.lineTo(x+d.w/2,y-58); ctx.lineTo(x+d.w+12,y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 4;
        ctx.strokeRect(x+42,y+74,64,76);
        ctx.beginPath(); ctx.moveTo(x+42,y+74); ctx.lineTo(x+106,y+150); ctx.moveTo(x+106,y+74); ctx.lineTo(x+42,y+150); ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
  }

  function drawPlayer(){ // zeichnet das küken
    const {w,h} = playerDims(); // size
    const x = player.x - cam.x; // screen x
    const y = player.y - cam.y; // screen y

    if (invuln > 0 && (Math.floor(invuln*16)%2===0)) return; // blink effekt (manchmal nicht zeichnen)

    const bob = player.onGround ? Math.sin(player.bob)*1.2 : 0; // bobbing wenn läuft

    ctx.fillStyle = "#ffd34a"; // gelb
    ctx.beginPath(); // body
    ctx.ellipse(x+w/2, y+h/2 + bob, 16*player.scale, 14*player.scale, 0, 0, Math.PI*2); // ellipse
    ctx.fill(); // fill

    ctx.beginPath(); // head
    ctx.ellipse(x+w/2 + 6*player.facing*player.scale, y+12*player.scale + bob, 13*player.scale, 12*player.scale, 0, 0, Math.PI*2); // ellipse
    ctx.fill(); // fill

    ctx.fillStyle = "rgba(255,190,40,.95)"; // belly shade
    ctx.beginPath(); // wing/bauch
    ctx.ellipse(x+w/2 - 4*player.facing*player.scale, y+22*player.scale + bob, 9*player.scale, 6*player.scale, 0.2*player.facing, 0, Math.PI*2); // ellipse
    ctx.fill(); // fill

    ctx.fillStyle = "#ff8a2a"; // beak
    ctx.beginPath(); // beak triangle
    ctx.moveTo(x+w/2 + 18*player.facing*player.scale, y+14*player.scale + bob); // point 1
    ctx.lineTo(x+w/2 + 30*player.facing*player.scale, y+18*player.scale + bob); // point 2
    ctx.lineTo(x+w/2 + 18*player.facing*player.scale, y+22*player.scale + bob); // point 3
    ctx.closePath(); // close
    ctx.fill(); // fill

    ctx.fillStyle = "#1b1b1b"; // eye
    ctx.beginPath(); // eye circle
    ctx.arc(x+w/2 + 10*player.facing*player.scale, y+10*player.scale + bob, 2.2*player.scale, 0, Math.PI*2); // arc
    ctx.fill(); // fill

    ctx.strokeStyle = "#ff8a2a"; // legs color
    ctx.lineWidth = 3; // leg width
    ctx.beginPath(); // legs lines
    ctx.moveTo(x+w/2 - 6*player.scale, y+h-2 + bob); // left leg start
    ctx.lineTo(x+w/2 - 10*player.scale, y+h+6 + bob); // left leg end
    ctx.moveTo(x+w/2 + 6*player.scale, y+h-2 + bob); // right leg start
    ctx.lineTo(x+w/2 + 10*player.scale, y+h+6 + bob); // right leg end
    ctx.stroke(); // draw
    ctx.lineWidth = 1; // reset

    if (charging){ // wenn charge aktiv
      const t = clamp(chargeT / CHARGE_MAX, 0, 1); // normalize
      const puff = lerp(6, 22, t); // size
      const bx = x+w/2 + 30*player.facing*player.scale; // charge x
      const by = y+18*player.scale + bob; // charge y

      ctx.fillStyle = `rgba(255,120,40,${0.10 + t*0.20})`; // outer glow
      ctx.beginPath(); ctx.arc(bx, by, puff*2.0, 0, Math.PI*2); ctx.fill(); // glow
      ctx.fillStyle = t>0.98 ? "#ff4a1a" : "#ff7a2a"; // inner color
      ctx.beginPath(); ctx.arc(bx, by, puff, 0, Math.PI*2); ctx.fill(); // inner
      ctx.strokeStyle = `rgba(255,255,255,${0.16 + t*0.38})`; // ring
      ctx.lineWidth = 3; // ring width
      ctx.beginPath(); ctx.arc(bx, by, puff*1.45, 0, Math.PI*2); ctx.stroke(); // ring
      ctx.lineWidth = 1; // reset
    }
  }

  function drawWorld(){ // zeichnet alles in der welt
    let sx=0, sy=0; // shake offset
    if (shakeT > 0){ // wenn shake aktiv
      sx = (Math.random()*2-1) * shakePow * 5; // random x
      sy = (Math.random()*2-1) * shakePow * 5; // random y
    }
    ctx.save(); // save state
    ctx.translate(sx, sy); // translate for shake

    drawDecor();

    const n = nightAmount();
    ctx.fillStyle = n > 0.55 ? "#3f7447" : "#5aa85b"; // ground color
    ctx.fillRect(0 - 200, groundY - cam.y, W + 400, H - groundY + 200); // ground rect
    ctx.fillStyle = n > 0.55 ? "#315332" : "#3f833e"; // bodenkante
    ctx.fillRect(0 - 200, groundY - cam.y, W + 400, 10);

    for (const c of groundCracks){ // stampfer-risse
      const x = c.x - cam.x, y = c.y - cam.y;
      if (x < -200 || x > W+200) continue;
      const a = 1 - c.t/c.life;
      ctx.strokeStyle = `rgba(42,28,22,${a*0.72})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(c.angle)*c.len, y + Math.sin(c.angle)*c.len);
      ctx.lineTo(x + Math.cos(c.angle)*c.len + 16, y + Math.sin(c.angle)*c.len + 6);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    for (const b of blocks){ // draw blocks
      const x = b.x - cam.x, y = b.y - cam.y; // screen pos
      if (x < -200 || x > W+200) continue; // skip offscreen
      drawBlock(b, x, y); // draw material
      if (b.hp <= 1){ // cracked effect
        ctx.strokeStyle = "rgba(0,0,0,.18)"; // line color
        ctx.beginPath(); // crack line
        ctx.moveTo(x+4, y+6); // start
        ctx.lineTo(x+b.w-6, y+b.h-8); // end
        ctx.stroke(); // draw
      }
    }

    for (const e of eggs){ // draw eggs
      if (e.got) continue; // skip collected
      const x = e.x - cam.x, y = e.y - cam.y; // screen pos
      if (x < -200 || x > W+200) continue; // cull
      const bob = Math.sin(worldTime*3 + e.bob) * 2;
      ctx.fillStyle = "#fff7e7"; // egg base
      ctx.beginPath(); // egg shape
      ctx.ellipse(x, y+bob, e.r*0.9, e.r*1.15, 0, 0, Math.PI*2); // ellipse
      ctx.fill(); // fill
      ctx.fillStyle = "rgba(210,170,120,.7)"; // spots
      for (let i=0;i<3;i++){ // 3 spots
        const ox = (Math.sin((i+1)*2.2) * 6); // offset x (random-ish)
        const oy = (Math.cos((i+1)*1.7) * 6); // offset y
        ctx.beginPath(); ctx.arc(x+ox, y+bob+oy, 2.1, 0, Math.PI*2); ctx.fill(); // spot
      }
    }

    for (const e of enemies){ // draw enemies
      if (!e.alive) continue; // skip dead
      const x = e.x - cam.x, y = e.y - cam.y; // screen pos
      if (x < -260 || x > W+260) continue; // cull

      const flash = e.hitT > 0; // flash when hit
      ctx.globalAlpha = flash ? 0.55 : 1; // alpha

      if (e.type === "pig"){ // pig draw
        ctx.fillStyle = "#ffb6c1"; // pink
        ctx.beginPath(); ctx.ellipse(x+e.w/2, y+e.h/2, e.w/2, e.h/2, 0, 0, Math.PI*2); ctx.fill(); // body
        ctx.fillStyle = "#ff9caf";
        ctx.beginPath(); ctx.arc(x+10, y+3, 7, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+24, y+2, 7, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ff8da0"; // snout
        ctx.beginPath(); ctx.ellipse(x+e.w-10, y+15, 10, 7, 0, 0, Math.PI*2); ctx.fill(); // snout
        ctx.fillStyle = "#1b1b1b"; // eye
        ctx.beginPath(); ctx.arc(x+12, y+11, 2.3, 0, Math.PI*2); ctx.fill();
        ctx.fillRect(x+e.w-13, y+14, 2, 2); ctx.fillRect(x+e.w-7, y+14, 2, 2);
        ctx.strokeStyle = "#8f4d57"; ctx.beginPath(); ctx.arc(x+2, y+17, 7, -1.2, 1.2); ctx.stroke();
        ctx.strokeStyle = "#7a4a55"; ctx.beginPath(); ctx.moveTo(x+10,y+e.h-2); ctx.lineTo(x+8,y+e.h+5); ctx.moveTo(x+29,y+e.h-2); ctx.lineTo(x+31,y+e.h+5); ctx.stroke();
      } else { // cow draw
        ctx.fillStyle = "#fff"; // white
        ctx.beginPath(); ctx.ellipse(x+e.w/2, y+e.h/2, e.w/2, e.h/2, 0, 0, Math.PI*2); ctx.fill(); // body
        ctx.fillStyle = "#222"; // spots
        ctx.beginPath(); ctx.ellipse(x+15, y+14, 9, 7, .4, 0, Math.PI*2); ctx.fill(); // spot 1
        ctx.beginPath(); ctx.ellipse(x+36, y+24, 10, 8, -.2, 0, Math.PI*2); ctx.fill(); // spot 2
        ctx.fillStyle = "#f1f1f1"; ctx.beginPath(); ctx.ellipse(x+e.w-9, y+16, 14, 13, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#1b1b1b"; // eye
        ctx.beginPath(); ctx.arc(x+e.w-13, y+11, 2.3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#f2a7a7"; // snout-ish
        ctx.beginPath(); ctx.ellipse(x+e.w-8, y+23, 12, 8, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#121212"; ctx.fillRect(x+e.w-12, y+22, 2, 2); ctx.fillRect(x+e.w-5, y+22, 2, 2);
        ctx.strokeStyle = "#3b312b"; ctx.beginPath(); ctx.moveTo(x+12,y+e.h-2); ctx.lineTo(x+10,y+e.h+7); ctx.moveTo(x+40,y+e.h-2); ctx.lineTo(x+42,y+e.h+7); ctx.stroke();
      }

      ctx.globalAlpha = 1; // reset alpha
    }

    for (const f of fireballs){ // draw fireballs
      const x = f.x - cam.x, y = f.y - cam.y; // screen pos
      if (x < -260 || x > W+260) continue; // cull
      ctx.fillStyle = f.charged ? "rgba(255,120,40,.40)" : "rgba(255,140,40,.28)"; // outer
      ctx.beginPath(); ctx.arc(x, y, f.r*2.2, 0, Math.PI*2); ctx.fill(); // glow
      ctx.fillStyle = f.charged ? "#ff4a1a" : "#ff7a2a"; // core
      ctx.beginPath(); ctx.arc(x, y, f.r, 0, Math.PI*2); ctx.fill(); // core
      ctx.fillStyle = "#fff1b8"; // highlight
      ctx.beginPath(); ctx.arc(x-2, y-2, f.r*0.45, 0, Math.PI*2); ctx.fill(); // dot
    }

    for (const p of particles){ // draw particles
      const x = p.x - cam.x, y = p.y - cam.y; // screen pos
      const k = p.t / p.life; // life ratio
      const a = 1 - k; // alpha
      if (p.kind === "spark"){ // spark
        ctx.fillStyle = `rgba(255,220,120,${a})`; // color
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI*2); ctx.fill(); // draw
      } else if (p.kind === "smoke"){ // smoke
        ctx.fillStyle = `rgba(80,80,90,${a*0.50})`; // color
        ctx.beginPath(); ctx.arc(x, y, p.r*1.2, 0, Math.PI*2); ctx.fill(); // draw
      } else if (p.kind === "dust"){ // stampfer-staub
        ctx.fillStyle = `rgba(150,105,66,${a*0.55})`;
        ctx.beginPath(); ctx.ellipse(x, y, p.r*1.5, p.r, 0, 0, Math.PI*2); ctx.fill();
      } else if (p.kind === "ring"){ // ring
        ctx.strokeStyle = `rgba(255,255,255,${a*0.80})`; // color
        ctx.lineWidth = 3; // width
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI*2); ctx.stroke(); // draw
        ctx.lineWidth = 1; // reset
      } else if (p.kind === "shockwave"){ // breite bodenwelle
        ctx.strokeStyle = `rgba(255,244,190,${a*0.75})`;
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.ellipse(x, y, p.r*2.4, p.r*0.34, 0, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = `rgba(95,66,42,${a*0.45})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(x, y+5, p.r*2.8, p.r*0.22, 0, 0, Math.PI*2); ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    drawPlayer(); // draw player last so it is in front
    ctx.restore(); // restore state
  }

  function updateScore(){ // berechnet distance score
    maxX = Math.max(maxX, player.x); // maxX updaten
    const dist = Math.max(0, maxX - startX); // dist von start
    score = dist * 0.10; // score scaling (nicht meter echt, mehr so pi mal daumen)
  }

  function drawHUD(){ // zeichnet oben links text
    ctx.save(); // save ctx
    const n = nightAmount();
    const hpRatio = clamp(hp / MAX_HP, 0, 1);
    let hpColor = "#30c25f";
    if (hpRatio <= 0.25) hpColor = "#e3322b";
    else if (hpRatio <= 0.45) hpColor = "#f07822";
    else if (hpRatio <= 0.70) hpColor = "#e9ca35";
    const textColor = n > 0.48 ? "rgba(245,250,255,.94)" : "rgba(10,18,18,.72)";
    const panelColor = n > 0.48 ? "rgba(8,13,28,.54)" : "rgba(255,255,255,.42)";
    ctx.globalAlpha = 1; // hud klar sichtbar
    ctx.fillStyle = panelColor;
    ctx.fillRect(10, 8, 252, 50);
    ctx.strokeStyle = n > 0.48 ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.13)";
    ctx.strokeRect(10, 8, 252, 50);
    ctx.fillStyle = "rgba(0,0,0,.26)";
    ctx.fillRect(18, 30, 136, 14);
    ctx.fillStyle = hpColor;
    ctx.fillRect(18, 30, 136*hpRatio, 14);
    ctx.strokeStyle = "rgba(255,255,255,.40)";
    ctx.strokeRect(18, 30, 136, 14);
    ctx.fillStyle = textColor; // text color-ish
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial"; // font
    ctx.fillText(`Score ${Math.floor(score)}  •  L${lives}  •  Eier ${eggPower}`, 18, 22); // hud line
    ctx.fillText(`HP ${hp}/${MAX_HP}`, 162, 42); // hp text
    ctx.globalAlpha = 0.82; // alpha down
    ctx.fillText(`Enter Pause  •  ↓ Stampfer`, 18, 56); // hint
    ctx.restore(); // restore
  }

  function drawDayNightOverlay(){ // macht die welt nachts sichtbar dunkler ohne hud
    const n = nightAmount();
    if (n <= 0.08) return;
    ctx.save();
    ctx.fillStyle = `rgba(7,12,32,${n*0.34})`;
    ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  // ---------------- Main Loop ----------------
  let lastT = performance.now(); // last timestamp
  let prevEnter = false; // previous enter state
  let prevFire = false; // previous fire state
  let prevDown = false; // previous down state

  function step(t){ // main frame function
    const dt = Math.min(0.02, (t - lastT)/1000); // delta time clamp
    lastT = t; // update lastT

    if (keys.enter && !prevEnter) togglePause(); // toggle pause on press edge
    prevEnter = keys.enter; // remember enter

    if (paused){ // if paused, still render menu bg
      render(); // draw frame
      requestAnimationFrame(step); // next frame
      return; // stop update
    }

    invuln = Math.max(0, invuln - dt); // invuln down
    fireCooldown = Math.max(0, fireCooldown - dt); // cooldown down
    stompCooldown = Math.max(0, stompCooldown - dt); // stampfer cooldown down
    stompLock = Math.max(0, stompLock - dt); // stampfer standzeit down
    worldTime += dt; // tag-nacht zyklus läuft real über zeit weiter
    ambientT -= dt;
    if (ambientT <= 0){
      ambientT = 4.5 + Math.random()*5.5;
      if (nightAmount() > 0.55) beep(520 + Math.random()*220, 0.035, "sine", 0.018);
      else if (Math.random() < 0.45) enemyVoice(Math.random() < 0.5 ? "cow" : "pig");
    }

    if (shakeT > 0){ // shake update
      shakeT -= dt; // time down
      shakePow *= 0.90; // damp power
      if (shakeT <= 0){ shakeT = 0; shakePow = 0; } // stop
    }

    if (keys.down && !prevDown) doStomp(); // stampfer auf tastendruck
    prevDown = keys.down;

    // movement input
    if (stompLock <= 0){
      if (keys.left)  { player.vx -= player.accel * dt; player.facing = -1; } // accelerate left
      if (keys.right) { player.vx += player.accel * dt; player.facing =  1; } // accelerate right
    } else {
      player.vx = 0;
    }

    // jump
    if (keys.up && player.onGround && stompLock <= 0){ // jump only if grounded
      player.vy = -player.jump; // impulse up
      player.onGround = false; // not grounded
      beep(520, 0.045, "sine", 0.06); // jump sound
    }

    // fire charge
    if (keys.fire){ // if space held
      charging = true; // charging on
      chargeT = clamp(chargeT + dt, 0, CHARGE_MAX); // charge time up
    }
    if (!keys.fire && prevFire){ // if released this frame (edge)
      shootFireball(chargeT); // shoot with charge amount
      charging = false; // charging off
      chargeT = 0; // reset charge
    }
    prevFire = keys.fire; // store prev

    // physics
    player.vy += gravity * dt; // gravity apply
    player.vx *= player.onGround ? 0.86 : 0.965; // friction ground/air, etwas natürlicher

    player.vx = clamp(player.vx, -player.maxVx, player.maxVx); // clamp speed
    player.vy = clamp(player.vy, -1750, 2100); // clamp y speed

    resolvePlayerCollisions(dt); // collisions

    // camera follows player
    cam.x = Math.max(0, player.x - W*0.35); // camera x
    cam.y = 0; // camera y fixed

    generateTo(cam.x + W + 2400); // generate ahead
    cleanupBehind(cam.x); // cleanup behind

    collectEggs(); // egg pickup
    updateEnemies(dt); // enemy update
    updateFireballs(dt); // fireballs update

    // particles update (inlined)
    for (let i=particles.length-1;i>=0;i--){ // update each particle
      const p = particles[i]; // particle
      p.t += dt; // time
      if (p.kind === "spark"){ // spark physics
        p.vy += 1300*dt; // gravity-ish
        p.x += p.vx*dt; p.y += p.vy*dt; // move
        p.vx *= 0.98; // damp
      } else if (p.kind === "smoke"){ // smoke physics
        p.vy += 340*dt; // slower gravity
        p.x += p.vx*dt; p.y += p.vy*dt; // move
        p.vx *= 0.92; // damp more
        p.r *= 1.016; // grow
      } else if (p.kind === "ring"){ // ring expand
        p.r *= 1.17; // grow quickly
      } else if (p.kind === "shockwave"){ // wave expand
        p.r += 2100*dt;
      } else if (p.kind === "dust"){
        p.vy += 820*dt;
        p.x += p.vx*dt; p.y += p.vy*dt;
        p.vx *= 0.88;
        p.r *= 1.012;
      }
      if (p.t >= p.life) particles.splice(i,1); // remove if done
    }

    for (let i=groundCracks.length-1;i>=0;i--){ // risse altern
      groundCracks[i].t += dt;
      if (groundCracks[i].t >= groundCracks[i].life) groundCracks.splice(i,1);
    }

    const moving = Math.abs(player.vx) > 90 || !player.onGround; // moving check
    player.bob += (moving ? 18 : 6) * dt; // bob update

    updateScore(); // score update
    render(); // render
    requestAnimationFrame(step); // next frame
  }

  function render(){ // renders one frame
    drawBackground(); // background
    drawWorld(); // world
    drawDayNightOverlay(); // nachtstimmung
    drawHUD(); // hud
  }

  // ---------------- Start ----------------
  function boot(){ // boot function
    scoreBox.textContent = highscoresText(0); // init overlay score text
    restartRun(); // start game
    requestAnimationFrame(step); // start loop
  }

  boot(); // call boot now

})(); // end IIFE
