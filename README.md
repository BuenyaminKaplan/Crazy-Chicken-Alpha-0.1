# Crazy Chicken

Ein kleines 2D-Canvas-Browsergame im Cartoon-Bauernhof-Stil. Du spielst ein Küken, sammelst Eier und Power-ups, schießt Feuerbälle, zerstörst Farmobjekte und kämpfst gegen Schweine, Kühe, Krähen und wütende Hühner.

## Features

- Vanilla JavaScript mit ES-Modulen
- Canvas-2D-Rendering ohne externe Assets
- Startscreen, Pause, Game Over, Highscores, Steuerungsansicht
- Distanz-Score und Top-3-Highscores via `localStorage`
- Prozedurale Endless-Farmwelt mit Themenabschnitten
- Gegner: Schwein, Kuh, Krähe, wütendes Huhn
- Fireball und Charged Fireball mit Screen-Clear
- Stampfer-Angriff in der Luft
- Power-ups: normales Ei, Gold-Ei, Chili, Feder
- WebAudio-Sounds
- Tag-Nacht-Zyklus mit weichen Übergängen
- Touch-Steuerung für mobile Geräte

## Steuerung

- `←` / `→`: laufen
- `↑`: springen
- `↓` im Sprung: Stampfer
- `Space` tippen: Fireball
- `Space` halten: Charged Fireball / Screen-Clear
- `Enter`: Pause

Auf Touch-Geräten erscheinen Buttons für links, rechts, springen, Stampfer und Feuer.

## Lokal starten

Direkt im Browser öffnen:

```text
Crazy-Chicken Alpha-0.1.html
```

Oder aus dem Unterordner:

```text
Crazy-Chicken-Alpha-0.1/html
```

Da ES-Module verwendet werden, funktionieren moderne Browser am zuverlässigsten. Falls ein Browser lokale Module blockiert, starte im Projektordner einen einfachen lokalen Server:

```bash
python3 -m http.server 8080
```

Dann öffnen:

```text
http://localhost:8080/Crazy-Chicken%20Alpha-0.1.html
```

## Dateistruktur

```text
code/
  html
  style.css
  game.js
  src/
    main.js
    Game.js
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
```

## Sinnvolle nächste Erweiterungen

- kleine Boss-Gegner nach bestimmten Distanzen
- eigene Level-Biome mit mehr Hindernisregeln
- Sprite-Sheets statt reinem Canvas-Zeichnen
- bessere Hitbox-Debug-Ansicht für Balancing
- Export als GitHub Pages Demo
