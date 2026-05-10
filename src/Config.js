export const CONFIG = {
  canvas: { width: 960, height: 540 },
  tile: 24,
  gravity: 2350,
  groundY: 470,
  dayLength: 220,
  highscoreKey: "crazy_chicken_top3_v2",
  statsKey: "crazy_chicken_stats_v1",
  achievementsKey: "crazy_chicken_achievements_v1",
  maxHp: 5,
  lives: 3,
  eggMax: 30,
  chargeMax: 1.15,
  merchantInteractionRadius: 112,
  hideInteractionRadius: 58,
  difficulties: {
    easy: { label: "Leicht", enemyRate: 0.75, damage: 0.75, speed: 0.88 },
    normal: { label: "Normal", enemyRate: 1, damage: 1, speed: 1 },
    hard: { label: "Schwer", enemyRate: 1.28, damage: 1.15, speed: 1.12 }
  },
  controlsText: [
    "←/→ laufen",
    "↑ springen",
    "↓ im Sprung = Stampfer",
    "↓ am Boden = Fähigkeit wechseln",
    "Space tippen = Fireball",
    "Space halten = Screen-Clear",
    "Enter = Pause",
    "H beim Händler = Handeln",
    "S beim Händler = Bett bauen/schlafen",
    "R am Mathe-Schild = Aufgabe",
    "K = Skin wechseln"
  ].join(" • ")
};

export const ACHIEVEMENTS = [
  { id:"pig50", label:"Besiege 50 Schweine", stat:"pigKills", target:50 },
  { id:"eggs200", label:"Sammle 200 Eier", stat:"eggs", target:200 },
  { id:"score5000", label:"Erreiche 5000 Punkte", stat:"bestScore", target:5000 },
  { id:"boss1", label:"Besiege einen Mini-Boss", stat:"bossKills", target:1 },
  { id:"fire100", label:"Zerstöre 100 Objekte", stat:"blocksBroken", target:100 }
];
