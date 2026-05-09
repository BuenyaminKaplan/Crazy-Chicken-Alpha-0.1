export class AudioBus {
  constructor(){
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.lastMaterial = 0;
    this.lastAmbient = 0;
  }

  resume(){
    if (!this.enabled) return;
    try{
      if (!this.ctx){
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.16;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    } catch {}
  }

  setEnabled(v){
    this.enabled = v;
    if (this.master) this.master.gain.value = v ? 0.16 : 0;
  }

  beep(freq=440, dur=0.06, type="sine", gain=0.08){
    if (!this.enabled || !this.ctx || this.ctx.state !== "running") return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur=0.12, gain=0.08, filterFreq=900){
    if (!this.enabled || !this.ctx || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    const size = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<size;i++) data[i] = (Math.random()*2-1) * (1 - i/size);
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    src.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  boom(base=90, dur=0.16, gain=0.14){
    this.beep(base, dur, "sawtooth", gain);
    this.noise(dur, gain * 0.65, 700);
  }

  cluck(){
    this.beep(620, 0.035, "triangle", 0.08);
    setTimeout(() => this.beep(760, 0.035, "triangle", 0.06), 45);
  }

  enemy(type){
    if (type === "cow"){
      this.beep(145, 0.10, "sawtooth", 0.06);
      setTimeout(() => this.beep(118, 0.12, "sawtooth", 0.05), 70);
    } else if (type === "crow"){
      this.beep(840, 0.045, "square", 0.045);
    } else {
      this.beep(260, 0.045, "square", 0.05);
    }
  }

  jump(power=1){
    this.beep(470 + Math.random()*80, 0.045, "sine", 0.045 * power);
    setTimeout(() => this.beep(620 + Math.random()*60, 0.035, "triangle", 0.03 * power), 35);
  }

  pickup(kind){
    if (kind === "goldEgg"){ this.beep(880, 0.08, "triangle", 0.10); setTimeout(() => this.beep(1180, 0.05, "sine", 0.05), 80); return; }
    if (kind === "chili"){ this.beep(320, 0.06, "sawtooth", 0.08); setTimeout(() => this.beep(430, 0.06, "sawtooth", 0.06), 55); return; }
    if (kind === "feather"){ this.beep(760, 0.05, "sine", 0.055); setTimeout(() => this.beep(980, 0.05, "triangle", 0.04), 60); return; }
    this.cluck();
  }

  boss(){
    this.beep(90, 0.18, "sawtooth", 0.12);
    setTimeout(() => this.beep(60, 0.22, "sawtooth", 0.10), 110);
    this.noise(0.28, 0.12, 420);
  }

  material(kind){
    if (!this.ctx || this.ctx.currentTime - this.lastMaterial < 0.035) return;
    this.lastMaterial = this.ctx.currentTime;
    if (kind === "hay") { this.noise(0.11, 0.07, 1500); this.beep(220, 0.035, "triangle", 0.035); return; }
    if (kind === "rock") { this.noise(0.14, 0.085, 520); this.boom(55, 0.08, 0.055); return; }
    if (kind === "tractor") { this.noise(0.16, 0.08, 780); this.beep(95, 0.06, "sawtooth", 0.045); return; }
    this.noise(0.10, 0.055, 1050);
  }

  ambient(weather, night){
    if (!this.enabled || !this.ctx || this.ctx.state !== "running") return;
    if (this.ctx.currentTime - this.lastAmbient < 1.8) return;
    this.lastAmbient = this.ctx.currentTime;
    if (weather === "rain") this.noise(0.45, 0.018, 2400);
    else if (weather === "wind") this.noise(0.34, 0.014, 760);
    else if (night > 0.65) {
      this.noise(0.36, 0.010, 520);
      this.beep(520 + Math.random()*90, 0.09, "sine", 0.010);
      setTimeout(() => this.beep(260 + Math.random()*70, 0.05, "triangle", 0.009), 170);
      if (Math.random() < 0.35) setTimeout(() => this.beep(1320 + Math.random()*200, 0.025, "sine", 0.008), 320);
    } else if (Math.random() < 0.28) {
      this.beep(560 + Math.random()*120, 0.025, "triangle", 0.010);
    }
  }
}
