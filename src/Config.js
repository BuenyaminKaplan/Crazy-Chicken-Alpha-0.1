export const CONFIG = {
  canvas: { width: 960, height: 540 },
  tile: 24,
  gravity: 2350,
  groundY: 470,
  dayLength: 220,
  highscoreKey: "crazy_chicken_top3_v2",
  maxHp: 5,
  lives: 3,
  eggMax: 30,
  chargeMax: 1.15,
  difficulties: {
    easy: { label: "Leicht", enemyRate: 0.75, damage: 0.75, speed: 0.88 },
    normal: { label: "Normal", enemyRate: 1, damage: 1, speed: 1 },
    hard: { label: "Schwer", enemyRate: 1.28, damage: 1.15, speed: 1.12 }
  },
  controlsText: [
    "←/→ laufen",
    "↑ springen",
    "↓ im Sprung = Stampfer",
    "Space tippen = Fireball",
    "Space halten = Screen-Clear",
    "Enter = Pause"
  ].join(" • ")
};
