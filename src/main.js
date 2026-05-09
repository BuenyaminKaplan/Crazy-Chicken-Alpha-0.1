import { CONFIG } from "./Config.js";
import { Game } from "./Game.js";

const canvas = document.getElementById("c");
canvas.width = CONFIG.canvas.width;
canvas.height = CONFIG.canvas.height;

const game = new Game(canvas);
game.boot();
