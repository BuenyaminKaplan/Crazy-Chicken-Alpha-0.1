# Crazy Chicken

Ein 2D-Canvas-Browsergame im Cartoon-Bauernhof-Stil: Küken, Feuerbälle, zerstörbare Farmobjekte, Power-ups und Gegner wie Schwein, Kuh, Krähe und wütendes Huhn.

## Starten

Empfohlen wegen ES-Modulen:

```bash
python3 -m http.server 8080
```

Dann im Browser öffnen:

```text
http://localhost:8080/Crazy-Chicken%20Alpha-0.1.html
```

Manche Browser erlauben ES-Module auch direkt per Dateiöffnung, manche blockieren sie über `file://`.

## Godot-4-Neuaufbau

Zusätzlich liegt jetzt eine Godot-4-Rekonstruktion im Ordner:

```text
godot/
```

Diese Version rekonstruiert das Spiel als Engine-Projekt mit Szenen, GDScript, State-Machine, BiomeManager, SpawnManager, Safe-Zones, Shop-UI und nicht blockierender Mathe-UI. Öffne dafür `godot/project.godot` in Godot 4.4 oder neuer.

## Steuerung

- `←` / `→`: laufen
- `↑`: springen
- `↓` im Sprung: Stampfer
- `Space`: Fireball, halten für Charged Fireball
- `Enter`: Pause

Auf Touch-Geräten erscheinen mobile Buttons.

## Features

- Startscreen, Pause, Game Over, Steuerung, Highscores
- Top-3-Highscores mit `localStorage`
- Endless-Welt mit getrennten Biomen, sauberen Übergängen und Safe-Zones
- Biome: Farm, Wald, Wüste, Schnee, Strand, Tropen, Vulkan, Friedhof und Sumpf
- Händler- und Mathe-Zonen sind sichere No-Spawn-Bereiche
- Power-ups: Ei, Gold-Ei, Chili, Feder
- Mini-Boss-System mit großem Hahn und Warnanzeige
- Interaktive Arcade-Objekte: Trampoline, fragile Plattformen, Windzonen, Schlammzonen, explosive Kisten
- Dynamisches Wetter mit Regen, Nebel und Wind
- Eingebettete Wasser- und Lavaflächen statt schwebender Wasserfälle
- Achievements und einfache Laufzeit-Statistiken
- Fireball, Charged Fireball und Stampfer
- WebAudio-Sounds
- Tag-Nacht-Zyklus
- Canvas-Cartoon-Stil ohne externe Assets

## Struktur

```text
code/
  html
  style.css
  game.js
  src/
    main.js
    Game.js
    Biomes.js
    Player.js
    Enemy.js
    World.js
    Collision.js
    Input.js
    Audio.js
    UI.js
    Storage.js
    Config.js
    Utils.js
    RenderAssets.js
    MetaSystems.js
    Abilities.js
```

## Spätere Erweiterungen

- Boss-Gegner und Mini-Events
- Sprite-Sheets und bessere Animationen
- Debug-Overlay für Hitboxen
- GitHub Pages Deployment
