export class Input {
  constructor(audio){
    this.audio = audio;
    this.keys = { left:false, right:false, up:false, down:false, fire:false, enter:false, escape:false };
    this.prev = { down:false, fire:false, enter:false, escape:false };
    this.bindKeyboard();
    this.bindTouch();
  }

  bindKeyboard(){
    addEventListener("keydown", e => {
      if (e.key === "ArrowLeft") this.keys.left = true;
      if (e.key === "ArrowRight") this.keys.right = true;
      if (e.key === "ArrowUp") this.keys.up = true;
      if (e.key === "ArrowDown") this.keys.down = true;
      if (e.key === " ") this.keys.fire = true;
      if (e.key === "Enter") this.keys.enter = true;
      if (e.key === "Escape") this.keys.escape = true;
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," ","Enter","Escape"].includes(e.key)){
        this.audio.resume();
        e.preventDefault();
      }
    }, { passive:false });
    addEventListener("keyup", e => {
      if (e.key === "ArrowLeft") this.keys.left = false;
      if (e.key === "ArrowRight") this.keys.right = false;
      if (e.key === "ArrowUp") this.keys.up = false;
      if (e.key === "ArrowDown") this.keys.down = false;
      if (e.key === " ") this.keys.fire = false;
      if (e.key === "Enter") this.keys.enter = false;
      if (e.key === "Escape") this.keys.escape = false;
    });
  }

  bindTouch(){
    document.querySelectorAll("[data-key]").forEach(btn => {
      const key = btn.dataset.key;
      const on = e => { e.preventDefault(); this.audio.resume(); this.keys[key] = true; };
      const off = e => { e.preventDefault(); this.keys[key] = false; };
      btn.addEventListener("pointerdown", on);
      btn.addEventListener("pointerup", off);
      btn.addEventListener("pointercancel", off);
      btn.addEventListener("pointerleave", off);
    });
  }

  pressed(key){ return this.keys[key] && !this.prev[key]; }
  released(key){ return !this.keys[key] && this.prev[key]; }
  snapshot(){ this.prev = { down:this.keys.down, fire:this.keys.fire, enter:this.keys.enter, escape:this.keys.escape }; }
}
